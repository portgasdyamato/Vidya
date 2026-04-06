import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";

// ── AI Provider Setup ─────────────────────────────────────────────────────────
// Priority: DeepSeek (primary) → Gemini (fallback) → OpenAI (fallback)

// 1. DeepSeek — primary provider (OpenAI-compatible API)
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const deepseek = DEEPSEEK_API_KEY
  ? new OpenAI({ apiKey: DEEPSEEK_API_KEY, baseURL: "https://api.deepseek.com/v1" })
  : null;

// 2. Google Gemini — fallback
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const googleAI = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

// 3. OpenAI — fallback (mainly for TTS audio)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

// ── DeepSeek helpers ──────────────────────────────────────────────────────────

/**
 * Generate text via DeepSeek-V3.
 * deepseek-chat = DeepSeek-V3 (best for most tasks).
 * deepseek-reasoner = DeepSeek-R1 (best for reasoning/math — costs more).
 */
async function deepseekChat(
  systemPrompt: string,
  userPrompt: string,
  model: "deepseek-chat" | "deepseek-reasoner" = "deepseek-chat",
  maxTokens = 2000
): Promise<string> {
  if (!deepseek) throw new Error("DeepSeek not configured");
  const res = await deepseek.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: maxTokens,
    temperature: 0.5,
  });
  return res.choices?.[0]?.message?.content || "";
}

/**
 * Generate JSON via DeepSeek-V3 with json_object response format.
 */
async function deepseekJSON(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 3000
): Promise<string> {
  if (!deepseek) throw new Error("DeepSeek not configured");
  const res = await deepseek.chat.completions.create({
    model: "deepseek-chat",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    max_tokens: maxTokens,
    temperature: 0.4,
  });
  const text = res.choices?.[0]?.message?.content || "{}";
  console.log("DEEPSEEK_JSON OUTPUT:", text.substring(0, 300) + "...");
  return text;
}

// ── Gemini helpers ────────────────────────────────────────────────────────────

/** Text generation via Gemini v1 SDK */
async function geminiGenerate(prompt: string, model = "gemini-1.5-flash"): Promise<string> {
  if (!googleAI) throw new Error("Gemini not configured");
  const response = await googleAI.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });
  return response.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

/** JSON generation via Gemini v1 SDK */
async function geminiGenerateJSON(prompt: string, model = "gemini-1.5-pro"): Promise<string> {
  if (!googleAI) throw new Error("Gemini not configured");
  const response = await googleAI.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { responseMimeType: "application/json" },
  });
  return response.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// ── Utility ───────────────────────────────────────────────────────────────────

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try { return JSON.stringify(err); } catch { return "Unknown error"; }
}

export interface ProcessingResult {
  extractedText?: string;
  summary?: string;
  audioUrl?: string;
  imageDescriptions?: Array<{ description: string; confidence: number }>;
  quizData?: Array<{ question: string; options: string[]; correctAnswer: number }>;
  flashcards?: Array<{ question: string; answer: string }>;
}

export async function extractTextFromImage(base64Image: string): Promise<string> {
  try {
    const prompt = "Extract all text from this image. If there are diagrams, charts, or visual elements, describe them in detail for accessibility. Format your response as plain text that can be read aloud.";
    
    if (googleAI) {
      try {
        // Use vision-capable model with inline image
        const response = await googleAI.models.generateContent({
          model: "gemini-1.5-flash",
          contents: [{
            role: "user",
            parts: [
              { text: prompt },
              { inlineData: { data: base64Image, mimeType: "image/jpeg" } }
            ]
          }],
        });
        const txt = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
        return txt;
      } catch (err) {
        console.warn("Google Gemini extractTextFromImage failed:", describeError(err));
      }
    }

    // Fallback: if Google client not available, return empty string
    return "";
  } catch (error: any) {
    throw new Error(`Failed to extract text from image: ${error?.message || 'Unknown error'}`);
  }
}

export async function summarizeContent(text: string): Promise<string> {
  try {
    const sysprompt = "You are an educational assistant. Produce concise, accessible summaries highlighting key concepts. Suitable for students.";
    const userprompt = `Summarize the following educational content, focusing on key concepts and main ideas:\n\n${text}`;

    // 1. DeepSeek (primary)
    if (deepseek) {
      try {
        const result = await deepseekChat(sysprompt, userprompt, "deepseek-chat", 1000);
        if (result) return result;
      } catch (err) { console.warn("DeepSeek summarize failed:", describeError(err)); }
    }

    // 2. Gemini (fallback)
    if (googleAI) {
      try {
        const result = await geminiGenerate(`${sysprompt}\n\n${userprompt}`, "gemini-1.5-flash");
        if (result) return result;
      } catch (err) { console.warn("Gemini summarize failed:", describeError(err)); }
    }

    return localSummarize(text);
  } catch (error: any) {
    console.warn("summarizeContent fallback to local:", error?.message || error);
    return localSummarize(text);
  }
}

export async function generateFormattedSummaryAndFlashcards(text: string): Promise<{ summary_markdown: string; flashcards: Array<{ question: string; answer: string }> }> {
  try {
  const prompt = `You are a world-class educational content designer with expertise in pedagogy. Transform the following content into the highest-quality study guide possible.

PHASE 1 - MASTER STUDY GUIDE (Markdown):
Create a deeply insightful, richly structured study guide. Think like a brilliant professor writing a textbook chapter.

Structure:
1. ## [Compelling Title]: Specific, descriptive, not generic
2. **TL;DR**: 2-3 sentences capturing the essence
3. ### Key Takeaways: 5-7 critical insights, each a complete thought
4. ### [Deep Dive Sections]: 3-5 sections on natural content themes. For each:
   - Opening statement about the section
   - 2-3 paragraphs with clear, academic-depth explanations
   - Bullet points for complex sub-concepts
5. ### Real-World Application: How this knowledge applies in practice
6. ### Connections & Context: How this relates to broader knowledge

Formatting Rules:
- **Bold** every key technical term on first mention
- Use inline math $eq$ or block math $$eq$$ for ALL mathematical equations
- Use > blockquotes for important definitions or quotes
- ONLY ## and ### headings, never H1 (#)
- No JSON artifacts or code syntax in the body text

PHASE 2 - ELITE FLASHCARDS (JSON):
Generate EXACTLY 12 world-class flashcards:
- 4 Conceptual: "What is X and why does it matter?" - test core understanding
- 3 Reasoning: "Explain WHY X leads to Y" - test causal reasoning
- 2 Application: "In a real-world scenario where [Z occurs], how would you apply X?" - test practical use
- 2 Critical Analysis: "Contrast X with Y" or "What is the fundamental limitation of X?" - test depth
- 1 Synthesis: A question requiring connecting multiple concepts

Rules: Questions must be precise and unambiguous. Answers must be 2-4 comprehensive sentences.

RETURN FORMAT - Respond ONLY with valid JSON:
{"summary_markdown": "## Title\n\n**TL;DR**: ...\n\n### Key Takeaways\n\n- ...", "flashcards": [{"question": "...", "answer": "..."}]}

CONTENT TO PROCESS:
${text.substring(0, 12000)}

IMPORTANT: Return ONLY the JSON object. No preamble, no explanation.`;

    const parseFlashcardsResponse = (jsonText: string) => {
      try {
        const parsed = JSON.parse(jsonText.replace(/```json\n?|\n?```/g, ''));
        let summary_markdown = typeof parsed.summary_markdown === "string" ? parsed.summary_markdown : String(parsed.summary || "");
        // Clean up the summary to ensure proper rendering
        summary_markdown = cleanSummaryMarkdown(summary_markdown);
        let flashcards = Array.isArray(parsed.flashcards) ? parsed.flashcards.map((f: any) => ({ question: String(f.question || ""), answer: String(f.answer || "") })) : [];
        // Ensure we have exactly 10 flashcards (pad or trim if needed)
        if (flashcards.length < 10) {
          // If we have fewer than 10, try to generate more from the text
          const additionalCards = localGenerateFlashcards(text).slice(0, 10 - flashcards.length);
          flashcards = [...flashcards, ...additionalCards];
        }
        flashcards = flashcards.slice(0, 10); // Ensure max 10
        return { summary_markdown, flashcards };
      } catch (err) {
        return null;
      }
    };

    // 1. Try DeepSeek first
    if (deepseek) {
      try {
        const jsonText = await deepseekJSON("You are an expert educational content creator. Return ONLY a valid JSON object.", prompt);
        const parsed = parseFlashcardsResponse(jsonText);
        if (parsed) return parsed;
      } catch (err) {
        console.warn("DeepSeek flashcard generation failed:", describeError(err));
      }
    }

    // 2. Try Google Gemini if available
    if (googleAI) {
      try {
        const jsonText = await geminiGenerateJSON(prompt, "gemini-1.5-pro");
        const parsed = parseFlashcardsResponse(jsonText);
        if (parsed) return parsed;
      } catch (err) {
        console.warn("Google flashcard generation failed:", describeError(err));
      }
    }

    // 3. Fallback to OpenAI if configured
    if (openai) {
      try {
        const chatResp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are an expert educational content creator. Return ONLY a valid JSON object — no markdown fences, no explanation. The JSON must have: 'summary_markdown' (a well-structured markdown string) and 'flashcards' (array of {question, answer} objects with comprehensive 2-4 sentence answers)." },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          max_tokens: 4000,
        });

        const jsonText = chatResp.choices?.[0]?.message?.content || "{}";
        const parsed = parseFlashcardsResponse(jsonText);
        if (parsed) return parsed;
      } catch (err) {
        console.warn("OpenAI flashcard generation failed:", describeError(err));
      }
    }

    // 4. Default Fallback
    return {
      summary_markdown: localSummarize(text),
      flashcards: localGenerateFlashcards(text)
    };
  } catch (error: any) {
    throw new Error(`Failed to generate formatted summary: ${error?.message || 'Unknown error'}`);
  }
}

// Clean summary markdown to ensure proper rendering
function cleanSummaryMarkdown(markdown: string): string {
  if (!markdown || !markdown.trim()) return "";
  
  let cleaned = markdown.trim();
  
  // Remove any JSON artifacts or code-like structures
  cleaned = cleaned
    .replace(/```json[\s\S]*?```/g, '') // Remove JSON code blocks
    .replace(/```[\s\S]*?```/g, (match) => {
      // Keep code blocks only if they contain actual code (not JSON structures)
      if (match.includes('"summary_markdown"') || match.includes('"flashcards"')) {
        return '';
      }
      return match;
    })
    .replace(/["']?summary_markdown["']?\s*[:=]\s*/gi, '')
    .replace(/["']?flashcards?["']?\s*[:=]\s*\[[\s\S]*?\]/gi, '')
    .replace(/\{[^}]*"summary_markdown"[^}]*\}/gi, '')
    .replace(/\{[^}]*"flashcards?"[^}]*\}/gi, '');
  
  // Fix heading levels - ensure it starts with ## not #
  cleaned = cleaned.replace(/^#\s+Summary/gi, '## Summary');
  cleaned = cleaned.replace(/^#\s+/gm, '## '); // Convert single # to ## for main headings
  
  // Remove multiple consecutive blank lines (more than 2)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  // Remove leading/trailing whitespace from each line
  cleaned = cleaned.split('\n').map(line => line.trimEnd()).join('\n');
  
  // Ensure proper spacing around headings
  cleaned = cleaned.replace(/([^\n])\n(#{1,6}\s+)/g, '$1\n\n$2');
  cleaned = cleaned.replace(/(#{1,6}\s+[^\n]+)\n([^\n#])/g, '$1\n\n$2');
  
  return cleaned.trim();
}

// Local lightweight summarizer used when external AI is unavailable.
function localSummarize(text: string): string {
  if (!text || !text.trim()) return "(No content)";
  // Split into sentences (very naive)
  const sentences = text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/);
  const top = sentences.slice(0, 4).map(s => s.trim()).filter(Boolean);

  let md = "## Summary\n\n";
  if (top.length === 0) {
    md += text.substring(0, 800);
    return md;
  }

  md += "**Key Points:**\n\n";
  for (const s of top) {
    md += `- ${s}\n`;
  }

  md += "\n**Notes:** This is a fallback summary generated locally because the AI service was unavailable.\n";
  return md;
}

function localGenerateFlashcards(text: string): Array<{ question: string; answer: string }> {
  // naively pick sentences that seem like they could be important
  const sentences = text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  const cards: Array<{ question: string; answer: string }> = [];
  
  // Try to find sections that look like definitions/important points
  sentences.forEach(s => {
    if (cards.length >= 10) return;
    
    const lower = s.toLowerCase();
    // Look for sentences that explain key concepts or have list-like properties
    if (s.length > 40 && (lower.includes(' is ') || lower.includes(' are ') || lower.includes(' refers to ') || lower.includes(' defined as '))) {
      const parts = s.split(/ is | are | refers to | defined as /i);
      if (parts.length >= 2) {
        const term = parts[0].trim();
        const definition = parts.slice(1).join(' ').trim();
        if (term.length > 3 && term.length < 50 && definition.length > 10) {
          cards.push({ question: `Define: ${term}`, answer: definition });
        }
      }
    }
  });

  // Fallback if we don't have enough
  if (cards.length < 10) {
    for (let i = 0; i < sentences.length && cards.length < 10; i++) {
      const s = sentences[i];
      if (s.length < 30) continue;
      // Skip sentences we already used
      if (cards.some(c => c.answer === s)) continue;
      
      const words = s.split(/\s+/);
      const question = `Question for this section: ${words.slice(0, 6).join(' ')}...`;
      cards.push({ question, answer: s });
    }
  }
  
  return cards;
}

export async function generateQuiz(text: string): Promise<Array<{ question: string; options: string[]; correctAnswer: number }>> {
  try {
    const prompt = `You are an educational quiz generator. Create accessible multiple-choice questions that test understanding of key concepts. Respond with JSON in this format: { "questions": [{ "question": "string", "options": ["string"], "correctAnswer": number }] }

Generate 3-5 multiple choice questions based on this content:

${text}`;
    
    const parseQuizResponse = (jsonText: string) => {
      try {
        const parsed = JSON.parse(jsonText.replace(/```json\n?|\n?```/g, ''));
        return parsed.questions || [];
      } catch {
        return null;
      }
    };

    if (deepseek) {
      try {
        const jsonText = await deepseekJSON("You are an educational quiz generator. Respond with JSON: { \"questions\": [{ \"question\": \"string\", \"options\": [\"string\"], \"correctAnswer\": number }] }", prompt);
        const parsed = parseQuizResponse(jsonText);
        if (parsed) return parsed;
      } catch (err) {
        console.warn("DeepSeek quiz generation failed:", describeError(err));
      }
    }

    if (googleAI) {
      try {
        const jsonText = await geminiGenerateJSON(prompt, "gemini-1.5-flash");
        const parsed = parseQuizResponse(jsonText);
        if (parsed) return parsed;
      } catch (err) {
        console.warn("Google quiz generation failed:", describeError(err));
      }
    }

    if (openai) {
      try {
        const chatResp = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: "You are an educational quiz generator. Respond with JSON: { \"questions\": [...] }" },
            { role: "user", content: prompt },
          ],
          max_tokens: 800,
        });
        const jsonText = chatResp.choices?.[0]?.message?.content || "{}";
        const parsed = parseQuizResponse(jsonText);
        if (parsed) return parsed;
      } catch (err) {
        console.warn("OpenAI quiz generation failed:", describeError(err));
      }
    }

    return [];
  } catch (error: any) {
    throw new Error(`Failed to generate quiz: ${error?.message || 'Unknown error'}`);
  }
}

export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  try {
    if (!openai) {
      throw new Error("OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.");
    }

    // Save to temporary file for OpenAI Whisper API
    // The OpenAI SDK for Node.js works best with file paths or readable streams
    const tempDir = "uploads";
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Determine file extension from mimeType
    let extension = "mp3";
    if (mimeType?.includes("wav")) extension = "wav";
    else if (mimeType?.includes("m4a")) extension = "m4a";
    else if (mimeType?.includes("webm")) extension = "webm";
    else if (mimeType?.includes("mp4")) extension = "mp4";
    else if (mimeType?.includes("ogg")) extension = "ogg";
    
    const tempFilePath = path.join(tempDir, `whisper_${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`);
    
    try {
      // Write buffer to temp file
      fs.writeFileSync(tempFilePath, audioBuffer);
      
      // Create a readable stream from the file
      // The OpenAI SDK for Node.js accepts File objects (Node.js 18+) or readable streams
      const fileStream = fs.createReadStream(tempFilePath);
      
      // Try to create a File object (available in Node.js 18+)
      // If File is not available, we'll use the stream directly
      let file: File | fs.ReadStream;
      try {
        // File API is available in Node.js 18+
        file = new File([new Uint8Array(audioBuffer)], `audio.${extension}`, { type: mimeType || `audio/${extension}` });
      } catch {
        // Fallback to stream if File is not available
        file = fileStream;
      }
      
      // Use OpenAI Whisper API for transcription
      const transcription = await openai.audio.transcriptions.create({
        file: file as any, // SDK accepts File or ReadStream
        model: "whisper-1",
        language: "en", // Optional: specify language for better accuracy
        response_format: "text", // Get plain text response
      });

      // The response is a string when response_format is "text"
      return typeof transcription === "string" ? transcription : String(transcription);
    } finally {
      // Clean up temp file
      if (fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (cleanupError) {
          console.warn("Failed to cleanup temp file:", cleanupError);
        }
      }
    }
  } catch (error: any) {
    console.error("Whisper transcription error:", error);
    throw new Error(`Failed to transcribe audio: ${error?.message || 'Unknown error'}`);
  }
}

export async function generatePodcastScript(transcript: string, summary?: string): Promise<string> {
  try {
    // Use raw document content as the primary source, summary as context only
    const sourceContent = transcript.substring(0, 12000);

    const prompt = `You are a world-class podcast script writer who creates episodes for a show called "Vidya Insights." Your scripts are always spoken naturally and never contain any markdown, symbols, or formatting characters.

TASK: Write a complete, engaging podcast script based on the following document content. This script will be read aloud by a text-to-speech engine.

CRITICAL RULES - THESE ARE ABSOLUTE:
1. NO markdown whatsoever. Zero hashtags (#), zero asterisks (*), zero underscores (_), zero backticks (\`), zero brackets [], zero dashes as bullets (-), zero numbered lists with periods (1.), zero angle brackets.
2. NO symbols that sound awkward when spoken: no &, no >, no <, no |, no =, no ^, no ~, no @
3. Write ONLY natural spoken English. Every sentence must sound exactly right when read aloud.
4. Instead of bullet points, use phrases like "First...", "Second...", "Another key point is...", "And importantly..."
5. Instead of headings, use natural transitions like "Let's start by talking about...", "Moving on to...", "Now, one of the most fascinating aspects is..."
6. Write as if you are a knowledgeable, enthusiastic host speaking to a curious listener.
7. The script must flow naturally from beginning to end with zero awkward pauses.
8. Length: approximately 400 to 600 words — substantive but not exhausting.

STRUCTURE (use these as natural spoken transitions, not headings):
- Opening Hook: Start with an intriguing question, surprising fact, or bold statement that grabs attention immediately. Do not begin with "Welcome" or "Hello."
- Topic Introduction: Establish what this episode is about in plain conversational terms
- Main Content: Cover 3 to 4 key concepts from the document, explained clearly with examples and analogies
- Real-World Relevance: Explain why this matters and how it applies in practice
- Closing Takeaway: A memorable final thought or call to action for the listener

DOCUMENT CONTENT TO CONVERT INTO A PODCAST:
${sourceContent}

Write the podcast script now. Begin directly with the opening hook. Output nothing else — just the spoken script.`;

    let script = "";

    // 1. Try DeepSeek first
    if (deepseek) {
      try {
        script = await deepseekChat(
          "You are a professional podcast script writer. You write ONLY clean, natural spoken English. You NEVER use markdown, hashtags, asterisks, bullet points, numbered lists, brackets, or any symbols. Every word you write must sound perfectly natural when read aloud by a text-to-speech engine.",
          prompt,
          "deepseek-chat",
          1200
        );
      } catch (err: any) {
        console.warn("DeepSeek podcast script generation failed:", describeError(err));
      }
    }

    // 2. Try Google Gemini
    if (!script && googleAI) {
      try {
        script = await geminiGenerate(prompt, "gemini-1.5-pro");
      } catch (err: any) {
        console.warn("Gemini podcast script generation failed:", describeError(err));
      }
    }

    // Fallback to OpenAI
    if (!script && openai) {
      try {
        const chatResp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a professional podcast script writer. You write ONLY clean, natural spoken English. You NEVER use markdown, hashtags, asterisks, bullet points, numbered lists, brackets, or any symbols. Every word you write must sound perfectly natural when read aloud by a text-to-speech engine."
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 1200,
          temperature: 0.75,
        });
        script = chatResp.choices?.[0]?.message?.content || "";
      } catch (err: any) {
        console.warn("OpenAI podcast script generation failed:", describeError(err));
      }
    }

    // Post-process to aggressively strip any remaining markdown symbols
    if (script) {
      script = cleanScriptForSpeech(script);
      return script;
    }

    // Fallback: clean the raw transcript enough to read aloud
    return cleanScriptForSpeech(
      `Today we are diving into a fascinating topic. ${transcript.substring(0, 2000)}`
    );

  } catch (error: any) {
    throw new Error(`Failed to generate podcast script: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Strips ALL markdown and special symbols from text so it reads
 * cleanly aloud by a TTS engine.
 */
function cleanScriptForSpeech(text: string): string {
  return text
    // Remove markdown headings (##, ###, #)
    .replace(/^#{1,6}\s+/gm, "")
    // Remove bold/italic markers (**, __, *, _)
    .replace(/\*{1,3}|_{1,3}/g, "")
    // Remove inline code backticks
    .replace(/`{1,3}[^`]*`{1,3}/g, (match) => match.replace(/`/g, ""))
    // Remove blockquote markers
    .replace(/^>\s*/gm, "")
    // Remove bullet/list markers (-, *, +, numbered)
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    // Remove horizontal rules
    .replace(/^-{3,}|={3,}|\*{3,}/gm, "")
    // Remove HTML tags
    .replace(/<[^>]+>/g, "")
    // Remove markdown links, keep link text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove image markdown
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    // Remove special characters that sound awkward in speech
    .replace(/[&<>|^~@#=\[\]{}\\]/g, "")
    // Replace multiple spaces/newlines with single
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    // Clean up lines that are now empty or just whitespace
    .split("\n").map(line => line.trim()).filter(line => line.length > 0).join("\n\n")
    .trim();
}


export async function generateSpeech(text: string, voiceId: string = "alloy"): Promise<Buffer | null> {
  try {
    if (!openai) {
      console.log("OpenAI API key not configured - TTS skipped");
      return null;
    }

    // Strip any remaining markdown/symbols before sending to TTS
    // so the voice doesn't read hashtags, asterisks, etc.
    const cleanText = cleanScriptForSpeech(text);

    // Use OpenAI TTS API - tts-1-hd for higher quality
    const response = await openai.audio.speech.create({
      model: "tts-1-hd",
      voice: voiceId as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer",
      input: cleanText.substring(0, 4096), // TTS API has character limits
    });

    // Convert response to buffer
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error: any) {
    console.error("TTS generation failed:", error);
    return null;
  }
}

export async function generateChatAnswer(question: string, summary: string, extractedText: string): Promise<string> {
  try {
    // Parse summary to get only the markdown text (not JSON)
    let cleanSummary = "";
    if (summary) {
      try {
        // Try to parse as JSON first
        if (summary.trim().startsWith("{")) {
          const parsed = JSON.parse(summary);
          cleanSummary = parsed.summary_markdown || parsed.summary || "";
        } else {
          cleanSummary = summary;
        }
      } catch {
        cleanSummary = summary;
      }
      
      // Clean flashcard data
      cleanSummary = cleanSummary
        .replace(/["']?flashcards?["']?\s*[:=]\s*\[[\s\S]*?\]/gi, '')
        .replace(/["']?question["']?\s*[:=]\s*["'][^"']*["']/gi, '')
        .replace(/["']?answer["']?\s*[:=]\s*["'][^"']*["']/gi, '')
        .replace(/\{[^}]*"flashcards?"[^}]*\}/gi, '')
        .trim();
    }
    
    const cleanText = (extractedText || "")
      .replace(/["']?flashcards?["']?\s*[:=]\s*\[[\s\S]*?\]/gi, '')
      .replace(/["']?question["']?\s*[:=]\s*["'][^"']*["']/gi, '')
      .replace(/["']?answer["']?\s*[:=]\s*["'][^"']*["']/gi, '')
      .replace(/\{[^}]*"flashcards?"[^}]*\}/gi, '')
      .trim();
    
    const context = `${cleanSummary}\n\n${cleanText}`.substring(0, 8000); // Limit context size
    
    // Determine question type for better prompting
    const isTakeaways = /takeaway|important|key|main|summary|overview|highlights|conclusion/i.test(question);
    const isList = /list|what are|name|examples|steps|ways|items|enumerate|many|several/i.test(question);
    const isDefinition = /what is|what are|define|definition|explain|meaning|describe|tell me about/i.test(question);
    const isHow = /how|process|method|approach|work|function/i.test(question);
    
    let questionGuidance = "";
    if (isTakeaways) {
      questionGuidance = "The student is asking for key takeaways or important points. Extract and list the most important concepts, findings, or conclusions from the document. Format as a numbered or bulleted list with clear headings.";
    } else if (isList) {
      questionGuidance = "The student wants a list. Provide a clear numbered or bulleted list of items. Each item should be a complete thought.";
    } else if (isDefinition) {
      questionGuidance = "The student wants a definition or explanation. Provide a clear, comprehensive definition with context and examples if available.";
    } else if (isHow) {
      // Guidance handled in the prompt instructions
    }

    const prompt = `You are Vidya AI — the world's most brilliant and encouraging personal tutor. You have mastered every academic discipline. Your teaching style combines Feynman's clarity, Socratic depth, and genuine enthusiasm.

SOURCE MATERIAL:
${context.length > 150 ? `You have the student's study notes to reference:
--- STUDY NOTES ---
${context.substring(0, 6000)}
--- END NOTES ---
Use these notes as primary truth for document-specific questions. Cite details naturally.` : 'You are answering from your vast general knowledge.'}

RESPONSE RULES:
1. Answer DIRECTLY and COMPLETELY. No filler phrases like "Great question!" or "Certainly!"
2. Structure: Start with a clear, direct 1-2 sentence answer. Then elaborate.
3. Use **bold** for key terms, bullet points for lists, \`code formatting\` for technical expressions
4. Mathematical expressions: use $inline$ or $$block$$ LaTeX notation
5. Match depth to complexity: simple questions get crisp answers; complex ones get rich coverage
6. NEVER say: "the document says", "based on the text", "as an AI", "I cannot", "the provided content"
7. If notes lack info on a general question, use your expert knowledge without mentioning the gap
8. When useful, add one golden insight that connects the concept to a bigger idea

STUDENT QUESTION: "${question}"

VIDYA AI RESPONSE:`;

    // 1. Try DeepSeek first
    if (deepseek) {
      try {
        const result = await deepseekChat(prompt, "", "deepseek-chat", 1800);
        if (result) return result;
      } catch (err: any) {
        console.warn("DeepSeek chat answer failed:", describeError(err));
      }
    }

    // 2. Try Google Gemini if available
    if (googleAI) {
      try {
        const result = await geminiGenerate(prompt, "gemini-1.5-pro");
        return result || "";
      } catch (err: any) {
        console.warn("Google Gemini chat answer failed:", describeError(err));
      }
    }

    // Fallback to OpenAI if configured
    if (openai) {
      try {
        const chatResp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are Vidya AI, a world-class educational tutor. Rules:
1. Answer questions directly and comprehensively — never be vague  
2. For document questions: use the provided notes as truth. For general questions: use your expert knowledge
3. NEVER say "the document says", "based on the text", "I cannot", "as an AI"
4. Format using markdown: **bold** key terms, bullet points, \`inline code\` for technical terms
5. Start with a concise direct answer, then elaborate with depth and examples
6. ${questionGuidance}`
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 1800,
          temperature: 0.5, // Lower temperature for more focused answers
        });

        const content = chatResp.choices?.[0]?.message?.content || "";
        return content;
      } catch (err: any) {
        console.warn("OpenAI chat answer failed:", describeError(err));
      }
    }

    // Fallback to improved local matching
    return generateLocalAnswer(question, cleanSummary, cleanText);
  } catch (error: any) {
    console.warn("generateChatAnswer error:", error?.message || error);
    return generateLocalAnswer(question, summary, extractedText);
  }
}

function generateLocalAnswer(question: string, summary: string, extractedText: string): string {
  const corpus = `${summary}\n\n${extractedText}`.trim();
  
  // Check if question is clearly not about the document (general question)
  const isGeneralQuestion = !corpus || corpus.length < 50 || 
    (!question.toLowerCase().includes('document') && 
     !question.toLowerCase().includes('notes') && 
     !question.toLowerCase().includes('material') &&
     !question.toLowerCase().includes('content') &&
     !question.toLowerCase().includes('reading') &&
     !question.toLowerCase().includes('text'));
  
  if (!corpus || corpus.length < 50) {
    // If it's a general question and no document content, provide a helpful response
    if (isGeneralQuestion) {
      return "I'm here to help! However, I don't have access to your document content yet, or this appears to be a general question. For document-specific questions, please wait until your document is processed. For general questions, I'd recommend using an AI assistant with broader knowledge access.";
    }
    return "I don't have any notes to reference yet. Try again after processing finishes.";
  }

  // Clean corpus - remove markdown artifacts and JSON
  let cleanCorpus = corpus
    .replace(/```[\s\S]*?```/g, '')
    .replace(/["']?flashcards?["']?\s*[:=]\s*\[[\s\S]*?\]/gi, '')
    .replace(/["']?question["']?\s*[:=]\s*["'][^"']*["']/gi, '')
    .replace(/["']?answer["']?\s*[:=]\s*["'][^"']*["']/gi, '')
    .replace(/\{[^}]*"flashcards?"[^}]*\}/gi, '')
    .trim();

  // Split into sentences and paragraphs
  const paragraphs = cleanCorpus.split(/\n\n+/).filter(p => {
    const trimmed = p.trim();
    return trimmed.length > 30 && 
           !trimmed.toLowerCase().includes('"question"') &&
           !trimmed.toLowerCase().includes('"answer"');
  });
  
  const sentences = cleanCorpus.split(/(?<=[.!?])\s+/).filter(s => {
    const trimmed = s.trim();
    const lower = trimmed.toLowerCase();
    return trimmed.length > 20 &&
           !lower.includes('"question"') && 
           !lower.includes('"answer"') && 
           !lower.includes('"flashcards"') &&
           !lower.startsWith('question:') &&
           !lower.startsWith('answer:');
  });
  
  // Extract meaningful keywords from question
  const questionLower = question.toLowerCase().trim();
  const questionWords = questionLower.split(/\W+/).filter(w => w.length > 0);
  
  // Identify question type and extract relevant keywords
  const isTakeawaysQuestion = /takeaway|important|key|main|summary|overview|highlights/i.test(question);
  const isListQuestion = /list|what are|name|examples|steps|ways|items|enumerate|many/i.test(question);
  const isDefinitionQuestion = /what is|what are|define|definition|explain|meaning|describe/i.test(question);
  
  // Extract keywords - keep important words even if short
  const keywords = questionWords
    .filter((word) => {
      // Keep important words
      if (['key', 'main', 'important', 'takeaway', 'takeaways', 'summary', 'overview'].includes(word)) return true;
      // Keep words longer than 3 chars
      if (word.length > 3) return true;
      return false;
    })
    .filter(word => !['what', 'when', 'where', 'why', 'how', 'does', 'doesn', 'isn', 'aren', 'the', 'are', 'is', 'a', 'an'].includes(word));
  
  // For "takeaways" or "important" questions, look for summary sections, key points, etc.
  if (isTakeawaysQuestion) {
    // Look for sections with "key", "important", "summary", "main", etc.
    const keySections = paragraphs.filter(p => {
      const lower = p.toLowerCase();
      return /key|important|main|summary|overview|takeaway|conclusion|highlights/i.test(lower);
    });
    
    if (keySections.length > 0) {
      const formatted = keySections.slice(0, 3).map((section, i) => {
        // Extract key points if it's a list
        const lines = section.split(/\n/).filter(l => l.trim().length > 10);
        if (lines.length > 1) {
          return lines.slice(0, 5).map((line, idx) => `${idx + 1}. ${line.trim()}`).join("\n");
        }
        return section.trim();
      }).join("\n\n");
      
      return `## Key Takeaways\n\n${formatted}`;
    }
    
    // Fallback: use first few paragraphs from summary
    if (summary) {
      const summaryParagraphs = summary.split(/\n\n+/).filter(p => p.trim().length > 30).slice(0, 5);
      if (summaryParagraphs.length > 0) {
        return `## Key Takeaways\n\n${summaryParagraphs.map((p, i) => `${i + 1}. ${p.trim()}`).join("\n\n")}`;
      }
    }
  }
  
  // Score paragraphs and sentences based on relevance
  const scoredParagraphs = paragraphs.map(p => {
    const lower = p.toLowerCase();
    let score = 0;
    
    // Exact keyword matches (higher weight)
    keywords.forEach(keyword => {
      const matches = (lower.match(new RegExp(`\\b${keyword}\\b`, 'gi')) || []).length;
      score += matches * 5; // Much higher weight for exact matches
    });
    
    // Semantic matching for question types
    if (isDefinitionQuestion) {
      if (lower.includes('is') || lower.includes('are') || lower.includes('means') || lower.includes('refers') || lower.includes('defined')) {
        score += 8;
      }
    }
    if (isListQuestion) {
      if (lower.match(/\d+\.|•|[-*]|\*/)) score += 5; // Has list markers
    }
    if (isTakeawaysQuestion) {
      if (lower.includes('key') || lower.includes('important') || lower.includes('main') || lower.includes('summary') || lower.includes('conclusion')) {
        score += 6;
      }
    }
    const isHowQuestion = /how|process|method|approach|work|function/i.test(question);
    if (isHowQuestion) {
      if (lower.includes('how') || lower.includes('process') || lower.includes('step') || lower.includes('method')) {
        score += 5;
      }
    }
    
    // Bonus for longer, more informative paragraphs
    if (p.length > 100) score += 2;
    if (p.length > 200) score += 3;
    
    return { text: p.trim(), score };
  }).filter(p => p.score > 0 || paragraphs.length < 3).sort((a, b) => b.score - a.score);
  
  const scoredSentences = sentences.map(s => {
    const lower = s.toLowerCase();
    let score = 0;
    keywords.forEach(keyword => {
      const matches = (lower.match(new RegExp(`\\b${keyword}\\b`, 'gi')) || []).length;
      score += matches * 3; // Higher weight for keyword matches
    });
    // Bonus for sentences that start with key terms
    if (keywords.some(kw => lower.startsWith(kw) || lower.includes(` ${kw} `))) score += 4;
    // Bonus for definition-like sentences
    if (isDefinitionQuestion && (lower.includes('is') || lower.includes('are') || lower.includes('means'))) score += 3;
    // Penalty for very short sentences
    if (s.length < 30) score -= 1;
    return { text: s.trim(), score };
  }).filter(s => s.score > 0 || sentences.length < 10).sort((a, b) => b.score - a.score);
  
  // Combine best content
  const bestContent: string[] = [];
  
  // Add top paragraphs (prioritize those with higher scores)
  scoredParagraphs.slice(0, 3).forEach(p => {
    const text = p.text;
    // Avoid duplicates
    if (!bestContent.some(existing => {
      const overlap = existing.toLowerCase().includes(text.substring(0, 50).toLowerCase()) ||
                     text.toLowerCase().includes(existing.substring(0, 50).toLowerCase());
      return overlap;
    })) {
      bestContent.push(text);
    }
  });
  
  // Add top sentences that aren't already in paragraphs
  scoredSentences.slice(0, 7).forEach(s => {
    const text = s.text;
    const isInParagraph = bestContent.some(p => {
      const pLower = p.toLowerCase();
      const sLower = text.toLowerCase();
      return pLower.includes(sLower.substring(0, 40)) || sLower.includes(pLower.substring(0, 40));
    });
    if (!isInParagraph && text.length > 20) {
      bestContent.push(text);
    }
  });
  
  if (bestContent.length === 0) {
    // Last resort: return first meaningful paragraph
    const firstParagraph = paragraphs[0] || sentences.slice(0, 3).join(" ");
    if (firstParagraph && firstParagraph.length > 30) {
      return firstParagraph;
    }
    return "I couldn't find a direct answer in the notes. Try rephrasing or review the summary above.";
  }
  
  // Format the answer based on question type
  if (isListQuestion && bestContent.length > 1) {
    const listItems = bestContent.slice(0, 6).map((item, i) => {
      // Clean up the item - remove heading markers
      const cleaned = item.replace(/^#{1,6}\s+/, '').replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '').trim();
      return `${i + 1}. ${cleaned}`;
    });
    // Start with a brief intro, then list
    return `${listItems.join("\n\n")}`;
  }
  
  if (isDefinitionQuestion) {
    const mainAnswer = bestContent[0].replace(/^#{1,6}\s+/, '').trim();
    const additionalInfo = bestContent.slice(1, 3).filter(c => c.length > 30).map(c => c.replace(/^#{1,6}\s+/, '').trim()).join(" ");
    
    // Bold keywords
    let formatted = mainAnswer;
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      formatted = formatted.replace(regex, (match) => {
        if (formatted.includes(`**${match}**`) || formatted.includes(`\`${match}\``)) {
          return match;
        }
        return `**${match}**`;
      });
    });
    
    // For definitions, start with a paragraph, not a heading
    if (additionalInfo) {
      return `${formatted}\n\n${additionalInfo}`;
    }
    return formatted;
  }
  
  // Default: format as a comprehensive answer
  if (bestContent.length === 1) {
    // Single paragraph - format nicely (NOT as heading)
    let answer = bestContent[0];
    
    // Remove any heading markers that might be in the content
    answer = answer.replace(/^#{1,6}\s+/, '').trim();
    
    // Bold keywords
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      answer = answer.replace(regex, (match) => {
        if (answer.includes(`**${match}**`) || answer.includes(`\`${match}\``)) {
          return match;
        }
        return `**${match}**`;
      });
    });
    
    return answer;
  }
  
  // Multiple items - format as structured answer
  let formattedAnswer = "";
  
  // If content has list markers, preserve them
  const hasListMarkers = bestContent.some(c => /^\d+\.|^[-*•]|^\*/.test(c.trim()));
  
  if (hasListMarkers || isListQuestion) {
    formattedAnswer = `${bestContent.slice(0, 6).map((item, i) => {
      // Remove heading markers
      const cleaned = item.replace(/^#{1,6}\s+/, '').replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '').replace(/^\*\s*/, '').trim();
      return `${i + 1}. ${cleaned}`;
    }).join("\n\n")}`;
  } else {
    // Format as paragraphs with proper structure (NOT headings)
    const mainAnswer = bestContent[0].replace(/^#{1,6}\s+/, '').trim();
    const supportingInfo = bestContent.slice(1, 4).map(c => c.replace(/^#{1,6}\s+/, '').trim());
    
    // Bold keywords in main answer
    let formattedMain = mainAnswer;
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      formattedMain = formattedMain.replace(regex, (match) => {
        if (formattedMain.includes(`**${match}**`) || formattedMain.includes(`\`${match}\``)) {
          return match;
        }
        return `**${match}**`;
      });
    });
    
    formattedAnswer = formattedMain;
    if (supportingInfo.length > 0) {
      formattedAnswer += "\n\n" + supportingInfo.join("\n\n");
    }
  }
  
  return formattedAnswer || "I couldn't find a direct answer in the notes. Try rephrasing or review the summary above.";
}

export async function generateMindMap(text: string): Promise<{ chart: string; explanations: Record<string, string> }> {
  try {
    const contentPreview = text.substring(0, 15000);

    const prompt = `You are an expert educational content designer who creates rich, interactive concept maps based STRICTLY on the provided document.

TASK: Analyze the following document and create a comprehensive Mermaid.js mindmap WITH deep, context-rich explanations. 
DO NOT generate generic dictionary definitions. Every node and every explanation MUST be derived directly from the specifics, arguments, and data presented in the text.

MERMAID MINDMAP SYNTAX RULES (FOLLOW EXACTLY):
1. Start with: mindmap
2. The root node uses double parentheses: root((Topic Name))
3. First level children use 4 spaces of indentation (child nodes)
4. Second level uses 8 spaces
5. Third level uses 12 spaces
6. Node labels: ONLY use plain alphanumeric text, spaces, and hyphens. NO colons, quotes, brackets, parentheses in labels (except root which uses double parens).
7. Generate 15-25 nodes total for a rich map
8. Keep labels SHORT: 2-5 words maximum per node

EXAMPLE OF VALID SYNTAX:
mindmap
  root((Machine Learning))
    Supervised Learning
      Classification
        Decision Trees
        Neural Networks
      Regression
        Linear Models
    Unsupervised Learning
      Clustering
      Dimensionality Reduction
    Applications
      Computer Vision
      Natural Language

RETURN FORMAT: A valid JSON object with exactly these two keys:
{
  "chart": "mindmap\\n  root((Topic))\\n    Branch 1\\n      Sub Point 1\\n    Branch 2",
  "explanations": {
    "Branch 1": "A 2-3 sentence explanation of how this concept specifically relates to the document's main thesis.",
    "Sub Point 1": "A detailed explanation including exact examples, facts, or data points mentioned in the text regarding this topic.",
    "Branch 2": "Explanation pulling specific context from the document."
  }
}

IMPORTANT RULES FOR EXPLANATIONS:
- Every node (except root) MUST have an explanation entry
- Keys in explanations MUST exactly match the label text in the chart
- EXPLANATIONS MUST BE SPECIFIC TO THE DOCUMENT. Do not write "X is defined as Y". Write "In this document, X is shown to lead to Y because of Z." Include specific facts, numbers, or arguments from the text. Length: 2-4 sentences.

DOCUMENT TO ANALYZE:
${contentPreview}

Respond with ONLY the JSON object. No markdown fences, no extra text.`;

    const defaultFallback = {
      chart: `mindmap\n  root((Document Overview))\n    Key Concepts\n      Main Ideas\n      Core Principles\n    Details\n      Supporting Facts\n      Examples\n    Applications\n      Real World Use\n      Practical Steps\n    Summary\n      Key Takeaways\n      Action Items`,
      explanations: {
        "Key Concepts": "The fundamental ideas and principles that form the foundation of this document's subject matter.",
        "Main Ideas": "The primary arguments or central themes that the author develops throughout the content.",
        "Core Principles": "Foundational rules or theories that underpin the entire topic being discussed.",
        "Details": "Specific supporting information, data points, and evidence that substantiate the main concepts.",
        "Supporting Facts": "Factual information and data that validates and strengthens the document's key arguments.",
        "Examples": "Concrete instances and case studies that illustrate how the concepts apply in practice.",
        "Applications": "Practical ways the knowledge from this document can be applied in real situations.",
        "Real World Use": "How these concepts manifest in actual practice, industry, or everyday scenarios.",
        "Practical Steps": "Actionable procedures or methods derived from the document's content.",
        "Summary": "A high-level synthesis of the most important insights from across the entire document.",
        "Key Takeaways": "The most crucial points the reader should remember and internalize.",
        "Action Items": "Specific next steps or changes one could implement based on this material."
      }
    };

    const parseResponse = (raw: string): { chart: string; explanations: Record<string, string> } | null => {
      try {
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) return null;
        let jsonText = match[0];
        
        let parsed;
        try {
          parsed = JSON.parse(jsonText);
        } catch (err: any) {
          // Attempt to fix unescaped newlines within JSON strings (common LLM mistake)
          // We'll replace real newlines with \n but only safely
          try {
             const fixed = jsonText
                .replace(/\n\s*root/g, "\\n  root")
                .replace(/\n\s{4,}/g, "\\n    ");
             parsed = JSON.parse(fixed);
          } catch (e2) {
             console.warn("ParseResponse string fix failed.", "RAW:", raw);
             throw err;
          }
        }

        if (parsed.chart && typeof parsed.chart === 'string' &&
            parsed.explanations && typeof parsed.explanations === 'object') {
          // Validate the chart starts with mindmap
          let chart = parsed.chart.trim();
          chart = chart.replace(/^```(?:mermaid)?\n?/i, '').replace(/\n?```$/i, '').trim();
          
          if (!chart.startsWith('mindmap')) {
            console.warn("ParseResponse failed: chart did not start with mindmap:", chart);
            return null;
          }
          return { chart, explanations: parsed.explanations };
        }
      } catch (err) {
        console.warn("ParseResponse JSON parse error:", err);
      }
      return null;
    };

    // 1. Try DeepSeek first
    if (deepseek) {
      try {
        const raw = await deepseekJSON("You are a Mermaid.js expert and educational content designer. You return ONLY valid JSON with 'chart' and 'explanations' keys. The chart must be a valid Mermaid mindmap. Never use any characters in node labels that would break Mermaid parsing.", prompt);
        const parsed = parseResponse(raw);
        if (parsed) return parsed;
        console.warn("DeepSeek mindmap returned invalid structure, trying fallback...");
      } catch (err) {
        console.warn("DeepSeek mindmap generation failed:", describeError(err));
      }
    }

    // 2. Try Google Gemini
    if (googleAI) {
      try {
        const raw = await geminiGenerateJSON(prompt, "gemini-1.5-flash"); // Flash is more stable than pro in v1 SDK
        const parsed = parseResponse(raw);
        if (parsed) return parsed;
        console.warn("Gemini mindmap returned invalid structure, trying fallback...");
      } catch (err) {
        console.warn("Google mindmap generation failed:", describeError(err));
      }
    }

    // Fallback to OpenAI
    if (openai) {
      try {
        const chatResp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a Mermaid.js expert and educational content designer. You return ONLY valid JSON with 'chart' and 'explanations' keys. The chart must be a valid Mermaid mindmap. Never use any characters in node labels that would break Mermaid parsing."
            },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          max_tokens: 2000,
          temperature: 0.4,
        });
        const content = chatResp.choices?.[0]?.message?.content || "";
        const parsed = parseResponse(content);
        if (parsed) return parsed;
      } catch (err) {
        console.warn("OpenAI mindmap generation failed:", describeError(err));
      }
    }

    // If ALL APIs fail (due to balance, quota, invalid keys) return an error map
    return {
      chart: "mindmap\n  root((API Error))\n    Check Credits\n      DeepSeek Balance Zero\n      Gemini Quota Exceeded\n    Action Required\n      Update Environment Keys",
      explanations: {
        "Check Credits": "Both DeepSeek and Gemini API calls failed to generate the mind map.",
        "DeepSeek Balance Zero": "Your DeepSeek account returned a 402 Insufficient Balance error.",
        "Gemini Quota Exceeded": "Your Google Gemini account returned a Quota/Rate Limit error.",
        "Action Required": "Please top up your DeepSeek balance or wait for Gemini rate limits to reset.",
        "Update Environment Keys": "You can add new API keys in your .env file."
      }
    };
  } catch (error: any) {
    console.warn("generateMindMap final catch error:", error?.message || error);
    return {
      chart: "mindmap\n  root((Error))\n    Generation Failed\n      Top-up required",
      explanations: { "Generation Failed": "Mind map generation completely failed.", "Top-up required": "Check your API credits." }
    };
  }
}
