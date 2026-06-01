import { db } from "@/server/db";
import { PrismaUserRepository } from "./userRepository";
import { PrismaUserProfileRepository } from "./userProfileRepository";
import { PrismaUserSocialRepository } from "./userSocialRepository";
import { PrismaUserBillingRepository } from "./userBillingRepository";
import { PrismaScenarioRepository } from "./scenarioRepository";
import { PrismaCallRepository } from "./callRepository";

export const userRepository = new PrismaUserRepository(db);
export const userProfileRepository = new PrismaUserProfileRepository(db);
export const userSocialRepository = new PrismaUserSocialRepository(db);
export const userBillingRepository = new PrismaUserBillingRepository(db);
export const scenarioRepository = new PrismaScenarioRepository(db);
export const callRepository = new PrismaCallRepository(db);

export type { IUserRepository } from "./userRepository";
export type { IUserProfileRepository } from "./userProfileRepository";
export type { IUserSocialRepository } from "./userSocialRepository";
export type { IUserBillingRepository } from "./userBillingRepository";
export type { IScenarioRepository } from "./scenarioRepository";
export type { ICallRepository } from "./callRepository";
