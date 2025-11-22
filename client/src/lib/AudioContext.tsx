import React, { createContext, useContext, useRef, useState, useEffect } from "react";

type AudioContextState = {
  audioUrl?: string;
  title?: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  playSource: (url: string, title?: string) => void;
  togglePlay: () => void;
  pause: () => void;
  setVolume: (v: number) => void;
  setPlaybackRate: (r: number) => void;
  seek: (s: number) => void;
};

const AudioContext = createContext<AudioContextState | undefined>(undefined);

export function useAudio() {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error("useAudio must be used within AudioProvider");
  return ctx;
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | undefined>(undefined);
  const [title, setTitle] = useState<string | undefined>(undefined);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [playbackRate, setPlaybackRateState] = useState(1);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = document.createElement("audio");
      audioRef.current.preload = "metadata";
      audioRef.current.addEventListener("timeupdate", () => setCurrentTime(audioRef.current?.currentTime || 0));
      audioRef.current.addEventListener("loadeddata", () => setDuration(audioRef.current?.duration || 0));
      audioRef.current.addEventListener("play", () => setIsPlaying(true));
      audioRef.current.addEventListener("pause", () => setIsPlaying(false));
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  const playSource = (url: string, t?: string) => {
    if (!audioRef.current) return;
    if (audioRef.current.src !== url) {
      audioRef.current.src = url;
      setAudioUrl(url);
      setTitle(t);
    }
    audioRef.current.play().catch(() => {});
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) audioRef.current.play().catch(() => {});
    else audioRef.current.pause();
  };

  const pause = () => audioRef.current?.pause();
  const setVolume = (v: number) => setVolumeState(v);
  const setPlaybackRate = (r: number) => setPlaybackRateState(r);
  const seek = (s: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = s;
  };

  const value: AudioContextState = {
    audioUrl,
    title,
    isPlaying,
    currentTime,
    duration,
    volume,
    playbackRate,
    playSource,
    togglePlay,
    pause,
    setVolume,
    setPlaybackRate,
    seek,
  };

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
}
