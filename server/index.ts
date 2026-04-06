import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import session from "express-session";
import { setupGoogleAuth } from "./auth";
import { ensureSchema, pool } from "./db";
import pgSession from "connect-pg-simple";
const PostgresStore = pgSession(session);
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
    store: new PostgresStore({ pool, tableName: "session" }),
    secret: process.env.SESSION_SECRET || "vidya_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      secure: process.env.NODE_ENV === "production",
    },
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

// Initialize app - top level await ensures this is ready for Vercel before the first request
try {
  log("📊 Initializing server components...");
  await ensureSchema();
  const { storage } = await import("./storage");
  await storage.ensureDefaultUser();
  await registerRoutes(app);
  
  if (app.get("env") === "development") {
    // Vite setup only for local dev
  } else {
    serveStatic(app);
  }
  
  // Final error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Error:", message, err);
    res.status(status).json({ message });
  });

  log("✅ Server components initialized");
} catch (err) {
  console.error("❌ Critical server initialization failure:", err);
}

// Auto-start if not on Vercel
if (!isVercel) {
  const port = parseInt(process.env.PORT || "5000", 10);
  app.listen(port, "0.0.0.0", () => {
    log(`✨ Server running at: http://localhost:${port}`);
  });
}

// Export the app as the default handler for Vercel
export default app;
export { app };


