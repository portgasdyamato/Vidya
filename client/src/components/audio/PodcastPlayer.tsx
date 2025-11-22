import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Pause, Volume2, Gauge, Subtitles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
  const [speechProgress, setSpeechProgress] = useState(0);
  const textToSpeak = summary || transcript || "";

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

  const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (useWebSpeech) {
        window.speechSynthesis.cancel();
      }
    };
  }, [useWebSpeech]);

  return (
    <div className="space-y-4">
      {!useWebSpeech && <audio ref={audioRef} src={audioUrl} preload="metadata" />}
      
      {/* Audio Player Controls */}
      <Card className="border-border/50">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">{title}</h3>
              <p className="text-sm text-muted-foreground">
                {useWebSpeech ? "Audio Podcast (Text-to-Speech)" : "Audio Podcast"}
              </p>
            </div>
            <Button
              onClick={togglePlay}
              size="lg"
              className="h-12 w-12 rounded-full"
              disabled={useWebSpeech && !textToSpeak}
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </Button>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSeek}
              className="w-full"
              disabled={useWebSpeech && !isPlaying}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Controls Row */}
          <div className="flex items-center gap-4">
            {/* Volume */}
            <div className="flex items-center gap-2 flex-1">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <Slider
                value={[volume]}
                max={1}
                step={0.01}
                onValueChange={(v) => setVolume(v[0])}
                className="flex-1"
              />
            </div>

            {/* Speed Control */}
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-muted-foreground" />
              <div className="flex gap-1">
                {speedOptions.map((speed) => (
                  <Button
                    key={speed}
                    variant={playbackRate === speed ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPlaybackRate(speed)}
                    className="h-8 px-2 text-xs"
                  >
                    {speed}x
                  </Button>
                ))}
              </div>
            </div>

            {/* Subtitles Toggle */}
            <Button
              variant={showSubtitles ? "default" : "outline"}
              size="sm"
              onClick={() => setShowSubtitles(!showSubtitles)}
              className="h-8"
            >
              <Subtitles className="h-4 w-4 mr-1" />
              {showSubtitles ? "Hide" : "Show"} Subtitles
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Subtitles Display */}
      {showSubtitles && (currentSubtitle || transcript) && (
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Subtitles className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold text-foreground">Subtitles</h4>
            </div>
            <div className="min-h-[60px] p-3 rounded-lg bg-background/50 border border-border/30">
              <p className="text-sm leading-relaxed text-foreground">
                {currentSubtitle || transcript?.substring(0, 200) + "..."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary/Transcript Display */}
      {summary && (
        <Card className="border-border/50">
          <CardContent className="p-4">
            <h4 className="text-sm font-semibold text-foreground mb-3">Summary</h4>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({node, ...props}) => <h1 className="text-xl font-bold text-foreground mb-3 mt-4" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-lg font-semibold text-foreground mb-2 mt-3" {...props} />,
                  h3: ({node, ...props}) => <h3 className="text-base font-semibold text-foreground mb-2 mt-2" {...props} />,
                  p: ({node, ...props}) => <p className="mb-2 leading-relaxed text-foreground text-sm" {...props} />,
                  strong: ({node, ...props}) => <strong className="font-semibold text-foreground" {...props} />,
                  ul: ({node, ...props}) => <ul className="list-disc list-inside mb-2 space-y-1 text-foreground text-sm" {...props} />,
                  ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-2 space-y-1 text-foreground text-sm" {...props} />,
                  li: ({node, ...props}) => <li className="ml-4" {...props} />,
                  code: ({node, ...props}) => <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props} />,
                  pre: ({node, ...props}) => <pre className="bg-muted p-3 rounded-lg overflow-x-auto mb-3" {...props} />,
                }}
              >
                {summary}
              </ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
