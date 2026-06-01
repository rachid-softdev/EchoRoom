/**
 * Data migration script: Populate UserProfile, UserSocial, UserBilling from existing User data.
 *
 * Run with: npx tsx prisma/scripts/migrate-user-partition.ts
 *
 * This script should be run once after the new tables are created.
 * It is idempotent — safe to run multiple times.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("Starting user partition data migration...");

  const users = await db.user.findMany({
    select: {
      id: true,
      image: true,
      displayName: true,
      bio: true,
      credits: true,
      totalLikesReceived: true,
      totalCallsMade: true,
    },
  });

  console.log(`Found ${users.length} users to migrate.`);

  let profileCount = 0;
  let socialCount = 0;
  let billingCount = 0;

  for (const user of users) {
    // Migrate UserProfile
    if (user.image || user.displayName || user.bio) {
      await db.userProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          image: user.image,
          displayName: user.displayName,
          bio: user.bio,
        },
        update: {
          image: user.image,
          displayName: user.displayName,
          bio: user.bio,
        },
      });
      profileCount++;
    }

    // Migrate UserSocial
    if (user.totalLikesReceived > 0 || user.totalCallsMade > 0) {
      await db.userSocial.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          totalLikesReceived: user.totalLikesReceived,
          totalCallsMade: user.totalCallsMade,
        },
        update: {
          totalLikesReceived: user.totalLikesReceived,
          totalCallsMade: user.totalCallsMade,
        },
      });
      socialCount++;
    }

    // Migrate UserBilling (always, since credits has a default of 5)
    await db.userBilling.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        credits: user.credits,
      },
      update: {
        credits: user.credits,
      },
    });
    billingCount++;
  }

  console.log(`Migration complete:`);
  console.log(`  - UserProfile: ${profileCount} records`);
  console.log(`  - UserSocial: ${socialCount} records`);
  console.log(`  - UserBilling: ${billingCount} records`);
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
