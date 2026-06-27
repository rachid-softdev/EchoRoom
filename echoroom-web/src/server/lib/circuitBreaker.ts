import { createLogger } from "@/server/lib/logger";

const log = createLogger("circuit-breaker");

export class CircuitBreakerOpenError extends Error {
  override name = "CircuitBreakerOpenError";
}

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface CircuitStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  totalCalls: number;
  lastFailure: number | null;
  lastSuccess: number | null;
  openTimeoutMs: number;
  failureThreshold: number;
  successThreshold: number;
}

export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private successCount = 0;
  private totalCalls = 0;
  private lastFailure: number | null = null;
  private lastSuccess: number | null = null;
  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly openTimeoutMs: number;
  private readonly name: string;

  constructor(
    failureThreshold: number,
    successThreshold: number,
    openTimeoutMs: number,
    name: string,
  ) {
    this.failureThreshold = failureThreshold;
    this.successThreshold = successThreshold;
    this.openTimeoutMs = openTimeoutMs;
    this.name = name;
  }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    this.totalCalls++;

    if (this.state === "OPEN") {
      const elapsed = Date.now() - (this.lastFailure ?? 0);
      if (elapsed >= this.openTimeoutMs) {
        this.transitionTo("HALF_OPEN");
      } else {
        // Service name logged server-side only, not exposed to clients
        log.warn(`Circuit breaker "${this.name}" rejected request while OPEN`);
        throw new CircuitBreakerOpenError(
          "Service temporairement indisponible — veuillez réessayer plus tard",
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.lastSuccess = Date.now();
    this.failureCount = 0;

    if (this.state === "HALF_OPEN") {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.transitionTo("CLOSED");
        this.successCount = 0;
      }
    }
  }

  private onFailure(): void {
    this.lastFailure = Date.now();
    this.failureCount++;
    this.successCount = 0;

    if (this.state === "HALF_OPEN") {
      this.transitionTo("OPEN");
    } else if (this.state === "CLOSED" && this.failureCount >= this.failureThreshold) {
      this.transitionTo("OPEN");
    }
  }

  private transitionTo(newState: CircuitState): void {
    const prev = this.state;
    this.state = newState;
    log.info(`Circuit breaker "${this.name}" state change`, {
      from: prev,
      to: newState,
      failureCount: this.failureCount,
      successCount: this.successCount,
    });
  }

  getStats(): CircuitStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalCalls: this.totalCalls,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
      openTimeoutMs: this.openTimeoutMs,
      failureThreshold: this.failureThreshold,
      successThreshold: this.successThreshold,
    };
  }

  reset(): void {
    this.state = "CLOSED";
    this.failureCount = 0;
    this.successCount = 0;
    this.totalCalls = 0;
    this.lastFailure = null;
    this.lastSuccess = null;
  }
}

export function createTwilioCircuitBreaker(): CircuitBreaker {
  return new CircuitBreaker(5, 3, 30_000, "twilio");
}

export function createOpenAICircuitBreaker(): CircuitBreaker {
  return new CircuitBreaker(3, 2, 15_000, "openai");
}

export function createElevenLabsCircuitBreaker(): CircuitBreaker {
  return new CircuitBreaker(5, 3, 15_000, "elevenlabs");
}

export function createDeepgramCircuitBreaker(): CircuitBreaker {
  return new CircuitBreaker(5, 3, 15_000, "deepgram");
}
