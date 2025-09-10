import * as fs from "fs";
import * as path from "path";
import { PDFExtract } from "pdf.js-extract";
import mammoth from "mammoth";
import { extractTextFromImage, summarizeContent, generateQuiz, generateSpeech, transcribeAudio } from "./openai";
import type { ProcessingOptions } from "@shared/schema";

const pdfExtract = new PDFExtract();

export async function processPDF(filePath: string): Promise<string> {
  try {
    const data = await new Promise<any>((resolve, reject) => {
      pdfExtract.extract(filePath, {}, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });

    const text = data.pages
      .map((page: any) => 
        page.content
          .map((item: any) => item.str)
          .join(" ")
      )
      .join("\n\n");

    return text;
  } catch (error: any) {
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
    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = imageBuffer.toString("base64");
    return await extractTextFromImage(base64Image);
  } catch (error: any) {
    throw new Error(`Failed to process image: ${error?.message || 'Unknown error'}`);
  }
}

export async function downloadAndTranscribeVideo(videoUrl: string): Promise<string> {
  try {
    // For YouTube videos, we would use youtube-dl or similar
    // For now, we'll return a placeholder that indicates video processing
    // In a real implementation, you'd download the audio and transcribe it
    throw new Error("Video processing not fully implemented - requires youtube-dl integration");
  } catch (error: any) {
    throw new Error(`Failed to process video: ${error?.message || 'Unknown error'}`);
  }
}

export async function processContent(
  filePath: string | null,
  contentType: "document" | "image" | "video",
  options: ProcessingOptions,
  originalUrl?: string,
  originalFileName?: string
): Promise<{
  extractedText: string;
  summary?: string;
  audioBuffer?: Buffer;
  quizData?: Array<{ question: string; options: string[]; correctAnswer: number }>;
}> {
  let extractedText = "";

  // Extract text based on content type
  if (contentType === "document" && filePath) {
    // Use original filename extension instead of uploaded file path
    const ext = originalFileName ? path.extname(originalFileName).toLowerCase() : path.extname(filePath).toLowerCase();
    if (ext === ".pdf") {
      extractedText = await processPDF(filePath);
    } else if (ext === ".docx") {
      extractedText = await processDOCX(filePath);
    } else {
      throw new Error(`Unsupported document format: ${ext}. Supported formats: PDF, DOCX`);
    }
  } else if (contentType === "image" && filePath) {
    extractedText = await processImage(filePath);
  } else if (contentType === "video" && originalUrl) {
    extractedText = await downloadAndTranscribeVideo(originalUrl);
  } else {
    throw new Error("Invalid content type or missing file/URL");
  }

  if (!extractedText.trim()) {
    throw new Error("No text could be extracted from the content");
  }

  const result: any = { extractedText };

  // Generate summary if requested
  if (options.generateSummary) {
    result.summary = await summarizeContent(extractedText);
  }

  // Generate audio if requested
  if (options.generateAudio) {
    try {
      result.audioBuffer = await generateSpeech(extractedText, options.voiceId);
    } catch (error) {
      console.log("Audio generation skipped:", error);
      // Continue without audio - don't fail the entire upload
    }
  }

  // Generate quiz if requested
  if (options.generateQuiz) {
    result.quizData = await generateQuiz(extractedText);
  }

  return result;
}
