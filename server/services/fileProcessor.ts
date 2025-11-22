import * as fs from "fs";
import * as path from "path";
import { PDFExtract } from "pdf.js-extract";
import mammoth from "mammoth";
import ytdl from "ytdl-core";
// Note: youtube-transcript removed - using audio download + Whisper as primary method
// import { YoutubeTranscript } from "youtube-transcript";
import { extractTextFromImage, summarizeContent, generateQuiz, generateSpeech, transcribeAudio, generateFormattedSummaryAndFlashcards, generatePodcastScript } from "./openai";
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

// Helper function to extract YouTube video ID from various URL formats
function extractYouTubeVideoId(url: string): string | null {
  // Remove any whitespace
  url = url.trim();
  
  // Handle youtu.be short URLs
  const shortMatch = url.match(/youtu\.be\/([^?&\/\s]{11})/);
  if (shortMatch) return shortMatch[1];
  
  // Handle youtube.com URLs with v= parameter
  const vMatch = url.match(/[?&]v=([^&\/\s]{11})/);
  if (vMatch) return vMatch[1];
  
  // Handle youtube.com/embed/ URLs
  const embedMatch = url.match(/youtube\.com\/embed\/([^?&\/\s]{11})/);
  if (embedMatch) return embedMatch[1];
  
  // Handle youtube.com/v/ URLs
  const vPathMatch = url.match(/youtube\.com\/v\/([^?&\/\s]{11})/);
  if (vPathMatch) return vPathMatch[1];
  
  // Handle youtube.com/watch URLs (fallback)
  const watchMatch = url.match(/youtube\.com\/watch[^?]*[?&]v=([^&\/\s]{11})/);
  if (watchMatch) return watchMatch[1];
  
  return null;
}

export async function downloadAndTranscribeVideo(videoUrl: string): Promise<string> {
  try {
    // Check if it's a YouTube URL
    const isYouTube = /youtube\.com|youtu\.be/.test(videoUrl);
    
    if (isYouTube) {
      try {
        // Extract video ID first (more reliable than ytdl validation)
        let videoId = extractYouTubeVideoId(videoUrl);
        
        if (!videoId) {
          // Try ytdl validation as fallback
          if (ytdl.validateURL(videoUrl)) {
            // If ytdl validates it, try to get info to extract ID
            try {
              const info = await ytdl.getInfo(videoUrl);
              videoId = info.videoDetails.videoId;
            } catch {
              // Ignore
            }
          }
          
          if (!videoId) {
            throw new Error("Invalid YouTube URL. Please check the URL format and try again.");
          }
        }

        // Skip caption fetching - go straight to audio download + Whisper (more reliable)
        // Note: youtube-transcript library can cause "Could not extract functions" errors
        // Using audio download + Whisper as the primary and only method
        console.log(`Processing YouTube video ${videoId} using audio download + Whisper transcription`);

        // Download audio and transcribe with Whisper (primary method)
        console.log(`Downloading audio for video ID: ${videoId}`);
        
        // Construct clean URL using video ID
        const cleanVideoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        
        // Get video info using the extracted video ID (more reliable)
        let info;
        try {
          info = await ytdl.getInfo(cleanVideoUrl);
        } catch (infoError: any) {
          // If that fails, try with original URL
          console.warn(`Failed to get info with video ID, trying original URL: ${infoError?.message}`);
          try {
            info = await ytdl.getInfo(videoUrl);
          } catch (fallbackError: any) {
            throw new Error(`Failed to get video information. The video may be private, age-restricted, or unavailable. Error: ${fallbackError?.message || 'Unknown error'}`);
          }
        }
        
        const videoTitle = info.videoDetails.title;
        console.log(`Processing YouTube video "${videoTitle}" with Whisper`);

        // Download audio stream from YouTube
        const audioStream = ytdl(cleanVideoUrl, {
          quality: "highestaudio",
          filter: "audioonly",
        });

        // Save audio to temporary file
        const tempAudioPath = path.join("uploads", `youtube_audio_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`);
        
        // Ensure uploads directory exists
        if (!fs.existsSync("uploads")) {
          fs.mkdirSync("uploads", { recursive: true });
        }
        
        return new Promise((resolve, reject) => {
          const writeStream = fs.createWriteStream(tempAudioPath);
          const chunks: Buffer[] = [];
          let hasError = false;

          audioStream.on("data", (chunk: Buffer) => {
            if (!hasError) {
              chunks.push(chunk);
              writeStream.write(chunk);
            }
          });

          audioStream.on("end", async () => {
            if (hasError) return;
            writeStream.end();
            try {
              // Wait for write stream to finish
              await new Promise((resolve) => writeStream.on("finish", resolve));
              
              // Read the audio file as buffer (use file system for reliability)
              const audioBuffer = fs.existsSync(tempAudioPath) 
                ? fs.readFileSync(tempAudioPath)
                : Buffer.concat(chunks);
              
              if (audioBuffer.length === 0) {
                throw new Error("Downloaded audio file is empty");
              }
              
              console.log(`Audio downloaded: ${audioBuffer.length} bytes`);
              
              // Transcribe using Whisper
              const transcription = await transcribeAudio(audioBuffer, "audio/mpeg");
              
              // Clean up temp file
              if (fs.existsSync(tempAudioPath)) {
                try { fs.unlinkSync(tempAudioPath); } catch {}
              }
              
              resolve(transcription);
            } catch (error: any) {
              // Clean up temp file on error
              if (fs.existsSync(tempAudioPath)) {
                try { fs.unlinkSync(tempAudioPath); } catch {}
              }
              reject(new Error(`Failed to transcribe audio: ${error?.message || 'Unknown error'}`));
            }
          });

          audioStream.on("error", (error: any) => {
            hasError = true;
            writeStream.end();
            if (fs.existsSync(tempAudioPath)) {
              try { fs.unlinkSync(tempAudioPath); } catch {}
            }
            const errorMsg = error?.message || String(error) || 'Unknown error';
            console.error("YouTube audio download error:", errorMsg);
            reject(new Error(`Failed to download YouTube audio: ${errorMsg}. The video may be unavailable or restricted.`));
          });

          writeStream.on("error", (error: any) => {
            hasError = true;
            reject(new Error(`Failed to save audio file: ${error?.message || 'Unknown error'}`));
          });
        });
      } catch (error: any) {
        // Better error handling for YouTube-specific errors
        console.error("YouTube video processing error:", error);
        
        if (error.message?.includes("Invalid YouTube URL")) {
          throw error;
        }
        
        // Provide more helpful error messages
        const errorMsg = error?.message || String(error) || 'Unknown error';
        if (errorMsg.includes("private") || errorMsg.includes("restricted")) {
          throw new Error("This video is private, age-restricted, or unavailable. Please use a public video.");
        }
        if (errorMsg.includes("extract functions")) {
          throw new Error("Failed to process video. Please try again or use a different video.");
        }
        
        throw new Error(`YouTube video processing failed: ${errorMsg}. Please check the URL and try again.`);
      }
    }

    // For direct video file URLs, download and transcribe
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.statusText}`);
    }

    const videoBuffer = Buffer.from(await response.arrayBuffer());
    const mimeType = response.headers.get("content-type") || "video/mp4";
    
    // Transcribe using Whisper (supports various video formats)
    const transcription = await transcribeAudio(videoBuffer, mimeType);
    return transcription;
  } catch (error: any) {
    throw new Error(`Failed to process video: ${error?.message || 'Unknown error'}`);
  }
}

type GeneratedFlashcard = { question: string; answer: string };

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
  podcastScript?: string;
  podcastAudioBuffer?: Buffer;
  quizData?: Array<{ question: string; options: string[]; correctAnswer: number }>;
  flashcards?: GeneratedFlashcard[];
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

  const result: {
    extractedText: string;
    summary?: string;
    audioBuffer?: Buffer;
    podcastScript?: string;
    podcastAudioBuffer?: Buffer;
    quizData?: Array<{ question: string; options: string[]; correctAnswer: number }>;
    flashcards?: GeneratedFlashcard[];
  } = { extractedText };

  // Generate summary if requested
  let summaryText: string | undefined;
  if (options.generateSummary) {
    try {
      const formatted = await generateFormattedSummaryAndFlashcards(extractedText);
      // store markdown summary
      result.summary = formatted.summary_markdown;
      summaryText = formatted.summary_markdown;
      if (formatted.flashcards && formatted.flashcards.length > 0) {
        result.flashcards = formatted.flashcards;
      }
    } catch (err) {
      // fallback to plain text summary if the new flow fails
      result.summary = await summarizeContent(extractedText);
      summaryText = result.summary;
    }
  }

  // For videos: Generate podcast script (always for videos)
  if (contentType === "video") {
    try {
      const podcastScript = await generatePodcastScript(extractedText, summaryText);
      result.podcastScript = podcastScript;
      
      // Optionally generate TTS audio for podcast script
      if (options.generateAudio) {
        try {
          const podcastAudio = await generateSpeech(podcastScript, options.voiceId);
          if (podcastAudio) {
            result.podcastAudioBuffer = podcastAudio;
          }
        } catch (error) {
          console.log("Podcast audio generation skipped:", error);
        }
      }
    } catch (error) {
      console.log("Podcast script generation skipped:", error);
    }
  }

  // Generate audio if requested (for non-video content, or as fallback)
  if (options.generateAudio && contentType !== "video") {
    try {
      const audio = await generateSpeech(extractedText, options.voiceId);
      if (audio) {
        result.audioBuffer = audio;
      }
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
