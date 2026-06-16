// src/shared/env-check.ts
// Executa na inicialização do servidor e falha rápido se variáveis críticas faltarem.

interface EnvVar {
  key: string;
  required: boolean;
  hint?: string;
}

const ENV_VARS: EnvVar[] = [
  { key: 'DATABASE_URL',           required: true,  hint: 'postgresql://user:pass@host:port/db' },
  { key: 'JWT_SECRET',             required: true,  hint: 'String aleatória longa (min 32 chars)' },
  { key: 'CLOUDINARY_CLOUD_NAME',  required: true,  hint: 'Encontre em cloudinary.com/console' },
  { key: 'CLOUDINARY_API_KEY',     required: true,  hint: 'Encontre em cloudinary.com/console' },
  { key: 'CLOUDINARY_API_SECRET',  required: true,  hint: 'Encontre em cloudinary.com/console' },
  { key: 'FOOTBALL_DATA_API_KEY',  required: false, hint: 'Opcional — placar ao vivo (football-data.org)' },
  { key: 'PORT',                   required: false, hint: 'Padrão: 3000' },
  { key: 'ALLOWED_ORIGINS',        required: false, hint: 'Ex: http://localhost:3000' },
  { key: 'NODE_ENV',               required: false, hint: 'development | production | test' },
];

export function checkEnv(): void {
  const missing: EnvVar[] = [];
  const warnings: EnvVar[] = [];

  for (const envVar of ENV_VARS) {
    const value = process.env[envVar.key];
    const isEmpty = !value || value.trim() === '';
    const isPlaceholder = value === 'sua_chave_aqui' ||
                          value === 'seu_cloud_name' ||
                          value === 'sua_api_key' ||
                          value === 'seu_api_secret' ||
                          value === 'troque_essa_senha' ||
                          value === 'sports_news_jwt_secret_troque_em_producao';

    if (isEmpty && envVar.required) {
      missing.push(envVar);
    } else if (isPlaceholder && envVar.required) {
      warnings.push(envVar);
    }
  }

  // JWT fraco em produção
  const jwtSecret = process.env.JWT_SECRET ?? '';
  if (process.env.NODE_ENV === 'production' && jwtSecret.length < 32) {
    console.warn('⚠️  [ENV] JWT_SECRET muito curto para produção. Use pelo menos 32 caracteres.');
  }

  if (missing.length > 0) {
    console.error('\n❌ [ENV] Variáveis de ambiente obrigatórias não configuradas:\n');
    for (const v of missing) {
      console.error(`   • ${v.key}`);
      if (v.hint) console.error(`     → ${v.hint}`);
    }
    console.error('\n   Configure-as no arquivo .env e reinicie o servidor.\n');
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn('\n⚠️  [ENV] Variáveis ainda com valores padrão (altere antes de ir para produção):\n');
    for (const v of warnings) {
      console.warn(`   • ${v.key}`);
    }
    console.warn('');
  }

  if (process.env.NODE_ENV !== 'test') {
    console.log('✅ [ENV] Todas as variáveis obrigatórias configuradas.\n');
  }
}
