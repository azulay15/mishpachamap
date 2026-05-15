import Anthropic from "@anthropic-ai/sdk";

let cached: Anthropic | null = null;

/** Lazily-instantiated Anthropic client. Returns null if no API key set so the
 *  app boots without one — the chat surface shows a setup screen instead. */
export function anthropic(): Anthropic | null {
  if (cached) return cached;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  cached = new Anthropic({ apiKey: key });
  return cached;
}

export const CLAUDE_MODEL = "claude-haiku-4-5-20251001";
