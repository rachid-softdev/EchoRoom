import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Conversation Engine Tests — generateResponse, generateScript
// ---------------------------------------------------------------------------

const mockLogInstance = {
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => mockLogInstance),
}));

// Circuit breaker mock — module-level reference
const mockCBCall = vi.fn();
vi.mock("@/server/lib/circuitBreaker", () => ({
  createOpenAICircuitBreaker: vi.fn(() => ({
    call: mockCBCall,
  })),
  CircuitBreakerOpenError: class extends Error {
    override name = "CircuitBreakerOpenError";
    constructor(message: string) {
      super(message);
    }
  },
}));

// OpenAI client mock
const mockCreate = vi.fn();

// Module-level reference for getOpenAIClient so we can restore defaults in beforeEach
const mockGetOpenAIClient = vi.fn(() => ({
  chat: {
    completions: {
      create: mockCreate,
    },
  },
}));

vi.mock("@/lib/openai", () => ({
  getOpenAIClient: mockGetOpenAIClient,
}));

// moderateOutput mock
const mockModerateOutput = vi.fn();
vi.mock("../moderation", () => ({
  moderateOutput: mockModerateOutput,
}));

function makeCompletionResponse(options?: {
  content?: string;
  totalTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
}) {
  const content = options?.content ?? "Je suis un assistant virtuel.";
  return {
    choices: [
      {
        message: { content },
      },
    ],
    usage: {
      total_tokens: options?.totalTokens ?? 42,
      prompt_tokens: options?.promptTokens ?? 10,
      completion_tokens: options?.completionTokens ?? 32,
    },
  };
}

describe("generateResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default implementations after clearAllMocks (which only resets calls/instances)
    mockCBCall.mockImplementation(async (fn: Function) => await fn());
    mockModerateOutput.mockImplementation(async (text: string) => text);
    // Ensure getOpenAIClient returns the mock client (not null from previous tests)
    mockGetOpenAIClient.mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    }));
  });

  // -----------------------------------------------------------------------
  // Happy path
  // -----------------------------------------------------------------------

  it("should return AI completion with response, tokensUsed and wasModerated", async () => {
    mockCreate.mockResolvedValue(
      makeCompletionResponse({
        content: "Bonjour, comment puis-je vous aider?",
        totalTokens: 50,
      }),
    );

    const { generateResponse } = await import("../conversationEngine");
    const result = await generateResponse({
      systemPrompt: "Tu es un assistant utile.",
      messages: [{ role: "user", content: "Bonjour" }],
    });

    expect(result.response).toBe("Bonjour, comment puis-je vous aider?");
    expect(result.tokensUsed).toBe(50);
    expect(result.wasModerated).toBe(false);
  });

  it("should pass messages, systemPrompt, temperature and maxTokens to OpenAI", async () => {
    mockCreate.mockResolvedValue(makeCompletionResponse());

    const { generateResponse } = await import("../conversationEngine");
    await generateResponse({
      systemPrompt: "Tu es un expert en français.",
      messages: [
        { role: "user", content: "Parle-moi de Paris" },
        { role: "assistant", content: "Paris est une belle ville" },
      ],
      maxTokens: 500,
    });

    expect(mockCreate).toHaveBeenCalledWith({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Tu es un expert en français." },
        { role: "user", content: "Parle-moi de Paris" },
        { role: "assistant", content: "Paris est une belle ville" },
      ],
      max_tokens: 500,
      temperature: 0.8,
    });
  });

  it("should use default maxTokens of 300 when not specified", async () => {
    mockCreate.mockResolvedValue(makeCompletionResponse());

    const { generateResponse } = await import("../conversationEngine");
    await generateResponse({
      systemPrompt: "Test",
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ max_tokens: 300 }),
    );
  });

  // -----------------------------------------------------------------------
  // OpenAI client unavailable
  // -----------------------------------------------------------------------

  it("should return 'Désolé, le moteur de conversation n'est pas disponible' when OpenAI is null", async () => {
    mockGetOpenAIClient.mockReturnValue(null);

    const { generateResponse } = await import("../conversationEngine");
    const result = await generateResponse({
      systemPrompt: "Test",
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(result.response).toBe(
      "Désolé, le moteur de conversation n'est pas disponible actuellement.",
    );
    expect(result.tokensUsed).toBe(0);
    expect(result.wasModerated).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Circuit breaker open
  // -----------------------------------------------------------------------

  it("should propagate CircuitBreakerOpenError when circuit is open", async () => {
    const { CircuitBreakerOpenError } = await import("@/server/lib/circuitBreaker");
    mockCBCall.mockRejectedValue(
      new CircuitBreakerOpenError("OpenAI temporairement indisponible"),
    );

    const { generateResponse } = await import("../conversationEngine");
    await expect(
      generateResponse({
        systemPrompt: "Test",
        messages: [{ role: "user", content: "Hello" }],
      }),
    ).rejects.toThrow(CircuitBreakerOpenError);
  });

  // -----------------------------------------------------------------------
  // Empty / no choices
  // -----------------------------------------------------------------------

  it("should fallback to 'Je n'ai rien à dire...' when choices array is empty", async () => {
    mockCreate.mockResolvedValue({
      choices: [],
      usage: { total_tokens: 5, prompt_tokens: 2, completion_tokens: 3 },
    });
    mockModerateOutput.mockImplementation(async (text: string) => text);

    const { generateResponse } = await import("../conversationEngine");
    const result = await generateResponse({
      systemPrompt: "Test",
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(result.response).toBe("Je n'ai rien à dire...");
  });

  it("should fallback when choices[0].message.content is null/undefined", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
      usage: { total_tokens: 3 },
    });
    mockModerateOutput.mockImplementation(async (text: string) => text);

    const { generateResponse } = await import("../conversationEngine");
    const result = await generateResponse({
      systemPrompt: "Test",
      messages: [{ role: "user", content: "Hi" }],
    });

    expect(result.response).toBe("Je n'ai rien à dire...");
  });

  // -----------------------------------------------------------------------
  // Moderation
  // -----------------------------------------------------------------------

  it("should call moderateOutput on the response", async () => {
    mockCreate.mockResolvedValue(
      makeCompletionResponse({ content: "Some AI response" }),
    );

    const { generateResponse } = await import("../conversationEngine");
    await generateResponse({
      systemPrompt: "Test",
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(mockModerateOutput).toHaveBeenCalledWith("Some AI response", 2000);
  });

  it("should set wasModerated=true when moderateOutput modifies the response", async () => {
    mockCreate.mockResolvedValue(
      makeCompletionResponse({ content: "Contenu inapproprié" }),
    );
    mockModerateOutput.mockResolvedValue(
      "Je suis désolé, je n'ai pas pu générer une réponse appropriée.",
    );

    const { generateResponse } = await import("../conversationEngine");
    const result = await generateResponse({
      systemPrompt: "Test",
      messages: [{ role: "user", content: "Bonjour" }],
    });

    expect(result.wasModerated).toBe(true);
    expect(result.response).toBe(
      "Je suis désolé, je n'ai pas pu générer une réponse appropriée.",
    );
  });

  // -----------------------------------------------------------------------
  // Token usage logging
  // -----------------------------------------------------------------------

  it("should log token usage after completion", async () => {
    mockCreate.mockResolvedValue(
      makeCompletionResponse({
        totalTokens: 100,
        promptTokens: 30,
        completionTokens: 70,
      }),
    );

    const { generateResponse } = await import("../conversationEngine");
    await generateResponse({
      systemPrompt: "System",
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(mockLogInstance.info).toHaveBeenCalledWith("OpenAI completion", {
      tokensUsed: 100,
      promptTokens: 30,
      completionTokens: 70,
    });
  });

  it("should handle missing usage data gracefully (tokensUsed=0)", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "Réponse" } }],
      usage: undefined,
    });
    mockModerateOutput.mockImplementation(async (text: string) => text);

    const { generateResponse } = await import("../conversationEngine");
    const result = await generateResponse({
      systemPrompt: "Test",
      messages: [{ role: "user", content: "Bonjour" }],
    });

    expect(result.tokensUsed).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  it("should handle empty messages array", async () => {
    mockCreate.mockResolvedValue(makeCompletionResponse());

    const { generateResponse } = await import("../conversationEngine");
    const result = await generateResponse({
      systemPrompt: "Test",
      messages: [],
    });

    expect(result.response).toBe("Je suis un assistant virtuel.");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: "system", content: "Test" }],
      }),
    );
  });

  it("should handle very long history (many messages)", async () => {
    const longHistory = Array.from({ length: 50 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `Message number ${i + 1}`,
    }));

    mockCreate.mockResolvedValue(makeCompletionResponse());

    const { generateResponse } = await import("../conversationEngine");
    const result = await generateResponse({
      systemPrompt: "You are a chat bot",
      messages: longHistory,
    });

    expect(result.response).toBe("Je suis un assistant virtuel.");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          { role: "system", content: "You are a chat bot" },
          ...longHistory,
        ]),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// generateScript
// ---------------------------------------------------------------------------

describe("generateScript", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCBCall.mockImplementation(async (fn: Function) => await fn());
    mockModerateOutput.mockImplementation(async (text: string) => text);
    mockGetOpenAIClient.mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    }));
  });

  it("should generate a script response with character prompt and user input", async () => {
    mockCreate.mockResolvedValue(
      makeCompletionResponse({
        content: "Bonjour, je suis ravi de vous parler aujourd'hui!",
      }),
    );

    const { generateScript } = await import("../conversationEngine");
    const result = await generateScript(
      "Tu es un vendeur enthousiaste.",
      "Bonjour, comment allez-vous?",
    );

    expect(result).toBe("Bonjour, je suis ravi de vous parler aujourd'hui!");
    expect(mockCreate).toHaveBeenCalledWith({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: expect.stringContaining("Tu génères une réplique"),
        },
        {
          role: "user",
          content: "Bonjour, comment allez-vous?",
        },
      ],
      max_tokens: 200,
      temperature: 0.9,
    });
  });

  it("should return 'Moteur IA indisponible.' when OpenAI is null", async () => {
    mockGetOpenAIClient.mockReturnValue(null);

    const { generateScript } = await import("../conversationEngine");
    const result = await generateScript(
      "Tu es un assistant.",
      "Parle-moi",
    );

    expect(result).toBe("Moteur IA indisponible.");
  });

  it("should call moderateOutput on the generated response", async () => {
    mockCreate.mockResolvedValue(
      makeCompletionResponse({ content: "Réponse scriptée" }),
    );

    const { generateScript } = await import("../conversationEngine");
    await generateScript("Personnalité amicale", "Salut!");

    expect(mockModerateOutput).toHaveBeenCalledWith("Réponse scriptée", 2000);
  });

  it("should fallback to '...' when choices are empty", async () => {
    mockCreate.mockResolvedValue({ choices: [], usage: {} });

    const { generateScript } = await import("../conversationEngine");
    const result = await generateScript(
      "Personnalité triste",
      "Ça va?",
    );

    expect(result).toBe("...");
  });

  it("should log token usage after completion", async () => {
    mockCreate.mockResolvedValue(
      makeCompletionResponse({
        totalTokens: 60,
        promptTokens: 20,
        completionTokens: 40,
      }),
    );

    const { generateScript } = await import("../conversationEngine");
    await generateScript("Test character", "Test input");

    expect(mockLogInstance.info).toHaveBeenCalledWith("OpenAI completion", {
      tokensUsed: 60,
      promptTokens: 20,
      completionTokens: 40,
    });
  });
});
