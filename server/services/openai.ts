import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";

// Initialize Google Gemini client only if key present
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const googleAI = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

// Initialize OpenAI client as a fallback when available
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
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
      const response = await googleAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: base64Image,
                  mimeType: "image/jpeg",
                },
              },
            ],
          },
        ],
      });

      return response.text || "";
    }

    // Fallback: if Google client not available, return empty string
    return "";
  } catch (error: any) {
    throw new Error(`Failed to extract text from image: ${error?.message || 'Unknown error'}`);
  }
}

export async function summarizeContent(text: string): Promise<string> {
  try {
    const prompt = `You are an educational assistant. Create concise, accessible summaries that highlight key concepts and learning objectives. Make the summary suitable for students with disabilities.\n\nPlease summarize the following educational content, focusing on key concepts and main ideas:\n\n${text}`;

    // Try Google Gemini first if available
    if (googleAI) {
      try {
        const response = await googleAI.models.generateContent({ model: "gemini-2.5-flash", contents: prompt });
        return response.text || localSummarize(text);
      } catch (err: any) {
        console.warn("Google Gemini summarize failed:", describeError(err));
      }
    }

    // Fallback to OpenAI Chat Completions if configured
    if (openai) {
      try {
        const chatResp = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: "You are an educational assistant. Produce concise accessible summaries." },
            { role: "user", content: prompt },
          ],
          max_tokens: 1000,
        });

        const content = chatResp.choices?.[0]?.message?.content || "";
        return content || localSummarize(text);
      } catch (err: any) {
        console.warn("OpenAI summarize failed:", describeError(err));
      }
    }

    return localSummarize(text);
  } catch (error: any) {
    // If AI call fails (missing API key / permission), return a local fallback summary
    console.warn("summarizeContent fallback to local summarizer:", error?.message || error);
    return localSummarize(text);
  }
}

export async function generateFormattedSummaryAndFlashcards(text: string): Promise<{ summary_markdown: string; flashcards: Array<{ question: string; answer: string }> }> {
  try {
     const prompt = `You are an educational assistant. Create a well-structured, clean summary in Markdown format.

  CRITICAL FORMATTING REQUIREMENTS:
  1. Use proper Markdown syntax - clean, readable, and well-structured
  2. Start with a main heading using ## (not #)
  3. Use ### for subheadings to organize sections
  4. Use **bold** for key terms, important concepts, and definitions
  5. Use bullet points (- or *) for lists of items, concepts, or key points
  6. Use numbered lists (1., 2., 3.) for sequential steps or ordered information
  7. For mathematical expressions:
    - ALWAYS use triple backticks (\`\`\`math ... \`\`\` blocks) for ALL math equations in the summary
    - Example: 
      \`\`\`math
      E = mc^2
      \`\`\`
    - DO NOT use $...$ or $$...$$ for math in the summary
  8. Use proper paragraph breaks (blank lines) between sections
  9. DO NOT include:
    - Raw code blocks unless absolutely necessary
    - JSON structures or code-like syntax
    - Unescaped special characters that break rendering
    - Multiple consecutive blank lines
    - Markdown syntax errors
    - Any flashcard questions or answers in the summary. The summary must ONLY contain the document content, not flashcards.

  STRUCTURE GUIDELINES:
  - Begin with a brief overview paragraph (2-3 sentences)
  - Organize content into logical sections with ### subheadings
  - Use bullet points for key concepts, takeaways, or important points
  - Use numbered lists for processes, steps, or sequential information
  - End with a brief conclusion or summary of main points

  CONTENT REQUIREMENTS:
  - Be comprehensive but concise
  - Focus on key concepts, main ideas, and important details
  - Make it accessible and easy to understand
  - Highlight important terms and definitions with **bold**

  Return a JSON object with exactly two fields:
  1. "summary_markdown": A clean, well-formatted Markdown summary following all the rules above
  2. "flashcards": An array of exactly 10 flashcards, each with {"question":"...","answer":"..."}

  IMPORTANT: The summary_markdown must be clean Markdown that will render perfectly in a Markdown viewer. No raw code, no JSON artifacts, just clean, readable formatted text. Do NOT include any flashcard questions or answers in the summary.

  Content to summarize:
  ${text}

  Return ONLY valid JSON with no additional text before or after.`;

    // First try Google Gemini if available
    if (googleAI) {
      try {
        const response = await googleAI.models.generateContent({ model: "gemini-2.5-flash", contents: prompt });
        const jsonText = response.text || "{}";
        try {
          const parsed = JSON.parse(jsonText);
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
          return { summary_markdown: response.text || localSummarize(text), flashcards: [] };
        }
      } catch (err) {
        console.warn("Google quiz generation failed:", describeError(err));
      }
    }

    // Fallback to OpenAI if configured
    if (openai) {
      try {
        const chatResp = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: `You are an educational assistant. Create a well-structured, clean summary in Markdown format.

CRITICAL FORMATTING REQUIREMENTS:
1. Use proper Markdown syntax - clean, readable, and well-structured
2. Start with a main heading using ## (not #)
3. Use ### for subheadings to organize sections
4. Use **bold** for key terms, important concepts, and definitions
5. Use bullet points (- or *) for lists of items, concepts, or key points
6. Use numbered lists (1., 2., 3.) for sequential steps or ordered information
7. For mathematical expressions:
   - Use $...$ for inline math (e.g., $E = mc^2$)
   - Use $$...$$ for block/display math (centered equations)
8. Use proper paragraph breaks (blank lines) between sections
9. DO NOT include:
   - Raw code blocks unless absolutely necessary
   - JSON structures or code-like syntax
   - Unescaped special characters that break rendering
   - Multiple consecutive blank lines
   - Markdown syntax errors

STRUCTURE GUIDELINES:

Return a JSON object with exactly two fields:
1. "summary_markdown": A clean, well-formatted Markdown summary following all the rules above
2. "flashcards": An array of exactly 10 flashcards, each with {"question":"...","answer":"..."}

IMPORTANT: The summary_markdown must be clean Markdown that will render perfectly. No raw code, no JSON artifacts, just clean, readable formatted text.` },
            { role: "user", content: prompt },
          ],
          max_tokens: 2000,
        });

        const text = chatResp.choices?.[0]?.message?.content || "{}";
        try {
          const parsed = JSON.parse(text);
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
          return { summary_markdown: text || localSummarize(text), flashcards: [] };
        }
      } catch (err) {
        console.warn("OpenAI generateFormattedSummaryAndFlashcards failed:", describeError(err));
      }
    }

    // Last resort: local summarizer
    let summary_markdown = localSummarize(text);
    summary_markdown = cleanSummaryMarkdown(summary_markdown);
    const flashcards = localGenerateFlashcards(text);
    return { summary_markdown, flashcards };
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
  const sentences = text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  const cards: Array<{ question: string; answer: string }> = [];
  // Generate up to 10 flashcards
  for (let i = 0; i < Math.min(10, sentences.length); i++) {
    const s = sentences[i];
    if (!s || s.length < 10) continue; // Skip very short sentences
    const words = s.split(/\s+/).slice(0, 8).join(' ');
    cards.push({ question: `What is: ${words}...?`, answer: s });
  }
  return cards;
}

export async function generateQuiz(text: string): Promise<Array<{ question: string; options: string[]; correctAnswer: number }>> {
  try {
    const prompt = `You are an educational quiz generator. Create accessible multiple-choice questions that test understanding of key concepts. Respond with JSON in this format: { "questions": [{ "question": "string", "options": ["string"], "correctAnswer": number }] }

Generate 3-5 multiple choice questions based on this content:

${text}`;
    
    if (googleAI) {
      try {
        const response = await googleAI.models.generateContent({ model: "gemini-2.5-flash", contents: prompt });
        const jsonText = response.text || "{}";
        try {
          const parsed = JSON.parse(jsonText);
          return parsed.questions || [];
        } catch {
          return [];
        }
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
        const text = chatResp.choices?.[0]?.message?.content || "{}";
        try {
          const parsed = JSON.parse(text);
          return parsed.questions || [];
        } catch {
          return [];
        }
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
        file = new File([audioBuffer], `audio.${extension}`, { type: mimeType || `audio/${extension}` });
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
    const context = summary ? `${summary}\n\nFull Transcript:\n${transcript}` : transcript;
    const contextLimit = context.substring(0, 12000); // Limit context size
    
    const prompt = `You are a professional podcast script writer. Create an engaging, educational podcast script based on the following video transcript and summary.

REQUIREMENTS:
1. Write in a conversational, podcast-style format
2. Start with an engaging introduction that hooks the listener
3. Organize content into clear sections with natural transitions
4. Use conversational language - write as if speaking to the listener
5. Include key insights, main points, and important details from the transcript
6. End with a thoughtful conclusion that summarizes key takeaways
7. Keep it engaging and easy to follow when read aloud
8. Use markdown formatting with ## for section headings, **bold** for emphasis, and proper paragraph breaks

Content:
${contextLimit}

Create a well-structured podcast script that makes this content accessible and engaging for listeners.`;

    // Try Google Gemini first if available
    if (googleAI) {
      try {
        const response = await googleAI.models.generateContent({ 
          model: "gemini-2.5-flash", 
          contents: prompt 
        });
        return response.text || "";
      } catch (err: any) {
        console.warn("Google Gemini podcast script generation failed:", describeError(err));
      }
    }

    // Fallback to OpenAI if configured
    if (openai) {
      try {
        const chatResp = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { 
              role: "system", 
              content: "You are a professional podcast script writer. Create engaging, educational podcast scripts in markdown format with clear sections, conversational tone, and natural transitions." 
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 2000,
          temperature: 0.7, // Slightly higher for more creative/engaging content
        });

        const content = chatResp.choices?.[0]?.message?.content || "";
        return content;
      } catch (err: any) {
        console.warn("OpenAI podcast script generation failed:", describeError(err));
      }
    }

    // Fallback: create a simple script from summary
    if (summary) {
      return `# Podcast Script\n\n## Introduction\n\nWelcome to today's episode. Let's dive into the key insights from this content.\n\n## Main Content\n\n${summary}\n\n## Conclusion\n\nThat wraps up today's episode. Thanks for listening!`;
    }
    
    // Last resort: use first part of transcript
    const sentences = transcript.split(/(?<=[.!?])\s+/).slice(0, 10).join(" ");
    return `# Podcast Script\n\n## Introduction\n\nLet's explore the key points from this content.\n\n## Main Content\n\n${sentences}\n\n## Conclusion\n\nThese are the main insights we've covered today.`;
  } catch (error: any) {
    throw new Error(`Failed to generate podcast script: ${error?.message || 'Unknown error'}`);
  }
}

export async function generateSpeech(text: string, voiceId: string = "alloy"): Promise<Buffer | null> {
  try {
    if (!openai) {
      console.log("OpenAI API key not configured - TTS skipped");
      return null;
    }

    // Use OpenAI TTS API
    const response = await openai.audio.speech.create({
      model: "tts-1", // or "tts-1-hd" for higher quality
      voice: voiceId as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer",
      input: text.substring(0, 4096), // TTS API has character limits
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
      questionGuidance = "The student wants to understand a process or method. Explain step-by-step or describe how something works.";
    } else {
      questionGuidance = "Provide a comprehensive answer that directly addresses the question with relevant details from the document.";
    }
    
    const prompt = `You are an expert educational assistant. Answer the student's question directly and helpfully.

CRITICAL INSTRUCTIONS:
1. If the question is about the document content, use information from the document to answer it.
2. If the question is a general knowledge question (like "why is the sky blue", "what is gravity", etc.), answer it using your general knowledge - DO NOT mention the document at all.
3. NEVER say phrases like:
   - "the document doesn't contain"
   - "the document doesn't discuss"
   - "the provided document content"
   - "the document does not contain information"
   Just answer the question directly!

FORMATTING RULES:
- Start with a paragraph, NOT a heading
- Only use ## for section headings if you have multiple distinct sections
- Use **bold** for key terms and important concepts
- Use numbered lists (1., 2., 3.) for sequential items
- Use bullet points (- or *) for non-sequential lists
- Use proper paragraph breaks between ideas
- For mathematical expressions, use inline code with backticks: \`expression\`

OTHER RULES:
- Answer directly - do NOT repeat or rephrase the question
- Do NOT ask follow-up questions
- Be comprehensive - include relevant details and context
- ${questionGuidance}

${context.length > 100 ? `Document Content (use this ONLY if the question is about the document):
${context}

` : ''}Student's Question: ${question}

Answer the question directly. If it's general knowledge, use your knowledge. If it's about the document, use the document. Never mention what the document doesn't contain.`;

    // Try Google Gemini first if available
    if (googleAI) {
      try {
        const response = await googleAI.models.generateContent({ 
          model: "gemini-2.5-flash", 
          contents: prompt 
        });
        return response.text || "";
      } catch (err: any) {
        console.warn("Google Gemini chat answer failed:", describeError(err));
      }
    }

    // Fallback to OpenAI if configured
    if (openai) {
      try {
        const chatResp = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { 
              role: "system", 
              content: `You are an expert educational assistant. Answer questions directly and helpfully.

CRITICAL INSTRUCTIONS:
1. If the question is about the document, use information from the document to answer it.
2. If the question is a general knowledge question (like "why is the sky blue", "what is gravity", etc.), answer it using your general knowledge - DO NOT mention the document at all.
3. NEVER say phrases like "the document doesn't contain", "the document doesn't discuss", "the provided document content", or "the document does not contain information". Just answer the question directly!

FORMATTING RULES:
- Start with a paragraph, NOT a heading
- Only use ## for section headings if you have multiple distinct sections
- Use markdown: **bold** for key terms, numbered/bullet lists, proper paragraphs
- For math expressions, use inline code: \`expression\`

OTHER RULES:
- Answer directly without repeating the question
- Do NOT ask follow-up questions
- Be comprehensive and well-organized
- ${questionGuidance}` 
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 1500,
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
    if (isHow) {
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
