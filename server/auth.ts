import type { Express, Request, Response } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy, Profile } from "passport-google-oauth20";
import { storage } from "./storage";

export function setupGoogleAuth(app: Express) {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, BASE_URL: ENV_BASE_URL, PORT } = process.env;

  passport.serializeUser((user: any, done: (err: any, id?: any) => void) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done: (err: any, user?: any) => void) => {
    try {
      const user = await storage.getUser(id);
      done(null, user || null);
    } catch (err) {
      done(err);
    }
  });

  if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
    const BASE_URL = ENV_BASE_URL || `http://localhost:${PORT || 5000}`;
    const callbackURL = `${BASE_URL.replace(/\/$/, "")}/auth/google/callback`;
    
    console.log(`Setting up Google Auth with callback: ${callbackURL}`);

    passport.use(
      new GoogleStrategy(
        {
          clientID: GOOGLE_CLIENT_ID,
          clientSecret: GOOGLE_CLIENT_SECRET,
          callbackURL,
          proxy: true
        },
        async (_accessToken: string, _refreshToken: string, profile: Profile, done: (err: any, user?: any) => void) => {
          try {
            // Check if user exists in DB
            let user = await storage.getUser(profile.id);
            if (!user) {
              // Create user in DB
              user = await storage.createUser({
                id: profile.id, // We use Google ID as the primary key
                username: profile.emails?.[0]?.value || profile.displayName || profile.id,
                password: "google-authenticated-user", // Placeholder since we use OAuth
              } as any);
              console.log(`Created new Google user: ${user.username}`);
            }
            
            // For session data that isn't in DB yet (like photo)
            const sessionUser = {
              ...user,
              name: profile.displayName,
              photo: profile.photos?.[0]?.value || "",
            };
            done(null, sessionUser);
          } catch (err) {
            console.error("Error in Google Strategy:", err);
            done(err);
          }
        }
      )
    );
  } else {
    console.warn("Google OAuth credentials missing – only Guest login available.");
  }

  // Mount passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Auth routes
  app.get("/auth/google", (req, res, next) => {
    if (!GOOGLE_CLIENT_ID) {
      return res.status(400).send("Google authentication is not configured on this server.");
    }
    passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
  });

  app.get(
    "/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/?auth_failed=true" }),
    (_req, res) => res.redirect("/workspace")
  );

  app.post("/auth/logout", (req, res) => {
    req.logout((err: any) => {
      if (err) return res.status(500).json({ error: "Logout failed" });
      res.json({ ok: true });
    });
  });

  app.get("/api/auth/user", (req, res) => {
    res.json({ user: req.user || null });
  });

  // Guest login implementation
  app.get("/auth/guest", async (req, res) => {
    try {
      console.log("Establishing guest session...");
      const guestUser = await storage.ensureDefaultUser();
      req.login({
        ...guestUser,
        name: "Guest Student",
        photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=guest"
      }, (err: any) => {
        if (err) {
          console.error("Guest login failed:", err);
          return res.redirect("/?error=guest_failed");
        }
        res.redirect("/workspace");
      });
    } catch (err) {
      console.error("Guest setup failed:", err);
      res.redirect("/?error=guest_db_failed");
    }
  });
}
