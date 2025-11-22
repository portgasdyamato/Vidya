import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Volume2, Download } from "lucide-react";
import { useAudio } from "@/lib/AudioContext";

export default function PersistentAudioPlayer() {
  const audio = useAudio();

  useEffect(() => {
    // nothing for now
  }, [audio.audioUrl]);

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
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 w-11/12 md:w-3/4 bg-card/80 border border-border/40 rounded-2xl p-3 shadow-lg">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => audio.togglePlay()} aria-label="Toggle play">
          {audio.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>

        <div className="flex-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{format(audio.currentTime)}</span>
            <span className="font-medium truncate mx-2">{audio.title}</span>
            <span>{format(audio.duration)}</span>
          </div>
          <Slider value={[audio.currentTime]} max={audio.duration || 100} step={1} onValueChange={(v) => audio.seek(v[0])} aria-label="Player progress" />
        </div>

        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-muted-foreground" />
          <Slider value={[audio.volume]} max={1} step={0.05} onValueChange={(v) => audio.setVolume(v[0])} className="w-24" aria-label="Volume" />
        </div>

        <Button variant="ghost" size="sm" onClick={handleDownload} aria-label="Download audio">
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
