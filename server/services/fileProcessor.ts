/**
 * fileProcessor.ts — Vercel-safe content extraction
 *
 * PDF strategy: pdfjs-dist "@legacy" build (no worker, no Canvas, no DOMMatrix).
 * All browser globals are polyfilled before the library is imported.
 */

import * as fs from "fs";
import * as path from "path";
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

// ── Browser global polyfills (must run before any pdf import) ──────────────────
function applyPolyfills() {
  const g = global as any;
  if (!g.DOMMatrix)       g.DOMMatrix       = class { setMatrixValue() { return this; } };
  if (!g.Path2D)          g.Path2D          = class {};
  if (!g.ImageData)       g.ImageData       = class {};
  if (!g.OffscreenCanvas) g.OffscreenCanvas = class { getContext() { return null; } };
}

// ── PDF Extraction ─────────────────────────────────────────────────────────────
export async function processPDF(filePath: string): Promise<string> {
  applyPolyfills();

  try {
    // Using the legacy CommonJS build which does not require a separate worker
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs" as any);
    const fileData = new Uint8Array(fs.readFileSync(filePath));
    const loadingTask = pdfjs.getDocument({
      data: fileData,
      disableFontFace: true,
      useSystemFonts: true,
      isEvalSupported: false,
    });
    const doc = await loadingTask.promise;

    const parts: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .filter((it: any) => typeof it.str === "string")
        .map((it: any) => it.str)
        .join(" ");
      parts.push(pageText);
    }

    const text = parts.join("\n\n").trim();
    if (!text) throw new Error("PDF contained no extractable text.");
    return text;
  } catch (err: any) {
    // Graceful fallback: scrape raw string literals from the PDF bytes
    console.warn("[processPDF] Primary parse failed, using raw-text fallback:", err.message);
    const raw = fs.readFileSync(filePath, "latin1");
    const matches: string[] = [];
    const re = /\(([^)]{3,})\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
      const s = m[1].replace(/\\[nrt]/g, " ").trim();
      if (s.length > 2) matches.push(s);
    }
    const fallback = matches.join(" ").trim();
    if (fallback.length > 100) return fallback;
    throw new Error(`PDF text extraction failed: ${err.message}`);
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
