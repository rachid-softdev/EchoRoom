import type { PrismaClient, UserProfile } from "@prisma/client";

export interface IUserProfileRepository {
  findByUserId(
    userId: string,
  ): Promise<Pick<UserProfile, "id" | "userId" | "image" | "displayName" | "bio"> | null>;
  upsert(
    userId: string,
    data: Partial<Pick<UserProfile, "image" | "displayName" | "bio">>,
  ): Promise<UserProfile>;
  anonymize(tx: PrismaTx, userId: string): Promise<void>;
}

type PrismaTx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$transaction" | "$extends"
>;

export class PrismaUserProfileRepository implements IUserProfileRepository {
  constructor(private db: PrismaClient) {}

  async findByUserId(
    userId: string,
  ): Promise<Pick<UserProfile, "id" | "userId" | "image" | "displayName" | "bio"> | null> {
    return this.db.userProfile.findUnique({
      where: { userId },
      select: { id: true, userId: true, image: true, displayName: true, bio: true },
    });
  }

  async upsert(
    userId: string,
    data: Partial<Pick<UserProfile, "image" | "displayName" | "bio">>,
  ): Promise<UserProfile> {
    return this.db.userProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }

  async anonymize(tx: PrismaTx, userId: string): Promise<void> {
    await tx.userProfile.update({
      where: { userId },
      data: {
        image: null,
        displayName: null,
        bio: null,
      },
    });
  }
}
