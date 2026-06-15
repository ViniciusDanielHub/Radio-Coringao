// src/server.ts
import 'dotenv/config';
import { buildApp } from './app';

const PORT = Number(process.env.PORT) || 3000;

async function main() {
  const app = await buildApp();

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`\n🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🏠 Health: http://localhost:${PORT}/api/health\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
