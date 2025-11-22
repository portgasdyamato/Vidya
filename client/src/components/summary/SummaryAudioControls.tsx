import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Volume2, VolumeX } from "lucide-react";

interface SummaryAudioControlsProps {
  text: string;
  title?: string;
  testId?: string;
}

const MIN_RATE = 0.7;
const MAX_RATE = 1.5;

function stripMarkdown(markdown: string): string {
  if (!markdown) return "";
  return markdown
    .replace(/```[\s\S]*?```/g, "") // code fences
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~>#`]/g, "")
    .replace(/ {2,}/g, " ")
    .replace(/\n+/g, " ")
    .trim();
}

export default function SummaryAudioControls({ text, title, testId }: SummaryAudioControlsProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [rate, setRate] = useState(1);
  const [progress, setProgress] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const activeStartRef = useRef(0);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const scrubbingRef = useRef(false);

  const plainText = useMemo(() => stripMarkdown(text), [text]);
  const totalChars = plainText.length;

  const cleanupSpeech = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    utteranceRef.current = null;
    setIsSpeaking(false);
  }, []);

  const handleBoundary = useCallback(
    (baseIndex: number, event: SpeechSynthesisEvent) => {
      if (scrubbingRef.current || typeof event.charIndex !== "number" || totalChars === 0) {
        return;
      }
      const absoluteIndex = Math.min(baseIndex + event.charIndex, totalChars);
      activeStartRef.current = absoluteIndex;
      setProgress(Number(((absoluteIndex / totalChars) * 100).toFixed(1)));
    },
    [totalChars]
  );

  const startFromIndex = useCallback(
    (fromIndex: number) => {
      if (!isSupported || totalChars === 0) return;
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

      cleanupSpeech();

      const safeIndex = Math.min(Math.max(fromIndex, 0), Math.max(totalChars - 1, 0));
      const utterance = new SpeechSynthesisUtterance(plainText.slice(safeIndex));
      utterance.rate = rate;
      utterance.lang = typeof window !== "undefined" && window.navigator?.language ? window.navigator.language : "en-US";
      utterance.onstart = () => {
        setIsSpeaking(true);
        activeStartRef.current = safeIndex;
        setProgress(Number(((safeIndex / Math.max(totalChars, 1)) * 100).toFixed(1)));
      };
      utterance.onboundary = (event) => handleBoundary(safeIndex, event);
      utterance.onend = () => {
        setIsSpeaking(false);
        setProgress(100);
        activeStartRef.current = totalChars;
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [cleanupSpeech, handleBoundary, isSupported, plainText, rate, totalChars]
  );

  const toggleSpeech = () => {
    if (!isSupported || totalChars === 0) return;

    if (isSpeaking) {
      cleanupSpeech();
      return;
    }

    const startIndex = Math.floor((progress / 100) * totalChars);

    startFromIndex(startIndex);
  };

  const onProgressChange = (value: number[]) => {
    const next = value[0];
    scrubbingRef.current = true;
    setIsScrubbing(true);
    setProgress(next);
  };

  const onProgressCommit = (value: number[]) => {
    const next = value[0];
    scrubbingRef.current = false;
    setIsScrubbing(false);
    if (!isSupported || totalChars === 0) {
      activeStartRef.current = Math.floor((next / 100) * totalChars);
      return;
    }

    const startIndex = Math.floor((next / 100) * totalChars);
    if (isSpeaking) {
      startFromIndex(startIndex);
    } else {
      activeStartRef.current = startIndex;
    }
  };

  const onRateChange = (value: number[]) => {
    const next = Number(value[0].toFixed(1));
    setRate(next);
    if (isSpeaking) {
      startFromIndex(activeStartRef.current);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      setIsSupported(true);
    }
    return () => cleanupSpeech();
  }, [cleanupSpeech]);

  const disabled = !isSupported || totalChars === 0;
  const progressValue = progress;

  return (
    <div className="w-full rounded-xl border border-border/60 bg-background/70 p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant={isSpeaking ? "destructive" : "secondary"}
            size="sm"
            disabled={disabled}
            onClick={toggleSpeech}
            className="shrink-0"
            data-testid={testId || "summary-audio-toggle"}
            aria-label={isSpeaking ? "Stop summary narration" : "Play summary narration"}
          >
            {isSpeaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            <span className="ml-2 text-sm">{isSpeaking ? "Stop" : "Listen"}</span>
          </Button>
          <div className="text-xs text-muted-foreground">
            {disabled ? "Speech not supported in this browser" : title || "Summary narration"}
          </div>
        </div>

        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{Math.round(progressValue)}%</span>
          </div>
          <Slider
            value={[progressValue]}
            min={0}
            max={100}
            step={1}
            onValueChange={onProgressChange}
            onValueCommit={onProgressCommit}
            disabled={disabled}
            className="cursor-pointer"
            aria-label="Summary audio progress"
            data-testid="summary-audio-progress"
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            Speed {rate.toFixed(1)}x
          </span>
          <Slider
            value={[rate]}
            min={MIN_RATE}
            max={MAX_RATE}
            step={0.1}
            onValueChange={onRateChange}
            disabled={disabled}
            className="w-32 md:w-40"
            aria-label="Summary audio speed"
            data-testid="summary-audio-speed"
          />
        </div>
      </div>
    </div>
  );
}

