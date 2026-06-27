const ALLOWED_HOST_PATTERNS = [/^[a-z0-9-]+\.twilio\.com$/i];

export function isAllowedTwilioOrigin(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return ALLOWED_HOST_PATTERNS.some((pattern) => pattern.test(parsed.hostname));
  } catch {
    return false;
  }
}

export function validateRecordingUrl(url: string): boolean {
  if (!isAllowedTwilioOrigin(url)) return false;
  const parsed = new URL(url);
  return (
    parsed.pathname.startsWith("/2010-04-01/Accounts/") && parsed.pathname.includes("/Recordings/")
  );
}
