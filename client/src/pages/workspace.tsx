import React, { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import Header from "@/components/Header";
import DocumentUpload from "@/components/upload/DocumentUpload";
import FlashcardDrill from "@/components/study/FlashcardDrill";
import SummaryPanel from "@/components/summary/SummaryPanel";
import PodcastPlayer from "@/components/audio/PodcastPlayer";
import MermaidChart from "@/components/study/MermaidChart";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAudio } from "@/lib/AudioContext";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import type { ContentItem } from "@shared/schema";
import { 
  UploadCloud, 
  FileText, 
  Speaker, 
  BookOpen, 
  Grid, 
  MessageSquare,
  ArrowUp,
  Pin,
  ThumbsUp,
  ThumbsDown,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Trash2,
  Clock,
  MoreVertical,
  Headphones,
  Mic,
  MicOff,
  Search,
  Copy,
  Download,
  Layers,
  BarChart3,
  ShieldCheck,
  Home,
  Settings,
  BrainCircuit,
  SquarePen,
  Folder,
  Library,
  Sparkles,
  ChevronRight,
  ChevronLeft
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfmModule from "remark-gfm";
import remarkMathModule from "remark-math";
import rehypeKatexModule from "rehype-katex";
import katex from "katex";
import "katex/dist/katex.min.css";
import { parseSummary } from "@/lib/summaryUtils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import VideoUpload from "@/components/upload/VideoUpload";

class MarkdownErrorBoundary extends React.Component<{ fallback: React.ReactNode; children?: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("Markdown render error", error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function transformSummaryMarkdown(summaryText: string): string {
  if (!summaryText) return "";

  let cleaned = summaryText
    .replace(/```json[\s\S]*?```/gi, "")
    .replace(/^[{\[].*[}\]]$/gm, "") // remove standalone JSON lines
    .replace(/["']?summary_markdown["']?\s*[:=].*/gi, "")
    .replace(/["']?flashcards["']?\s*[:=].*/gi, "")
    .replace(/^#\s+/gm, "## ")
    .replace(/\n{3,}/g, "\n\n");

  // Fix spaced bold markers like ** word ** => **word**
  cleaned = cleaned.replace(/\*\*\s+([^*]+?)\s+\*\*/g, (_, inner) => `**${inner.trim()}**`);

  return cleaned.trim();
}

const remarkGfmPlugin = (remarkGfmModule as any)?.default || remarkGfmModule;
const remarkMathPlugin = (remarkMathModule as any)?.default || remarkMathModule;
const rehypeKatexPlugin = (rehypeKatexModule as any)?.default || rehypeKatexModule;

function prepareSummaryContent(summaryText: string, fallbackTitle?: string) {
  let processed = summaryText.replace(/```\s*(math|latex)\s*/gi, "```math\n");

  // Keep block math as $$...$$ so remark-math can parse it.
  // Convert any INLINE_MATH placeholders back into inline $...$ for remark-math.
  processed = processed.replace(/`?INLINE_MATH:([^`]+)`?/g, (_, expr) => `$${expr.trim()}$`);
  
    // Convert fenced math blocks (```math or ```latex) into $$...$$ block math
    processed = processed.replace(/```\s*(?:math|latex)\s*\n([\s\S]*?)\n```/gi, (_, expr) => `\n\n$$\n${expr.trim()}\n$$\n\n`);

    // Remove any non-math fenced code blocks entirely to avoid interfering with math parsing
    processed = processed.replace(/```(?!\s*(?:math|latex))[\s\S]*?```/gi, "");

    // Ensure there are balanced $$ delimiters (remark-math can crash on unbalanced math fences)
    const dollarPairs = (processed.match(/\$\$/g) || []).length;
    if (dollarPairs % 2 !== 0) {
      // If unbalanced, attempt to fix by removing the last unmatched $$
      const lastIndex = processed.lastIndexOf('$$');
      if (lastIndex !== -1) {
        processed = processed.slice(0, lastIndex) + processed.slice(lastIndex).replace('$$', '');
      }
    }

  const primaryHeadingMatch = processed.match(/^#{1,3}\s+(.+)$/m);
  const heroTitle = primaryHeadingMatch?.[1]?.trim() || fallbackTitle || "Summary";

  if (primaryHeadingMatch) {
    processed = processed.replace(primaryHeadingMatch[0], "").trim();
  }

  // Final cleanup: remove leftover JSON blobs or non-math fenced code blocks that may still slip through
  processed = processed
    .replace(/```json[\s\S]*?```/gi, "")
    .replace(/```(?!math)[\s\S]*?```/gi, "")
    .replace(/^[{}\[\]].*$/gm, "") // remove standalone JSON brace lines
    .replace(/\n{3,}/g, "\n\n") // collapse excessive newlines
    .trim();

  const heroDescription = processed
    .split(/\n+/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#") && !line.match(/^[*-]|^\d+\./))
    || "Key takeaways from your processed notes.";

  return { heroTitle, heroDescription, body: processed };
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
}

interface ChatSession {
  id: string;
  contentItemId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: ChatMessage[];
  progress?: number;
}

// Store chat sessions in localStorage (in production, this should be in the database)
const STORAGE_KEY = "chat-sessions";

function getStoredSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored).map((s: any) => ({
      ...s,
      createdAt: new Date(s.createdAt),
      updatedAt: new Date(s.updatedAt),
      messages: s.messages.map((m: any) => ({
        ...m,
        timestamp: m.timestamp ? new Date(m.timestamp) : undefined,
      })),
    })) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

// Far Left: Main Navigation Sidebar (Anara Style)
function MainNav({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) {
  const items = [
    { id: "home", icon: Home, label: "Home" },
    { id: "library", icon: Library, label: "Library" },
    { id: "models", icon: BrainCircuit, label: "Models" },
    { id: "settings", icon: Settings, label: "Settings" },
  ];

  return (
    <nav className="w-16 flex flex-col items-center py-6 bg-background border-r border-border/50 h-full gap-8 z-20">
      <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center mb-2 shadow-lg shadow-primary/20">
        <Sparkles className="h-6 w-6 text-primary-foreground" />
      </div>
      
      <div className="flex-1 flex flex-col gap-4">
        {items.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`p-3 rounded-xl transition-all duration-200 group relative ${
              activeTab === id 
                ? "bg-primary/10 text-primary" 
                : "text-muted-foreground hover:bg-muted"
            }`}
            title={label}
          >
            <Icon className="h-6 w-6" />
            <span className="absolute left-14 bg-foreground text-background text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
              {label}
            </span>
          </button>
        ))}
      </div>
      
      <div className="mt-auto">
        <Button variant="ghost" size="icon" className="rounded-full h-10 w-10">
          <div className="h-2 w-2 rounded-full bg-green-500 absolute bottom-2 right-2 border-2 border-background" />
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[10px] text-white font-bold">
            JD
          </div>
        </Button>
      </div>
    </nav>
  );
}

// Left Column: Sources Panel (matches reference UI)
function SessionsPanel({ 
  activeSessionId, 
  onSelectSession, 
  onNewChat,
  onDeleteSession,
  autoSelectNew 
}: { 
  activeSessionId?: string; 
  onSelectSession: (session: ChatSession) => void;
  onNewChat: () => void;
  onDeleteSession: (sessionId: string) => void;
  autoSelectNew?: boolean;
}) {
  const [searchSources, setSearchSources] = useState("");
  const { data: items, refetch: refetchItems } = useQuery<ContentItem[]>({ 
    queryKey: ["/api/content"],
    queryFn: async () => {
      const res = await fetch("/api/content", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch content");
      return res.json();
    },
    refetchInterval: (query) => {
      const data = query.state.data as any[] | undefined;
      if (!data || !Array.isArray(data)) return false;
      return data.some((item: any) => item.status === "processing" || item.status === "pending") ? 3000 : false;
    }
  });

  const [sessions, setSessions] = useState<ChatSession[]>(getStoredSessions());

  // Sync sessions with content items
  useEffect(() => {
    if (!items) return;
    
    const existingSessions = getStoredSessions();
    
    // Create sessions for content items that don't have one
    const newSessions: ChatSession[] = items
      .filter(item => !existingSessions.find(s => s.contentItemId === item.id))
      .map(item => ({
        id: `session-${item.id}`,
        contentItemId: item.id,
        title: item.title,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
        messages: [],
        progress: item.status === "completed" ? 100 : item.status === "processing" ? 50 : 0,
      }));

    // Update existing sessions with latest data
    const updatedSessions = existingSessions.map(session => {
      const item = items.find(i => i.id === session.contentItemId);
      if (!item) return session;
      
      return {
        ...session,
        title: item.title,
        updatedAt: new Date(item.updatedAt),
        progress: item.status === "completed" ? 100 : item.status === "processing" ? 50 : 0,
      };
    });

    const allSessions = [...updatedSessions, ...newSessions].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );

    setSessions(allSessions);
    saveSessions(allSessions);
    
    // Auto-select the most recent new session if requested
    if (newSessions.length > 0 && autoSelectNew && !activeSessionId) {
      const newestSession = newSessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      onSelectSession(newestSession);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, activeSessionId, autoSelectNew]);

  const handleDelete = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = sessions.filter(s => s.id !== sessionId);
    setSessions(updated);
    saveSessions(updated);
    onDeleteSession(sessionId);
  };

  const filteredSessions = searchSources.trim()
    ? sessions.filter(s => s.title.toLowerCase().includes(searchSources.toLowerCase()))
    : sessions;
  const byDate = filteredSessions.reduce<Record<string, ChatSession[]>>((acc, s) => {
    const key = s.updatedAt.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});
  const dateKeys = Object.keys(byDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  return (
    <aside className="w-72 glass-card rounded-none border-r border-border/50 flex flex-col h-full border-t-0 border-b-0 border-l-0">
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-foreground">Sources</h2>
          <Button
            onClick={onNewChat}
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 rounded-lg hover:bg-white/10 text-foreground"
            aria-label="Add source"
          >
            <UploadCloud className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sources"
            value={searchSources}
            onChange={(e) => setSearchSources(e.target.value)}
            className="pl-9 h-9 rounded-xl bg-white/5 border-border/50 text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {sessions.length === 0 ? (
            <div className="text-center py-12 px-4">
              <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground mb-1">No sources yet</p>
              <p className="text-xs text-muted-foreground">Upload a document or add a video URL to get started</p>
            </div>
          ) : dateKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground px-2">No matching sources</p>
          ) : (
            dateKeys.map((dateKey) => (
              <div key={dateKey}>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">{dateKey}</p>
                <div className="space-y-1">
                  {byDate[dateKey].map((session) => {
                    const isActive = activeSessionId === session.id;
                    const progress = session.progress || 0;
                    return (
                      <div
                        key={session.id}
                        onClick={() => onSelectSession(session)}
                        className={`group relative rounded-xl p-3 transition-all cursor-pointer border ${
                          isActive ? "bg-white/5 border-primary/30 source-item-active" : "border-transparent hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className={`text-sm font-medium truncate ${isActive ? "text-foreground" : "text-foreground/90"}`} title={session.title}>
                              {session.title}
                            </h3>
                            <div className="mt-1.5 h-1 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all ${progress === 100 ? "bg-primary" : progress > 0 ? "bg-primary/80" : "bg-transparent"}`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 rounded-lg">
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(session.id, e); }} className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}

// Center Column: Dynamic Content Display
function CenterColumn({ 
  session, 
  contentItem,
  selectedView,
  onSendMessage,
  onUpload 
}: { 
  session?: ChatSession;
  contentItem?: ContentItem;
  selectedView: string;
  onSendMessage: (message: string) => void;
  onUpload: () => void;
}) {
  const [input, setInput] = useState("");
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const {
    listening,
    browserSupportsSpeech,
    microphoneAccess,
    toggleListening,
    error: speechError,
  } = useSpeechRecognition({
    onTranscript: (transcript) => {
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      toast({ title: "Voice input captured", description: "Transcription added to the chat box." });
    },
  });

  useEffect(() => {
    if (speechError) {
      toast({ title: "Voice input", description: speechError, variant: "destructive" });
    }
  }, [speechError, toast]);

  useEffect(() => {
    if (contentItem?.summary && contentItem.status === "completed") {
      const prompts = [
        "What are the main concepts discussed?",
        "Can you explain the key points in simple terms?",
        "What are the most important takeaways?",
      ];
      setSuggestedPrompts(prompts);
    } else {
      setSuggestedPrompts([]);
    }
  }, [contentItem]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages]);

  const handleSend = () => {
    if (!input.trim() || !contentItem) return;
    onSendMessage(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePromptClick = (prompt: string) => {
    setInput(prompt);
    textareaRef.current?.focus();
  };

  // ── Regenerate Mind Map button ─────────────────────────────────────────────
  function RegenerateMindMapButton({ contentId, onDone, primary }: { contentId: string; onDone: () => void; primary?: boolean }) {
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const { toast } = useToast();

    const handleRegenerate = async () => {
      setLoading(true);
      setDone(false);
      try {
        const res = await fetch(`/api/content/${contentId}/regenerate-mindmap`, { method: 'POST' });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || 'Failed to regenerate');
        }
        setDone(true);
        onDone();
        toast({ title: 'Mind Map Ready!', description: 'Your document has been mapped into an interactive concept graph.' });
      } catch (e: any) {
        toast({ title: 'Generation failed', description: e.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    if (primary) {
      return (
        <button
          onClick={handleRegenerate}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-white font-bold hover:bg-primary/80 transition-all disabled:opacity-60 shadow-lg shadow-primary/20"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
          {loading ? 'Generating…' : 'Generate Mind Map'}
        </button>
      );
    }

    return (
      <button
        onClick={handleRegenerate}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-primary/30 text-primary hover:bg-primary/10 transition-all disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
        {loading ? 'Generating…' : done ? '✓ Regenerated' : 'Regenerate'}
      </button>
    );
  }

  if (!session || !contentItem) {
    return (
      <div className="flex-1 flex flex-col bg-background h-full relative overflow-hidden">
        {/* Ambient background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/4 blur-[120px] rounded-full" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/3 blur-[100px] rounded-full" />
        </div>

        <div className="flex-1 flex items-center justify-center p-12 relative z-10">
          <div className="max-w-lg w-full text-center space-y-10">
            <div className="space-y-4">
              <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto shadow-2xl shadow-primary/10">
                <Sparkles className="h-10 w-10 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-foreground font-serif">Ready to learn?</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
                  Upload any document or add a video URL. Vidya AI will instantly generate summaries, mind maps, flashcards, and a podcast.
                </p>
              </div>
            </div>

            {/* Feature Pills */}
            <div className="flex flex-wrap gap-2 justify-center">
              {["AI Summary", "Mind Map", "Flashcards", "Quiz", "AI Podcast", "Chat"].map((f) => (
                <div key={f} className="px-3 py-1.5 rounded-full bg-white/5 border border-white/8 text-[11px] font-bold text-white/50 uppercase tracking-wider">
                  {f}
                </div>
              ))}
            </div>

            <Button
              onClick={onUpload}
              className="h-14 px-10 text-base font-black rounded-2xl bg-primary hover:bg-primary/90 text-white shadow-2xl shadow-primary/20 hover:shadow-primary/40 hover:scale-105 active:scale-95 transition-all gap-3"
            >
              <UploadCloud className="h-5 w-5" />
              Upload Your First Source
            </Button>

            <p className="text-[11px] text-white/20">
              Supports PDF, DOCX, TXT, and YouTube / video URLs
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isReady = contentItem.status === "completed";
  const messages = session.messages || [];

  // Render different views based on selectedView
  if (selectedView === "summary") {
    return (
      <div className="flex-1 flex flex-col bg-background overflow-hidden h-full">
        <div className="p-4 border-b border-border/50 bg-card/30 flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">Study Summary</h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => {
                const parsed = parseSummary(contentItem.summary as any);
                const text = parsed.text || "";
                if (text) {
                  navigator.clipboard.writeText(text);
                  toast({ title: "Copied", description: "Summary copied to clipboard." });
                }
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => {
                const parsed = parseSummary(contentItem.summary as any);
                const text = parsed.text || "";
                if (text) {
                  const blob = new Blob([text], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${(contentItem.title || "summary").replace(/\s+/g, "-")}-summary.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast({ title: "Downloaded", description: "Summary saved." });
                }
              }}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-6 max-w-4xl mx-auto">
            {isReady && (contentItem.summary || contentItem.extractedText) ? (
              <div className="space-y-6">
                {(() => {
                  try {
                    const rawSummary = contentItem.summary as string | undefined;
                    const parsed = parseSummary(rawSummary ?? null);
                    let summaryText = parsed.text || '';
                    if (!summaryText && contentItem.extractedText) {
                      summaryText = (contentItem.extractedText as string).slice(0, 3000);
                      if ((contentItem.extractedText as string).length > 3000) summaryText += "\n\n…";
                    }

                    summaryText = summaryText
                      .replace(/^\{?\s*["']?summary_markdown["']?\s*[:=]\s*["']?/i, '')
                      .replace(/["']?\s*[,}]\s*["']?flashcards["']?\s*[:=].*$/i, '')
                      .replace(/["']?\s*\}$/, '')
                      .replace(/^["']|["']$/g, '')
                      .trim();

                    summaryText = transformSummaryMarkdown(summaryText);

                    if (!summaryText || summaryText.length < 10) {
                      return (
                        <div className="text-center py-12">
                          <Loader2 className="h-8 w-8 text-muted-foreground animate-spin mx-auto mb-3" />
                          <p className="text-muted-foreground">Summary is being generated...</p>
                        </div>
                      );
                    }

                    const { heroTitle, heroDescription, body } = prepareSummaryContent(summaryText, contentItem.title);

                    const plainBody = body.replace(/\$\$/g, "");

                    const markdownSection = (() => {
                      try {
                        return (
                          <MarkdownErrorBoundary
                            key={body}
                            fallback={
                              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
                                <p className="text-sm font-medium text-destructive mb-2">
                                  We couldn't render some of the formatted content, so here's the plain text instead.
                                </p>
                                <pre className="text-xs whitespace-pre-wrap text-foreground/80">
                                  {plainBody}
                                </pre>
                              </div>
                            }
                          >
                            <ReactMarkdown
                              remarkPlugins={[remarkGfmPlugin, remarkMathPlugin]}
                              rehypePlugins={[rehypeKatexPlugin]}
                              components={{
                                h1: ({ node, ...props }: any) => <h2 className="text-2xl font-semibold text-foreground mt-6 mb-4" {...props} />,
                                h2: ({ node, ...props }: any) => <h3 className="text-xl font-semibold text-foreground mt-5 mb-3 border-l-4 border-primary/30 pl-3" {...props} />,
                                h3: ({ node, ...props }: any) => <h4 className="text-lg font-semibold text-foreground mt-4 mb-2" {...props} />,
                                h4: ({ node, ...props }: any) => <h5 className="text-base font-semibold text-foreground mt-3 mb-2" {...props} />,
                                p: ({ node, ...props }: any) => <p className="mb-3 leading-relaxed text-foreground text-sm" {...props} />,
                                strong: ({ node, ...props }: any) => <strong className="font-semibold text-foreground" {...props} />,
                                em: ({ node, ...props }: any) => <em className="italic text-foreground" {...props} />,
                                ul: ({ node, ordered, ...props }: any) => <ul className="list-disc list-outside mb-3 ml-5 space-y-2 text-foreground text-sm" {...props} />,
                                ol: ({ node, ordered, ...props }: any) => <ol className="list-decimal list-outside mb-3 ml-5 space-y-2 text-foreground text-sm" {...props} />,
                                li: ({ node, ...props }: any) => <li className="leading-relaxed" {...props} />,
                                pre: ({ node, ...props }: any) => <pre className="bg-muted/80 p-4 rounded-lg overflow-x-auto mb-3 text-xs font-mono border border-border/50" {...props} />,
                                code: ({ node, inline, ...props }: any) =>
                                  inline ? (
                                    <code className="bg-muted/80 px-1.5 py-0.5 rounded text-xs font-mono text-foreground border border-border/50" {...props} />
                                  ) : (
                                    <code className="block bg-muted/80 px-1.5 py-0.5 rounded text-xs font-mono text-foreground border border-border/50" {...props} />
                                  ),
                                blockquote: ({ node, ...props }: any) => <blockquote className="border-l-4 border-primary/50 pl-4 italic text-muted-foreground mb-3 bg-muted/30 py-2 rounded-r" {...props} />,
                                hr: ({ node, ...props }: any) => <hr className="my-4 border-border" {...props} />,
                                a: ({ node, ...props }: any) => <a className="text-primary hover:underline font-medium" {...props} />,
                              }}
                            >
                              {body}
                            </ReactMarkdown>
                          </MarkdownErrorBoundary>
                        );
                      } catch (renderErr) {
                        console.error("Summary markdown render failed", renderErr);
                        return (
                          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
                            <p className="text-sm font-medium text-destructive mb-2">
                              We couldn't render some of the formatted content, so here's the plain text instead.
                            </p>
                            <pre className="text-xs whitespace-pre-wrap text-foreground/80">
                              {plainBody}
                            </pre>
                          </div>
                        );
                      }
                    })();

                    return (
                      <>
                        <section className="rounded-2xl border border-border/50 bg-gradient-to-br from-card/80 via-card to-background p-6 shadow-sm">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Summary Overview</p>
                          <h1 className="text-3xl font-bold text-foreground leading-tight">{heroTitle}</h1>
                          <p className="mt-3 text-base text-muted-foreground leading-relaxed max-w-3xl">{heroDescription}</p>
                        </section>

                        <section className="rounded-2xl border border-border/40 bg-card/60 p-6">
                          {markdownSection}
                        </section>
                      </>
                    );
                  } catch (error) {
                    console.error('Error rendering summary:', error);
                    return <p className="text-destructive">Error loading summary. Please try refreshing.</p>;
                  }
                })()}
              </div>
            ) : (
              <div className="text-center py-12">
                {isReady ? (
                  <>
                    <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-sm text-muted-foreground">No summary available. Enable “Create Summary & Flashcards” when uploading to generate one.</p>
                  </>
                ) : (
                  <>
                    <Loader2 className="h-8 w-8 text-muted-foreground animate-spin mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Summary is being generated...</p>
                  </>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  if (selectedView === "preview") {
    return (
      <div className="flex-1 flex flex-col bg-background overflow-hidden h-full">
        <div className="p-4 border-b border-border/50 bg-card/30 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Source Content Preview</h2>
           <div className="flex items-center gap-2">
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-primary/20">
              Raw Extraction
            </span>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-8 max-w-4xl mx-auto space-y-6">
            <Card className="glass-card border-white/5 bg-black/40">
              <CardContent className="p-8">
                 <div className="prose prose-sm prose-invert max-w-none prose-p:text-white/70 prose-p:leading-relaxed selection:bg-primary/30">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                    {contentItem.extractedText || "No text could be extracted from this source."}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </div>
    );
  }

  if (selectedView === "flashcards") {
    // Parse flashcards - they come as JSONB from database
    let flashcards: any[] = [];
    if (contentItem.flashcards) {
      try {
        if (typeof contentItem.flashcards === 'string') {
          flashcards = JSON.parse(contentItem.flashcards);
        } else if (Array.isArray(contentItem.flashcards)) {
          flashcards = contentItem.flashcards;
        } else if (typeof contentItem.flashcards === 'object') {
          flashcards = Object.values(contentItem.flashcards);
        }
      } catch (e) {
        console.error("Error parsing flashcards:", e);
        flashcards = [];
      }
    }

    return (
      <div className="flex-1 flex flex-col bg-background overflow-hidden h-full">
        <div className="p-4 border-b border-border/50 bg-card/30">
          <h2 className="text-base font-semibold text-foreground">Flashcards</h2>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-6 max-w-4xl mx-auto">
            {isReady && flashcards && Array.isArray(flashcards) && flashcards.length > 0 ? (
              <FlashcardDrill flashcards={flashcards} />
            ) : (
              <div className="text-center py-12">
                <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-sm text-muted-foreground">
                  {isReady ? "No flashcards available yet" : "Flashcards are being generated..."}
                </p>
                {!isReady && (
                  <Loader2 className="h-6 w-6 text-muted-foreground animate-spin mx-auto mt-3" />
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  if (selectedView === "audio") {
    const hasPodcastAudio = isReady && contentItem.podcastAudioUrl;
    const hasDocumentAudio = isReady && contentItem.audioUrl;
    
    // The podcast SCRIPT is always the spoken content (it is pre-cleaned plain text).
    // Fall back to extractedText only if no script exists.
    // NEVER use the markdown summary as spoken content — it reads symbols aloud.
    const podcastScript = contentItem.podcastScript as string | undefined;
    const hasScript = isReady && !!podcastScript;
    const hasAnyAudio = hasPodcastAudio || hasDocumentAudio;
    const hasAnyText = isReady && (hasScript || !!(contentItem.extractedText as string));
    
    const audioUrlToUse = hasPodcastAudio
      ? `/api/content/${contentItem.id}/podcast-audio`
      : hasDocumentAudio
        ? `/api/content/${contentItem.id}/audio`
        : "";

    // For Web Speech: prefer the clean podcast script; use extracted text as last resort
    const spokenText = podcastScript || (contentItem.extractedText as string) || "";
    // Summary is shown in the script panel, but NOT spoken aloud
    const summaryForDisplay = (contentItem.summary as string) || "";
    
    return (
      <div className="flex-1 flex flex-col bg-background overflow-hidden h-full">
        <div className="p-4 border-b border-border/50 bg-card/30 flex items-center gap-3">
          <Headphones className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">AI Podcast</h2>
          {hasScript && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-bold uppercase tracking-wider">
              Script Ready
            </span>
          )}
        </div>
        <ScrollArea className="flex-1">
          <div className="p-6 max-w-4xl mx-auto">
            {audioUrlToUse ? (
              <PodcastPlayer
                audioUrl={audioUrlToUse}
                title={contentItem.title || "Document Podcast"}
                transcript={spokenText}
                summary={summaryForDisplay}
              />
            ) : hasAnyText ? (
              <PodcastPlayer
                audioUrl=""
                title={contentItem.title || "Document Podcast"}
                transcript={spokenText}
                summary={summaryForDisplay}
                useWebSpeech={true}
              />
            ) : (
              <div className="text-center py-12">
                <Headphones className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-sm text-muted-foreground">
                  {isReady ? "No audio available for this document" : "Audio is being generated..."}
                </p>
                {!isReady && (
                  <Loader2 className="h-6 w-6 text-muted-foreground animate-spin mx-auto mt-3" />
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  if (selectedView === "quiz") {
    let quizList: Array<{ question: string; options?: string[]; correctAnswer?: number }> = [];
    if (contentItem.quizData) {
      try {
        if (Array.isArray(contentItem.quizData)) {
          quizList = contentItem.quizData;
        } else if (typeof contentItem.quizData === "string") {
          const parsed = JSON.parse(contentItem.quizData);
          quizList = Array.isArray(parsed) ? parsed : [];
        } else if (typeof contentItem.quizData === "object" && contentItem.quizData !== null) {
          quizList = Array.isArray((contentItem.quizData as any).questions)
            ? (contentItem.quizData as any).questions
            : [contentItem.quizData as any];
        }
      } catch (_) {
        quizList = [];
      }
    }
    const hasQuiz = isReady && quizList.length > 0;
    return (
      <div className="flex-1 flex flex-col bg-background overflow-hidden h-full">
        <div className="p-4 border-b border-border/50 bg-card/30">
          <h2 className="text-base font-semibold text-foreground">Quiz</h2>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-6 max-w-4xl mx-auto">
            {hasQuiz ? (
              <div className="space-y-4">
                {quizList.map((q: any, i: number) => (
                  <Card key={i} className="p-4 border-border/50">
                    <p className="text-sm font-medium mb-3">{q.question}</p>
                    {q.options && (
                      <ul className="space-y-2">
                        {q.options.map((opt: string, idx: number) => (
                          <li 
                            key={idx} 
                            className={`p-2 rounded-lg border ${
                              Number(q.correctAnswer) === idx 
                                ? "border-primary bg-primary/5 text-primary font-medium" 
                                : "border-border/50 bg-card/50"
                            }`}
                          >
                            {String.fromCharCode(65 + idx)}. {opt}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Grid className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-sm text-muted-foreground">
                  {isReady ? "No quiz available yet. Enable “Create Quiz” when uploading to generate one." : "Quiz is being generated..."}
                </p>
                {!isReady && <Loader2 className="h-6 w-6 text-muted-foreground animate-spin mx-auto mt-3" />}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  if (selectedView === "mindmap") {
    const hasMindMap = isReady && contentItem.mindMap;
    const canRegenerate = isReady && !!(contentItem.extractedText as string);

    return (
      <div className="flex-1 flex flex-col bg-background overflow-hidden h-full">
        <div className="p-4 border-b border-border/50 bg-card/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrainCircuit className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Mind Map</h2>
            {hasMindMap && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-bold uppercase tracking-wider">
                Interactive
              </span>
            )}
          </div>
          {canRegenerate && (
            <RegenerateMindMapButton contentId={contentItem.id} onDone={() => queryClient.invalidateQueries({ queryKey: ["/api/content"] })} />
          )}
        </div>
        <ScrollArea className="flex-1">
          <div className="p-6 max-w-5xl mx-auto">
            {hasMindMap ? (
              <MermaidChart data={contentItem.mindMap as any} />
            ) : (
              <div className="flex flex-col items-center justify-center py-20 gap-6 text-center">
                <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <BrainCircuit className="h-10 w-10 text-primary/40" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">No Mind Map Yet</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    {isReady
                      ? "Click \"Generate Mind Map\" to create an interactive knowledge map from your document."
                      : "Mind map is being generated from your document…"}
                  </p>
                </div>
                {isReady && !hasMindMap && canRegenerate && (
                  <RegenerateMindMapButton contentId={contentItem.id} onDone={() => queryClient.invalidateQueries({ queryKey: ["/api/content"] })} primary />
                )}
                {!isReady && <Loader2 className="h-6 w-6 text-primary animate-spin" />}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  if (selectedView === "reports") {
    return (
      <div className="flex-1 flex flex-col bg-background overflow-hidden h-full">
        <div className="p-4 border-b border-border/50">
          <h2 className="text-base font-bold text-foreground">Reports</h2>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-6 max-w-2xl mx-auto">
            <div className="glass-card rounded-2xl p-6 border border-border/50">
              <BarChart3 className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Your content history</h3>
              <p className="text-sm text-muted-foreground mb-4">View and manage all your uploaded documents, summaries, and progress in one place.</p>
              <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Link href="/history">Open History</Link>
              </Button>
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  // No longer needed: selectedView === "chat" is handled by the persistent ChatPanel
  // Removed input, suggestedPrompts, and chat-related hooks from this component
  // to reduce redundancy.

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-background">
      <Sparkles className="h-12 w-12 text-primary/10 mb-4" />
      <h3 className="text-lg font-semibold text-foreground mb-2">Select a tool to explore content</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Use the tools on the right to generate a summary, flashcards, or take a quiz based on your source.
      </p>
    </div>
  );
}

// Right Side: Persistent AI Chat Panel
function ChatPanel({ 
  session, 
  contentItem,
  onSendMessage,
}: { 
  session?: ChatSession;
  contentItem?: ContentItem;
  onSendMessage: (message: string) => void;
}) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const {
    listening,
    browserSupportsSpeech,
    microphoneAccess,
    toggleListening,
    error: speechError,
  } = useSpeechRecognition({
    onTranscript: (transcript) => {
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      toast({ title: "Voice input captured", description: "Transcription added to the chat box." });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages]);

  const handleSend = () => {
    if (!input.trim() || !contentItem) return;
    onSendMessage(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!session || !contentItem) {
    return (
      <aside className="w-80 flex flex-col bg-background border-l border-border/50 h-full">
        <div className="p-4 border-b border-border/50">
          <h2 className="text-sm font-bold text-foreground">AI Assistant</h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Sparkles className="h-8 w-8 text-muted-foreground/30 mb-2" />
          <p className="text-xs text-muted-foreground">Select a source to start chatting</p>
        </div>
      </aside>
    );
  }

  const isReady = contentItem.status === "completed";
  const messages = session.messages || [];

  return (
    <aside className="w-[400px] flex flex-col bg-background border-l border-border/50 h-full relative">
      <div className="p-4 border-b border-border/50 flex items-center justify-between bg-card/10">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">AI Assistant</h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] font-normal py-0">GPT-4o</Badge>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="h-6 w-6 text-primary/40" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Ask anything about this source</h3>
              <p className="text-xs text-muted-foreground max-w-[200px] mx-auto">
                Get summaries, definitions, or clarify complex topics from your notes.
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-3 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/50 text-foreground border border-border/50"
                  }`}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfmPlugin]}
                    components={{
                      p: ({ node, ...props }: any) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                      ul: ({ node, ...props }: any) => <ul className="list-disc ml-4 mb-2" {...props} />,
                      li: ({ node, ...props }: any) => <li className="mb-1" {...props} />,
                      h1: ({ node, ...props }: any) => <h4 className="text-base font-bold mt-2 mb-1" {...props} />,
                      h2: ({ node, ...props }: any) => <h4 className="text-sm font-bold mt-2 mb-1" {...props} />,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="p-4 bg-background border-t border-border/50">
        <div className="relative bg-muted/30 rounded-2xl border border-border/50 p-2 focus-within:border-primary/50 transition-colors">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Anara..."
            className="min-h-[40px] max-h-[150px] resize-none bg-transparent border-none focus:ring-0 text-sm py-2 pr-10"
            disabled={!isReady}
          />
          <div className="absolute right-2 bottom-2 flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleListening}
              className={`h-8 w-8 rounded-lg ${listening ? "text-destructive animate-pulse" : "text-muted-foreground"}`}
            >
              <Mic className="h-4 w-4" />
            </Button>
            <Button
              onClick={handleSend}
              disabled={!input.trim() || !isReady}
              size="icon"
              className="h-8 w-8 rounded-lg bg-primary text-primary-foreground"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}

// Learning Tools grid + AI Productivity Tip
// Side Toolbar: Learning Tools (Icons only for slimness)
function RightColumn({ contentItem, selectedView, onSelectView }: { 
  contentItem?: ContentItem; 
  selectedView: string;
  onSelectView: (view: string) => void;
}) {
  const isReady = contentItem?.status === "completed";
  const tools = [
    { id: "summary", label: "General", icon: FileText },
    { id: "preview", label: "Source", icon: Search },
    { id: "flashcards", label: "Review", icon: BookOpen },
    { id: "mindmap", label: "Map", icon: Layers },
    { id: "quiz", label: "Practice", icon: Grid },
    { id: "audio", label: "Listen", icon: Headphones },
    { id: "reports", label: "Stats", icon: BarChart3 },
  ] as const;

  return (
    <aside className="w-16 bg-card/10 border-l border-border/50 flex flex-col h-full py-4 items-center gap-4">
      {!contentItem || !isReady ? (
        <div className="flex flex-col items-center gap-4 opacity-20 pointer-events-none">
          {tools.map(({ id, icon: Icon }) => (
            <div key={id} className="p-3 rounded-xl border border-transparent">
              <Icon className="h-5 w-5" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {tools.map(({ id, label, icon: Icon }) => {
            const isSelected = selectedView === id;
            return (
              <button
                key={id}
                onClick={() => onSelectView(id)}
                className={`p-3 rounded-xl transition-all duration-200 group relative ${
                  isSelected 
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                    : "text-muted-foreground hover:bg-muted"
                }`}
                title={label}
              >
                <Icon className="h-5 w-5" />
                <span className="absolute right-14 bg-foreground text-background text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                  {label}
                </span>
              </button>
            );
          })}
          
          <div className="mt-auto pt-4 border-t border-border/50 w-full flex flex-col items-center gap-4">
            <button
              onClick={() => onSelectView("canvas")}
              className={`p-3 rounded-xl transition-all duration-200 group relative ${
                selectedView === "canvas" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
              }`}
              title="Canvas"
            >
              <SquarePen className="h-5 w-5" />
            </button>
          </div>
        </>
      )}
    </aside>
  );
}

// Wrapper component for VideoUpload to integrate with workspace
function VideoUploadWrapper({ onSuccess }: { onSuccess: (contentItem: { id: string; title: string; status: string }) => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [generateAudio, setGenerateAudio] = useState(true);
  const [generateSummary, setGenerateSummary] = useState(true);
  const [generateMindMap, setGenerateMindMap] = useState(true);
  const [generateQuiz, setGenerateQuiz] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async () => {
    if (!url.trim()) {
      toast({
        title: "No URL provided",
        description: "Please enter a video URL.",
        variant: "destructive",
      });
      return;
    }

    try {
      new URL(url);
    } catch {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid video URL.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch("/api/content/video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          title: title || "Video Content",
          processingOptions: {
            generateAudio,
            generateSummary,
            generateMindMap,
            generateQuiz,
          },
        }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to process video");
      }

      const contentItem = await response.json();
      onSuccess(contentItem);
      setUrl("");
      setTitle("");
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
    } catch (error: any) {
      toast({
        title: "Processing failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const isYouTubeUrl = (url: string) => {
    return url.includes("youtube.com") || url.includes("youtu.be");
  };

  return (
    <Card className="border border-border shadow-lg">
      <CardContent className="p-8">
        <h3 className="text-2xl font-semibold text-card-foreground mb-6">Process Video Content</h3>
        
        <div className="mb-6">
          <Label htmlFor="video-url" className="text-base font-medium">Video URL</Label>
          <div className="relative mt-2">
            <Input
              id="video-url"
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="pl-3"
            />
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Supports YouTube, Vimeo, and other video platforms
          </p>
          
          {url && isYouTubeUrl(url) && (
            <div className="mt-3 p-3 bg-primary/10 rounded-lg">
              <p className="text-sm text-primary font-medium">
                ✓ YouTube URL detected - ready for transcription
              </p>
            </div>
          )}
        </div>

        <div className="mb-8">
          <Label htmlFor="video-title" className="text-base font-medium">Title (Optional)</Label>
          <Input
            id="video-title"
            type="text"
            placeholder="Enter a custom title for this video"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-2"
          />
        </div>

        <div className="mb-8">
          <h4 className="text-lg font-semibold text-card-foreground mb-4">Processing Options</h4>
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="audio-video"
                checked={generateAudio}
                onCheckedChange={(checked) => setGenerateAudio(!!checked)}
              />
              <div>
                <Label htmlFor="audio-video" className="font-medium">Generate Podcast Audio</Label>
                <p className="text-sm text-muted-foreground">
                  Create audio version of the podcast script
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Checkbox
                id="summary-video"
                checked={generateSummary}
                onCheckedChange={(checked) => setGenerateSummary(!!checked)}
              />
              <div>
                <Label htmlFor="summary-video" className="font-medium">Create Summary & Flashcards</Label>
                <p className="text-sm text-muted-foreground">
                  Receive structured highlights plus flashcards from the transcript
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Checkbox
                id="mindmap-video"
                checked={generateMindMap}
                onCheckedChange={(checked) => setGenerateMindMap(!!checked)}
              />
              <div>
                <Label htmlFor="mindmap-video" className="font-medium">Generate Mind Map</Label>
                <p className="text-sm text-muted-foreground">
                  Create an interactive concept map with Mermaid.js
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Checkbox
                id="quiz-video"
                checked={generateQuiz}
                onCheckedChange={(checked) => setGenerateQuiz(!!checked)}
              />
              <div>
                <Label htmlFor="quiz-video" className="font-medium">Generate Quiz</Label>
                <p className="text-sm text-muted-foreground">
                  Create questions based on the video transcript
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center">
          <Button
            onClick={handleSubmit}
            disabled={!url.trim() || isProcessing}
            className="btn-primary px-8 py-4 text-lg font-semibold"
          >
            {isProcessing ? (
              <>
                <Loader2 className="inline-block w-5 h-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <UploadCloud className="inline-block w-5 h-5 mr-2" />
                Process Video
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper function for chat replies - returns clean markdown without flashcards
function buildAssistantReply(summary: string, extractedText: string, question: string): string {
  // Clean summary to remove any flashcard data
  const cleanSummary = parseSummary(summary).text;
  
  // Also clean extractedText to remove any flashcard data
  const cleanExtracted = extractedText
    .replace(/["']?flashcards?["']?\s*[:=]\s*\[[\s\S]*?\]/gi, '')
    .replace(/["']?question["']?\s*[:=]\s*["'][^"']*["']/gi, '')
    .replace(/["']?answer["']?\s*[:=]\s*["'][^"']*["']/gi, '')
    .replace(/\{[^}]*"flashcards?"[^}]*\}/gi, '')
    .trim();
  
  const corpus = `${cleanSummary}\n\n${cleanExtracted}`.replace(/\s+/g, " ").trim();
  
  if (!corpus) {
    return "I don't have any notes to reference yet. Try again after processing finishes.";
  }

  const sentences = corpus.split(/(?<=[.!?])\s+/).filter(s => {
    // Filter out sentences that look like flashcard data
    const lower = s.toLowerCase();
    return !lower.includes('"question"') && 
           !lower.includes('"answer"') && 
           !lower.includes('"flashcards"') &&
           s.length > 10; // Filter very short sentences
  });
  
  const keywords = question
    .toLowerCase()
    .split(/\W+/)
    .filter((word) => word.length > 3);

  let bestSentences: string[] = [];
  let bestScore = 0;

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    let score = 0;
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestSentences = [sentence];
    } else if (score === bestScore && score > 0) {
      bestSentences.push(sentence);
    }
  }

  if (bestScore === 0 || bestSentences.length === 0) {
    return "I couldn't find a direct answer in the notes. Try rephrasing or review the summary above.";
  }

  // Clean sentences before formatting
  const cleanSentences = bestSentences.map(s => {
    return s
      .replace(/["']?flashcards?["']?\s*[:=]\s*\[[\s\S]*?\]/gi, '')
      .replace(/["']?question["']?\s*[:=]\s*["'][^"']*["']/gi, '')
      .replace(/["']?answer["']?\s*[:=]\s*["'][^"']*["']/gi, '')
      .replace(/\{[^}]*"flashcards?"[^}]*\}/gi, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/\\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }).filter(s => s.length > 10);
  
  if (cleanSentences.length === 0) {
    return "I couldn't find a direct answer in the notes. Try rephrasing or review the summary above.";
  }
  
  // Check if question asks for a list or definition
  const isListQuestion = /list|what are|name|examples|steps|ways|items|enumerate/i.test(question);
  const isDefinitionQuestion = /what is|what are|define|definition|explain|meaning/i.test(question);
  
  // Format response based on question type
  if (isListQuestion && cleanSentences.length > 1) {
    return `## Answer\n\n${cleanSentences.slice(0, 5).map((s, i) => `${i + 1}. ${s}`).join("\n\n")}`;
  }
  
  if (isDefinitionQuestion) {
    // For definition questions, format with a clear heading
    const mainAnswer = cleanSentences[0];
    const additionalInfo = cleanSentences.slice(1, 3).join(" ");
    
    // Extract key terms to bold
    let formatted = mainAnswer;
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      formatted = formatted.replace(regex, (match) => {
        // Don't bold if already bolded or in code
        if (formatted.includes(`**${match}**`) || formatted.includes(`\`${match}\``)) {
          return match;
        }
        return `**${match}**`;
      });
    });
    
    if (additionalInfo) {
      return `## ${question.charAt(0).toUpperCase() + question.slice(1).replace(/\?$/, '')}\n\n${formatted}\n\n${additionalInfo}`;
    }
    
    return `## ${question.charAt(0).toUpperCase() + question.slice(1).replace(/\?$/, '')}\n\n${formatted}`;
  }
  
  // Default: format as a well-structured answer
  let answer = cleanSentences.slice(0, 3).join(" ").trim();
  
  // Bold important keywords from the question
  keywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    answer = answer.replace(regex, (match) => {
      // Don't bold if already bolded or in code
      if (answer.includes(`**${match}**`) || answer.includes(`\`${match}\``)) {
        return match;
      }
      return `**${match}**`;
    });
  });
  
  // Format with proper paragraph structure
  return answer;
}

// Dashboard View (Anara Home Style)
function Dashboard({ onUpload, onSelectSource }: { onUpload: () => void; onSelectSource: (session: ChatSession) => void }) {
  const sessions = getStoredSessions();
  const recentSessions = sessions.slice(0, 4);

  return (
    <div className="flex-1 overflow-y-auto bg-[#F9FAFB] dark:bg-[#0A0A0A] p-8">
      <div className="max-w-5xl mx-auto">
        <header className="mb-12">
          <h1 className="text-3xl font-bold text-foreground mb-2">Welcome back, Student</h1>
          <p className="text-muted-foreground">What would you like to research today?</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {[
            { title: "New Project", description: "Upload sources and start researching", icon: Plus, action: onUpload, color: "bg-primary" },
            { title: "Continue Reading", description: "Pick up where you left off", icon: BookOpen, action: () => {}, color: "bg-indigo-500" },
            { title: "Practice Mode", description: "Review flashcards and quizzes", icon: Grid, action: () => {}, color: "bg-emerald-500" },
          ].map((card, i) => (
            <button
              key={i}
              onClick={card.action}
              className="group bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-border/50 hover:border-primary/50 transition-all text-left shadow-sm hover:shadow-md"
            >
              <div className={`w-12 h-12 rounded-xl ${card.color} flex items-center justify-center mb-4 text-white shadow-lg`}>
                <card.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">{card.title}</h3>
              <p className="text-sm text-muted-foreground">{card.description}</p>
            </button>
          ))}
        </div>

        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foreground">Recent Sources</h2>
            <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">View Library</Button>
          </div>

          {recentSessions.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-border p-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">You haven't uploaded any sources yet.</p>
              <Button onClick={onUpload}>Upload your first source</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {recentSessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => onSelectSource(session)}
                  className="bg-white dark:bg-zinc-900 border border-border/50 rounded-2xl p-4 flex items-center gap-4 hover:border-primary/30 cursor-pointer group shadow-sm"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-foreground truncate">{session.title}</h4>
                    <p className="text-xs text-muted-foreground">{new Date(session.updatedAt).toLocaleDateString()}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// Middle Left: Canvas/Editor for note taking
function Canvas({ initialContent, title }: { initialContent?: string; title: string }) {
  const [content, setContent] = useState(initialContent || "");
  const [isSaved, setIsSaved] = useState(true);

  useEffect(() => {
    setContent(initialContent || "");
  }, [initialContent]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setIsSaved(false);
  };

  const handleSave = () => {
    // In a real app, this would save to the database
    setIsSaved(true);
  };

  return (
    <div className="flex-1 flex flex-col bg-background h-full overflow-hidden">
      <div className="p-4 border-b border-border/50 flex items-center justify-between bg-card/10">
        <div className="flex items-center gap-2">
          <SquarePen className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground truncate max-w-[200px]">{title} Notes</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">
            {isSaved ? "Saved" : "Unsaved changes"}
          </span>
          <Button size="sm" variant="ghost" className="h-8 px-3 text-xs" onClick={handleSave} disabled={isSaved}>
            Save
          </Button>
        </div>
      </div>
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-3xl mx-auto h-full">
          <textarea
            value={content}
            onChange={handleChange}
            placeholder="Start writing your research notes here..."
            className="w-full h-full resize-none bg-transparent border-none focus:outline-none text-base leading-relaxed text-foreground placeholder:text-muted-foreground/30 font-serif"
          />
        </div>
      </div>
    </div>
  );
}

export default function Workspace() {
  const [activeMainNavTab, setActiveMainNavTab] = useState("library");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedSession, setSelectedSession] = useState<ChatSession | undefined>();
  const [selectedView, setSelectedView] = useState<string>("summary");
  const [showUpload, setShowUpload] = useState(false);
  const [uploadType, setUploadType] = useState<"document" | "video">("document");
  const [autoSelectNew, setAutoSelectNew] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Debug: Log when component mounts
  useEffect(() => {
    console.log("Workspace component mounted");
  }, []);

  const { data: contentItem, isLoading, refetch } = useQuery<ContentItem>({
    queryKey: ["content-item", selectedSession?.contentItemId],
    queryFn: async () => {
      if (!selectedSession?.contentItemId) return null;
      const res = await fetch(`/api/content/${selectedSession.contentItemId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load content");
      return res.json();
    },
    enabled: Boolean(selectedSession?.contentItemId),
  });

  // Poll for updates if processing
  useEffect(() => {
    if (!contentItem || contentItem.status !== "processing") return;
    const interval = setInterval(() => {
      refetch();
    }, 3000);
    return () => clearInterval(interval);
  }, [contentItem?.status, refetch]);

  // Reset to summary view when session changes
  useEffect(() => {
    if (selectedSession) {
      setSelectedView("summary");
    }
  }, [selectedSession?.id]);

  const handleSelectSession = (session: ChatSession) => {
    setSelectedSession(session);
    setSelectedView("summary"); // Always start with summary when selecting a session
  };

  const handleSendMessage = async (message: string) => {
    if (!selectedSession || !contentItem) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: message,
      timestamp: new Date(),
    };

    const sessions = getStoredSessions();
    const sessionIndex = sessions.findIndex(s => s.id === selectedSession.id);
    
    if (sessionIndex === -1) return;

    sessions[sessionIndex].messages.push(userMessage);
    sessions[sessionIndex].updatedAt = new Date();
    saveSessions(sessions);
    setSelectedSession(sessions[sessionIndex]);

    // Add loading message
    const loadingMessage: ChatMessage = {
      role: "assistant",
      content: "Thinking...",
      timestamp: new Date(),
    };
    sessions[sessionIndex].messages.push(loadingMessage);
    saveSessions(sessions);
    setSelectedSession({ ...sessions[sessionIndex] });

    try {
      // Call AI API endpoint
      const response = await fetch(`/api/content/${contentItem.id}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: message }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to get AI response");
      }

      const data = await response.json();
      let reply = data.answer || buildAssistantReply(
        contentItem.summary || "",
        contentItem.extractedText || "",
        message
      );
      // Remove loading message and add actual response
      const updatedSessions = getStoredSessions();
      const updatedIndex = updatedSessions.findIndex(s => s.id === selectedSession.id);
      if (updatedIndex !== -1) {
        // Remove loading message (last assistant message that says "Thinking...")
        const messages = updatedSessions[updatedIndex].messages;
        const lastLoadingIndex = messages.length - 1;
        if (messages[lastLoadingIndex]?.role === "assistant" && messages[lastLoadingIndex]?.content === "Thinking...") {
          messages.pop();
        }
        
        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: reply,
          timestamp: new Date(),
        };
        
        messages.push(assistantMessage);
        updatedSessions[updatedIndex].messages = messages;
        updatedSessions[updatedIndex].updatedAt = new Date();
        saveSessions(updatedSessions);
        setSelectedSession(updatedSessions[updatedIndex]);
      }
    } catch (error) {
      console.error("Failed to get AI response:", error);
      
      // Fallback to local reply
      const reply = buildAssistantReply(
        contentItem.summary || "",
        contentItem.extractedText || "",
        message
      );

      const updatedSessions = getStoredSessions();
      const updatedIndex = updatedSessions.findIndex(s => s.id === selectedSession.id);
      if (updatedIndex !== -1) {
        // Remove loading message
        const messages = updatedSessions[updatedIndex].messages;
        const lastLoadingIndex = messages.length - 1;
        if (messages[lastLoadingIndex]?.role === "assistant" && messages[lastLoadingIndex]?.content === "Thinking...") {
          messages.pop();
        }
        
        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: reply,
          timestamp: new Date(),
        };
        
        messages.push(assistantMessage);
        updatedSessions[updatedIndex].messages = messages;
        updatedSessions[updatedIndex].updatedAt = new Date();
        saveSessions(updatedSessions);
        setSelectedSession(updatedSessions[updatedIndex]);
      }
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    if (selectedSession?.id === sessionId) {
      setSelectedSession(undefined);
      setSelectedView("chat");
    }
    queryClient.invalidateQueries({ queryKey: ["/api/content"] });
  };

  const [uploadedItemId, setUploadedItemId] = useState<string | null>(null);

  const handleNewChat = () => {
    setShowUpload(true);
    setUploadedItemId(null);
  };

  // Monitor uploaded item progress
  const { data: uploadedItem, refetch: refetchUploadedItem } = useQuery<ContentItem>({
    queryKey: ["content-item", uploadedItemId],
    queryFn: async () => {
      if (!uploadedItemId) return null;
      const res = await fetch(`/api/content/${uploadedItemId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load content");
      const data = await res.json();
      return data;
    },
    enabled: Boolean(uploadedItemId),
    refetchInterval: (query) => {
      // Poll every 3 seconds if still processing
      const data = query.state.data as ContentItem | undefined;
      if (!data) return false;
      const status = data.status;
      if (status === "processing" || status === "pending") {
        return 3000;
      }
      // Stop polling if completed or failed
      return false;
    },
  });

  // Also poll manually to ensure we catch status changes
  useEffect(() => {
    if (!uploadedItemId) return;
    
    // Poll every 3 seconds while processing
    const interval = setInterval(() => {
      if (uploadedItem?.status === "processing" || uploadedItem?.status === "pending" || !uploadedItem) {
        refetchUploadedItem();
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [uploadedItemId, uploadedItem?.status, refetchUploadedItem]);

  // When upload completes, create session and close upload view
  useEffect(() => {
    if (uploadedItem?.status === "completed" && uploadedItemId) {
      const completedId = uploadedItemId; // Save ID before clearing
      
      // Force refresh content items to ensure new item is in the list
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      
      // Show success message
      toast({
        title: "Document processed successfully!",
        description: "Your document is ready. Opening chat session...",
      });
      
      // Close upload view immediately
      setShowUpload(false);
      setAutoSelectNew(true);
      
      // Wait for items to load, then create session and select it
      const selectSession = () => {
        // Force refresh items first
        queryClient.invalidateQueries({ queryKey: ["/api/content"] });
        
        // Get fresh sessions (they should be created from items)
        const sessions = getStoredSessions();
        let newSession = sessions.find(s => s.contentItemId === completedId);
        
        // If session not found, try creating it manually from the uploaded item
        if (!newSession && uploadedItem) {
          const manualSession: ChatSession = {
            id: `session-${completedId}`,
            contentItemId: completedId,
            title: uploadedItem.title,
            createdAt: new Date(uploadedItem.createdAt),
            updatedAt: new Date(uploadedItem.updatedAt),
            messages: [],
            progress: 100,
          };
          const allSessions = [...sessions, manualSession];
          saveSessions(allSessions);
          newSession = manualSession;
        }
        
        if (newSession) {
          setSelectedSession(newSession);
          setSelectedView("chat");
          setUploadedItemId(null);
          setAutoSelectNew(false);
        } else {
          // If still not found, try again after a short delay (max 10 attempts)
          let attempts = 0;
          const retrySelect = () => {
            attempts++;
            queryClient.invalidateQueries({ queryKey: ["/api/content"] });
            const sessions = getStoredSessions();
            const newSession = sessions.find(s => s.contentItemId === completedId);
            if (newSession) {
              setSelectedSession(newSession);
              setSelectedView("chat");
              setUploadedItemId(null);
              setAutoSelectNew(false);
            } else if (attempts < 10) {
              setTimeout(retrySelect, 500);
            } else {
              // Give up after 10 attempts, but still clear the upload state
              setUploadedItemId(null);
              setAutoSelectNew(false);
              toast({
                title: "Session created",
                description: "Your document is ready. Please select it from the sessions list.",
              });
            }
          };
          setTimeout(retrySelect, 500);
        }
      };
      
      // Start trying to select the session after a brief delay
      setTimeout(selectSession, 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadedItem?.status, uploadedItemId, uploadedItem]);

  if (showUpload) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-4xl mx-auto p-6">
          <Button variant="ghost" onClick={() => {
            if (!uploadedItemId || uploadedItem?.status === "completed") {
              setShowUpload(false);
              setUploadedItemId(null);
            }
          }} className="mb-4">
            <X className="h-4 w-4 mr-2" />
            {uploadedItemId ? "Close" : "Back to Workspace"}
          </Button>
          
          {/* Show processing status if item is being processed */}
          {uploadedItemId && uploadedItem && (
            <Card className="mb-6 border-primary/20 bg-primary/5">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{uploadedItem.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Status: <span className="font-medium text-primary capitalize">{uploadedItem.status}</span>
                    </p>
                  </div>
                  {uploadedItem.status === "processing" && (
                    <Loader2 className="h-6 w-6 text-primary animate-spin" />
                  )}
                  {uploadedItem.status === "completed" && (
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  )}
                  {uploadedItem.status === "failed" && (
                    <AlertCircle className="h-6 w-6 text-destructive" />
                  )}
                </div>
                {uploadedItem.status === "processing" && (
                  <div className="space-y-3">
                    <Progress value={75} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      Processing your document... This may take a few moments.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        // Create session immediately if we have the item
                        if (uploadedItem && uploadedItemId) {
                          const existingSessions = getStoredSessions();
                          const sessionExists = existingSessions.find(s => s.contentItemId === uploadedItemId);
                          
                          if (!sessionExists) {
                            const itemStatus = uploadedItem.status;
                            const newSession: ChatSession = {
                              id: `session-${uploadedItemId}`,
                              contentItemId: uploadedItemId,
                              title: uploadedItem.title,
                              createdAt: new Date(uploadedItem.createdAt),
                              updatedAt: new Date(uploadedItem.updatedAt),
                              messages: [],
                              progress: itemStatus === "completed" ? 100 : itemStatus === "processing" ? 50 : 0,
                            };
                            const allSessions = [...existingSessions, newSession];
                            saveSessions(allSessions);
                          }
                        }
                        
                        setShowUpload(false);
                        setUploadedItemId(null);
                        queryClient.invalidateQueries({ queryKey: ["/api/content"] });
                        const itemStatus = uploadedItem?.status;
                        toast({
                          title: "Returning to workspace",
                          description: itemStatus === "completed" 
                            ? "Your document is ready in the sessions list."
                            : "Processing will continue in background. Check sessions list when ready.",
                        });
                      }}
                      className="w-full"
                    >
                      Go to Workspace (Processing in background)
                    </Button>
                  </div>
                )}
                {uploadedItem.status === "completed" && (
                  <div className="space-y-2">
                    <Progress value={100} className="h-2" />
                    <p className="text-sm text-green-600 font-medium">
                      ✓ Document processed successfully! Redirecting to workspace...
                    </p>
                  </div>
                )}
                {uploadedItem.status === "failed" && (
                  <div className="space-y-2">
                    <p className="text-sm text-destructive font-medium">
                      Processing failed. Please try uploading again.
                    </p>
                    {uploadedItem.errorMessage && (
                      <p className="text-xs text-muted-foreground">{uploadedItem.errorMessage}</p>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowUpload(false);
                        setUploadedItemId(null);
                      }}
                      className="w-full mt-2"
                    >
                      Return to Workspace
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          
          <Tabs value={uploadType} onValueChange={(value) => setUploadType(value as "document" | "video")} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="document" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Upload Document
              </TabsTrigger>
              <TabsTrigger value="video" className="flex items-center gap-2">
                <UploadCloud className="h-4 w-4" />
                Video URL
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="document">
              <DocumentUpload 
                onSuccess={(contentItem) => {
                  setUploadedItemId(contentItem.id);
                  queryClient.invalidateQueries({ queryKey: ["/api/content"] });
                  toast({
                    title: "Upload successful",
                    description: "Your document is being processed. Please wait...",
                  });
                }}
                hideProgress={true}
              />
            </TabsContent>
            
            <TabsContent value="video">
              <VideoUploadWrapper
                onSuccess={(contentItem) => {
                  setUploadedItemId(contentItem.id);
                  queryClient.invalidateQueries({ queryKey: ["/api/content"] });
                  toast({
                    title: "Processing started",
                    description: "Your video is being transcribed. Please wait...",
                  });
                }}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex overflow-hidden text-foreground">
      {/* 1. Main Navigation Sidebar */}
      <MainNav activeTab={activeMainNavTab} onTabChange={setActiveMainNavTab} />
      
      <div className="flex-1 flex overflow-hidden relative">
        {activeMainNavTab === "home" ? (
          <Dashboard 
            onUpload={handleNewChat} 
            onSelectSource={(session) => {
              setActiveMainNavTab("library");
              handleSelectSession(session);
            }} 
          />
        ) : activeMainNavTab === "library" ? (
          <>
            {/* 2. Secondary Sidebar (Library/Sources) */}
            {isSidebarOpen && (
              <SessionsPanel 
                activeSessionId={selectedSession?.id} 
                onSelectSession={handleSelectSession}
                onNewChat={handleNewChat}
                onDeleteSession={handleDeleteSession}
                autoSelectNew={autoSelectNew}
              />
            )}
            
            {/* Sidebar Toggle Button */}
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`absolute z-10 top-1/2 -track-y-1/2 flex items-center justify-center w-5 h-10 bg-background border border-border/50 rounded-r-lg hover:bg-muted transition-all shadow-sm ${
                isSidebarOpen ? "left-[288px]" : "left-0"
              }`}
            >
              {isSidebarOpen ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>

            {/* 3. Main Stage (Content + AI Tools) */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
              {/* Main Stage Header */}
              <div className="h-16 border-b border-border/50 flex items-center justify-between px-6 bg-navbar/5 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                  {selectedSession ? (
                    <>
                      <Folder className="h-4 w-4 text-muted-foreground" />
                      <h1 className="text-sm font-bold text-foreground truncate max-w-[300px]">{selectedSession.title}</h1>
                      <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10 text-[10px] h-5">Selected</Badge>
                    </>
                  ) : (
                    <h1 className="text-sm font-bold text-foreground">Select a source</h1>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-6 w-[1px] bg-border/50 mx-2" />
                  <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
                    <Button 
                      variant={selectedView === "summary" ? "secondary" : "ghost"} 
                      size="sm" 
                      className="h-7 px-3 text-[11px] font-medium"
                      onClick={() => setSelectedView("summary")}
                    >
                      Summary
                    </Button>
                    <Button 
                      variant={selectedView === "canvas" ? "secondary" : "ghost"} 
                      size="sm" 
                      className="h-7 px-3 text-[11px] font-medium"
                      onClick={() => setSelectedView("canvas")}
                    >
                      Canvas
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex-1 flex overflow-hidden">
                {/* Left part of Main Stage: Content Viewer */}
                <div className="flex-1 flex flex-col overflow-hidden border-r border-border/50">
                  {selectedView === "canvas" ? (
                    <Canvas 
                      title={selectedSession?.title || "Draft"} 
                      initialContent={contentItem?.summary as string || ""} 
                    />
                  ) : (
                    <CenterColumn 
                      session={selectedSession}
                      contentItem={contentItem || undefined}
                      selectedView={selectedView}
                      onSendMessage={handleSendMessage}
                      onUpload={handleNewChat}
                    />
                  )}
                </div>

                {/* Right part: Learning Tools Sidebar */}
                <RightColumn 
                  contentItem={contentItem || undefined}
                  selectedView={selectedView}
                  onSelectView={setSelectedView}
                />
              </div>
            </div>

            {/* 4. Far Right: Persistent AI Chat Panel */}
            <ChatPanel 
              session={selectedSession}
              contentItem={contentItem || undefined}
              onSendMessage={handleSendMessage}
            />
          </>
        ) : activeMainNavTab === "models" ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <BrainCircuit className="h-16 w-16 text-primary/20 mb-6" />
            <h2 className="text-2xl font-bold mb-2">Model Settings</h2>
            <p className="text-muted-foreground max-w-sm">Manage which AI models power your research assistant.</p>
            <div className="mt-8 grid grid-cols-1 gap-4 max-w-md w-full">
              {['GPT-4o (Default)', 'Claude 3.5 Sonnet', 'Gemini 1.5 Pro'].map((model) => (
                <div key={model} className="p-4 rounded-xl border border-border/50 bg-card/50 flex items-center justify-between">
                  <span className="font-medium">{model}</span>
                  <Badge variant={model.includes('Default') ? 'default' : 'outline'}>{model.includes('Default') ? 'Active' : 'Unused'}</Badge>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <Settings className="h-16 w-16 text-primary/20 mb-6" />
            <h2 className="text-2xl font-bold mb-2">Settings</h2>
            <p className="text-muted-foreground">General application settings and profile management.</p>
          </div>
        )}
      </div>
    </div>
  );
}
