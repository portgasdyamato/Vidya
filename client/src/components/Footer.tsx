import { GraduationCap } from "lucide-react";

export default function Footer() {
  return (
    <footer className="py-16 border-t border-white/5 bg-[#050505]" role="contentinfo">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
           <div className="text-center md:text-left">
              <div className="flex items-center gap-2 mb-2 justify-center md:justify-start">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <GraduationCap className="text-primary w-5 h-5" strokeWidth={2.5} />
                </div>
                <h3 className="text-xl font-serif font-bold text-white">Vidya</h3>
              </div>
              <p className="text-sm text-white/30 max-w-sm">
                Making education accessible through AI-powered learning tools. Breaking down barriers for students everywhere.
              </p>
           </div>
           
           <div className="flex gap-8 text-sm font-medium">
              <a href="/#features" className="text-white/40 hover:text-white transition-colors">Features</a>
              <a href="/#how-it-works" className="text-white/40 hover:text-white transition-colors">How it works</a>
              <a href="mailto:support@vidya.edu" className="text-white/40 hover:text-white transition-colors">Contact</a>
           </div>

           <div className="text-sm text-white/10">
              © {new Date().getFullYear()} Vidya. All rights reserved.
           </div>
        </div>
      </div>
    </footer>
  );
}
