// Central configuration for the AI chat assistant.
export const AI_CONFIG = {
  // Model name comes from the environment so it can change without code edits.
  model: process.env.GEMINI_MODEL || "gemini-flash-latest",
  maxMessageChars: 500,
  maxHistory: 10,
  rateLimitPerMinute: 8,
  menuCacheMs: 60_000,
  // Chat requires a signed-in user unless CHAT_REQUIRE_LOGIN=false is set.
  requireLogin: process.env.CHAT_REQUIRE_LOGIN !== "false",
};