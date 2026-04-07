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
    const { PDFParse } = await import("pdf-parse");
    const dataBuffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: dataBuffer });
    const data = await parser.getText();
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

  const isVercel = !!(process.env.VERCEL || process.env.LAMBDA_TASK_ROOT);
  const uploadsDir =
    process.env.APP_UPLOADS_DIR || (isVercel ? "/tmp/uploads" : "uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const tempPath = path.join(uploadsDir, `yt_${Date.now()}.mp3`);
  const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;

  const ytdl = (await import("ytdl-core")).default;
  const audioStream = ytdl(cleanUrl, {
    quality: "highestaudio",
    filter: "audioonly",
  });

  await new Promise<void>((resolve, reject) => {
    const ws = fs.createWriteStream(tempPath);
    audioStream.pipe(ws);
    ws.on("finish", resolve);
    ws.on("error", reject);
    audioStream.on("error", reject);
  });

  try {
    // transcribeAudio expects (Buffer, mimeType)
    const audioBuffer = fs.readFileSync(tempPath);
    return await transcribeAudio(audioBuffer, "audio/mpeg");
  } finally {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
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

  if (options.generateSummary) {
    tasks.push(
      (async () => {
        try {
          const fmt = await generateFormattedSummaryAndFlashcards(extractedText);
          result.summary = fmt.summary_markdown;
          if (fmt.flashcards?.length) result.flashcards = fmt.flashcards;
        } catch {
          try { result.summary = await summarizeContent(extractedText); } catch {}
        }
      })()
    );
  }

  if (options.generateMindMap) {
    tasks.push(
      (async () => {
        try { result.mindMap = await generateMindMap(extractedText); } catch (e) {
          console.warn("Mind-map generation failed:", e);
        }
      })()
    );
  }

  if (options.generateQuiz) {
    tasks.push(
      (async () => {
        try { result.quizData = await generateQuiz(extractedText); } catch (e) {
          console.warn("Quiz generation failed:", e);
        }
      })()
    );
  }

  if (options.generateAudio) {
    tasks.push(
      (async () => {
        try {
          const audio = await generateSpeech(extractedText);
          if (audio) result.audioBuffer = audio;
        } catch (e) {
          console.warn("Audio generation failed:", e);
        }
      })()
    );
  }

  if (contentType === "video") {
    tasks.push(
      (async () => {
        try {
          const script = await generatePodcastScript(extractedText);
          result.podcastScript = script;
          if (options.generateAudio) {
            const audio = await generateSpeech(script);
            if (audio) result.podcastAudioBuffer = audio;
          }
        } catch (e) {
          console.warn("Podcast generation failed:", e);
        }
      })()
    );
  }

  await Promise.all(tasks);
  return result;
}
