import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Pause, Volume2, Subtitles, Headphones, ChevronDown, FileText, Sparkles, Maximize2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PodcastPlayerProps {
  audioUrl: string;
  title: string;
  transcript?: string; // This should be the CLEAN podcast script (no markdown)
  summary?: string;    // This is the markdown summary — shown in display only, never spoken
  useWebSpeech?: boolean;
}

/**
 * Strips markdown / special characters so text reads cleanly via Web Speech API.
 */
function cleanForSpeech(raw: string): string {
  return raw
    .replace(/^#{1,6}\s+/gm, "")         // headings
    .replace(/\*{1,3}|_{1,3}/g, "")       // bold/italic
    .replace(/`{1,3}[^`]*`{1,3}/g, (m) => m.replace(/`/g, ""))  // code
    .replace(/^>\s*/gm, "")               // blockquotes
    .replace(/^\s*[-*+]\s+/gm, "")        // unordered lists
    .replace(/^\s*\d+[.)]\s+/gm, "")      // ordered lists
    .replace(/^-{3,}|={3,}|\*{3,}/gm, "") // hr
    .replace(/<[^>]+>/g, "")              // html tags
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links → text
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")    // images
    .replace(/[&<>|^~@#=\[\]{}\\]/g, "")    // special chars
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .split("\n").map(l => l.trim()).filter(l => l.length > 0).join(" ")
    .trim();
}

export default function PodcastPlayer({ audioUrl, title, transcript, summary, useWebSpeech = false }: PodcastPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [currentSubtitle, setCurrentSubtitle] = useState("");
  const [speechProgress, setSpeechProgress] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // ALWAYS use transcript (podcast script) as what gets spoken.
  // summary is markdown — it will read # and ** symbols aloud if passed to TTS.
  const rawSpokenText = transcript || "";
  // Clean it one more time client-side just in case any symbols slipped through
  const textToSpeak = cleanForSpeech(rawSpokenText);
  // The script panel shows the clean version too — strip any old markdown from stored scripts
  const displayText = cleanForSpeech(transcript || summary || "");


  // Web Speech API duration estimation
  useEffect(() => {
    if (useWebSpeech && textToSpeak) {
      const words = textToSpeak.split(/\s+/).length;
      const estimatedDuration = (words / 150) * 60; // seconds
      setDuration(estimatedDuration);
    }
  }, [useWebSpeech, textToSpeak]);

  // Audio / Speech Effects
  useEffect(() => {
    if (useWebSpeech || !audioUrl) return;
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const setStatus = (p: boolean) => setIsPlaying(p);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("play", () => setStatus(true));
    audio.addEventListener("pause", () => setStatus(false));
    audio.addEventListener("ended", () => setStatus(false));

    if (textToSpeak && showSubtitles) {
      const interval = setInterval(() => {
        if (audio.duration) {
          const words = textToSpeak.split(/\s+/);
          const currentIdx = Math.floor((audio.currentTime / audio.duration) * words.length);
          setCurrentSubtitle(words.slice(Math.max(0, currentIdx - 8), currentIdx + 8).join(" "));
        }
      }, 300);
      return () => {
        clearInterval(interval);
        audio.removeEventListener("timeupdate", updateTime);
      }
    }
    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
    };
  }, [transcript, showSubtitles, audioUrl, useWebSpeech]);

  const togglePlay = () => {
    if (useWebSpeech) {
      if (isPlaying) {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
      } else {
        if (!textToSpeak) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.rate = playbackRate;
        utterance.volume = volume;
        utterance.onstart = () => setIsPlaying(true);
        utterance.onend = () => { setIsPlaying(false); setSpeechProgress(100); };
        utterance.onboundary = (e) => {
          if (e.charIndex !== undefined) {
             setSpeechProgress((e.charIndex / textToSpeak.length) * 100);
             setCurrentTime((e.charIndex / textToSpeak.length) * duration);
          }
        };
        window.speechSynthesis.speak(utterance);
      }
    } else {
      if (!audioRef.current) return;
      isPlaying ? audioRef.current.pause() : audioRef.current.play().catch(console.error);
    }
  };

  const handleSeek = (val: number[]) => {
    if (useWebSpeech) return; // seeking not fully supported in simple web speech mode
    if (audioRef.current) audioRef.current.currentTime = val[0];
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {!useWebSpeech && <audio ref={audioRef} src={audioUrl} preload="metadata" />}
      
      {/* Premium Podcast Player UI */}
      <Card className="glass-card relative border-primary/20 bg-black/40 overflow-hidden shadow-2xl">
        {/* Animated Background Pulse */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/5 blur-[100px] rounded-full translate-y-1/2 -translate-x-1/2" />

        <CardContent className="p-8 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            
            {/* Left Visual Area */}
            <div className="relative group">
              <div className="w-56 h-56 md:w-64 md:h-64 rounded-3xl bg-black/60 relative overflow-hidden shadow-2xl ring-1 ring-white/10 group-hover:ring-primary/40 transition-all duration-500">
                <img 
                  src={isPlaying ? "/talk.gif" : "/stop.gif"} 
                  alt="AI Personalities" 
                  className={`w-full h-full object-cover transition-all duration-1000 ${isPlaying ? "scale-110 grayscale-0" : "scale-100 grayscale opacity-40"}`}
                />
                
                {/* Overlay Controls */}
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                   <Maximize2 className="w-8 h-8 text-white/40" />
                </div>
              </div>
              
              {/* Floating Play Button */}
              <motion.button
                whileHover={{ scale: 1.15, rotate: 5 }}
                whileTap={{ scale: 0.9 }}
                onClick={togglePlay}
                className="absolute -bottom-6 -right-6 w-20 h-20 bg-primary text-white rounded-2xl shadow-2xl shadow-primary/30 flex items-center justify-center z-20 group/play"
              >
                {isPlaying ? <Pause className="w-10 h-10" /> : <Play className="w-10 h-10 ml-1 fill-current" />}
              </motion.button>
            </div>

            {/* Right Controls & Info */}
            <div className="flex-1 w-full space-y-8 text-center lg:text-left">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary uppercase text-[10px] font-black tracking-widest mb-2">
                  <Sparkles className="w-3 h-3" />
                  <span>Vidya AI Broadcast</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-white font-serif tracking-tight leading-tight line-clamp-2">
                  {title}
                </h2>
                <div className="flex items-center justify-center lg:justify-start gap-3 text-white/50 text-sm font-medium">
                  <Headphones className="w-4 h-4 text-primary" />
                  <span>AI Narrator {useWebSpeech ? "(Neural)" : "(HD Studio)"}</span>
                </div>
              </div>

              {/* Progress System */}
              <div className="space-y-4">
                <Slider
                  value={[useWebSpeech ? (speechProgress / 100) * duration : currentTime]}
                  max={duration || 100}
                  step={0.1}
                  onValueChange={handleSeek}
                  className="w-full cursor-pointer h-2"
                />
                <div className="flex justify-between font-mono text-[10px] text-white/30 tabular-nums font-bold uppercase tracking-tighter">
                  <span>{formatTime(currentTime)}</span>
                  <div className="flex gap-2 text-primary/40">
                    <span className="w-1 h-1 rounded-full bg-current animate-pulse" />
                    <span>Live Output</span>
                  </div>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4">
                 <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-2xl border border-white/5">
                    <Volume2 className="w-4 h-4 text-white/30" />
                    <div className="w-24">
                       <Slider 
                        value={[volume]} 
                        max={1} 
                        step={0.01} 
                        onValueChange={(v) => setVolume(v[0])} 
                       />
                    </div>
                 </div>

                 <div className="flex bg-white/5 rounded-2xl border border-white/5 p-1">
                    {[1, 1.25, 1.5].map(s => (
                      <button 
                        key={s} 
                        onClick={() => setPlaybackRate(s)}
                        className={`text-[10px] font-black px-3 py-1.5 rounded-xl transition-all ${playbackRate === s ? "bg-primary text-white" : "text-white/40 hover:text-white"}`}
                      >
                        {s}X
                      </button>
                    ))}
                 </div>

                 <Button 
                  variant="outline" 
                   onClick={() => setShowSubtitles(!showSubtitles)}
                   className={`rounded-2xl border-white/10 ${showSubtitles ? "bg-primary/20 text-primary border-primary/40" : "text-white/60"}`}
                 >
                   <Subtitles className="w-4 h-4 mr-2" />
                   Subtitles
                 </Button>
              </div>
            </div>

          </div>

          {/* Expanded Subtitle Bar */}
          <AnimatePresence>
            {showSubtitles && isPlaying && currentSubtitle && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-12 p-8 rounded-[2rem] bg-primary/5 border border-primary/10 text-center"
              >
                 <motion.p 
                    key={currentSubtitle}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="text-xl md:text-2xl font-serif text-primary italic leading-relaxed"
                 >
                    "{currentSubtitle}"
                 </motion.p>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Script Drawer */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white font-serif">Podcast Script</h3>
              <p className="text-[11px] text-white/30">AI-generated from your document</p>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-primary font-bold hover:bg-primary/10 text-sm"
          >
            {isExpanded ? "Collapse" : "Read Full Script"}
            <ChevronDown className={`ml-2 w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
          </Button>
        </div>

        <motion.div
          animate={{ height: isExpanded ? 'auto' : '160px' }}
          className="relative overflow-hidden rounded-3xl bg-white/3 border border-white/6"
        >
          <div className="p-8">
            {displayText ? (
              <div className="space-y-4">
                {displayText.split(/\n\n+/).filter(p => p.trim().length > 0).map((para, i) => (
                  <p key={i} className="text-base text-white/65 leading-relaxed">
                    {para.trim()}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-white/30 italic text-sm">
                No script available yet. Generate a podcast to see the script here.
              </p>
            )}
          </div>
          {!isExpanded && (
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent pointer-events-none" />
          )}
        </motion.div>

        {displayText && (
          <p className="text-[10px] text-white/20 text-right">
            {displayText.split(/\s+/).filter(Boolean).length} words · Spoken by Vidya AI
          </p>
        )}
      </div>
    </div>
  );
}
