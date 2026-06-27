import type {
  Call,
  CallStatus,
  Character,
  CharacterCategory,
  Comment,
  ModerationStatus,
  Purchase,
  Reaction,
  Scenario,
  User,
  UserRole,
  Visibility,
} from "@prisma/client";

export type {
  Call,
  CallStatus,
  Character,
  CharacterCategory,
  Comment,
  ModerationStatus,
  Purchase,
  Reaction,
  Scenario,
  User,
  UserRole,
  Visibility,
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
