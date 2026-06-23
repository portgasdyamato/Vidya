import type { Express, Request, Response } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy, Profile } from "passport-google-oauth20";
import { storage } from "./storage.js";

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
    const callbackURL = "/api/auth/google/callback";
    
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
  app.get("/api/auth/google", (req, res, next) => {
    if (!GOOGLE_CLIENT_ID) {
      return res.status(400).send("Google authentication is not configured on this server.");
    }
    passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
  });

  app.get(
    "/api/auth/google/callback",
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

  app.patch("/api/auth/user", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const { displayName } = req.body;
    try {
      const updatedUser = await storage.updateUser((req.user as any).id, { displayName });
      
      // Update the session user object
      if (updatedUser) {
        const sessionUser = {
          ...req.user,
          ...updatedUser,
          name: updatedUser.displayName || (req.user as any).name,
        };
        req.login(sessionUser, (err) => {
          if (err) return res.status(500).json({ message: "Failed to update session" });
          res.json({ user: sessionUser });
        });
      } else {
        res.status(404).json({ message: "User not found" });
      }
    } catch (error) {
      console.error("Failed to update user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
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
