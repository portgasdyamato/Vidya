import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";
import session from "express-session";
import { setupGoogleAuth } from "./auth.js";
import { ensureSchema, pool } from "./db.js";
import pgSession from "connect-pg-simple";
import { setupVite, serveStatic, log } from "./vite.js";
import path from "path";
import * as fs from "fs";
import os from "os";

const app = express();
const isVercel = !!process.env.VERCEL || !!process.env.LAMBDA_TASK_ROOT || !!process.env.VERCEL_URL;
const uploadsDir = isVercel 
  ? path.join(os.tmpdir(), "uploads") 
  : path.join(process.cwd(), "uploads");

log(`🚀 Environment: ${isVercel ? "Vercel/Serverless" : "Local"}`);
log(`📂 Uploads directory: ${uploadsDir}`);

if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch (err) {
    log(`⚠️ Could not create uploads dir: ${err}`);
  }
}

process.env.APP_UPLOADS_DIR = uploadsDir;
app.set("etag", false);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static GIFs
app.get("/talk.gif", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "talk.gif"));
});
app.get("/stop.gif", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "stop.gif"));
});

// Polyfill for PDF libraries on Vercel
if (isVercel && typeof (global as any).DOMMatrix === 'undefined') {
  (global as any).DOMMatrix = class {};
}

// Session middleware with Vercel-specific optimizations
const PostgresStore = pgSession(session);
app.use(
  session({
    store: new PostgresStore({ 
      pool, 
      tableName: "session",
      pruneSessionInterval: false // CRITICAL for serverless
    }),
    secret: process.env.SESSION_SECRET || "vidya_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === "production" && !isVercel,
    },
  })
);

setupGoogleAuth(app);

// Diagnostic Health Check
app.get("/api/health", (req, res) => {
  const dbSet = !!process.env.DATABASE_URL;
  const orSet = !!process.env.OPENROUTER_API_KEY;
  res.json({ 
    status: "ok", 
    isVercel,
    region: process.env.VERCEL_REGION || "local",
    checks: {
      DATABASE_URL: dbSet ? "Set" : "MISSING",
      OPENROUTER_API_KEY: orSet ? "Set" : "MISSING",
      UPLOADS: uploadsDir
    }
  });
});

let initializedApp: any = null;

// Vercel serverless handler with lazy initialization
export default async (req: Request, res: Response) => {
  try {
    if (!initializedApp) {
      log("📊 Lazy-initializing server...");
      await ensureSchema();
      const { storage } = await import("./storage.js");
      await storage.ensureDefaultUser();
      await registerRoutes(app);
      
      if (app.get("env") !== "development" || isVercel) {
        serveStatic(app);
      } else {
        const { createServer: createHttpServer } = await import("http");
        const server = createHttpServer(app);
        await setupVite(app, server);
      }
      
      app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
        const status = err.status || err.statusCode || 500;
        res.status(status).json({ message: err.message || "Internal Server Error" });
      });
      
      initializedApp = app;
      log("✅ Lazy-initialization complete");
    }
    
    return initializedApp(req, res);
  } catch (error: any) {
    console.error("Vercel handler crash:", error);
    res.status(500).json({ error: "Initialization Failed", detail: error?.message });
  }
};

// Local startup
if (!isVercel) {
  const port = parseInt(process.env.PORT || "5000", 10);
  app.listen(port, "0.0.0.0", () => {
    log(`✨ Local server running at: http://localhost:${port}`);
  });
}

export { app };
