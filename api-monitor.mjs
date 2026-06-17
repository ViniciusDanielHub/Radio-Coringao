#!/usr/bin/env node
// api-monitor.mjs — Monitor de rotas da sports-news API
// Uso: node api-monitor.mjs [base-url] [jwt-token]
// Ex:  node api-monitor.mjs http://localhost:3007 eyJhbGci...

const BASE_URL = process.argv[2]?.replace(/\/$/, '') || 'http://localhost:3007';
const JWT      = process.argv[3] || '';

// ── Cores ANSI ────────────────────────────────────────────────
const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  cyan:   '\x1b[36m',
  gray:   '\x1b[90m',
  white:  '\x1b[97m',
  bgGreen:  '\x1b[42m',
  bgRed:    '\x1b[41m',
  bgYellow: '\x1b[43m',
};

const ok   = `${c.green}✓${c.reset}`;
const fail = `${c.red}✗${c.reset}`;
const skip = `${c.gray}–${c.reset}`;
const wait = `${c.yellow}?${c.reset}`;

// ── Rotas ─────────────────────────────────────────────────────
const ROUTES = [
  // Sistema
  { method:'GET',  path:'/api/health',                           group:'Sistema',           auth:false, note:'Health check' },

  // Auth
  { method:'POST', path:'/api/auth/login',                       group:'Autenticação',      auth:false, note:'Login',
    body:{ email:'admin@seusite.com.br', password:'troque_essa_senha' } },
  { method:'POST', path:'/api/auth/refresh',                     group:'Autenticação',      auth:false, note:'Refresh token',
    body:{ refreshToken:'placeholder' }, expectCodes:[400,401,422] },
  { method:'GET',  path:'/api/auth/me',                          group:'Autenticação',      auth:true,  note:'Usuário autenticado' },

  // Artigos públicos
  { method:'GET',  path:'/api/articles',                         group:'Artigos públicos',  auth:false, note:'Listar artigos' },
  { method:'GET',  path:'/api/articles/search?q=futebol',        group:'Artigos públicos',  auth:false, note:'Busca pública' },
  { method:'GET',  path:'/api/articles/trending',                group:'Artigos públicos',  auth:false, note:'Artigos em alta' },
  { method:'GET',  path:'/api/articles/slug-que-nao-existe',     group:'Artigos públicos',  auth:false, note:'Por slug — 404 esperado', expectCodes:[404] },

  // Categorias / Tags / Banners / Menu / Settings
  { method:'GET',  path:'/api/categories',                       group:'Público',           auth:false, note:'Categorias' },
  { method:'GET',  path:'/api/tags',                             group:'Público',           auth:false, note:'Tags' },
  { method:'GET',  path:'/api/banners',                          group:'Público',           auth:false, note:'Banners ativos' },
  { method:'GET',  path:'/api/menu',                             group:'Público',           auth:false, note:'Menu de navegação' },
  { method:'GET',  path:'/api/settings',                         group:'Público',           auth:false, note:'Configurações do site' },

  // Live Scores
  { method:'GET',  path:'/api/live-scores/matches',              group:'Live Scores',       auth:false, note:'Partidas BSA' },
  { method:'GET',  path:'/api/live-scores/standings',            group:'Live Scores',       auth:false, note:'Tabela BSA' },
  { method:'GET',  path:'/api/live-scores/scorers',              group:'Live Scores',       auth:false, note:'Artilheiros' },
  { method:'GET',  path:'/api/live-scores/competition',          group:'Live Scores',       auth:false, note:'Info da competição' },
  { method:'GET',  path:'/api/live-scores/corinthians',          group:'Live Scores',       auth:false, note:'Widget Corinthians' },
  { method:'GET',  path:'/api/live-scores/teams/1782/matches',   group:'Live Scores',       auth:false, note:'Partidas do Corinthians' },
  { method:'GET',  path:'/api/live-scores/teams/1782/squad',     group:'Live Scores',       auth:false, note:'Elenco do Corinthians' },

  // Admin
  { method:'GET',  path:'/api/admin/dashboard',                  group:'Admin',             auth:true,  note:'Stats do dashboard' },
  { method:'GET',  path:'/api/admin/articles',                   group:'Admin',             auth:true,  note:'Listar artigos' },
  { method:'GET',  path:'/api/admin/articles/search?q=teste',    group:'Admin',             auth:true,  note:'Buscar artigos' },
  { method:'GET',  path:'/api/admin/categories',                 group:'Admin',             auth:true,  note:'Listar categorias' },
  { method:'GET',  path:'/api/admin/banners',                    group:'Admin',             auth:true,  note:'Listar banners' },
  { method:'GET',  path:'/api/admin/menu',                       group:'Admin',             auth:true,  note:'Listar menu' },
  { method:'GET',  path:'/api/admin/tags',                       group:'Admin',             auth:true,  note:'Listar tags' },
  { method:'GET',  path:'/api/admin/users',                      group:'Admin',             auth:true,  note:'Listar usuários (SUPER_ADMIN)' },
];

// ── Helpers ───────────────────────────────────────────────────
function pad(str, len) {
  return String(str).padEnd(len).slice(0, len);
}

function colorMethod(m) {
  const map = { GET: c.green, POST: c.blue, PATCH: c.yellow, DELETE: c.red };
  return `${c.bold}${map[m] || c.white}${pad(m, 6)}${c.reset}`;
}

function colorStatus(code) {
  if (code >= 200 && code < 300) return `${c.green}${code}${c.reset}`;
  if (code >= 400 && code < 500) return `${c.yellow}${code}${c.reset}`;
  return `${c.red}${code}${c.reset}`;
}

function line(char = '─', len = 72) {
  return c.gray + char.repeat(len) + c.reset;
}

// ── Executor de rota ──────────────────────────────────────────
async function checkRoute(route) {
  if (route.auth && !JWT) {
    return { status: 'skip', note: 'sem token JWT' };
  }

  const url = BASE_URL + route.path;
  const headers = { 'Content-Type': 'application/json' };
  if (JWT) headers['Authorization'] = JWT.startsWith('Bearer ') ? JWT : 'Bearer ' + JWT;

  const opts = { method: route.method, headers };
  if (route.body) opts.body = JSON.stringify(route.body);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  opts.signal = controller.signal;

  const t0 = Date.now();
  try {
    const res = await fetch(url, opts);
    clearTimeout(timeout);
    const latency = Date.now() - t0;
    const code = res.status;

    let body = null;
    try { body = await res.json(); } catch {}

    const expected = route.expectCodes || [200, 201];
    const isOk = expected.includes(code) ||
                 (code >= 200 && code < 300 && !route.expectCodes);

    return { status: isOk ? 'ok' : 'fail', code, latency, body };
  } catch (e) {
    clearTimeout(timeout);
    const latency = Date.now() - t0;
    const msg = e.name === 'AbortError' ? 'timeout (8s)' : e.message;
    return { status: 'fail', code: 'ERR', latency, error: msg };
  }
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log(`${c.bold}${c.cyan}  sports-news API Monitor${c.reset}`);
  console.log(`  Base URL : ${c.white}${BASE_URL}${c.reset}`);
  console.log(`  Token    : ${JWT ? `${c.green}configurado${c.reset}` : `${c.yellow}não informado — rotas admin serão puladas${c.reset}`}`);
  console.log(`  Rotas    : ${c.white}${ROUTES.length}${c.reset}`);
  console.log('');

  let lastGroup = '';
  const results = [];
  let countOk = 0, countFail = 0, countSkip = 0;
  const latencies = [];

  for (const route of ROUTES) {
    if (route.group !== lastGroup) {
      console.log(line());
      console.log(`  ${c.bold}${c.dim}${route.group}${c.reset}`);
      lastGroup = route.group;
    }

    const result = await checkRoute(route);
    results.push({ route, result });

    if (result.status === 'ok')   { countOk++;   latencies.push(result.latency); }
    if (result.status === 'fail') { countFail++;  latencies.push(result.latency); }
    if (result.status === 'skip') countSkip++;

    const icon    = result.status === 'ok' ? ok : result.status === 'skip' ? skip : fail;
    const method  = colorMethod(route.method);
    const path    = `${c.white}${pad(route.path, 44)}${c.reset}`;
    const code    = result.status === 'skip'
                    ? `${c.gray}pulada${c.reset}      `
                    : result.status === 'fail' && result.error
                    ? `${c.red}${pad(result.error, 12)}${c.reset}`
                    : colorStatus(result.code) + '         ';
    const ms      = result.latency != null
                    ? `${c.gray}${result.latency}ms${c.reset}`
                    : '';

    console.log(`  ${icon}  ${method}  ${path}  ${code}  ${ms}`);

    // Detalhe de erro
    if (result.status === 'fail' && result.body) {
      const msg = result.body.error || result.body.message || JSON.stringify(result.body).slice(0, 80);
      console.log(`     ${c.gray}└─ ${msg}${c.reset}`);
    }
  }

  // ── Resumo ────────────────────────────────────────────────
  console.log(line('═'));
  const avg = latencies.length
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : 0;

  const totalTested = countOk + countFail;
  const pct = totalTested > 0 ? Math.round((countOk / totalTested) * 100) : 0;

  console.log('');
  console.log(`  ${c.bold}Resultado:${c.reset}`);
  console.log(`  ${c.green}✓ OK       ${countOk}${c.reset}`);
  console.log(`  ${c.red}✗ Falhas   ${countFail}${c.reset}`);
  console.log(`  ${c.gray}– Puladas  ${countSkip}${c.reset}`);
  console.log(`  ${c.cyan}⌀ Latência ${avg}ms${c.reset}`);
  console.log(`  ${c.bold}  Taxa OK  ${pct}%${c.reset}`);
  console.log('');

  // ── Falhas detalhadas ─────────────────────────────────────
  const failures = results.filter(r => r.result.status === 'fail');
  if (failures.length > 0) {
    console.log(`  ${c.bold}${c.red}Falhas:${c.reset}`);
    failures.forEach(({ route, result }) => {
      console.log(`  ${c.red}✗${c.reset} ${route.method} ${route.path}`);
      if (result.error) console.log(`    ${c.gray}└─ ${result.error}${c.reset}`);
      else if (result.body?.error) console.log(`    ${c.gray}└─ ${result.body.error}${c.reset}`);
      else console.log(`    ${c.gray}└─ HTTP ${result.code}${c.reset}`);
    });
    console.log('');
  }

  // ── CSV ───────────────────────────────────────────────────
  const csvPath = './api-monitor-result.csv';
  const csvLines = ['metodo,rota,grupo,auth,status,http,latencia_ms,nota'];
  results.forEach(({ route, result }) => {
    csvLines.push([
      route.method,
      route.path,
      route.group,
      route.auth ? 'sim' : 'nao',
      result.status,
      result.code || '',
      result.latency || '',
      route.note || '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  });

  const { writeFileSync } = await import('fs');
  writeFileSync(csvPath, csvLines.join('\n'), 'utf8');
  console.log(`  ${c.dim}Relatório salvo em ${csvPath}${c.reset}`);
  console.log('');

  process.exit(countFail > 0 ? 1 : 0);
}

main().catch(e => {
  console.error(`\n${c.red}Erro fatal:${c.reset}`, e.message);
  process.exit(1);
});
