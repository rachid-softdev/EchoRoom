/**
 * Vitest setup — ensures env vars are properly set before any imports.
 * Without this, env.ts would receive empty strings from process.env
 * and fail Zod URL validation for optional vars.
 */
process.env['DIRECT_URL'] = process.env['DIRECT_URL'] || "postgresql://localhost:5432/echoroom?schema=public";
process.env['NEXTAUTH_URL'] = process.env['NEXTAUTH_URL'] || "http://localhost:3000";
process.env['REDIS_URL'] = process.env['REDIS_URL'] || "https://localhost:6379";
process.env['R2_PUBLIC_URL'] = process.env['R2_PUBLIC_URL'] || "https://cdn.echoroom.app";
process.env['PHONE_ENCRYPTION_KEY'] = process.env['PHONE_ENCRYPTION_KEY'] || "test_key_for_ci_32_chars_minimum_!!!!!";
process.env['TWILIO_TOKEN_SECRET'] = process.env['TWILIO_TOKEN_SECRET'] || "test_twilio_token_secret_here";
