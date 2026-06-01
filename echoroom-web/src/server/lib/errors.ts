// Custom error class for service-layer errors.
// Allows tRPC routers to map domain errors to TRPCError codes.

export type AppErrorCode =
  | "BAD_REQUEST"
  | "SCENARIO_NOT_FOUND"
  | "USER_NOT_FOUND"
  | "INSUFFICIENT_CREDITS"
  | "TWILIO_ERROR"
  | "NOT_FOUND"
  | "DAILY_LIMIT_EXCEEDED"
  | "NUMBER_BLOCKED"
  | "CREDIT_DEBIT_FAILED"
  | "USER_IN_ACTIVE_CALL"
  | "CONSENT_ALREADY_WITHDRAWN";

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}
