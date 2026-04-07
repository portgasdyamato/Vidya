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
  MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export default function Home() {
  const { user } = useAuth();
  
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-4 selection:bg-[#00a3b6]/30">
      
      {/* Custom Header */}
      <header className="w-full max-w-6xl flex justify-between items-center py-6 absolute top-0 px-6">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer transition-transform hover:scale-105 active:scale-95">
            <h1 className="text-2xl font-bold font-serif">Vidya</h1>
          </div>
        </Link>
        <div className="flex items-center gap-6">
          {!user ? (
            <Link href="/login">
              <span className="text-sm font-medium text-white/70 hover:text-white transition-colors cursor-pointer">Login</span>
            </Link>
          ) : (
             <Link href="/workspace">
              <span className="text-sm font-medium text-white/70 hover:text-white transition-colors cursor-pointer capitalize">Hi, {user.name || user.username}</span>
            </Link>
          )}
          <Link href="/workspace">
            <span className="text-sm font-medium text-white/70 hover:text-white transition-colors cursor-pointer">Workspace</span>
          </Link>
        </div>
      </header>

      <main className="w-full max-w-6xl flex flex-col items-center gap-12 mt-20 mb-12">
        
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <h2 className="text-5xl font-bold font-serif tracking-tight lg:text-6xl text-white/95">
            Vidya Web
          </h2>
          <div className="flex items-center justify-center gap-2 text-white/50 text-sm md:text-base">
            <Lock className="w-3.5 h-3.5 opacity-60" />
            <p>AI-powered learning companion for accessible education.</p>
          </div>
        </div>

        {/* Main Interface Card */}
        <div className="w-full max-w-5xl glass-card rounded-[2.5rem] border border-white/10 p-8 md:p-12 relative shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)]">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            
            {/* Steps Left Panel */}
            <div className="space-y-8">
              <h3 className="text-2xl font-semibold font-serif text-white/90">Steps to start learning</h3>
              <ul className="space-y-6">
                {[
                  { text: "Choose your material type (Doc, Image, Video)" },
                  { text: "Upload your files or paste a link" },
                  { text: "Advanced AI processes and transforms content" },
                  { text: "Receive accessible audio and interactive study material" },
                ].map((step, i) => (
                  <li key={i} className="flex items-center gap-4 group">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white text-black flex items-center justify-center font-bold text-sm shadow-lg group-hover:scale-110 transition-transform">
                      {i + 1}
                    </div>
                    <p className="text-white/80 font-medium leading-tight group-hover:text-white transition-colors">{step.text}</p>
                  </li>
                ))}
              </ul>
              
              <div className="pt-4">
                <Link href="/workspace">
                  <span className="text-[#00a3b6] hover:text-[#22d3ee] font-medium flex items-center gap-1 transition-colors cursor-pointer group">
                    Get started with your first source
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Link>
              </div>
            </div>

            {/* AI Visual Right Panel */}
            <div className="flex flex-col items-end gap-6 relative">
              <div className="w-full max-w-sm aspect-square bg-[#00a3b6]/5 rounded-[2.5rem] border border-white/5 flex items-center justify-center overflow-hidden relative group transition-all hover:bg-[#00a3b6]/10 shadow-[0_20px_50px_rgba(0,163,182,0.05)]">
                <img 
                  src="/talk.gif" 
                  alt="AI Assistant Visualization" 
                  className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-all duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-black/10 to-transparent pointer-events-none" />
                
                {/* Visual Accent */}
                <div className="absolute bottom-4 left-4 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">AI Active</span>
                </div>
              </div>

              {/* Action Button */}
              <Link href="/workspace">
                <Button className="bg-[#5c8a82] hover:bg-[#6c9a92] text-white px-8 py-6 rounded-full font-medium shadow-xl flex items-center gap-3 transition-all hover:scale-105 active:scale-95 group">
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
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="w-6 h-6 text-white/70 group-hover:text-primary transition-colors" />
              </div>
              <p className="text-sm font-medium text-white/80 leading-snug">{feature.title}</p>
            </div>
          ))}
        </div>

        {/* Final CTA Strip */}
        <div className="w-full max-w-5xl glass-card rounded-[2rem] border border-white/10 p-6 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative group">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 relative flex items-center justify-center">
              <div className="absolute inset-0 bg-[#00a3b6]/20 blur-xl rounded-full" />
              <div className="relative w-10 h-10 border-2 border-primary/40 rounded-full flex items-center justify-center animate-[spin_10s_linear_infinite]">
                 <Plus className="w-4 h-4 text-primary" />
                 <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                 <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
              </div>
              <Layout className="absolute w-5 h-5 text-primary opacity-80" />
            </div>
            <div className="text-center md:text-left">
              <h4 className="text-lg font-bold">Don't have a Vidya account?</h4>
              <p className="text-sm text-white/50">Start your accessible learning journey today.</p>
            </div>
          </div>
          <Link href={user ? "/workspace" : "/login"}>
            <Button variant="ghost" className="text-primary hover:text-white hover:bg-primary transition-all gap-2 text-md font-bold px-0 md:px-6">
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
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/60">
          Powered by Project Vidya AI 2026
        </p>
      </footer>
    </div>
  );
}
