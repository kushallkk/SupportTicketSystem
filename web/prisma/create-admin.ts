import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

async function main() {
  const email = "admin@resolveiq.dev";
  const password = "admin1234";
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { name: "Admin", email, passwordHash, role: "ADMIN" },
  });

  console.log(`Admin ready: ${user.email} / ${password}`);
}

main().finally(() => prisma.$disconnect());
