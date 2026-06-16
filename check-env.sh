#!/usr/bin/env bash
# =============================================================
#  check-env.sh — Diagnóstico de conflitos Docker / portas
#  Uso: chmod +x check-env.sh && ./check-env.sh
# =============================================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()   { echo -e "  ${GREEN}✅ $*${NC}"; }
warn() { echo -e "  ${YELLOW}⚠️  $*${NC}"; }
err()  { echo -e "  ${RED}❌ $*${NC}"; }
info() { echo -e "  ${BLUE}ℹ️  $*${NC}"; }
section() { echo -e "\n${BOLD}${CYAN}━━━ $* ${NC}\n"; }

echo -e "${BOLD}${CYAN}"
echo "  ╔══════════════════════════════════════╗"
echo "  ║   Sports News — Diagnóstico Docker   ║"
echo "  ╚══════════════════════════════════════╝"
echo -e "${NC}"

# ─── Lê o .env se existir ─────────────────────────────────────
ENV_PORT=3000
ENV_DB_PORT=5432
ENV_DB_NAME="sports_news"
ENV_DB_USER="postgres"

if [ -f ".env" ]; then
  ok ".env encontrado"
  ENV_PORT=$(grep -E '^PORT=' .env | cut -d= -f2 | tr -d '"' || echo 3000)
  ENV_DB_URL=$(grep -E '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"' || echo "")
  # Extrai porta do DATABASE_URL (ex: @localhost:5439/...)
  ENV_DB_PORT=$(echo "$ENV_DB_URL" | grep -oE ':[0-9]+/' | tr -d ':/' | head -1)
  ENV_DB_PORT="${ENV_DB_PORT:-5432}"
  ENV_DB_NAME=$(echo "$ENV_DB_URL" | grep -oE '/[^/]+$' | tr -d '/' | head -1)
  ENV_DB_NAME="${ENV_DB_NAME:-sports_news}"
  info "API porta  : ${ENV_PORT}"
  info "DB porta   : ${ENV_DB_PORT}"
  info "DB nome    : ${ENV_DB_NAME}"
else
  warn ".env não encontrado — usando valores padrão (3000 / 5432)"
fi

# ═══════════════════════════════════════════════════════════════
section "1. Docker"
# ═══════════════════════════════════════════════════════════════

if ! command -v docker &>/dev/null; then
  err "Docker não instalado."
else
  ok "Docker $(docker --version | awk '{print $3}' | tr -d ',')"

  if ! docker info &>/dev/null 2>&1; then
    err "Docker instalado mas não está rodando. Inicie o Docker Desktop."
  else
    ok "Docker daemon rodando"
  fi

  # Docker Compose
  if docker compose version &>/dev/null 2>&1; then
    ok "Docker Compose plugin $(docker compose version --short)"
    COMPOSE_CMD="docker compose"
  elif command -v docker-compose &>/dev/null; then
    ok "docker-compose standalone $(docker-compose --version | awk '{print $3}' | tr -d ',')"
    COMPOSE_CMD="docker-compose"
  else
    err "Docker Compose não encontrado."
  fi
fi

# ═══════════════════════════════════════════════════════════════
section "2. Containers rodando"
# ═══════════════════════════════════════════════════════════════

if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
  CONTAINERS=$(docker ps --format "{{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}" 2>/dev/null)
  if [ -z "$CONTAINERS" ]; then
    info "Nenhum container rodando."
  else
    echo -e "  ${BOLD}NOME\t\t\tIMAGEM\t\t\tPORTAS${NC}"
    echo "  ──────────────────────────────────────────────────────────────────"
    while IFS=$'\t' read -r name image ports status; do
      echo -e "  ${CYAN}${name}${NC}\t${image}\t${ports}"
    done <<< "$CONTAINERS"
  fi

  # Projetos compose ativos
  echo ""
  if docker compose ls &>/dev/null 2>&1; then
    PROJECTS=$(docker compose ls --format json 2>/dev/null | \
      python3 -c "import sys,json; [print(f\"  {p['Name']} — {p['Status']}\") for p in json.load(sys.stdin)]" 2>/dev/null || \
      docker compose ls 2>/dev/null | tail -n +2)
    if [ -n "$PROJECTS" ]; then
      info "Projetos Docker Compose ativos:"
      echo "$PROJECTS" | while read -r line; do echo "    $line"; done
    fi
  fi
fi

# ═══════════════════════════════════════════════════════════════
section "3. Conflitos de porta"
# ═══════════════════════════════════════════════════════════════

check_port() {
  local port=$1
  local label=$2
  local process

  # lsof (macOS / Linux)
  if command -v lsof &>/dev/null; then
    process=$(lsof -i :"$port" -sTCP:LISTEN 2>/dev/null | awk 'NR>1 {print $1" (PID "$2")"}' | head -1)
  # ss (Linux alternativo)
  elif command -v ss &>/dev/null; then
    process=$(ss -tlnp 2>/dev/null | grep ":$port " | awk '{print $6}' | head -1)
  # netstat
  elif command -v netstat &>/dev/null; then
    process=$(netstat -tlnp 2>/dev/null | grep ":$port " | awk '{print $7}' | head -1)
  fi

  if [ -n "$process" ]; then
    err "Porta ${port} (${label}) OCUPADA por: ${process}"
    return 1
  else
    ok "Porta ${port} (${label}) livre"
    return 0
  fi
}

API_OK=true
DB_OK=true

check_port "$ENV_PORT"    "API"      || API_OK=false
check_port "$ENV_DB_PORT" "Postgres" || DB_OK=false

# Verifica portas comuns de outros projetos que podem colidir
for extra_port in 5432 5433 5434 5435 5436 5437 5438 5439 5440; do
  if [ "$extra_port" != "$ENV_DB_PORT" ]; then
    if command -v lsof &>/dev/null; then
      proc=$(lsof -i :"$extra_port" -sTCP:LISTEN 2>/dev/null | awk 'NR>1 {print $1}' | head -1)
      [ -n "$proc" ] && info "Porta ${extra_port} em uso por: ${proc} (pode ser outro projeto)"
    fi
  fi
done

# ═══════════════════════════════════════════════════════════════
section "4. Volumes existentes"
# ═══════════════════════════════════════════════════════════════

if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
  VOLUMES=$(docker volume ls --format "{{.Name}}" 2>/dev/null | grep -i "sports\|postgres\|news" || true)
  if [ -n "$VOLUMES" ]; then
    warn "Volumes relacionados ao projeto encontrados:"
    echo "$VOLUMES" | while read -r v; do echo "    • $v"; done
    warn "Se quiser resetar o banco: docker volume rm <nome_do_volume>"
  else
    info "Nenhum volume deste projeto encontrado (banco será criado do zero)."
  fi

  # Todos os volumes postgres
  ALL_PG=$(docker volume ls --format "{{.Name}}" 2>/dev/null | grep -i "postgres\|pg_\|_db" || true)
  if [ -n "$ALL_PG" ]; then
    info "Outros volumes Postgres no sistema:"
    echo "$ALL_PG" | while read -r v; do echo "    • $v"; done
  fi
fi

# ═══════════════════════════════════════════════════════════════
section "5. docker-compose.dev.yml vs .env"
# ═══════════════════════════════════════════════════════════════

if [ -f "docker-compose.dev.yml" ]; then
  COMPOSE_DB_PORT=$(grep -E '^\s+-\s+"?[0-9]+:5432"?' docker-compose.dev.yml \
    | grep -oE '[0-9]+:5432' | cut -d: -f1 | head -1)
  COMPOSE_API_PORT=$(grep -E '^\s+-\s+"?\$\{PORT' docker-compose.dev.yml | head -1)

  ok "docker-compose.dev.yml encontrado"
  info "Porta mapeada para Postgres no compose: ${COMPOSE_DB_PORT:-não detectada}"

  if [ -n "$COMPOSE_DB_PORT" ] && [ "$COMPOSE_DB_PORT" != "$ENV_DB_PORT" ]; then
    err "CONFLITO: docker-compose.dev.yml mapeia Postgres para :${COMPOSE_DB_PORT}"
    err "          mas DATABASE_URL no .env usa :${ENV_DB_PORT}"
    echo ""
    echo -e "  ${YELLOW}Correção — altere no docker-compose.dev.yml:${NC}"
    echo -e "  ${CYAN}    ports:"
    echo -e "        - \"${ENV_DB_PORT}:5432\"   # ← era ${COMPOSE_DB_PORT}:5432${NC}"
  else
    ok "Porta do compose (${COMPOSE_DB_PORT}) bate com o DATABASE_URL (:${ENV_DB_PORT})"
  fi
else
  warn "docker-compose.dev.yml não encontrado."
fi

# ═══════════════════════════════════════════════════════════════
section "Resumo e próximos passos"
# ═══════════════════════════════════════════════════════════════

PROBLEMS=0
$API_OK || { err "Resolva o conflito na porta ${ENV_PORT} antes de subir a API."; PROBLEMS=$((PROBLEMS+1)); }
$DB_OK  || { err "Resolva o conflito na porta ${ENV_DB_PORT} antes de subir o Postgres."; PROBLEMS=$((PROBLEMS+1)); }

if [ $PROBLEMS -eq 0 ]; then
  echo -e "  ${GREEN}${BOLD}Tudo OK! Sem conflitos detectados.${NC}"
  echo ""
  echo -e "  Pode rodar com segurança:"
  echo -e "  ${CYAN}  ./setup.sh${NC}"
else
  echo ""
  echo -e "  ${YELLOW}Dicas para liberar uma porta ocupada:${NC}"
  echo -e "  ${CYAN}  lsof -i :<porta>${NC}              → descobre o processo"
  echo -e "  ${CYAN}  kill -9 <PID>${NC}                 → mata o processo"
  echo -e "  ${CYAN}  docker stop <container>${NC}        → para um container específico"
  echo -e "  ${CYAN}  docker compose down${NC}            → para todos do projeto atual"
fi

echo ""
