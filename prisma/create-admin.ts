// ============================================
// BiblioGest - Criar / Resetar Administrador
//
// Uso:
//   npm run db:admin
//   npx tsx prisma/create-admin.ts [email] [senha] [nome]
//
// Se o usuário já existir, a senha é redefinida.
// ============================================

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = (process.argv[2] || "admin@bibliogest.local").trim().toLowerCase();
  const password = process.argv[3] || "admin123";
  const name = process.argv[4] || "Administrador";

  const existing = await prisma.user.findUnique({ where: { email } });
  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      password: hashedPassword,
      role: "ADMIN",
      isActive: true,
      failedAttempts: 0,
      lockedUntil: null,
    },
    create: {
      name,
      email,
      password: hashedPassword,
      role: "ADMIN",
    },
  });

  console.log(existing ? "✅ Administrador atualizado" : "✅ Administrador criado");
  console.log(`   Nome : ${user.name}`);
  console.log(`   E-mail: ${user.email}`);
  console.log(`   Senha : ${password}`);
  console.log(`\nAcesse: ${process.env.NEXT_PUBLIC_URL || "http://localhost:3000"}/auth/login`);
}

main()
  .catch((e) => {
    console.error("Erro:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
