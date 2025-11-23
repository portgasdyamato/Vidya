import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Pause, Volume2, Gauge, Subtitles, Rewind, FastForward } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

interface PodcastPlayerProps {
  audioUrl: string;
  title: string;
  transcript?: string; // Full transcript text for subtitles
  summary?: string; // Summary text to display
  useWebSpeech?: boolean; // Use Web Speech API instead of audio file
}

export default function PodcastPlayer({ audioUrl, title, transcript, summary, useWebSpeech = false }: PodcastPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [currentSubtitle, setCurrentSubtitle] = useState("");
  // Choose transcript first; fallback to summary if provided
  const primaryText = transcript || summary || "";
  // Remove code/json fences
  const cleanText = primaryText
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[{}\[\]]/g, " ");
  const [speechProgress, setSpeechProgress] = useState(0);
  const textToSpeak = cleanText;
  const gifPath = isPlaying ? '/talk.gif' : '/stop.gif';
  const gifSrc = import.meta.env.DEV ? `http://localhost:5001${gifPath}` : gifPath;

  // Web Speech API implementation
  useEffect(() => {
    if (useWebSpeech && textToSpeak) {
      // Estimate duration based on text length (rough estimate: 150 words per minute)
      const words = textToSpeak.split(/\s+/).length;
      const estimatedDuration = (words / 150) * 60; // seconds
      setDuration(estimatedDuration);
    }
  }, [useWebSpeech, textToSpeak]);

  // Audio file implementation
  useEffect(() => {
    if (useWebSpeech || !audioUrl) return;
    
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    // Update subtitle based on current time
    if (transcript && showSubtitles) {
      const interval = setInterval(() => {
        if (audio.duration) {
          const words = transcript.split(/\s+/);
          const wordsPerSecond = words.length / audio.duration;
          const currentWordIndex = Math.floor(audio.currentTime * wordsPerSecond);
          const startIdx = Math.max(0, currentWordIndex - 10);
          const endIdx = Math.min(words.length, currentWordIndex + 10);
          setCurrentSubtitle(words.slice(startIdx, endIdx).join(" "));
        }
      }, 500);

      return () => {
        clearInterval(interval);
        audio.removeEventListener("timeupdate", updateTime);
        audio.removeEventListener("loadedmetadata", updateDuration);
        audio.removeEventListener("play", handlePlay);
        audio.removeEventListener("pause", handlePause);
        audio.removeEventListener("ended", handleEnded);
      };
    }

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [transcript, duration, showSubtitles, audioUrl, useWebSpeech]);

  // Web Speech subtitle updates
  useEffect(() => {
    if (!useWebSpeech || !transcript || !showSubtitles || !isPlaying) return;

    const interval = setInterval(() => {
      if (duration > 0) {
        const progress = speechProgress / 100;
        const words = transcript.split(/\s+/);
        const currentWordIndex = Math.floor(progress * words.length);
        const startIdx = Math.max(0, currentWordIndex - 10);
        const endIdx = Math.min(words.length, currentWordIndex + 10);
        setCurrentSubtitle(words.slice(startIdx, endIdx).join(" "));
        setCurrentTime(progress * duration);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [useWebSpeech, transcript, showSubtitles, isPlaying, duration, speechProgress]);

  useEffect(() => {
    if (!useWebSpeech && audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, useWebSpeech]);

  useEffect(() => {
    if (!useWebSpeech && audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume, useWebSpeech]);

  const togglePlay = () => {
    if (useWebSpeech) {
      // Web Speech API
      if (isPlaying) {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
        setSpeechProgress(0);
        setCurrentTime(0);
      } else {
        if (!textToSpeak) return;
        
        // Cancel any existing speech
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.rate = playbackRate;
        utterance.volume = volume;
        utterance.lang = navigator.language || "en-US";
        
        let startTime = Date.now();
        const totalChars = textToSpeak.length;
        
        utterance.onstart = () => {
          setIsPlaying(true);
          startTime = Date.now();
        };
        
        utterance.onboundary = (event) => {
          if (event.charIndex !== undefined && totalChars > 0) {
            const progress = (event.charIndex / totalChars) * 100;
            setSpeechProgress(progress);
            const elapsed = (Date.now() - startTime) / 1000;
            setCurrentTime(elapsed);
          }
        };
        
        utterance.onend = () => {
          setIsPlaying(false);
          setSpeechProgress(100);
          setCurrentTime(duration);
        };
        
        utterance.onerror = () => {
          setIsPlaying(false);
        };
        
        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      }
    } else {
      // Audio file
      if (!audioRef.current) return;
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(console.error);
      }
    }
  };

  const handleSeek = (value: number[]) => {
    if (useWebSpeech) {
      // For Web Speech, we can't seek easily, so cancel and restart from new position
      const seekTime = value[0];
      const progress = (seekTime / duration) * 100;
      setSpeechProgress(progress);
      setCurrentTime(seekTime);
      
      if (isPlaying && textToSpeak) {
        window.speechSynthesis.cancel();
        const seekCharIndex = Math.floor((progress / 100) * textToSpeak.length);
        const textFromSeek = textToSpeak.substring(seekCharIndex);
        
        const utterance = new SpeechSynthesisUtterance(textFromSeek);
        utterance.rate = playbackRate;
        utterance.volume = volume;
        utterance.lang = navigator.language || "en-US";
        
        utterance.onstart = () => setIsPlaying(true);
        utterance.onend = () => {
          setIsPlaying(false);
          setSpeechProgress(100);
          setCurrentTime(duration);
        };
        
        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      }
    } else {
      if (audioRef.current) {
        audioRef.current.currentTime = value[0];
        setCurrentTime(value[0]);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleDownload = () => {
  if (!audioUrl || useWebSpeech) return;
  const link = document.createElement("a");
  link.href = audioUrl;
  link.download = `${title || "podcast"}.mp3`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const handleShare = async () => {
  try {
    if (navigator.share) {
      await navigator.share({ title, url: audioUrl || window.location.href });
    } else if (audioUrl) {
      await navigator.clipboard.writeText(audioUrl);
      alert("Link copied to clipboard");
    }
  } catch (err) {
    console.error(err);
  }
};

const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (useWebSpeech) {
        window.speechSynthesis.cancel();
      }
    };
  }, [useWebSpeech]);

// Keyboard shortcuts for enhanced accessibility and quicker controls
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (["INPUT", "TEXTAREA"].includes(tag ?? "")) return;

    switch (e.code) {
      case "Space":
        e.preventDefault();
        togglePlay();
        break;
      case "ArrowLeft":
        handleSeek([Math.max(0, currentTime - 10)]);
        break;
      case "ArrowRight":
        handleSeek([Math.min(duration, currentTime + 10)]);
        break;
      case "ArrowUp":
        setVolume((v) => Math.min(1, v + 0.05));
        break;
      case "ArrowDown":
        setVolume((v) => Math.max(0, v - 0.05));
        break;
      case "KeyS":
        setShowSubtitles((v) => !v);
        break;
      case "BracketRight":
        setPlaybackRate((rate) => {
          const idx = speedOptions.indexOf(rate);
          return idx < speedOptions.length - 1 ? speedOptions[idx + 1] : rate;
        });
        break;
      case "BracketLeft":
        setPlaybackRate((rate) => {
          const idx = speedOptions.indexOf(rate);
          return idx > 0 ? speedOptions[idx - 1] : rate;
        });
        break;
      default:
        break;
    }
  };
  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [currentTime, duration, togglePlay, handleSeek]);

  return (
  <div className="space-y-6">
    {!useWebSpeech && <audio ref={audioRef} src={audioUrl} preload="metadata" />}

    <div className="flex flex-col items-center gap-6">
      <img
        src={gifSrc}
        alt="animation"
        className="w-64 h-64 rounded-full shadow-xl object-cover"
      />

      <div className="text-center">
        <h3 className="text-2xl font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">
          {useWebSpeech ? "Audio Podcast (Text-to-Speech)" : "Audio Podcast"}
        </p>
      </div>

      <Button onClick={togglePlay} className="h-14 w-14 rounded-full">
        {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
      </Button>
    </div>

    {/* progress */}
    <div>
      <Slider value={[currentTime]} max={duration || 100} step={0.1} onValueChange={handleSeek} />
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>

    {/* controls */}
    <div className="flex flex-wrap justify-center items-center gap-4">
      <Button variant="ghost" onClick={() => handleSeek([Math.max(0, currentTime - 10)])}>
        <Rewind className="h-5 w-5" />
      </Button>

      <div className="flex items-center gap-2">
        <Volume2 className="h-4 w-4" />
        <Slider value={[volume]} max={1} step={0.01} onValueChange={(v) => setVolume(v[0])} className="w-32" />
      </div>

      <Select value={String(playbackRate)} onValueChange={(v) => setPlaybackRate(parseFloat(v))}>
        <SelectTrigger className="w-20 h-8 text-xs">
          <SelectValue placeholder={`${playbackRate}x`} />
        </SelectTrigger>
        <SelectContent>
          {speedOptions.map((s) => (
            <SelectItem key={s} value={String(s)}>{s}x</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button variant="ghost" onClick={() => handleSeek([Math.min(duration, currentTime + 10)])}>
        <FastForward className="h-5 w-5" />
      </Button>

      <Button variant={showSubtitles ? "default" : "outline"} onClick={() => setShowSubtitles(!showSubtitles)}>
        <Subtitles className="h-4 w-4 mr-1" />
        {showSubtitles ? "Hide" : "Show"} Subtitles
      </Button>
    </div>

    {showSubtitles && currentSubtitle && (
      <div className="rounded-lg border p-4 bg-muted/20 text-sm">{currentSubtitle}</div>
    )}
  </div>
  )}