#!/usr/bin/env bash
# =============================================================
#  setup.sh — Sports News API · Setup do zero
#  Uso: chmod +x setup.sh && ./setup.sh
# =============================================================

set -euo pipefail

# ─── Cores ───────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()     { echo -e "${GREEN}✅ $*${NC}"; }
info()    { echo -e "${BLUE}ℹ️  $*${NC}"; }
warn()    { echo -e "${YELLOW}⚠️  $*${NC}"; }
error()   { echo -e "${RED}❌ $*${NC}"; exit 1; }
section() { echo -e "\n${BOLD}${CYAN}━━━ $* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"; }

# ─── Banner ──────────────────────────────────────────────────
echo -e "${BOLD}${CYAN}"
cat << 'EOF'
  ____              _        _   _
 / ___| _ __   ___ | |_ ___  | \ | | _____      _____
 \___ \| '_ \ / _ \| __/ __| |  \| |/ _ \ \ /\ / / __|
  ___) | |_) | (_) | |_\__ \ | |\  |  __/\ V  V /\__ \
 |____/| .__/ \___/ \__|___/ |_| \_|\___| \_/\_/ |___/
        |_|              API  —  Setup Script
EOF
echo -e "${NC}"

# ═══════════════════════════════════════════════════════════════
# 1. PRÉ-REQUISITOS
# ═══════════════════════════════════════════════════════════════
section "Verificando pré-requisitos"

# Node.js ≥ 18
if ! command -v node &>/dev/null; then
  error "Node.js não encontrado. Instale em https://nodejs.org (v18+)"
fi
NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  error "Node.js v18+ necessário. Versão atual: $(node -v)"
fi
log "Node.js $(node -v)"

# npm
command -v npm &>/dev/null || error "npm não encontrado."
log "npm $(npm -v)"

# Docker
if ! command -v docker &>/dev/null; then
  warn "Docker não encontrado — necessário para banco de dados local."
  warn "Instale em https://docs.docker.com/get-docker/ ou configure DATABASE_URL manualmente."
  DOCKER_AVAILABLE=false
else
  log "Docker $(docker --version | awk '{print $3}' | tr -d ',')"
  DOCKER_AVAILABLE=true
fi

# Docker Compose (plugin v2 ou standalone)
if $DOCKER_AVAILABLE; then
  if docker compose version &>/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
    log "Docker Compose (plugin) $(docker compose version --short)"
  elif command -v docker-compose &>/dev/null; then
    COMPOSE_CMD="docker-compose"
    log "docker-compose $(docker-compose --version | awk '{print $3}' | tr -d ',')"
  else
    warn "Docker Compose não encontrado. Banco será configurado manualmente."
    DOCKER_AVAILABLE=false
  fi
fi

# ═══════════════════════════════════════════════════════════════
# 2. CONFIGURAÇÃO DO .env
# ═══════════════════════════════════════════════════════════════
section "Configurando variáveis de ambiente"

if [ -f ".env" ]; then
  warn ".env já existe. Deseja sobrescrever? (s/N)"
  read -r OVERWRITE
  if [[ "$OVERWRITE" =~ ^[sS]$ ]]; then
    cp .env ".env.backup.$(date +%Y%m%d_%H%M%S)"
    info "Backup salvo."
    CREATE_ENV=true
  else
    info "Mantendo .env existente."
    CREATE_ENV=false
  fi
else
  CREATE_ENV=true
fi

if $CREATE_ENV; then
  echo ""
  info "Vamos configurar o .env. Pressione Enter para usar o valor padrão."
  echo ""

  # Port
  read -rp "  Porta da API [3000]: " PORT_INPUT
  APP_PORT="${PORT_INPUT:-3000}"

  # DB
  read -rp "  Usuário do PostgreSQL [postgres]: " DB_USER_INPUT
  DB_USER="${DB_USER_INPUT:-postgres}"

  read -rsp "  Senha do PostgreSQL [postgres]: " DB_PASS_INPUT
  echo ""
  DB_PASS="${DB_PASS_INPUT:-postgres}"

  read -rp "  Nome do banco [sports_news]: " DB_NAME_INPUT
  DB_NAME="${DB_NAME_INPUT:-sports_news}"

  read -rp "  Porta do PostgreSQL [5432]: " DB_PORT_INPUT
  DB_PORT="${DB_PORT_INPUT:-5432}"

  # JWT
  JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))" 2>/dev/null \
    || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)

  # Admin seed
  read -rp "  E-mail do admin [admin@portal.com.br]: " ADMIN_EMAIL_INPUT
  ADMIN_EMAIL="${ADMIN_EMAIL_INPUT:-admin@portal.com.br}"

  read -rsp "  Senha do admin [Admin@123456]: " ADMIN_PASS_INPUT
  echo ""
  ADMIN_PASS="${ADMIN_PASS_INPUT:-Admin@123456}"

  read -rp "  Nome do admin [Administrador]: " ADMIN_NAME_INPUT
  ADMIN_NAME="${ADMIN_NAME_INPUT:-Administrador}"

  # Cloudinary
  echo ""
  info "Cloudinary (upload de imagens) — deixe em branco para preencher depois"
  read -rp "  CLOUDINARY_CLOUD_NAME: " CL_CLOUD
  read -rp "  CLOUDINARY_API_KEY: " CL_KEY
  read -rsp "  CLOUDINARY_API_SECRET: " CL_SECRET
  echo ""

  # Football-data
  echo ""
  info "football-data.org (placares ao vivo) — deixe em branco para preencher depois"
  read -rp "  FOOTBALL_DATA_API_KEY: " FD_KEY

  # CORS
  read -rp "  Origens CORS permitidas [http://localhost:3000,http://localhost:3001]: " CORS_INPUT
  CORS_ORIGINS="${CORS_INPUT:-http://localhost:3000,http://localhost:3001}"

  cat > .env << EOF
# ==============================================
# AMBIENTE
# ==============================================
NODE_ENV=development
PORT=${APP_PORT}

# ==============================================
# BANCO DE DADOS
# ==============================================
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:${DB_PORT}/${DB_NAME}"

POSTGRES_USER=${DB_USER}
POSTGRES_PASSWORD=${DB_PASS}
POSTGRES_DB=${DB_NAME}

# ==============================================
# JWT
# ==============================================
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# ==============================================
# CLOUDINARY
# ==============================================
CLOUDINARY_CLOUD_NAME=${CL_CLOUD:-seu_cloud_name}
CLOUDINARY_API_KEY=${CL_KEY:-sua_api_key}
CLOUDINARY_API_SECRET=${CL_SECRET:-seu_api_secret}
CLOUDINARY_FOLDER=sports-news

# ==============================================
# CORS
# ==============================================
ALLOWED_ORIGINS=${CORS_ORIGINS}

# ==============================================
# ADMIN INICIAL (seed)
# ==============================================
SEED_ADMIN_EMAIL=${ADMIN_EMAIL}
SEED_ADMIN_PASSWORD=${ADMIN_PASS}
SEED_ADMIN_NAME=${ADMIN_NAME}

# ==============================================
# PLACAR AO VIVO
# ==============================================
FOOTBALL_DATA_API_KEY=${FD_KEY:-sua_chave_aqui}
EOF

  log ".env criado com sucesso."
fi

# Exporta variáveis do .env para uso no script
set -a
# shellcheck disable=SC1091
source .env
set +a

# ═══════════════════════════════════════════════════════════════
# 3. DEPENDÊNCIAS
# ═══════════════════════════════════════════════════════════════
section "Instalando dependências npm"

if [ -d "node_modules" ]; then
  warn "node_modules já existe. Reinstalando..."
fi
npm install
log "Dependências instaladas."

# ═══════════════════════════════════════════════════════════════
# 4. BANCO DE DADOS
# ═══════════════════════════════════════════════════════════════
section "Banco de dados"

if $DOCKER_AVAILABLE; then
  info "Iniciando PostgreSQL via Docker..."

  # Para containers existentes (evita conflito)
  $COMPOSE_CMD -f docker-compose.dev.yml down --remove-orphans 2>/dev/null || true

  # Sobe apenas o postgres
  $COMPOSE_CMD -f docker-compose.dev.yml up -d postgres

  # Aguarda healthcheck
  info "Aguardando PostgreSQL ficar pronto..."
  MAX_WAIT=60
  WAITED=0
  until $COMPOSE_CMD -f docker-compose.dev.yml exec -T postgres \
      pg_isready -U "${POSTGRES_USER:-postgres}" &>/dev/null; do
    sleep 2
    WAITED=$((WAITED + 2))
    if [ "$WAITED" -ge "$MAX_WAIT" ]; then
      error "PostgreSQL não ficou pronto em ${MAX_WAIT}s. Verifique os logs: $COMPOSE_CMD logs postgres"
    fi
    echo -n "."
  done
  echo ""
  log "PostgreSQL pronto."
else
  warn "Docker indisponível. Certifique-se de que o PostgreSQL está rodando e DATABASE_URL está correta."
  info "DATABASE_URL atual: ${DATABASE_URL}"
  read -rp "  Continuar mesmo assim? (s/N): " CONTINUE
  [[ "$CONTINUE" =~ ^[sS]$ ]] || exit 0
fi

# ═══════════════════════════════════════════════════════════════
# 5. PRISMA
# ═══════════════════════════════════════════════════════════════
section "Prisma — geração e migrações"

info "Gerando Prisma Client..."
npx prisma generate
log "Prisma Client gerado."

info "Rodando migrações..."
npx prisma migrate dev --name init
log "Migrações aplicadas."

# ═══════════════════════════════════════════════════════════════
# 6. SEED
# ═══════════════════════════════════════════════════════════════
section "Seed inicial"

info "Populando banco com dados iniciais..."
npm run db:seed
log "Seed concluído."

# ═══════════════════════════════════════════════════════════════
# 7. BUILD (opcional)
# ═══════════════════════════════════════════════════════════════
section "Build TypeScript"

read -rp "  Deseja fazer o build agora? (s/N): " DO_BUILD
if [[ "$DO_BUILD" =~ ^[sS]$ ]]; then
  npm run build
  log "Build concluído → ./dist"
else
  info "Pulando build. Em dev, use: npm run dev"
fi

# ═══════════════════════════════════════════════════════════════
# 8. RESUMO FINAL
# ═══════════════════════════════════════════════════════════════
section "Tudo pronto! 🎉"

APP_PORT_FINAL="${PORT:-3000}"
ADMIN_EMAIL_FINAL="${SEED_ADMIN_EMAIL:-admin@portal.com.br}"
ADMIN_PASS_FINAL="${SEED_ADMIN_PASSWORD:-Admin@123456}"

echo -e "${BOLD}Credenciais de acesso:${NC}"
echo -e "  ${CYAN}E-mail : ${ADMIN_EMAIL_FINAL}${NC}"
echo -e "  ${CYAN}Senha  : ${ADMIN_PASS_FINAL}${NC}"
echo ""
echo -e "${BOLD}Comandos úteis:${NC}"
echo -e "  ${GREEN}npm run dev${NC}              → API em modo desenvolvimento (hot reload)"
echo -e "  ${GREEN}npm start${NC}                → API em produção (requer build)"
echo -e "  ${GREEN}npm run build${NC}            → Compila TypeScript → dist/"
echo -e "  ${GREEN}npm run db:seed${NC}          → Reexecuta o seed"
echo -e "  ${GREEN}npm run db:studio${NC}        → Abre o Prisma Studio (GUI do banco)"
echo -e "  ${GREEN}npm run db:migrate${NC}       → Cria e aplica novas migrations"
if $DOCKER_AVAILABLE; then
  echo -e "  ${GREEN}$COMPOSE_CMD -f docker-compose.dev.yml up -d${NC}   → Sobe Postgres"
  echo -e "  ${GREEN}$COMPOSE_CMD -f docker-compose.dev.yml down${NC}     → Para Postgres"
fi
echo ""
echo -e "${BOLD}Endpoints:${NC}"
echo -e "  ${CYAN}http://localhost:${APP_PORT_FINAL}/api/health${NC}      → Health check"
echo -e "  ${CYAN}http://localhost:${APP_PORT_FINAL}/api/auth/login${NC}  → Login"
echo -e "  ${CYAN}http://localhost:${APP_PORT_FINAL}/api/articles${NC}    → Artigos públicos"
echo ""
echo -e "${BOLD}Para iniciar agora:${NC}"
echo -e "  ${YELLOW}npm run dev${NC}"
echo ""
EOF
