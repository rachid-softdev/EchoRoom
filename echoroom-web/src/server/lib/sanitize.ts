import sanitizeHtml from "sanitize-html";

/**
 * Strict sanitizer for user-generated community content (posts, replies, reports).
 *
 * Strips ALL HTML markup — only plain text survives. This prevents stored XSS
 * from payloads such as `<script>…</script>` or attributes like `onerror=` /
 * `onload=` that would execute if the content were later rendered as HTML.
 *
 * Intentionally uses an empty allow-list (strict mode): community content is
 * plain text and must never carry markup through to the database.
 */
export function sanitizeUserContent(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: "discard",
    // Drop the raw contents of these non-text tags entirely (e.g. <script>).
    nonTextTags: ["style", "script", "textarea", "option", "noscript", "title"],
  }).trim();
}
