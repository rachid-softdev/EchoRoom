import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

async function main() {
  const db = new PrismaClient();

  // Create test user with known password
  const passwordHash = await bcrypt.hash("testpassword123", 10);
  const user = await db.user.upsert({
    where: { email: "testuser@echoroom.app" },
    update: { passwordHash },
    create: {
      email: "testuser@echoroom.app",
      username: "testuser",
      passwordHash,
      role: "USER",
      credits: 50,
    },
  });
  console.log("Test USER created:", user.id, user.email);

  // Create mod user
  const modHash = await bcrypt.hash("modpassword123", 10);
  const mod = await db.user.upsert({
    where: { email: "mod@echoroom.app" },
    update: { passwordHash: modHash },
    create: {
      email: "mod@echoroom.app",
      username: "moderator",
      passwordHash: modHash,
      role: "MODERATOR",
      credits: 100,
    },
  });
  console.log("Test MOD created:", mod.id, mod.email);

  // Update admin with real password
  const adminHash = await bcrypt.hash("admin123", 10);
  const admin = await db.user.upsert({
    where: { email: "admin@echoroom.app" },
    update: { passwordHash: adminHash },
    create: {
      email: "admin@echoroom.app",
      username: "admin",
      passwordHash: adminHash,
      role: "ADMIN",
      credits: 9999,
    },
  });
  console.log("Admin updated:", admin.id, admin.email);

  await db.$disconnect();
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
