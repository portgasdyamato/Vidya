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

const BackgroundNodes = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden hidden lg:block opacity-60 dark:opacity-40">
      
      {/* Top Left */}
      <svg className="absolute top-[150px] left-0 w-[400px] h-[200px] stroke-white dark:stroke-white/20" preserveAspectRatio="none">
        <path d="M 85 0 L 250 0 L 350 150 L 400 150" fill="none" strokeWidth="1" />
      </svg>
      <div className="absolute top-[130px] -left-[20px] w-24 h-10 bg-white/40 dark:bg-[#111] backdrop-blur-md border border-black/10 dark:border-white/10 rounded-lg flex items-center justify-end pr-2 shadow-lg">
        <div className="flex flex-col gap-1 pr-2">
           <div className="flex gap-1"><div className="w-1 h-1 bg-black/20 dark:bg-white/20 rounded-full"/><div className="w-1 h-1 bg-black/20 dark:bg-white/20 rounded-full"/></div>
           <div className="flex gap-1"><div className="w-1 h-1 bg-black/20 dark:bg-white/20 rounded-full"/><div className="w-1 h-1 bg-black/20 dark:bg-white/20 rounded-full"/></div>
        </div>
      </div>
      <div className="absolute top-[148px] left-[85px] w-1.5 h-1.5 bg-white dark:bg-white/60 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)] dark:shadow-[0_0_8px_rgba(255,255,255,0.8)]" />

      {/* Bottom Left */}
      <svg className="absolute bottom-[150px] left-0 w-[400px] h-[200px] stroke-white dark:stroke-white/20" preserveAspectRatio="none">
        <path d="M 85 200 L 250 200 L 350 50 L 400 50" fill="none" strokeWidth="1" />
      </svg>
      <div className="absolute bottom-[130px] -left-[20px] w-24 h-10 bg-white/40 dark:bg-[#111] backdrop-blur-md border border-black/10 dark:border-white/10 rounded-lg flex items-center justify-end pr-2 shadow-lg">
         <div className="flex flex-col gap-1 pr-2">
           <div className="flex gap-1"><div className="w-1 h-1 bg-black/20 dark:bg-white/20 rounded-full"/><div className="w-1 h-1 bg-black/20 dark:bg-white/20 rounded-full"/></div>
           <div className="flex gap-1"><div className="w-1 h-1 bg-black/20 dark:bg-white/20 rounded-full"/><div className="w-1 h-1 bg-black/20 dark:bg-white/20 rounded-full"/></div>
        </div>
      </div>
      <div className="absolute top-[148px] left-[85px] w-1.5 h-1.5 bg-white dark:bg-white/60 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)] dark:shadow-[0_0_8px_rgba(255,255,255,0.8)]" />

      {/* Top Right */}
      <svg className="absolute top-[150px] right-0 w-[400px] h-[200px] stroke-white dark:stroke-white/20" preserveAspectRatio="none">
        <path d="M 315 0 L 150 0 L 50 150 L 0 150" fill="none" strokeWidth="1" />
      </svg>
      <div className="absolute top-[130px] -right-[20px] w-24 h-10 bg-white/40 dark:bg-[#111] backdrop-blur-md border border-black/10 dark:border-white/10 rounded-lg flex items-center justify-start pl-2 shadow-lg">
         <div className="flex flex-col gap-1 pl-2">
           <div className="flex gap-1"><div className="w-1 h-1 bg-black/20 dark:bg-white/20 rounded-full"/><div className="w-1 h-1 bg-black/20 dark:bg-white/20 rounded-full"/></div>
           <div className="flex gap-1"><div className="w-1 h-1 bg-black/20 dark:bg-white/20 rounded-full"/><div className="w-1 h-1 bg-black/20 dark:bg-white/20 rounded-full"/></div>
        </div>
      </div>
      <div className="absolute top-[148px] right-[85px] w-1.5 h-1.5 bg-white dark:bg-white/60 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)] dark:shadow-[0_0_8px_rgba(255,255,255,0.8)]" />

      {/* Bottom Right */}
      <svg className="absolute bottom-[150px] right-0 w-[400px] h-[200px] stroke-white dark:stroke-white/20" preserveAspectRatio="none">
        <path d="M 315 200 L 150 200 L 50 50 L 0 50" fill="none" strokeWidth="1" />
      </svg>
      <div className="absolute bottom-[130px] -right-[20px] w-24 h-10 bg-white/40 dark:bg-[#111] backdrop-blur-md border border-black/10 dark:border-white/10 rounded-lg flex items-center justify-start pl-2 shadow-lg">
         <div className="flex flex-col gap-1 pl-2">
           <div className="flex gap-1"><div className="w-1 h-1 bg-black/20 dark:bg-white/20 rounded-full"/><div className="w-1 h-1 bg-black/20 dark:bg-white/20 rounded-full"/></div>
           <div className="flex gap-1"><div className="w-1 h-1 bg-black/20 dark:bg-white/20 rounded-full"/><div className="w-1 h-1 bg-black/20 dark:bg-white/20 rounded-full"/></div>
        </div>
      </div>
      <div className="absolute bottom-[148px] right-[85px] w-1.5 h-1.5 bg-white dark:bg-white/60 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)] dark:shadow-[0_0_8px_rgba(255,255,255,0.8)]" />

    </div>
  );
};

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const [isLogin, setIsLogin] = useState(true);
  const [showPass, setShowPass] = useState(false);

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white flex items-center justify-center overflow-hidden relative p-4 transition-colors duration-500">
      {/* Light Mode: Dynamic Colorful Flowy Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none dark:hidden z-0 bg-white/10 backdrop-blur-3xl">
        <div className="absolute w-[120vw] h-[120vh] -top-[10%] -left-[10%] bg-pink-400 rounded-full filter blur-[120px] opacity-60 animate-pulse" style={{ animationDuration: '12s' }} />
        <div className="absolute w-[100vw] h-[100vh] top-[10%] left-[30%] bg-sky-400 rounded-full filter blur-[120px] opacity-60 animate-pulse" style={{ animationDuration: '18s', animationDelay: '2s' }} />
        <div className="absolute w-[110vw] h-[110vh] -bottom-[10%] -right-[10%] bg-purple-400 rounded-full filter blur-[120px] opacity-60 animate-pulse" style={{ animationDuration: '15s', animationDelay: '5s' }} />
        <div className="absolute inset-0 bg-white/10 filter blur-[10px]" />
      </div>

      {/* Dark Mode: Cinematic GIF Environment */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-80 mix-blend-screen pointer-events-none hidden dark:block"
        style={{ backgroundImage: "url('/bg.gif')" }} 
      />
      <div className="absolute inset-0 bg-black/20 pointer-events-none hidden dark:block" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/80 pointer-events-none hidden dark:block" />
      
      {/* Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-white/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-white/5 blur-[100px] rounded-full" />
      </div>

      <BackgroundNodes />

      <div className="w-full max-w-[400px] relative z-10 animate-in fade-in zoom-in duration-700">
        <div className="bg-white/[0.02] backdrop-blur-[60px] border border-white/10 rounded-[32px] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col items-center">
          
          {/* Logo / Icon */}
          <Link href="/">
            <div className="w-14 h-14 rounded-[1.25rem] bg-white/10 border border-white/20 flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(255,255,255,0.05)] cursor-pointer hover:bg-white/15 transition-all">
              <img src="/logo.png" alt="Vidya Logo" className="w-8 h-8 object-contain" />
            </div>
          </Link>

          <h2 className="text-2xl font-bold text-white mb-2 font-serif tracking-tight">
            {isLogin ? "Welcome Back" : "Create Account"}
          </h2>
          
          <p className="text-sm text-white mb-8">
            {isLogin ? "Don't have an account yet?" : "Already have an account?"}{" "}
            <button 
              onClick={() => setIsLogin(!isLogin)} 
              className="text-white hover:underline font-semibold transition-all"
            >
              {isLogin ? "Sign up" : "Log in"}
            </button>
          </p>

          <div className="w-full space-y-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={isLogin ? "login" : "register"}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {!isLogin && (
                  <div className="relative">
                    <UserCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white pointer-events-none" />
                    <Input
                      type="text"
                      placeholder="Full Name"
                      className="h-12 rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white focus:border-white/30 focus:bg-white/10 transition-all pl-11"
                    />
                  </div>
                )}
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white pointer-events-none" />
                  <Input
                    type="email"
                    placeholder="email address"
                    className="h-12 rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white focus:border-white/30 focus:bg-white/10 transition-all pl-11"
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white pointer-events-none" />
                  <Input
                    type={showPass ? "text" : "password"}
                    placeholder="Password"
                    className="h-12 rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white focus:border-white/30 focus:bg-white/10 transition-all pl-11 pr-12"
                  />
                  <button
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-white transition-colors"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <Button className="w-full h-12 rounded-xl glass-button-primary mt-2">
                  {isLogin ? "Login" : "Sign Up"}
                </Button>
              </motion.div>
            </AnimatePresence>

            {/* Divider */}
            <div className="relative flex items-center gap-4 py-2">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[10px] text-white font-bold uppercase tracking-widest">Or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* Social Logins */}
            <div className="flex flex-col gap-3">
              <a href="/api/auth/google" className="w-full">
                <Button variant="outline" className="w-full h-12 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 text-white transition-all shadow-none flex items-center justify-center gap-3">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span className="font-medium text-[15px]">Continue with Google</span>
                </Button>
              </a>
              <a href="/workspace" className="w-full">
                <Button variant="outline" className="w-full h-12 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 text-white transition-all shadow-none flex items-center justify-center gap-3">
                  <UserCheck className="w-5 h-5 text-white/80" />
                  <span className="font-medium text-[15px] text-white/90">Continue as Guest</span>
                </Button>
              </a>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
