import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import session from "express-session";
import { setupGoogleAuth } from "./auth";
import { ensureSchema } from "./db";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import * as fs from "fs";
import os from "os";

const app = express();

// Ensure uploads directory exists - use os.tmpdir on Vercel/Serverless
const isVercel = !!process.env.VERCEL || !!process.env.LAMBDA_TASK_ROOT;
const uploadsDir = isVercel 
  ? path.join(os.tmpdir(), "uploads") 
  : path.join(process.cwd(), "uploads");

if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch (err) {
    log(`Warning: Failed to create uploads directory at ${uploadsDir}: ${err}`);
  }
}

// Make the uploads dir accessible globally
process.env.APP_UPLOADS_DIR = uploadsDir;
app.set("etag", false);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve GIF assets
app.get("/talk.gif", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "talk.gif"));
});
app.get("/stop.gif", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "stop.gif"));
});

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || "vidya_secret",
    resave: false,
    saveUninitialized: false,
  })
);

// Passport + Google OAuth
setupGoogleAuth(app);

// Cache control for API routes
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
  }
  next();
});

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (res.get("X-Response-Time")) {
        logLine += ` (real: ${res.get("X-Response-Time")}ms)`;
      }
      log(logLine);
    }
  });

  next();
});

let initialized = false;
let serverInstance: any = null;

export async function initApp() {
  if (initialized) return { app, server: serverInstance };

  // Ensure database schema and default user
  try {
    log("📊 Setting up database schema...");
    await ensureSchema();
    log("✅ Database schema ready");
    
    // Create default user for guest flow
    const { storage } = await import("./storage");
    await storage.ensureDefaultUser();
    log("👤 Default user verified");
  } catch (err) {
    console.error("❌ Failed to initialize database:", err);
  }

  // Register API routes
  serverInstance = await registerRoutes(app);

  // Setup Vite in development or static serving in production
  if (app.get("env") === "development") {
    await setupVite(app, serverInstance);
  } else {
    serveStatic(app);
  }

  // Error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Error:", message, err);
    res.status(status).json({ message });
  });

  initialized = true;
  return { app, server: serverInstance };
}

// Auto-start if not being imported as a module (simplified check)
if (!process.env.VERCEL && !process.env.LAMBDA_TASK_ROOT) {
  initApp().then(({ server }) => {
    const port = parseInt(process.env.PORT || "5000", 10);
    server.listen(port, "0.0.0.0", () => {
      log(`✨ Server running at: http://localhost:${port}`);
      log(`📱 Environment: ${app.get("env")}`);
    });
  });
}

// Vercel serverless handler
export default async (req: Request, res: Response) => {
  try {
    const { app } = await initApp();
    return (app as any)(req, res);
  } catch (error: any) {
    console.error("Vercel handler crashed:", error);
    res.status(500).json({ error: "Server Initialization Failed", details: error?.message });
  }
};

export { app };


