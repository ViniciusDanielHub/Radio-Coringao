// prisma/seed.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...\n');

  // ─── SUPER_ADMIN ──────────────────────────────────────────────
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@portal.com';
  const password = process.env.SEED_ADMIN_PASSWORD || 'Admin@123456';
  const name = process.env.SEED_ADMIN_NAME || 'Super Admin';

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log(`⚠️  Usuário já existe: ${email} — pulando criação.`);
  } else {
    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        role: 'SUPER_ADMIN',
        position: 'Administrador',
        isActive: true,
      },
    });
    console.log(`✅ SUPER_ADMIN criado:`);
    console.log(`   Nome  : ${user.name}`);
    console.log(`   E-mail: ${user.email}`);
    console.log(`   Senha : ${password}`);
    console.log(`   Role  : ${user.role}\n`);
  }

  // ─── Configurações iniciais do site ───────────────────────────
  const settings = await prisma.siteSettings.findUnique({ where: { id: 'main' } });

  if (!settings) {
    await prisma.siteSettings.create({
      data: {
        id: 'main',
        siteName: 'Portal Esportivo',
        siteDescription: 'Notícias esportivas em tempo real',
        primaryColor: '#E63946',
      },
    });
    console.log('✅ Configurações iniciais do site criadas.');
  } else {
    console.log('⚠️  Configurações do site já existem — pulando.');
  }

  // ─── Categorias padrão ────────────────────────────────────────
  const defaultCategories = [
    { name: 'Futebol', slug: 'futebol', color: '#1DB954', icon: 'football', order: 1 },
    { name: 'Basquete', slug: 'basquete', color: '#E63946', icon: 'basketball', order: 2 },
    { name: 'Tênis', slug: 'tenis', color: '#F4A261', icon: 'tennis', order: 3 },
    { name: 'MMA', slug: 'mma', color: '#9B2335', icon: 'mma', order: 4 },
    { name: 'Natação', slug: 'natacao', color: '#2196F3', icon: 'swimming', order: 5 },
    { name: 'Automobilismo', slug: 'automobilismo', color: '#FF5722', icon: 'racing', order: 6 },
  ];

  let categoriesCreated = 0;
  for (const cat of defaultCategories) {
    const exists = await prisma.category.findUnique({ where: { slug: cat.slug } });
    if (!exists) {
      await prisma.category.create({ data: { ...cat, isActive: true } });
      categoriesCreated++;
    }
  }

  if (categoriesCreated > 0) {
    console.log(`✅ ${categoriesCreated} categorias criadas.`);
  } else {
    console.log('⚠️  Categorias já existem — pulando.');
  }

  console.log('\n🎉 Seed concluído com sucesso!');
  console.log('━'.repeat(50));
  console.log(`🔑 Login: ${email}`);
  console.log(`🔑 Senha: ${password}`);
  console.log('━'.repeat(50));
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });