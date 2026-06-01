import type { PrismaClient } from "@prisma/client";

type PrismaTx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$transaction" | "$extends"
>;

/**
 * Shared anonymization logic used by deleteMyAccount, deleteUser (admin),
 * and withdrawConsent (GDPR). Extracted to prevent code drift.
 */
export async function anonymizePersonalData(tx: PrismaTx, userId: string): Promise<void> {
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
