import * as fs from "fs";
import * as path from "path";
import mammoth from "mammoth";
import ytdl from "ytdl-core";
import { extractTextFromImage, summarizeContent, generateQuiz, generateSpeech, transcribeAudio, generateFormattedSummaryAndFlashcards, generatePodcastScript, generateMindMap } from "./openai.js";
import type { ProcessingOptions } from "../../shared/schema.js";

export async function processPDF(filePath: string): Promise<string> {
  try {
    // Dynamic import to keep startup light
    const { default: pdfParse } = await import("pdf-parse");
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text || "";
  } catch (error: any) {
    console.error("Error processing PDF:", error);
    throw new Error(`Failed to process PDF: ${error?.message || 'Unknown error'}`);
  }
}

export async function processDOCX(filePath: string): Promise<string> {
  try {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error: any) {
    throw new Error(`Failed to process DOCX: ${error?.message || 'Unknown error'}`);
  }
}

export async function processImage(filePath: string): Promise<string> {
  try {
    const text = await extractTextFromImage(filePath);
    return text;
  } catch (error: any) {
    throw new Error(`Failed to process image: ${error?.message || 'Unknown error'}`);
  }
}

export async function processYouTube(videoUrl: string): Promise<string> {
  try {
    const videoId = extractYouTubeId(videoUrl);
    if (!videoId) throw new Error("Invalid YouTube URL");

    const cleanVideoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    log(`🎬 Processing YouTube URL: ${cleanVideoUrl}`);

    const isVercel = !!process.env.VERCEL || !!process.env.LAMBDA_TASK_ROOT || !!process.env.VERCEL_URL;
    const uploadsDir = process.env.APP_UPLOADS_DIR || (isVercel ? "/tmp" : "uploads");
    const tempAudioPath = path.join(uploadsDir, `youtube_audio_${Date.now()}.mp3`);

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const audioStream = ytdl(cleanVideoUrl, {
      quality: "highestaudio",
      filter: "audioonly",
    });

    return new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(tempAudioPath);
      audioStream.pipe(writeStream);
      
      writeStream.on("finish", async () => {
        try {
          const transcription = await transcribeAudio(tempAudioPath);
          fs.unlinkSync(tempAudioPath);
          resolve(transcription);
        } catch (err) {
          reject(err);
        }
      });

      writeStream.on("error", reject);
      audioStream.on("error", reject);
    });
  } catch (error: any) {
    throw new Error(`YouTube processing failed: ${error?.message || 'Unknown error'}`);
  }
}

export function extractYouTubeId(url: string): string | null {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

export function log(message: string) {
  const time = new Date().toLocaleTimeString();
  console.log(`[Processor ${time}] ${message}`);
}
