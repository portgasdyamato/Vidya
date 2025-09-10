import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertContentItemSchema, processingOptionsSchema } from "@shared/schema";
import multer from "multer";
import * as path from "path";
import * as fs from "fs";
import { processContent } from "./services/fileProcessor";

const upload = multer({ dest: "uploads/" });

export async function registerRoutes(app: Express): Promise<Server> {
  // Get user content items
  app.get("/api/content", async (req, res) => {
    try {
      // For demo purposes, using a default user ID
      // In a real app, this would come from authentication
      const userId = "default-user";
      const items = await storage.getUserContentItems(userId);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || 'Failed to fetch content items' });
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
        userId: "default-user", // In real app, get from auth
        title: title || req.file.originalname,
        type: "document",
        originalFileName: req.file.originalname,
        processingOptions: parsedOptions,
      });

      // Process in background
      processContentAsync(contentItem.id, req.file.path, "document", parsedOptions);

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
        userId: "default-user",
        title: title || req.file.originalname,
        type: "image",
        originalFileName: req.file.originalname,
        processingOptions: parsedOptions,
      });

      // Process in background
      processContentAsync(contentItem.id, req.file.path, "image", parsedOptions);

      res.json(contentItem);
    } catch (error: any) {
      res.status(400).json({ message: error?.message || 'Failed to process image' });
    }
  });

  // Process video URL
  app.post("/api/content/video", async (req, res) => {
    try {
      const { title, url, processingOptions } = req.body;
      const parsedOptions = processingOptionsSchema.parse(processingOptions);

      const contentItem = await storage.createContentItem({
        userId: "default-user",
        title: title || "Video Content",
        type: "video",
        originalUrl: url,
        processingOptions: parsedOptions,
      });

      // Process in background
      processContentAsync(contentItem.id, null, "video", parsedOptions, url);

      res.json(contentItem);
    } catch (error: any) {
      res.status(400).json({ message: error?.message || 'Failed to process video' });
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

  const httpServer = createServer(app);
  return httpServer;
}

// Background processing function
async function processContentAsync(
  contentId: string,
  filePath: string | null,
  contentType: "document" | "image" | "video",
  options: any,
  originalUrl?: string
) {
  try {
    // Update status to processing
    await storage.updateContentItem(contentId, { status: "processing" });

    // Process the content
    const result = await processContent(filePath, contentType, options, originalUrl);

    // Save audio file if generated
    let audioUrl: string | undefined;
    if (result.audioBuffer && result.audioBuffer.length > 0) {
      audioUrl = `audio_${contentId}.mp3`;
      const audioPath = path.join("uploads", audioUrl);
      fs.writeFileSync(audioPath, result.audioBuffer);
    }

    // Update with results
    await storage.updateContentItem(contentId, {
      status: "completed",
      extractedText: result.extractedText,
      summary: result.summary,
      audioUrl,
      quizData: result.quizData,
    });

    // Clean up uploaded file
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
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
