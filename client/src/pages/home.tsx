import { Link } from "wouter";
import { 
  FileText, 
  Image as ImageIcon, 
  Video, 
  Lock, 
  Sparkles, 
  ShieldCheck, 
  ArrowRight,
  Plus,
  Monitor,
  Layout,
  MessageSquare,
  Sun,
  Moon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

export default function Home() {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const displayName = user ? (user.displayName || user.name || user.username) : '';
  
  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-4 selection:bg-[#00a3b6]/30 relative overflow-hidden transition-colors duration-500">
      {/* Light Mode: Dynamic Colorful Flowy Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none dark:hidden z-0 bg-white/10 backdrop-blur-3xl">
        <div className="absolute w-[120vw] h-[120vh] -top-[10%] -left-[10%] bg-pink-400 rounded-full filter blur-[120px] opacity-60 animate-pulse" style={{ animationDuration: '12s' }} />
        <div className="absolute w-[100vw] h-[100vh] top-[10%] left-[30%] bg-sky-400 rounded-full filter blur-[120px] opacity-60 animate-pulse" style={{ animationDuration: '18s', animationDelay: '2s' }} />
        <div className="absolute w-[110vw] h-[110vh] -bottom-[10%] -right-[10%] bg-purple-400 rounded-full filter blur-[120px] opacity-60 animate-pulse" style={{ animationDuration: '15s', animationDelay: '5s' }} />
        <div className="absolute inset-0 bg-white/10 filter blur-[10px]" />
      </div>
      
      {/* Main Content wrapper */}
      <div className="relative z-10 flex flex-col w-full items-center">
      
      {/* Custom Header */}
      <header className="w-full max-w-6xl flex justify-between items-center py-6 absolute top-0 px-6">
        <Link href="/">
          <div className="flex items-center gap-3 cursor-pointer transition-transform hover:scale-105 active:scale-95 group">
            <div className="flex items-center justify-center group-hover:scale-105 transition-transform">
              <img src="/logo.png" alt="Vidya Logo" className="w-8 h-8 object-contain" />
            </div>
            <h1 className="text-2xl font-bold font-serif text-white">Vidya</h1>
          </div>
        </Link>
        <div className="flex items-center gap-6">
          <button 
            onClick={toggle} 
            className="glass-button w-10 h-10 p-0 rounded-xl flex items-center justify-center text-white"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          {!user ? (
            <Link href="/login">
              <span className="text-sm font-medium text-white hover:text-white transition-colors cursor-pointer">Login</span>
            </Link>
          ) : (
            <Link href="/workspace">
              <span className="text-sm font-medium text-white hover:text-white transition-colors cursor-pointer capitalize">Hi, {displayName}</span>
            </Link>
          )}
            <Link href="/workspace">
              <span className="text-sm font-medium text-white hover:text-white transition-colors cursor-pointer">Workspace</span>
            </Link>
        </div>
      </header>

      <main className="w-full max-w-6xl flex flex-col items-center gap-8 mt-16 mb-8">
        
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <h2 className="text-5xl font-bold font-serif tracking-tight lg:text-6xl text-white">
            Vidya Web
          </h2>
          <div className="flex items-center justify-center gap-2 text-white text-sm md:text-base">
            <Lock className="w-3.5 h-3.5 opacity-60" />
            <p>AI-powered learning companion for accessible education.</p>
          </div>
        </div>

        {/* Main Interface Card */}
        <div className="w-full max-w-5xl glass-card rounded-[2.5rem] border border-white/10 p-6 md:p-10 relative shadow-[0_32px_64px_-16px_rgba(0,0,0,0.15)]">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            
            {/* Steps Left Panel */}
            <div className="space-y-8">
              <h3 className="text-2xl font-semibold font-serif text-white">Steps to start learning</h3>
              <ul className="space-y-6">
                {[
                  { text: "Choose your material type (Document)" },
                  { text: "Upload your files" },
                  { text: "Advanced AI processes and transforms content" },
                  { text: "Receive accessible audio and interactive study material" },
                ].map((step, i) => (
                  <li key={i} className="flex items-center gap-4 group">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center font-bold text-sm shadow-lg group-hover:scale-110 transition-transform">
                      {i + 1}
                    </div>
                    <p className="text-white font-medium leading-tight group-hover:text-white transition-colors">{step.text}</p>
                  </li>
                ))}
              </ul>
              
              <div className="pt-4">
                <Link href="/workspace">
                  <span className="text-white hover:text-white font-medium flex items-center gap-1 transition-colors cursor-pointer group">
                    Get started with your first source
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Link>
              </div>
            </div>

            {/* AI Visual Right Panel */}
            <div className="flex flex-col items-end gap-6 relative">
              <div className="w-full max-w-sm aspect-square glass-card rounded-[2.5rem] flex items-center justify-center relative group transition-all dark:hover:bg-[#00a3b6]/10 shadow-[0_20px_50px_rgba(0,163,182,0.05)]">
                <img 
                  src={theme === "dark" ? "/bg.gif" : "/lightide.gif"} 
                  alt="AI Assistant Visualization" 
                  className="w-full h-full object-cover dark:opacity-80 dark:group-hover:opacity-100 transition-all duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent dark:from-black/10 to-transparent pointer-events-none" />
                
                {/* Visual Accent */}
                <div className="absolute bottom-4 left-4 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white">AI Active</span>
                </div>
              </div>

              {/* Action Button */}
              <Link href="/workspace">
                <Button className="glass-button-primary px-8 py-6 rounded-full shadow-xl flex items-center gap-3 group">
                  {user ? "Go to Workspace" : "Start learning now"}
                  <ShieldCheck className="w-5 h-5 opacity-80 group-hover:scale-110 transition-transform" />
                </Button>
              </Link>
            </div>

          </div>
        </div>

        {/* Triple Feature Grid */}
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { 
              icon: Monitor, 
              title: "View materials in high-res", 
              description: "Access summaries and transcripts on all devices." 
            },
            { 
              icon: FileText, 
              title: "Drag and drop to upload", 
              description: "Seamlessly process PDFs and Word documents." 
            },
            { 
              icon: Sparkles, 
              title: "AI-powered study companion", 
              description: "Keep learning while you multitask with ease." 
            },
          ].map((feature, i) => (
            <div key={i} className="glass-card rounded-3xl p-6 border border-white/10 flex items-center gap-4 transition-all hover:border-white/20 hover:bg-white/[0.05] group">
              <feature.icon className="w-7 h-7 text-white group-hover:text-white transition-colors flex-shrink-0" />
              <p className="text-sm font-medium text-white leading-snug">{feature.title}</p>
            </div>
          ))}
        </div>

        {/* Final CTA Strip */}
        <div className="w-full max-w-5xl glass-card rounded-[2rem] border border-white/10 p-6 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative group">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 relative flex items-center justify-center">
              <div className="relative w-10 h-10 border-2 border-primary/40 rounded-full flex items-center justify-center animate-[spin_10s_linear_infinite]">
                 <Plus className="w-4 h-4 text-primary" />
                 <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                 <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
              </div>
              <Layout className="absolute w-5 h-5 text-primary opacity-80" />
            </div>
            <div className="text-center md:text-left">
              <h4 className="text-lg font-bold">Don't have a Vidya account?</h4>
              <p className="text-sm text-white">Start your accessible learning journey today.</p>
            </div>
          </div>
          <Link href={user ? "/workspace" : "/login"}>
            <Button className="glass-button-primary transition-all gap-2 text-md px-6 py-6 rounded-full">
              {user ? "Go to Workspace" : "Get started"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          
          {/* Subtle background glow */}
          <div className="absolute -right-20 -bottom-20 w-40 h-40 bg-primary/20 blur-[80px] rounded-full group-hover:bg-primary/30 transition-all pointer-events-none" />
        </div>

      </main>

      {/* Simplified Footer */}
      <footer className="w-full max-w-6xl flex justify-center py-8 opacity-40 hover:opacity-100 transition-opacity">
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-white">
          Powered by Project Vidya AI 2026 &bull; Built by Sakshi Agrahari
        </p>
      </footer>
      </div>
    </div>
  );
}
