import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Lock, Mail, LogIn, Sparkles, UserCheck, Eye, EyeOff, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";

const features = [
  "AI-powered study summaries",
  "Interactive mind maps",
  "Smart flashcard drills",
  "Neural audio podcast",
];

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const [isLogin, setIsLogin] = useState(true);
  const [showPass, setShowPass] = useState(false);

  return (
    <div className="min-h-screen bg-[#060608] text-white flex overflow-hidden">
      {/* ── Left: Decorative Panel ─────────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] relative bg-gradient-to-br from-primary/10 via-transparent to-blue-500/5 p-16 border-r border-white/5">
        {/* Background Orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary/8 blur-[120px] rounded-full" />
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-blue-500/5 blur-[100px] rounded-full" />
        </div>

        {/* Logo */}
        <Link href="/">
          <div className="flex items-center gap-3 cursor-pointer group w-fit">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-black font-serif tracking-tight">Vidya</h1>
          </div>
        </Link>

        {/* Hero Text */}
        <div className="space-y-8 relative">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-black uppercase tracking-widest">
              <Sparkles className="w-3 h-3" />
              <span>Next-Gen Learning</span>
            </div>
            <h2 className="text-5xl font-black font-serif text-white leading-tight tracking-tight">
              Your AI
              <br />
              <span className="text-primary">learning</span>
              <br />
              companion.
            </h2>
            <p className="text-white/50 text-base leading-relaxed max-w-sm">
              Transform any document, lecture, or video into interactive study guides, mind maps, and intelligent conversations.
            </p>
          </div>

          {/* Features List */}
          <div className="space-y-3">
            {features.map((f, i) => (
              <motion.div
                key={f}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * i, duration: 0.5 }}
                className="flex items-center gap-3"
              >
                <div className="w-5 h-5 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-3 h-3 text-primary" />
                </div>
                <span className="text-sm text-white/60">{f}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom Note */}
        <p className="text-[11px] text-white/20 font-medium">
          Trusted by 10,000+ students worldwide · Privacy-first AI
        </p>
      </div>

      {/* ── Right: Auth Form ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-16 relative">
        {/* Mobile Logo */}
        <Link href="/">
          <div className="lg:hidden flex items-center gap-2 mb-10 cursor-pointer">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-xl font-black font-serif">Vidya</h1>
          </div>
        </Link>

        <div className="w-full max-w-[420px] space-y-8">

          {/* Tab Toggle */}
          <div className="space-y-2">
            <div className="flex items-center gap-1 bg-white/5 p-1.5 rounded-2xl border border-white/5">
              <button
                onClick={() => setIsLogin(true)}
                className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${isLogin ? "bg-white text-black shadow-lg" : "text-white/50 hover:text-white"}`}
              >
                Sign In
              </button>
              <button
                onClick={() => setIsLogin(false)}
                className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${!isLogin ? "bg-white text-black shadow-lg" : "text-white/50 hover:text-white"}`}
              >
                Create Account
              </button>
            </div>
          </div>

          {/* Form */}
          <AnimatePresence mode="wait">
            <motion.div
              key={isLogin ? "login" : "register"}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="space-y-3">
                {!isLogin && (
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="Full Name"
                      className="h-13 rounded-2xl bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-primary/50 focus:bg-white/8 transition-all pl-5 py-4"
                    />
                  </div>
                )}
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                  <Input
                    type="email"
                    placeholder="Email address"
                    className="h-13 rounded-2xl bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-primary/50 focus:bg-white/8 transition-all pl-11 py-4"
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                  <Input
                    type={showPass ? "text" : "password"}
                    placeholder="Password"
                    className="h-13 rounded-2xl bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-primary/50 focus:bg-white/8 transition-all pl-11 pr-12 py-4"
                  />
                  <button
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {isLogin && (
                <div className="text-right">
                  <button className="text-[12px] text-primary hover:text-primary/80 font-semibold transition-colors">
                    Forgot password?
                  </button>
                </div>
              )}

              <Button className="w-full h-13 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black text-base shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3">
                {isLogin ? <LogIn className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                {isLogin ? "Sign in to Vidya" : "Create free account"}
              </Button>
            </motion.div>
          </AnimatePresence>

          {/* Divider */}
          <div className="relative flex items-center gap-4">
            <div className="flex-1 h-px bg-white/8" />
            <span className="text-[11px] text-white/30 font-medium uppercase tracking-widest">Or</span>
            <div className="flex-1 h-px bg-white/8" />
          </div>

          {/* Social Logins */}
          <div className="flex flex-col gap-3">
            <a href="/auth/google" className="w-full">
              <Button
                variant="outline"
                className="w-full h-13 rounded-2xl border-white/10 bg-white/4 hover:bg-white/8 text-white hover:text-white gap-3 font-semibold transition-all hover:border-white/20"
              >
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </Button>
            </a>

            <a href="/workspace" className="w-full">
              <Button
                variant="outline"
                className="w-full h-13 rounded-2xl border-white/10 bg-white/4 hover:bg-white/8 text-white hover:text-white gap-3 font-semibold transition-all hover:border-primary/30 group"
              >
                <Sparkles className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                Continue as Guest
              </Button>
            </a>
          </div>

          <p className="text-center text-[12px] text-white/25">
            By continuing, you agree to Vidya's{" "}
            <button className="text-white/40 underline hover:text-white/60 transition-colors">Terms</button>
            {" "}and{" "}
            <button className="text-white/40 underline hover:text-white/60 transition-colors">Privacy Policy</button>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
