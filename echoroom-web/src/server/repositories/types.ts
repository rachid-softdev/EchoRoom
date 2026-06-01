import type { PrismaClient } from "@prisma/client";

export type PrismaTx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$transaction" | "$extends"
>;

export interface AtomicDebitSuccess { debited: true }
export interface AtomicDebitFailure { debited: false; reason: "INSUFFICIENT_CREDITS" | "USER_NOT_FOUND" }
export type AtomicDebitResult = AtomicDebitSuccess | AtomicDebitFailure;
