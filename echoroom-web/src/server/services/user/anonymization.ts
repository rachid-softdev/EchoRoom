import type { PrismaClient } from "@prisma/client";

type PrismaTx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$transaction" | "$extends"
>;

/**
 * Shared anonymization logic used by deleteMyAccount, deleteUser (admin),
 * and withdrawConsent (GDPR). Extracted to prevent code drift.
 */
export async function anonymizePersonalData(
  tx: PrismaTx,
  userId: string,
  options?: { skipPhoneNumbers?: boolean; skipComments?: boolean },
): Promise<void> {
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

  if (!options?.skipComments) {
    await tx.comment.updateMany({
      where: { userId },
      data: { content: "[Commentaire supprimé]" },
    });
  }

  if (!options?.skipPhoneNumbers) {
    await tx.call.updateMany({
      where: { userId },
      data: { phoneNumber: "[ANONYMISÉ]" },
    });
  }
}
