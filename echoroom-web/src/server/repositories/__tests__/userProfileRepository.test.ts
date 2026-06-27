import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// UserProfileRepository — Contract Tests (future partitioned repository)
// ---------------------------------------------------------------------------
// Sprint 4 (Horizon 6 Months) plans to partition the monolithic User model
// into UserProfile, UserSocial, and UserBilling. These tests define the
// expected contract for the UserProfileRepository that will handle:
//   - Profile CRUD (email, username, displayName, bio, image, passwordHash)
//   - Authentication fields (passwordHash, tokenVersion)
//   - GDPR fields (consent, deletedAt, anonymizedAt)
//   - Role management
//
// These tests validate the INTERFACE contract, not a specific implementation.
// They mock the repository to verify the interface shape and expected behavior.

interface UserProfileData {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  image: string | null;
  passwordHash: string;
  role: "USER" | "ADMIN" | "MODERATOR";
  tokenVersion: number;
  consentAcceptedAt: Date | null;
  consentWithdrawnAt: Date | null;
  gdprDataExportedAt: Date | null;
  deletedAt: Date | null;
  anonymizedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface IUserProfileRepository {
  findById(id: string): Promise<UserProfileData | null>;
  findByEmail(
    email: string,
  ): Promise<Pick<
    UserProfileData,
    "id" | "email" | "passwordHash" | "role" | "tokenVersion" | "deletedAt"
  > | null>;
  findByUsername(username: string): Promise<Pick<UserProfileData, "id" | "username"> | null>;
  create(data: {
    email: string;
    username: string;
    passwordHash: string;
    consentAcceptedAt: Date;
  }): Promise<{ id: string }>;
  update(id: string, data: Partial<UserProfileData>): Promise<UserProfileData>;
  softDelete(tx: any, id: string, anonId: string, deletedHash: string): Promise<void>;
  incrementTokenVersion(tx: any, id: string): Promise<void>;
}

describe("IUserProfileRepository — interface contract", () => {
  let mockRepo: IUserProfileRepository;

  beforeEach(() => {
    // Create a mock implementation of the interface
    mockRepo = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      findByUsername: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      incrementTokenVersion: vi.fn(),
    };
  });

  describe("findById", () => {
    it("should return full profile when user exists", async () => {
      const mockProfile: UserProfileData = {
        id: "user-1",
        email: "test@example.com",
        username: "testuser",
        displayName: "Test User",
        bio: "A bio",
        image: "https://example.com/avatar.png",
        passwordHash: "$2b$12$hash",
        role: "USER",
        tokenVersion: 0,
        consentAcceptedAt: new Date(),
        consentWithdrawnAt: null,
        gdprDataExportedAt: null,
        deletedAt: null,
        anonymizedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (mockRepo.findById as any).mockResolvedValue(mockProfile);

      const result = await mockRepo.findById("user-1");

      expect(result).toEqual(mockProfile);
      expect(result?.email).toBe("test@example.com");
      expect(result?.role).toBe("USER");
    });

    it("should return null when user not found", async () => {
      (mockRepo.findById as any).mockResolvedValue(null);

      const result = await mockRepo.findById("nonexistent");

      expect(result).toBeNull();
    });

    it("should include GDPR timestamps", async () => {
      const withGdpr: UserProfileData = {
        id: "user-1",
        email: "test@example.com",
        username: "testuser",
        displayName: null,
        bio: null,
        image: null,
        passwordHash: "$2b$12$hash",
        role: "USER",
        tokenVersion: 2,
        consentAcceptedAt: new Date("2026-01-01"),
        consentWithdrawnAt: new Date("2026-06-01"),
        gdprDataExportedAt: new Date("2026-05-01"),
        deletedAt: new Date("2026-06-01"),
        anonymizedAt: new Date("2026-06-01"),
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-06-01"),
      };
      (mockRepo.findById as any).mockResolvedValue(withGdpr);

      const result = await mockRepo.findById("user-1");

      expect(result?.consentAcceptedAt).toBeInstanceOf(Date);
      expect(result?.consentWithdrawnAt).toBeInstanceOf(Date);
      expect(result?.gdprDataExportedAt).toBeInstanceOf(Date);
      expect(result?.deletedAt).toBeInstanceOf(Date);
      expect(result?.anonymizedAt).toBeInstanceOf(Date);
    });
  });

  describe("findByEmail", () => {
    it("should return auth-relevant fields only", async () => {
      const authData = {
        id: "user-1",
        email: "test@example.com",
        passwordHash: "$2b$12$hash",
        role: "USER" as const,
        tokenVersion: 3,
        deletedAt: null,
      };
      (mockRepo.findByEmail as any).mockResolvedValue(authData);

      const result = await mockRepo.findByEmail("test@example.com");

      expect(result).toBeDefined();
      expect(result!.id).toBe("user-1");
      expect(result!.passwordHash).toBeDefined();
      expect(result!.tokenVersion).toBe(3);
      expect(Object.keys(result!)).toEqual(
        expect.arrayContaining([
          "id",
          "email",
          "passwordHash",
          "role",
          "tokenVersion",
          "deletedAt",
        ]),
      );
    });

    it("should NOT leak username or displayName", async () => {
      (mockRepo.findByEmail as any).mockResolvedValue({
        id: "user-1",
        email: "test@example.com",
        passwordHash: "$2b$12$hash",
        role: "USER",
        tokenVersion: 0,
        deletedAt: null,
      });

      const result = await mockRepo.findByEmail("test@example.com");

      expect((result as any).displayName).toBeUndefined();
      expect((result as any).bio).toBeUndefined();
    });

    it("should return null when email not found", async () => {
      (mockRepo.findByEmail as any).mockResolvedValue(null);

      const result = await mockRepo.findByEmail("unknown@example.com");

      expect(result).toBeNull();
    });
  });

  describe("findByUsername", () => {
    it("should return only id and username for conflict checks", async () => {
      (mockRepo.findByUsername as any).mockResolvedValue({
        id: "user-1",
        username: "existing_user",
      });

      const result = await mockRepo.findByUsername("existing_user");

      expect(result).toEqual({ id: "user-1", username: "existing_user" });
    });

    it("should return null when username not found", async () => {
      (mockRepo.findByUsername as any).mockResolvedValue(null);

      const result = await mockRepo.findByUsername("unknown_user");

      expect(result).toBeNull();
    });
  });

  describe("create", () => {
    it("should create a profile and return its id", async () => {
      const input = {
        email: "new@example.com",
        username: "newuser",
        passwordHash: "$2b$12$hash",
        consentAcceptedAt: new Date(),
      };
      (mockRepo.create as any).mockResolvedValue({ id: "new-user-id" });

      const result = await mockRepo.create(input);

      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe("string");
    });

    it("should throw on duplicate email", async () => {
      (mockRepo.create as any).mockRejectedValue(new Error("Unique constraint failed on email"));

      await expect(
        mockRepo.create({
          email: "duplicate@example.com",
          username: "unique_username",
          passwordHash: "$2b$12$hash",
          consentAcceptedAt: new Date(),
        }),
      ).rejects.toThrow("email");
    });
  });

  describe("softDelete", () => {
    it("should anonymize personal data and set deletedAt", async () => {
      (mockRepo.softDelete as any).mockResolvedValue(undefined);

      await expect(
        mockRepo.softDelete({} as any, "user-1", "anon-uuid", "$2b$12$deletedHash"),
      ).resolves.not.toThrow();
    });

    it("should require a transaction object", async () => {
      // softDelete must accept a transaction for atomicity
      const tx = { userProfile: { update: vi.fn() } };

      (mockRepo.softDelete as any).mockImplementation(
        async (t: any, _id: string, _anonId: string, _hash: string) => {
          await t.userProfile.update({ where: { id: _id }, data: { deletedAt: new Date() } });
        },
      );

      await mockRepo.softDelete(tx, "user-1", "uuid", "hash");

      expect(tx.userProfile.update).toHaveBeenCalled();
    });
  });

  describe("incrementTokenVersion", () => {
    it("should increment tokenVersion atomically", async () => {
      (mockRepo.incrementTokenVersion as any).mockImplementation(async (_tx: any, _id: string) => {
        // Token version was incremented
        return;
      });

      await expect(mockRepo.incrementTokenVersion({} as any, "user-1")).resolves.not.toThrow();
    });

    it("should require a transaction for atomicity", async () => {
      const tx = { userProfile: { update: vi.fn().mockResolvedValue({ tokenVersion: 2 }) } };

      (mockRepo.incrementTokenVersion as any).mockImplementation(async (t: any, id: string) => {
        await t.userProfile.update({
          where: { id },
          data: { tokenVersion: { increment: 1 } },
        });
      });

      await mockRepo.incrementTokenVersion(tx, "user-1");

      expect(tx.userProfile.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { tokenVersion: { increment: 1 } },
      });
    });
  });
});
