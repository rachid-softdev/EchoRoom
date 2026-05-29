// Custom error class for service-layer errors.
// Allows tRPC routers to map domain errors to TRPCError codes.

export type AppErrorCode =
  | "SCENARIO_NOT_FOUND"
  | "USER_NOT_FOUND"
  | "INSUFFICIENT_CREDITS"
  | "TWILIO_ERROR"
  | "NOT_FOUND"
  | "DAILY_LIMIT_EXCEEDED"
  | "NUMBER_BLOCKED"
  | "CREDIT_DEBIT_FAILED";

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}
