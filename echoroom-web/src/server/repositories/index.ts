import { db } from "@/server/db";
import { PrismaUserRepository } from "./userRepository";
import { PrismaScenarioRepository } from "./scenarioRepository";
import { PrismaCallRepository } from "./callRepository";

export const userRepository = new PrismaUserRepository(db);
export const scenarioRepository = new PrismaScenarioRepository(db);
export const callRepository = new PrismaCallRepository(db);

export type { IUserRepository } from "./userRepository";
export type { IScenarioRepository } from "./scenarioRepository";
export type { ICallRepository } from "./callRepository";
