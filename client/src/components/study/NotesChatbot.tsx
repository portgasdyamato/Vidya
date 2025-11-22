import { useMemo, useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Button } from "@/components/ui/button";
import { Mic } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { sendChatToBackend } from "@/lib/chatClient";

interface NotesChatbotProps {
  summary?: string;
  extractedText?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function buildAssistantReply(summary: string, extractedText: string, question: string): string {
  // Always fallback to a generic message if no backend answer
  return "I'm here to help! Please ask any question about your notes.";
}

export default function NotesChatbot({ summary = "", extractedText = "" }: NotesChatbotProps) {
    const [listening, setListening] = useState(false);
    const recognitionRef = useRef<any>(null);

    // Setup speech recognition
    const startListening = () => {
      if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
        alert('Speech recognition not supported in this browser.');
        return;
      }
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput((prev) => prev + (prev ? ' ' : '') + transcript);
      };
      recognition.onend = () => {
        setListening(false);
      };
      recognition.onerror = () => {
        setListening(false);
      };
      recognitionRef.current = recognition;
      recognition.start();
      setListening(true);
    };

    const stopListening = () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        setListening(false);
      }
    };
  const [input, setInput] = useState("");
  // Show only a single intro message welcoming the user and explaining they can ask about their notes
  const initialMessages: ChatMessage[] = useMemo(() => [
    {
      role: "assistant",
      content: "Welcome! Your notes are processed. You can ask anything about the material, concepts, or details—just type your question below.",
    }
  ], []);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [loading, setLoading] = useState(false);

  // Chat is always enabled, regardless of summary/extractedText
  const combinedSummary = "";

  const handleAsk = () => {
    if (!input.trim()) return;
    const question = input.trim();
    setInput("");

    // append user message immediately
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);

    const ctx = `${summary || ""}\n\n${extractedText || ""}`.trim();

    // Build conversation history to send: send last N messages to backend
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    history.push({ role: "user", content: question });

    // Insert a placeholder assistant message that will be filled progressively
    const assistantIndex = messages.length + 1; // approximate position
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    // Use streaming-capable client to get progressive chunks
    (async () => {
      let accumulated = "";
      const onChunk = (chunk: string) => {
        accumulated += chunk;
        // update the last assistant message progressively
        setMessages((prev) => {
          // find the last assistant message and replace content
          const copy = [...prev];
          for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].role === 'assistant') {
              copy[i] = { ...copy[i], content: accumulated };
              break;
            }
          }
          return copy;
        });
      };

      const resp = await sendChatToBackend(question, ctx, { messages: history, onChunk });

      if (resp.answer) {
        // ensure final content
        setMessages((prev) => {
          const copy = [...prev];
          for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].role === 'assistant') {
              copy[i] = { ...copy[i], content: resp.answer ?? "" };
              break;
            }
          }
          return copy;
        });
      } else {
        // fallback to generic message
        const reply = buildAssistantReply();
        setMessages((prev) => {
          const copy = [...prev];
          for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].role === 'assistant') {
              copy[i] = { ...copy[i], content: reply };
              break;
            }
          }
          return copy;
        });
      }

      setLoading(false);
    })();
  };

  return (
    <div className="space-y-3">
      <ScrollArea className="h-48 rounded-lg border border-border/50 bg-card/50 p-3 text-sm">
        <div className="space-y-3">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`rounded-lg p-2 ${
                msg.role === "assistant" ? "bg-primary/10 text-primary-foreground" : "bg-muted text-foreground"
              }`}
            >
              <div className="text-xs font-semibold uppercase tracking-wide">
                {msg.role === "assistant" ? "Study AI" : "You"}
              </div>
              {msg.role === "assistant" ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  className="mt-1 text-sm whitespace-pre-line"
                >
                  {msg.content}
                </ReactMarkdown>
              ) : (
                <p className="mt-1 text-sm whitespace-pre-line">{msg.content}</p>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="flex gap-2 items-center">
        <Textarea
          placeholder="Ask about specific topics, definitions, or next steps..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="min-h-[80px]"
        />
        <Button
          type="button"
          variant={listening ? "secondary" : "outline"}
          onClick={listening ? stopListening : startListening}
          aria-label={listening ? "Stop voice input" : "Start voice input"}
          disabled={loading}
          title={listening ? "Stop voice input" : "Record your question with your voice"}
          className="flex items-center gap-1"
        >
          <Mic className={`h-5 w-5 ${listening ? 'text-red-500 animate-pulse' : ''}`} />
          <span className="hidden sm:inline">{listening ? "Stop" : "Speak"}</span>
        </Button>
        {listening && (
          <span className="ml-2 flex items-center text-xs text-red-600 font-semibold animate-pulse">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />
            Recording… Speak now
          </span>
        )}
      </div>
      <div className="flex justify-end">
        <Button 
          type="button" 
          onClick={handleAsk} 
          disabled={!combinedSummary || !combinedSummary.trim() || !input.trim() || loading}
        >
          {loading ? 'Thinking…' : 'Ask'}
        </Button>
      </div>
    </div>
  );
}

