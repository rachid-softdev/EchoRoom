import sanitizeHtml from "sanitize-html";

/**
 * Strict, server-side sanitization for free-text user input
 * (scenario titles, descriptions, opening messages, AI instructions, etc.).
 *
 * Policy: strip ALL HTML tags and attributes (including <script>, inline
 * event handlers like on*). Only the bare text content survives, which
 * prevents stored XSS when this data is later rendered as HTML on the
 * client. This is intentionally lossy for markup — these fields are
 * plain text and must never carry executable content.
 *
 * Shared with the community router (P5) to avoid a second sanitizer dep.
 */
const STRICT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  // Drop the content of these tags entirely rather than leaking it as text.
  nonTextTags: ["style", "script", "textarea", "option", "noscript", "title"],
  disallowedTagsMode: "discard",
};

export function sanitizeUserText(input: string): string {
  if (typeof input !== "string") return input;
  return sanitizeHtml(input, STRICT_OPTIONS);
}
