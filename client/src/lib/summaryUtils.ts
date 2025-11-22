export function parseSummary(raw: string | null | undefined) {
  const result: { text: string; flashcards?: any[] } = { text: "" };
  if (!raw) return result;
  
  // Normalize input: remove surrounding code fences and whitespace
  let s = raw.trim();
  
  // Remove markdown code fences ```json ... ``` or ``` ... ```
  s = s.replace(/^```[a-zA-Z0-9\-]*\n/, "").replace(/\n```$/, "");
  
  // Handle double-encoded JSON (stringified JSON stored as a string)
  // First, try to detect if it's a JSON string that needs to be parsed
  if (s.startsWith('"') && s.endsWith('"')) {
    try {
      const unquoted = JSON.parse(s);
      if (typeof unquoted === 'string') {
        s = unquoted;
      } else if (typeof unquoted === 'object' && unquoted !== null) {
        // It's already an object, extract summary_markdown
        if (typeof unquoted.summary_markdown === "string") {
          result.text = unquoted.summary_markdown;
          if (Array.isArray(unquoted.flashcards)) result.flashcards = unquoted.flashcards;
          return result;
        } else if (typeof unquoted.summary === "string") {
          result.text = unquoted.summary;
          if (Array.isArray(unquoted.flashcards)) result.flashcards = unquoted.flashcards;
          return result;
        }
      }
    } catch (e) {
      // Not a valid JSON string, continue with other parsing methods
    }
  }

  // If it looks like JSON somewhere inside (many LLMs return JSON as a fenced block),
  // try to extract the first balanced JSON object and parse it.
  const firstBrace = s.indexOf("{");
  const lastBrace = s.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = s.substring(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") {
        if (typeof parsed.summary_markdown === "string") {
          result.text = parsed.summary_markdown;
          if (Array.isArray(parsed.flashcards)) result.flashcards = parsed.flashcards;
          return result;
        } else if (typeof parsed.summary === "string") {
          result.text = parsed.summary;
          if (Array.isArray(parsed.flashcards)) result.flashcards = parsed.flashcards;
          return result;
        }
      }
    } catch (e) {
      // fall through and try looser parsing
    }
  }

  // Looser extraction: look for a `summary_markdown` or `summary` key in the string
  const mdMatch = s.match(/summary_markdown\s*[:=]\s*["'`]([\s\S]{20,})["'`]/i);
  if (mdMatch && mdMatch[1]) {
    result.text = mdMatch[1]
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, "\\")
      .trim();
    return result;
  }

  const summaryMatch = s.match(/"?summary"?\s*[:=]\s*"([\s\S]{20,})"/i);
  if (summaryMatch && summaryMatch[1]) {
    result.text = summaryMatch[1]
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, "\\")
      .trim();
    return result;
  }

  // If nothing parsed as structured JSON, but the raw text looks like JSON-like with quotes,
  // attempt one more parse by unescaping common escape sequences.
  try {
    const unescaped = s
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, "\\")
      .replace(/\\t/g, "\t")
      .replace(/\\r/g, "\r");
    const maybe = JSON.parse(unescaped);
    if (maybe && typeof maybe === "object") {
      if (typeof maybe.summary_markdown === "string") {
        result.text = maybe.summary_markdown;
        if (Array.isArray(maybe.flashcards)) result.flashcards = maybe.flashcards;
        return result;
      } else if (typeof maybe.summary === "string") {
        result.text = maybe.summary;
        if (Array.isArray(maybe.flashcards)) result.flashcards = maybe.flashcards;
        return result;
      }
    }
  } catch (e) {
    // give up and treat as plain text below
  }

  // Fallback: treat s as plain markdown/text, but unescape common sequences
  result.text = s
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, "\\")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\r");
  
  // Remove any remaining JSON wrapper text
  result.text = result.text
    .replace(/^\{?\s*["']?summary_markdown["']?\s*[:=]\s*["']?/i, '')
    .replace(/["']?\s*[,}]\s*["']?flashcards["']?\s*[:=].*$/i, '')
    .replace(/["']?\s*\}$/, '')
    .trim();
  
  return result;
}
