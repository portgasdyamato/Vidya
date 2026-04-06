import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Volume2, Download, Music, X } from "lucide-react";
import { useAudio } from "@/lib/AudioContext";
import { motion, AnimatePresence } from "framer-motion";

export default function PersistentAudioPlayer() {
  const audio = useAudio();

  const format = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  if (!audio.audioUrl) return null;

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = audio.audioUrl!;
    link.download = `${audio.title || "audio"}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-3rem)] md:w-[600px]"
      >
        <div className="glass-card rounded-3xl p-4 shadow-2xl border-white/10">
          <div className="flex items-center gap-5">
            <button 
              onClick={() => audio.togglePlay()} 
              className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
            >
              {audio.isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>

            <div className="flex-1 min-w-0">
               <div className="flex items-center gap-2 mb-1.5 overflow-hidden">
                  <Music className="w-3 h-3 text-primary animate-pulse shrink-0" />
                  <span className="text-sm font-medium text-white truncate">{audio.title || "Study Session"}</span>
               </div>
               
               <div className="relative pt-1">
                  <Slider 
                    value={[audio.currentTime]} 
                    max={audio.duration || 100} 
                    step={1} 
                    onValueChange={(v) => audio.seek(v[0])} 
                    className="cursor-pointer"
                  />
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-[10px] font-mono text-white/30">{format(audio.currentTime)}</span>
                    <span className="text-[10px] font-mono text-white/30">{format(audio.duration)}</span>
                  </div>
               </div>
            </div>

            <div className="hidden sm:flex items-center gap-3 ml-2 border-l border-white/5 pl-5">
              <Volume2 className="w-4 h-4 text-white/30" />
              <Slider 
                value={[audio.volume]} 
                max={1} 
                step={0.05} 
                onValueChange={(v) => audio.setVolume(v[0])} 
                className="w-20" 
              />
            </div>

            <div className="flex items-center gap-2">
               <button onClick={handleDownload} className="p-2 hover:bg-white/5 rounded-xl text-white/30 hover:text-white transition-colors">
                  <Download className="w-5 h-5" />
               </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
