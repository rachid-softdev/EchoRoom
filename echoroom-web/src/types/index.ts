import type {
  User,
  Character,
  Scenario,
  Call,
  Reaction,
  Comment,
  Purchase,
  UserRole,
  CallStatus,
  Visibility,
  CharacterCategory,
  ModerationStatus,
} from "@prisma/client";

export type {
  User,
  Character,
  Scenario,
  Call,
  Reaction,
  Comment,
  Purchase,
  UserRole,
  CallStatus,
  Visibility,
  CharacterCategory,
  ModerationStatus,
};

export interface FeedItem {
  id: string;
  title: string;
  description: string;
  creator: {
    id: string;
    username: string;
    image: string | null;
  };
  character: {
    id: string;
    name: string;
    slug: string;
    avatarUrl: string;
  };
  _count: {
    reactions: number;
    comments: number;
  };
  createdAt: Date;
  playCount: number;
  likeCount: number;
}

export interface CallWithScenario {
  id: string;
  status: CallStatus;
  durationSeconds: number;
  costCredits: number;
  createdAt: Date | null;
  endedAt: Date | null;
  scenario: {
    id: string;
    title: string;
    character: {
      name: string;
      slug: string;
    };
  };
}

export interface TranscriptChunk {
  speaker: string;
  text: string;
  timestamp: number;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string;
}
