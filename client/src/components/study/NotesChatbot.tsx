import { useMemo, useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Button } from "@/components/ui/button";
import { Mic, Send, Sparkles, User,Bot, MoreHorizontal, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { sendChatToBackend } from "@/lib/chatClient";
import { motion, AnimatePresence } from "framer-motion";

interface NotesChatbotProps {
  id: string; // contentId
  summary?: string;
  extractedText?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function NotesChatbot({ id, summary = "", extractedText = "" }: NotesChatbotProps) {
    const [listening, setListening] = useState(false);
    const recognitionRef = useRef<any>(null);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const initialMessages: ChatMessage[] = useMemo(() => [
        {
          role: "assistant",
          content: "Hello! I've analyzed your notes. How can I assist you today? I can explain complex concepts, summarize specific parts, or even help you prep for an exam.",
        }
    ], []);
    
    const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    }, [messages, loading]);

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
      recognition.onend = () => setListening(false);
      recognition.onerror = () => setListening(false);
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

    const handleAsk = async () => {
        if (!input.trim() || loading) return;
        const question = input.trim();
        setInput("");
        
        const newMessages = [...messages, { role: "user", content: question } as ChatMessage];
        setMessages(newMessages);
        setLoading(true);

        const ctx = `${summary || ""}\n\n${extractedText || ""}`.trim();

        try {
            // Initial empty assistant message for streaming
            setMessages(prev => [...prev, { role: "assistant", content: "" }]);
            
            let accumulated = "";
            const onChunk = (chunk: string) => {
                accumulated += chunk;
                setMessages(prev => {
                    const copy = [...prev];
                    const last = copy[copy.length - 1];
                    if (last && last.role === 'assistant') {
                        last.content = accumulated;
                    }
                    return copy;
                });
            };

            const resp = await sendChatToBackend(question, ctx, { 
                messages: newMessages, 
                onChunk 
            });

            if (resp.answer) {
                setMessages(prev => {
                    const copy = [...prev];
                    const last = copy[copy.length - 1];
                    if (last && last.role === 'assistant') {
                        last.content = resp.answer || accumulated;
                    }
                    return copy;
                });
            }
        } catch (error) {
            console.error("Chat error:", error);
            setMessages(prev => [...prev.slice(0, -1), { role: "assistant", content: "I'm sorry, I encountered an error. Please try again." }]);
        } finally {
            setLoading(false);
        }
    };

    const clearChat = () => {
        setMessages(initialMessages);
    };

    return (
        <div className="flex flex-col h-full bg-black/20 border-l border-white/5">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20">
                        <Sparkles className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-white leading-none">AI Assistant</h3>
                        <p className="text-[10px] text-white/30 uppercase tracking-widest mt-1">Active Learning</p>
                    </div>
                </div>
                <button 
                  onClick={clearChat}
                  className="p-2 hover:bg-white/5 rounded-lg text-white/30 hover:text-white/60 transition-colors"
                  title="Clear conversation"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>

            {/* Messages Area */}
            <ScrollArea ref={scrollRef} className="flex-1 p-4">
                <div className="space-y-6 max-w-2xl mx-auto">
                    {messages.map((msg, index) => (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            key={index}
                            className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border ${
                                msg.role === "assistant" 
                                    ? "bg-primary/20 border-primary/30 text-primary" 
                                    : "bg-white/5 border-white/10 text-white/50"
                            }`}>
                                {msg.role === "assistant" ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                            </div>
                            
                            <div className={`flex flex-col max-w-[85%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                                <div className={`relative px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                                    msg.role === "assistant" 
                                        ? "glass-card border-white/5 text-white/90 shadow-xl" 
                                        : "bg-primary text-white shadow-lg shadow-primary/10"
                                }`}>
                                    {msg.role === "assistant" ? (
                                        <div className="prose prose-sm prose-invert max-w-none">
                                            <ReactMarkdown 
                                                remarkPlugins={[remarkGfm, remarkMath]} 
                                                rehypePlugins={[rehypeKatex]}
                                            >
                                                {msg.content || "..."}
                                            </ReactMarkdown>
                                        </div>
                                    ) : (
                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                    )}
                                </div>
                                <span className="text-[9px] text-white/20 mt-1.5 uppercase font-bold tracking-tighter">
                                    {msg.role === "assistant" ? "Assistant" : "You"}
                                </span>
                            </div>
                        </motion.div>
                    ))}
                    {loading && (
                        <div className="flex gap-3">
                             <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border bg-primary/20 border-primary/30 text-primary animate-pulse">
                                <Bot className="w-4 h-4" />
                            </div>
                            <div className="flex gap-1 items-center p-3 rounded-2xl bg-white/5">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 border-t border-white/5 bg-white/[0.01]">
                <div className="relative group max-w-2xl mx-auto">
                    <Textarea
                        placeholder="Ask me anything about your notes..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleAsk();
                            }
                        }}
                        className="min-h-[100px] w-full bg-white/5 border-white/10 rounded-2xl focus:border-primary/50 focus:ring-primary/20 transition-all resize-none pr-24 pl-4 py-4 text-sm placeholder:text-white/20"
                    />
                    
                    <div className="absolute bottom-3 right-3 flex items-center gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={listening ? stopListening : startListening}
                            className={`h-9 w-9 rounded-xl border transition-all ${
                                listening 
                                    ? "bg-red-500/20 border-red-500/50 text-red-500 animate-pulse" 
                                    : "bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10"
                            }`}
                        >
                            <Mic className="h-4 w-4" />
                        </Button>
                        
                        <Button
                            onClick={handleAsk}
                            disabled={!input.trim() || loading}
                            className="h-9 w-9 rounded-xl bg-primary hover:bg-primary/80 text-white shadow-lg shadow-primary/20 transition-all"
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                <p className="text-[10px] text-white/20 text-center mt-3 font-medium uppercase tracking-widest">
                    Shift + Enter for new line • Press Enter to send
                </p>
            </div>
        </div>
    );
}

