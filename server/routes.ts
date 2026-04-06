import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertContentItemSchema, processingOptionsSchema } from "@shared/schema";
import multer from "multer";
import * as path from "path";
import * as fs from "fs";
import { processContent } from "./services/fileProcessor";
import { generateChatAnswer, transcribeAudio } from "./services/openai";

const isVercel = !!process.env.VERCEL || !!process.env.LAMBDA_TASK_ROOT;
const uploadDir = isVercel ? "/tmp/uploads" : "uploads/";
const upload = multer({ dest: uploadDir });

export async function registerRoutes(app: Express): Promise<Server> {
  // Ensure a default user exists for demo uploads and capture its id
  let defaultUserId: string | undefined = undefined;
  try {
    const u = await storage.ensureDefaultUser();
    defaultUserId = u.id;
  } catch (err) {
    console.warn("Failed to ensure default user:", err);
  }
  // Get user content items
  app.get("/api/content", async (req, res) => {
    try {
      // Ensure default user exists first
      try {
        await storage.ensureDefaultUser();
      } catch (userError) {
        console.warn("Could not ensure default user:", userError);
      }
      
      // For demo purposes, using a default user ID
      // In a real app, this would come from authentication
      const userId = "default-user";
      const items = await storage.getUserContentItems(userId);
      res.json(items || []);
    } catch (error: any) {
      console.error("Error fetching content items:", error);
      // Return empty array instead of error to prevent frontend crashes
      res.status(200).json([]);
    }
  });

  // Upload and process document
  app.post("/api/content/document", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { title, processingOptions } = req.body;
      const parsedOptions = processingOptionsSchema.parse(JSON.parse(processingOptions));

      // Create content item
      const contentItem = await storage.createContentItem({
        userId: defaultUserId || "default-user", // In real app, get from auth
        title: title || req.file.originalname,
        type: "document",
        originalFileName: req.file.originalname,
        processingOptions: parsedOptions,
      });

      // Process in background
      processContentAsync(contentItem.id, req.file.path, "document", parsedOptions, undefined, req.file.originalname);

      res.json(contentItem);
    } catch (error: any) {
      res.status(400).json({ message: error?.message || 'Failed to process document' });
    }
  });

  // Upload and process image
  app.post("/api/content/image", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image uploaded" });
      }

      const { title, processingOptions } = req.body;
      const parsedOptions = processingOptionsSchema.parse(JSON.parse(processingOptions));

      const contentItem = await storage.createContentItem({
        userId: defaultUserId || "default-user",
        title: title || req.file.originalname,
        type: "image",
        originalFileName: req.file.originalname,
        processingOptions: parsedOptions,
      });

      // Process in background
      processContentAsync(contentItem.id, req.file.path, "image", parsedOptions, undefined, req.file.originalname);

      res.json(contentItem);
    } catch (error: any) {
      res.status(400).json({ message: error?.message || 'Failed to process image' });
    }
  });

  // Process video URL
  app.post("/api/content/video", async (req, res) => {
    try {
      const { title, url, processingOptions } = req.body;
      
      if (!url || typeof url !== 'string' || url.trim().length === 0) {
        return res.status(400).json({ message: 'Video URL is required and must be a valid string' });
      }

      // Ensure default user exists
      if (!defaultUserId) {
        try {
          const u = await storage.ensureDefaultUser();
          defaultUserId = u.id;
        } catch (userError) {
          console.error("Failed to ensure default user:", userError);
          return res.status(500).json({ message: 'Server configuration error' });
        }
      }

      // Parse and validate processing options with defaults
      let parsedOptions;
      try {
        // Handle both object and string formats
        const optionsToParse = typeof processingOptions === 'string' 
          ? JSON.parse(processingOptions) 
          : (processingOptions || {});
        parsedOptions = processingOptionsSchema.parse(optionsToParse);
      } catch (parseError: any) {
        console.warn("Processing options validation error:", parseError?.message || parseError);
        // Use defaults if validation fails
        parsedOptions = {
          generateAudio: processingOptions?.generateAudio !== false,
          generateSummary: processingOptions?.generateSummary !== false,
          generateMindMap: processingOptions?.generateMindMap !== false,
          generateQuiz: processingOptions?.generateQuiz === true,
        };
      }

      const contentItem = await storage.createContentItem({
        userId: defaultUserId,
        title: title || "Video Content",
        type: "video",
        originalUrl: url.trim(),
        processingOptions: parsedOptions,
      });

      // Process in background (don't await)
      processContentAsync(contentItem.id, null, "video", parsedOptions, url.trim()).catch((err) => {
        console.error("Background video processing error:", err);
      });

      res.json(contentItem);
    } catch (error: any) {
      console.error("Video processing error:", error);
      const errorMessage = error?.message || 'Failed to process video';
      res.status(400).json({ message: errorMessage });
    }
  });

  // Upload and process audio file (using Whisper for transcription)
  app.post("/api/content/audio", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No audio file uploaded" });
      }

      const { title, processingOptions } = req.body;
      const parsedOptions = processingOptionsSchema.parse(JSON.parse(processingOptions || "{}"));

      const contentItem = await storage.createContentItem({
        userId: defaultUserId || "default-user",
        title: title || req.file.originalname,
        type: "document", // Store as document type but process as audio
        originalFileName: req.file.originalname,
        processingOptions: parsedOptions,
      });

      // Process in background - will transcribe audio using Whisper
      processAudioFileAsync(contentItem.id, req.file.path, req.file.mimetype, parsedOptions, req.file.originalname);

      res.json(contentItem);
    } catch (error: any) {
      res.status(400).json({ message: error?.message || 'Failed to process audio file' });
    }
  });

  // Get specific content item
  app.get("/api/content/:id", async (req, res) => {
    try {
      const item = await storage.getContentItem(req.params.id);
      if (!item) {
        return res.status(404).json({ message: "Content not found" });
      }
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || 'Failed to get content item' });
    }
  });

  // Regenerate mind map for an existing content item
  app.post("/api/content/:id/regenerate-mindmap", async (req, res) => {
    try {
      const item = await storage.getContentItem(req.params.id);
      if (!item) return res.status(404).json({ message: "Content not found" });

      const text = (item.extractedText as string) || "";
      if (!text || text.length < 20) {
        return res.status(400).json({ message: "No extracted text available to generate mind map from." });
      }

      // Import here to avoid circular issues
      const { generateMindMap } = await import("./services/openai");
      const mindMapData = await generateMindMap(text);

      const updated = await storage.updateContentItem(item.id, { mindMap: mindMapData as any });
      res.json({ success: true, mindMap: mindMapData, item: updated });
    } catch (error: any) {
      console.error("Regenerate mindmap error:", error);
      res.status(500).json({ message: error?.message || "Failed to regenerate mind map" });
    }
  });

  // Chat endpoint: accepts { question, contentId } or { question, context }
  // If `PY_CHAT_BACKEND_URL` is set in the environment, requests will be proxied
  // to that external Python backend. Otherwise the server will use its own
  // `generateChatAnswer` implementation.
  const PY_CHAT_BACKEND_URL = process.env.PY_CHAT_BACKEND_URL || "";
  const PY_CHAT_BACKEND_API_KEY = process.env.PY_CHAT_BACKEND_API_KEY || "";

  app.post("/api/chat", async (req, res) => {
    try {
      const { question, contentId, context } = req.body || {};
      if (!question || typeof question !== 'string') {
        return res.status(400).json({ message: 'Missing question in request body' });
      }

      // If a Python backend URL is configured, forward the request to it.
      if (PY_CHAT_BACKEND_URL) {
        try {
          // Build payload for external service. Prefer sending contentId if available
          // so the external service can fetch or accept context as desired.
          const proxyPayload: any = { question };
          if (contentId) proxyPayload.contentId = contentId;
          else if (context) proxyPayload.context = context;

          const proxyUrl = PY_CHAT_BACKEND_URL.replace(/\/$/, '') + "/api/chat";
          const headers: any = { "Content-Type": "application/json" };
          if (PY_CHAT_BACKEND_API_KEY) headers["Authorization"] = `Bearer ${PY_CHAT_BACKEND_API_KEY}`;

          const proxyResp = await fetch(proxyUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(proxyPayload),
          });

          const text = await proxyResp.text();
          // Try to parse JSON and forward, otherwise forward raw text
          try {
            const parsed = JSON.parse(text);
            return res.status(proxyResp.status).json(parsed);
          } catch {
            return res.status(proxyResp.status).send(text);
          }
        } catch (err: any) {
          console.error('Proxy to PY_CHAT_BACKEND_URL failed:', err?.message || err);
          return res.status(502).json({ message: 'Failed to proxy to configured Python chat backend' });
        }
      }

      // No external backend configured: use local generator
      let summary = "";
      let extractedText = "";

      if (contentId && typeof contentId === 'string') {
        const item = await storage.getContentItem(contentId);
        if (!item) return res.status(404).json({ message: 'Content item not found' });
        summary = item.summary || "";
        extractedText = item.extractedText || "";
      } else if (context && typeof context === 'string') {
        // If the client provides a context string, use it as the summary
        summary = context;
        extractedText = "";
      } else {
        // No contentId or context; fall back to returning an error
        return res.status(400).json({ message: 'Provide contentId or context for chat' });
      }

      const answer = await generateChatAnswer(question, summary, extractedText);
      res.json({ answer });
    } catch (error: any) {
      console.error('Chat handler error:', error);
      res.status(500).json({ message: error?.message || 'Chat processing failed' });
    }
  });

  // Get audio file
  app.get("/api/content/:id/audio", async (req, res) => {
    try {
      const item = await storage.getContentItem(req.params.id);
      if (!item || !item.audioUrl) {
        return res.status(404).json({ message: "Audio not found" });
      }

      const audioPath = path.join("uploads", item.audioUrl);
      if (!fs.existsSync(audioPath)) {
        return res.status(404).json({ message: "Audio file not found" });
      }

      res.setHeader("Content-Type", "audio/mpeg");
      res.sendFile(path.resolve(audioPath));
    } catch (error: any) {
      res.status(500).json({ message: error?.message || 'Failed to get audio file' });
    }
  });

  // Get podcast audio file
  app.get("/api/content/:id/podcast-audio", async (req, res) => {
    try {
      const item = await storage.getContentItem(req.params.id);
      if (!item || !item.podcastAudioUrl) {
        return res.status(404).json({ message: "Podcast audio not found" });
      }

      const audioPath = path.join("uploads", item.podcastAudioUrl);
      if (!fs.existsSync(audioPath)) {
        return res.status(404).json({ message: "Podcast audio file not found" });
      }

      res.setHeader("Content-Type", "audio/mpeg");
      res.sendFile(path.resolve(audioPath));
    } catch (error: any) {
      res.status(500).json({ message: error?.message || 'Failed to get podcast audio file' });
    }
  });

  // Get original file (PDF/Image)
  app.get("/api/content/:id/original", async (req, res) => {
    try {
      const item = await storage.getContentItem(req.params.id);
      if (!item) return res.status(404).json({ message: "Content not found" });
      
      if (item.type === "video") {
        if (item.originalUrl) return res.redirect(item.originalUrl);
        return res.status(404).json({ message: "Original URL not found" });
      }

      // Look for original file in uploads
      const files = fs.readdirSync(uploadDir).filter(f => f.startsWith(`original_${item.id}`));
      if (files.length === 0) return res.status(404).json({ message: "Original file not found" });

      const filePath = path.join(uploadDir, files[0]);
      res.sendFile(path.resolve(filePath));
    } catch (error: any) {
      res.status(500).json({ message: error?.message || 'Failed to get original file' });
    }
  });

  // Delete content item
  app.delete("/api/content/:id", async (req, res) => {
    try {
      const success = await storage.deleteContentItem(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Content not found" });
      }
      res.json({ message: "Content deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error?.message || 'Failed to delete content item' });
    }
  });

  // Generate AI chat answer
  app.post("/api/content/:id/chat", async (req, res) => {
    try {
      const { question } = req.body;
      if (!question || typeof question !== 'string') {
        return res.status(400).json({ message: "Question is required" });
      }

      const item = await storage.getContentItem(req.params.id);
      if (!item) {
        return res.status(404).json({ message: "Content not found" });
      }

      const answer = await generateChatAnswer(
        question,
        item.summary || "",
        item.extractedText || ""
      );

      res.json({ answer });
    } catch (error: any) {
      console.error("Chat answer generation failed:", error);
      res.status(500).json({ message: error?.message || 'Failed to generate answer' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Background processing function
async function processContentAsync(
  contentId: string,
  filePath: string | null,
  contentType: "document" | "image" | "video",
  options: any,
  originalUrl?: string,
  originalFileName?: string
) {
  try {
    console.log(`Starting ${contentType} processing for content ID: ${contentId}`);
    
    // Update status to processing
    await storage.updateContentItem(contentId, { status: "processing" });

    // Process the content
    console.log(`Calling processContent for ${contentType}...`);
    const result = await processContent(filePath, contentType, options, originalUrl, originalFileName);
    console.log(`processContent completed for ${contentId}, extracted text length: ${result.extractedText?.length || 0}`);

    // Save audio file if generated
    let audioUrl: string | undefined;
    if (result.audioBuffer && result.audioBuffer.length > 0) {
      audioUrl = `audio_${contentId}.mp3`;
      const audioPath = path.join(uploadDir, audioUrl);
      fs.writeFileSync(audioPath, result.audioBuffer);
    }

    // Save podcast audio file if generated (for videos)
    let podcastAudioUrl: string | undefined;
    if (result.podcastAudioBuffer && result.podcastAudioBuffer.length > 0) {
      podcastAudioUrl = `podcast_audio_${contentId}.mp3`;
      const podcastAudioPath = path.join(uploadDir, podcastAudioUrl);
      fs.writeFileSync(podcastAudioPath, result.podcastAudioBuffer);
    }

    // Update with results (only set fields that were generated so we don't overwrite with undefined)
    const updates: Record<string, unknown> = {
      status: "completed",
      extractedText: result.extractedText,
    };
    if (result.summary !== undefined) updates.summary = result.summary;
    if (audioUrl !== undefined) updates.audioUrl = audioUrl;
    if (result.podcastScript !== undefined) updates.podcastScript = result.podcastScript;
    if (podcastAudioUrl !== undefined) updates.podcastAudioUrl = podcastAudioUrl;
    if (result.quizData !== undefined) updates.quizData = result.quizData;
    if (result.flashcards !== undefined) updates.flashcards = result.flashcards;
    if ((result as any).mindMap !== undefined) updates.mindMap = (result as any).mindMap;
    await storage.updateContentItem(contentId, updates as any);

    // Clean up or rename uploaded file
    if (filePath && fs.existsSync(filePath)) {
      if (contentType === "document" || contentType === "image") {
        const ext = path.extname(originalFileName || filePath);
        const permanentPath = path.join(uploadDir, `original_${contentId}${ext}`);
        fs.renameSync(filePath, permanentPath);
      } else {
        fs.unlinkSync(filePath);
      }
    }
  } catch (error: any) {
    console.error("Processing failed:", error);
    await storage.updateContentItem(contentId, {
      status: "failed",
      errorMessage: error?.message || 'Processing failed',
    });

    // Clean up uploaded file on error
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

// Background processing function for audio files
async function processAudioFileAsync(
  contentId: string,
  filePath: string,
  mimeType: string,
  options: any,
  originalFileName?: string
) {
  try {
    // Update status to processing
    await storage.updateContentItem(contentId, { status: "processing" });

    // Read audio file and transcribe using Whisper
    const audioBuffer = fs.readFileSync(filePath);
    const extractedText = await transcribeAudio(audioBuffer, mimeType);

    if (!extractedText.trim()) {
      throw new Error("No text could be extracted from the audio file");
    }

    // Import functions needed for processing
    const { generateFormattedSummaryAndFlashcards, summarizeContent, generateQuiz, generateSpeech } = await import("./services/openai");

    const result: {
      extractedText: string;
      summary?: string;
      audioBuffer?: Buffer;
      quizData?: Array<{ question: string; options: string[]; correctAnswer: number }>;
      flashcards?: Array<{ question: string; answer: string }>;
    } = { extractedText };

    // Generate summary if requested
    if (options.generateSummary) {
      try {
        const formatted = await generateFormattedSummaryAndFlashcards(extractedText);
        result.summary = formatted.summary_markdown;
        if (formatted.flashcards && formatted.flashcards.length > 0) {
          result.flashcards = formatted.flashcards;
        }
      } catch (err) {
        result.summary = await summarizeContent(extractedText);
      }
    }

    // Generate audio if requested (TTS)
    if (options.generateAudio) {
      try {
        const audio = await generateSpeech(extractedText, options.voiceId);
        if (audio) {
          result.audioBuffer = audio;
        }
      } catch (error) {
        console.log("Audio generation skipped:", error);
      }
    }

    // Generate quiz if requested
    if (options.generateQuiz) {
      result.quizData = await generateQuiz(extractedText);
    }

    // Save audio file if generated (TTS)
    let audioUrl: string | undefined;
    if (result.audioBuffer && result.audioBuffer.length > 0) {
      audioUrl = `audio_${contentId}.mp3`;
      const audioPath = path.join(uploadDir, audioUrl);
      fs.writeFileSync(audioPath, result.audioBuffer);
    }

    // Update with results (only set fields that were generated)
    const updates: Record<string, unknown> = {
      status: "completed",
      extractedText: result.extractedText,
    };
    if (result.summary !== undefined) updates.summary = result.summary;
    if (audioUrl !== undefined) updates.audioUrl = audioUrl;
    if (result.quizData !== undefined) updates.quizData = result.quizData;
    if (result.flashcards !== undefined) updates.flashcards = result.flashcards;
    await storage.updateContentItem(contentId, updates as any);

    // Clean up or rename uploaded file
    if (filePath && fs.existsSync(filePath)) {
      const ext = path.extname(originalFileName || filePath);
      const permanentPath = path.join(uploadDir, `original_${contentId}${ext}`);
      fs.renameSync(filePath, permanentPath);
    }
  } catch (error: any) {
    console.error("Audio processing failed:", error);
    await storage.updateContentItem(contentId, {
      status: "failed",
      errorMessage: error?.message || 'Processing failed',
    });

    // Clean up uploaded file on error
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
