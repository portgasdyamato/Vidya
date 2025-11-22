import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence?: number;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  length: number;
  isFinal?: boolean;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

interface UseSpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  onTranscript?: (transcript: string) => void;
}

interface UseSpeechRecognitionResult {
  listening: boolean;
  browserSupportsSpeech: boolean;
  microphoneAccess: boolean | null;
  startListening: () => Promise<void>;
  stopListening: () => void;
  toggleListening: () => Promise<void>;
  error: string | null;
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionResult {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const transcriptCallbackRef = useRef<((transcript: string) => void) | undefined>(
    undefined
  );
  const lastTranscriptRef = useRef<string>("");

  const [listening, setListening] = useState(false);
  const [browserSupportsSpeech, setBrowserSupportsSpeech] = useState(true);
  const [microphoneAccess, setMicrophoneAccess] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { lang = "en-US", continuous = false, onTranscript } = options;

  useEffect(() => {
    transcriptCallbackRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    if (typeof window === "undefined") {
      setBrowserSupportsSpeech(false);
      setError("Speech recognition is unavailable in this environment.");
      return;
    }

    const SpeechRecognitionCtor = (window.SpeechRecognition || window.webkitSpeechRecognition) as
      | SpeechRecognitionConstructor
      | undefined;

    if (!SpeechRecognitionCtor) {
      setBrowserSupportsSpeech(false);
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognitionRef.current = recognition;
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.continuous = continuous;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const results = event.results;
      const lastIndex = results.length - 1;
      if (lastIndex < 0) return;

      const result = results[lastIndex];
      const transcript = result?.[0]?.transcript?.trim();

      if (!transcript || result?.isFinal === false) {
        return;
      }

      if (transcript === lastTranscriptRef.current) {
        return;
      }

      lastTranscriptRef.current = transcript;

      if (transcriptCallbackRef.current) {
        transcriptCallbackRef.current(transcript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setListening(false);
      setError(
        event.error === "not-allowed"
          ? "Microphone access was denied. Please enable it in your browser settings."
          : event.error === "audio-capture"
          ? "No microphone was detected. Please connect one and try again."
          : "An error occurred while processing voice input."
      );
    };

    recognition.onend = () => {
      setListening(false);
    };

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [lang, continuous]);

  const requestMicrophonePermission = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Microphone access is not supported in this environment.");
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicrophoneAccess(true);
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch {
      setMicrophoneAccess(false);
      setError("Microphone access is required to use voice input.");
      return false;
    }
  }, []);

  const startListening = useCallback(async () => {
    if (!browserSupportsSpeech) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    if (!recognitionRef.current) {
      setError("Speech recognition is not initialized yet.");
      return;
    }

    const granted = await requestMicrophonePermission();
    if (!granted) return;

    try {
      setError(null);
      recognitionRef.current.start();
      setListening(true);
    } catch (err) {
      console.error("Speech recognition start error", err);
      setError("Unable to start voice input. Please try again.");
    }
  }, [browserSupportsSpeech, requestMicrophonePermission]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setListening(false);
    lastTranscriptRef.current = "";
  }, []);

  const toggleListening = useCallback(async () => {
    if (listening) {
      stopListening();
    } else {
      await startListening();
    }
  }, [listening, startListening, stopListening]);

  return {
    listening,
    browserSupportsSpeech,
    microphoneAccess,
    startListening,
    stopListening,
    toggleListening,
    error,
  };
}
