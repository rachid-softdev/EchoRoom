import type { PrismaClient } from "@prisma/client";
import { userProfileRepository } from "@/server/repositories";

type PrismaTx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$transaction" | "$extends"
>;

/**
 * Shared anonymization logic used by deleteMyAccount, deleteUser (admin),
 * and withdrawConsent (GDPR). Extracted to prevent code drift.
 *
 * Handles both the sub-aggregate (UserProfile) and legacy User fields
 * for backward compatibility during the partition migration.
 */
export async function anonymizePersonalData(tx: PrismaTx, userId: string): Promise<void> {
  // Anonymize UserProfile sub-aggregate via repository.
  // Falls back to upsert if no UserProfile record exists yet.
  try {
    await userProfileRepository.anonymize(tx, userId);
  } catch {
    await tx.userProfile.upsert({
      where: { userId },
      create: { userId },
      update: { image: null, displayName: null, bio: null },
    });
  }

  // Legacy User fields (kept for backward compatibility)
  await tx.user.update({
    where: { id: userId },
    data: {
      displayName: null,
      bio: null,
      image: null,
    },
  });

  await tx.scenario.updateMany({
    where: { creatorId: userId },
    data: { visibility: "PRIVATE" },
  });

  await tx.comment.updateMany({
    where: { userId },
    data: { content: "[Commentaire supprimé]" },
  });

  // Sever FK references to this user as moderator (comments they moderated)
  await tx.comment.updateMany({
    where: { moderatedById: userId },
    data: { moderatedById: null, moderatedAt: null },
  });

  await tx.call.updateMany({
    where: { userId },
    data: { phoneNumber: "[ANONYMISÉ]" },
  });
}
