/**
 * fileProcessor.ts — Vercel-safe content extraction
 *
 * PDF strategy: pdfjs-dist "@legacy" build (no worker, no Canvas, no DOMMatrix).
 * All browser globals are polyfilled before the library is imported.
 */

import * as fs from "fs";
import * as path from "path";
import { createRequire } from "module";
import mammoth from "mammoth";
import { YoutubeTranscript } from 'youtube-transcript';
import {
  extractTextFromImage,
  summarizeContent,
  generateQuiz,
  generateSpeech,
  transcribeAudio,
  generateFormattedSummaryAndFlashcards,
  generatePodcastScript,
  generateMindMap,
} from "./openai.js";
import type { ProcessingOptions } from "../../shared/schema.js";

// ── PDF Extraction ─────────────────────────────────────────────────────────────
// pdf-parse handles font encoding / ToUnicode maps correctly.
// DOMMatrix and other browser globals are polyfilled in server/index.ts
// before this module is ever imported, so the library loads cleanly.
export async function processPDF(filePath: string): Promise<string> {
  try {
    const require = createRequire(import.meta.url);
    const pdfParse = require("pdf-parse");
    
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    const text = data.text?.replace(/\0/g, "").trim();
    if (!text) throw new Error("PDF contained no extractable text.");
    return text;
  } catch (err: any) {
    console.error("[processPDF] pdf-parse failed:", err.message);
    throw new Error(`Failed to process PDF: ${err.message}`);
  }
}

// ── DOCX Extraction ────────────────────────────────────────────────────────────
export async function processDOCX(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer });
  if (!result.value.trim()) throw new Error("DOCX contained no extractable text.");
  return result.value;
}

// ── Image OCR ──────────────────────────────────────────────────────────────────
export async function processImage(filePath: string): Promise<string> {
  return extractTextFromImage(filePath);
}

// ── YouTube helpers ────────────────────────────────────────────────────────────
export function extractYouTubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
  );
  return m ? m[1] : null;
}

export async function processYouTube(videoUrl: string): Promise<string> {
  const videoId = extractYouTubeId(videoUrl);
  if (!videoId) throw new Error("Invalid YouTube URL");

  // ── Path 1: Try captions/transcript (fast, free) ──────────────────────────
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    if (transcript && transcript.length > 0) {
      console.log(`[processYouTube] Captions fetched for ${videoId} (${transcript.length} segments)`);
      return transcript.map(t => t.text).join(' ');
    }
  } catch (captionErr: any) {
    console.warn(`[processYouTube] Captions unavailable for ${videoId}: ${captionErr.message}. Falling back to Whisper transcription...`);
  }

  // ── Path 2: Download audio → Whisper transcription ────────────────────────
  try {
    const play = (await import('play-dl')).default;

    console.log(`[processYouTube] Downloading audio for Whisper transcription using play-dl: ${videoId}`);

    // Collect the audio stream into a buffer
    const audioBuffer = await new Promise<Buffer>(async (resolve, reject) => {
      try {
        const streamInfo = await play.stream(`https://www.youtube.com/watch?v=${videoId}`, {
          discordPlayerCompatibility: false // false returns standard WebM/MP4 container (Whisper requires container headers)
        });
        
        const chunks: Buffer[] = [];
        streamInfo.stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        streamInfo.stream.on('end', () => resolve(Buffer.concat(chunks)));
        streamInfo.stream.on('error', reject);
        
        // Hard timeout: 90 seconds to download
        setTimeout(() => reject(new Error('Audio download timed out after 90s')), 90_000);
      } catch (err) {
        reject(err);
      }
    });

    console.log(`[processYouTube] Audio downloaded (${(audioBuffer.length / 1024 / 1024).toFixed(1)} MB). Transcribing with Whisper...`);

    // Use existing transcribeAudio helper (uses OpenAI Whisper)
    const { transcribeAudio } = await import('./openai.js');
    const text = await transcribeAudio(audioBuffer, 'audio/webm');
    if (!text || !text.trim()) throw new Error('Whisper returned empty transcription');

    console.log(`[processYouTube] Whisper transcription complete (${text.length} chars)`);
    return text;
  } catch (whisperErr: any) {
    console.error(`[processYouTube] Whisper fallback also failed:`, whisperErr.message);
    throw new Error(
      `Could not transcribe this video. Captions are disabled and audio download failed: ${whisperErr.message}. ` +
      `Please try a video that has captions enabled, or paste the transcript text directly.`
    );
  }
}

// ── ProcessResult type ─────────────────────────────────────────────────────────
export interface ProcessResult {
  extractedText: string;
  summary?: string;
  audioBuffer?: Buffer;
  quizData?: Array<{ question: string; options: string[]; correctAnswer: number }>;
  flashcards?: Array<{ question: string; answer: string }>;
  mindMap?: any;
  podcastScript?: string;
  podcastAudioBuffer?: Buffer;
}

// ── Main entry point (called by routes.ts) ─────────────────────────────────────
export async function processContent(
  filePath: string | null,
  contentType: "document" | "image" | "video",
  options: ProcessingOptions,
  originalUrl?: string,
  originalFileName?: string
): Promise<ProcessResult> {
  // ── 1. Extract raw text ──────────────────────────────────────────────────────
  let extractedText = "";

  if (contentType === "video") {
    if (!originalUrl) throw new Error("No URL provided for video content");
    extractedText = await processYouTube(originalUrl);
  } else if (contentType === "image" && filePath) {
    extractedText = await processImage(filePath);
  } else if (contentType === "document" && filePath) {
    const ext = path.extname(originalFileName || filePath).toLowerCase();
    if (ext === ".pdf") {
      extractedText = await processPDF(filePath);
    } else if (ext === ".docx" || ext === ".doc") {
      extractedText = await processDOCX(filePath);
    } else {
      extractedText = fs.readFileSync(filePath, "utf-8");
    }
  }

  if (!extractedText.trim()) {
    throw new Error("Could not extract any text from the provided file.");
  }

  // Sanitize: PostgreSQL rejects null bytes (0x00) in UTF-8 text columns
  extractedText = extractedText.replace(/\0/g, "").trim();

  const result: ProcessResult = { extractedText };

  // ── 2. Run all AI generation in parallel (failures are non-fatal) ────────────
  const tasks: Promise<void>[] = [];

  const withTimeout = <T>(promise: Promise<T>, ms: number, taskName: string): Promise<T> => {
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Task ${taskName} timed out after ${ms}ms`));
      }, ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
  };
  if (options.generateSummary) {
    tasks.push(
      withTimeout((async () => {
        try {
          const fmt = await generateFormattedSummaryAndFlashcards(extractedText);
          result.summary = fmt.summary_markdown;
          if (fmt.flashcards?.length) result.flashcards = fmt.flashcards;
        } catch {
          try { result.summary = await summarizeContent(extractedText); } catch {}
        }
      })(), 90000, "generateSummary").catch(e => console.warn(e.message))
    );
  }

  if (options.generateMindMap) {
    tasks.push(
      withTimeout((async () => {
        try { result.mindMap = await generateMindMap(extractedText); } catch (e) {
          console.warn("Mind-map generation failed:", e);
        }
      })(), 60000, "generateMindMap").catch(e => console.warn(e.message))
    );
  }

  if (options.generateQuiz) {
    tasks.push(
      withTimeout((async () => {
        try { result.quizData = await generateQuiz(extractedText); } catch (e) {
          console.warn("Quiz generation failed:", e);
        }
      })(), 60000, "generateQuiz").catch(e => console.warn(e.message))
    );
  }

  if (options.generateAudio) {
    tasks.push(
      withTimeout((async () => {
        try {
          const audio = await generateSpeech(extractedText);
          if (audio) result.audioBuffer = audio;
        } catch (e) {
          console.warn("Audio generation failed:", e);
        }
      })(), 45000, "generateAudio").catch(e => console.warn(e.message))
    );
  }

  if (contentType === "video") {
    tasks.push(
      withTimeout((async () => {
        try {
          const script = await generatePodcastScript(extractedText);
          result.podcastScript = script;
          // Skip TTS for podcast by default — it's the main bottleneck and takes 30-60s.
          // Only generate audio if explicitly enabled AND a TTS key is configured.
          if (options.generateAudio && script) {
            try {
              const audio = await generateSpeech(script.substring(0, 2000)); // Limit to 2k chars
              if (audio) result.podcastAudioBuffer = audio;
            } catch (audioErr) {
              console.warn("Podcast TTS skipped:", audioErr);
            }
          }
        } catch (e) {
          console.warn("Podcast generation failed:", e);
        }
      })(), 60000, "generatePodcast").catch(e => console.warn(e.message))
    );
  }

  // Race all tasks against a hard 3-minute deadline so processing ALWAYS completes
  const HARD_DEADLINE_MS = 3 * 60 * 1000;
  await Promise.race([
    Promise.allSettled(tasks),
    new Promise<void>((resolve) => setTimeout(() => {
      console.warn(`[processContent] Hard deadline reached (${HARD_DEADLINE_MS}ms). Returning partial results.`);
      resolve();
    }, HARD_DEADLINE_MS)),
  ]);
  return result;
}
