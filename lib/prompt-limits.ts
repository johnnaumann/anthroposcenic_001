/** SD CLIP encoders truncate around 77 tokens; keep headroom for quality tags. */
export const MAX_SD_PROMPT_WORDS = 75;

/** Matches the describe instruction ("30–60 descriptive tags"). */
export const MAX_SD_PROMPT_TAGS = 60;

export function countPromptWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function countPromptTags(text: string): number {
  return text
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean).length;
}

export function isPromptAtLimit(text: string): boolean {
  return (
    countPromptWords(text) >= MAX_SD_PROMPT_WORDS ||
    countPromptTags(text) >= MAX_SD_PROMPT_TAGS
  );
}

/** Trim to the last complete tag before word/tag limits. */
export function truncatePromptAtLimit(text: string): string {
  let result = text.trim();
  if (!result) return result;

  while (result && isPromptAtLimit(result)) {
    const lastComma = result.lastIndexOf(',');
    if (lastComma <= 0) break;
    result = result.slice(0, lastComma).trim();
  }

  if (isPromptAtLimit(result)) {
    const words = result.split(/\s+/).slice(0, MAX_SD_PROMPT_WORDS);
    result = words.join(' ').trim();
  }

  return result.replace(/,\s*$/, '').trim();
}

export function wouldExceedPromptLimit(current: string, nextToken: string): boolean {
  return isPromptAtLimit(current + nextToken);
}
