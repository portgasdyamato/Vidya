import type { Express } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy, Profile } from "passport-google-oauth20";

// In-memory user store for demo purposes
const users = new Map<string, any>();

export function setupGoogleAuth(app: Express) {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, BASE_URL: ENV_BASE_URL, PORT } = process.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.warn("Google OAuth env vars missing – auth disabled");
    return;
  }

  // Allow BASE_URL to be omitted; fallback to localhost:<PORT|5000>
  const BASE_URL = ENV_BASE_URL || `http://localhost:${PORT || 5000}`;

  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser((id: string, done) => {
    done(null, users.get(id) || null);
  });

  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: `${BASE_URL.replace(/\/$/, "")}/auth/google/callback`,
      },
      (_accessToken: string, _refreshToken: string, profile: Profile, done) => {
        const user = {
          id: profile.id,
          name: profile.displayName,
          photo: profile.photos?.[0]?.value || "",
          email: profile.emails?.[0]?.value || "",
        };
        users.set(user.id, user);
        done(null, user);
      }
    )
  );

  // Mount passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Auth routes
  app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

  app.get(
    "/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/" }),
    (_req, res) => res.redirect("/workspace")
  );

  app.post("/auth/logout", (req, res) => {
    req.logout(() => {
      res.json({ ok: true });
    });
  });

  app.get("/api/auth/user", (req, res) => {
    res.json({ user: req.user || null });
  });
}
