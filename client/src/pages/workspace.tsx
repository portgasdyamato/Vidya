import React, { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import Header from "@/components/Header";
import DocumentUpload from "@/components/upload/DocumentUpload";
import FlashcardDrill from "@/components/study/FlashcardDrill";
import SummaryPanel from "@/components/summary/SummaryPanel";
import PodcastPlayer from "@/components/audio/PodcastPlayer";
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
  MicOff
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

// Left Column: Sessions Panel (Chat History)
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
  const { data: items, refetch: refetchItems } = useQuery<ContentItem[]>({ 
    queryKey: ["/api/content"],
    queryFn: async () => {
      const res = await fetch("/api/content", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch content");
      return res.json();
    },
    refetchInterval: (data) => {
      // Poll every 3 seconds if any item is processing
      if (!data || !Array.isArray(data)) return false;
      return data.some(item => item.status === "processing" || item.status === "pending") ? 3000 : false;
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

  return (
    <aside className="w-72 bg-background border-r border-border/50 flex flex-col h-full">
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">Sessions</h2>
          <Button
            onClick={onNewChat}
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 rounded-full hover:bg-muted"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {sessions.length === 0 ? (
            <div className="text-center py-12 px-4">
              <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground mb-1">No chat sessions yet</p>
              <p className="text-xs text-muted-foreground">
                Click the + button to start a new chat session
              </p>
            </div>
          ) : (
            sessions.map((session) => {
              const isActive = activeSessionId === session.id;
              const progress = session.progress || 0;
              
              return (
                <div
                  key={session.id}
                  onClick={() => onSelectSession(session)}
                  className={`group relative rounded-lg p-3 border transition-all cursor-pointer ${
                    isActive
                      ? "border-primary/50 bg-primary/5 shadow-sm"
                      : "border-border/50 bg-card/50 hover:border-primary/30 hover:bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {session.updatedAt.toLocaleDateString('en-US', { 
                          month: '2-digit', 
                          day: '2-digit', 
                          year: 'numeric' 
                        })}, {session.updatedAt.toLocaleTimeString('en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          hour12: true
                        })}
                      </span>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(session.id, e);
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  <h3 className={`text-sm font-medium mb-2 truncate ${
                    isActive ? "text-foreground" : "text-foreground/90"
                  }`} title={session.title}>
                    {session.title}
                  </h3>
                  
                  <div className="mt-2">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all ${
                          progress === 100 
                            ? "bg-green-500" 
                            : progress > 0 
                            ? "bg-primary" 
                            : "bg-muted"
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
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

  if (!session || !contentItem) {
    return (
      <div className="flex-1 flex flex-col bg-background h-full">
        <div className="p-6 border-b border-border/50">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-foreground" />
            <h2 className="text-base font-semibold text-foreground">Chat</h2>
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <ArrowUp className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Add a source to get started</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Upload a document to begin chatting and exploring your content
            </p>
            <Button 
              onClick={onUpload} 
              className="bg-foreground text-background hover:bg-foreground/90 h-10 px-6"
            >
              <UploadCloud className="h-4 w-4 mr-2" />
              Upload a source
            </Button>
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
        <div className="p-4 border-b border-border/50 bg-card/30">
          <h2 className="text-base font-semibold text-foreground">Summary</h2>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-6 max-w-4xl mx-auto">
            {isReady && contentItem.summary ? (
              <div className="space-y-6">
                {(() => {
                  try {
                    const parsed = parseSummary(contentItem.summary as any);
                    let summaryText = parsed.text || '';

                    summaryText = summaryText
                      .replace(/^\{?\s*["']?summary_markdown["']?\s*[:=]\s*["']?/i, '')
                      .replace(/["']?\s*[,}]\s*["']?flashcards["']?\s*[:=].*$/i, '')
                      .replace(/["']?\s*\}$/, '')
                      .replace(/^["']|["']$/g, '')
                      .trim();

                    summaryText = transformSummaryMarkdown(summaryText);

                    if (!summaryText || summaryText.length < 10) {
                      return <p className="text-muted-foreground">Summary is being generated...</p>;
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
                <Loader2 className="h-8 w-8 text-muted-foreground animate-spin mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Summary is being generated...</p>
              </div>
            )}
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
    // Use Web Speech API as fallback if no audio file exists
    const hasAudioFile = isReady && contentItem.audioUrl;
    const hasTextForTTS = isReady && (contentItem.summary || contentItem.extractedText);
    
    return (
      <div className="flex-1 flex flex-col bg-background overflow-hidden h-full">
        <div className="p-4 border-b border-border/50 bg-card/30">
          <h2 className="text-base font-semibold text-foreground">Audio Podcast</h2>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-6 max-w-4xl mx-auto">
            {hasAudioFile ? (
              <PodcastPlayer
                audioUrl={`/api/content/${contentItem.id}/audio`}
                title={contentItem.title || "Document Podcast"}
                transcript={contentItem.extractedText as string}
                summary={contentItem.summary as string}
              />
            ) : hasTextForTTS ? (
              <PodcastPlayer
                audioUrl="" // Empty URL means use Web Speech API
                title={contentItem.title || "Document Podcast"}
                transcript={contentItem.extractedText as string}
                summary={contentItem.summary as string}
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
    return (
      <div className="flex-1 flex flex-col bg-background overflow-hidden h-full">
        <div className="p-4 border-b border-border/50 bg-card/30">
          <h2 className="text-base font-semibold text-foreground">Quiz</h2>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-6 max-w-4xl mx-auto">
            {isReady && contentItem.quizData && Array.isArray(contentItem.quizData) && contentItem.quizData.length > 0 ? (
              <div className="space-y-4">
                {contentItem.quizData.map((q: any, i: number) => (
                  <Card key={i} className="p-4 border-border/50">
                    <p className="text-sm font-medium mb-3">{q.question}</p>
                    {q.options && (
                      <ul className="space-y-2">
                        {q.options.map((opt: string, idx: number) => (
                          <li 
                            key={idx} 
                            className={`p-2 rounded-lg border ${
                              idx === q.correctAnswer 
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
                <p className="text-sm text-muted-foreground">No quiz available yet</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Default: Chat view
  return (
    <div className="flex-1 flex flex-col bg-background overflow-hidden" style={{ height: 'calc(100vh - 4rem)' }}>
      {/* Header */}
      <div className="p-4 border-b border-border/50 bg-card/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-foreground" />
            <h2 className="text-base font-semibold text-foreground">Chat</h2>
            <Badge variant="secondary" className="ml-2 text-xs">
              1 source
            </Badge>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <ScrollArea className="flex-1">
        <div className="p-6 max-w-4xl mx-auto">
          {isReady && messages.length === 0 && (
            <div className="mb-6 p-6 rounded-xl bg-card/50 border border-border/50">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Welcome! 👋
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Your notes are processed and ready. You can ask anything about the material, concepts, or details—just type your question below.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.length > 0 && (
            <div className="space-y-4 mb-6">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-card/50 border border-border/50"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfmPlugin, remarkMathPlugin]}
                          rehypePlugins={[rehypeKatexPlugin]}
                          components={{
                            h1: ({node, ...props}: any) => <h1 className="text-2xl font-bold text-foreground mb-4 mt-6 leading-tight border-b border-border/30 pb-2" {...props} />,
                            h2: ({node, ...props}: any) => <h2 className="text-xl font-bold text-foreground mb-3 mt-5 leading-tight border-l-4 border-primary/50 pl-3" {...props} />,
                            h3: ({node, ...props}: any) => <h3 className="text-lg font-semibold text-foreground mb-2 mt-4 leading-tight" {...props} />,
                            h4: ({node, ...props}: any) => <h4 className="text-base font-semibold text-foreground mb-2 mt-3 leading-tight" {...props} />,
                            p: ({node, ...props}: any) => <p className="mb-4 leading-7 text-foreground text-sm" {...props} />,
                            strong: ({node, ...props}: any) => <strong className="font-bold text-foreground" {...props} />,
                            em: ({node, ...props}: any) => <em className="italic text-foreground" {...props} />,
                            ul: ({node, ...props}: any) => <ul className="list-disc list-outside mb-4 ml-6 space-y-2 text-foreground text-sm" {...props} />,
                            ol: ({node, ordered, ...props}: any) => <ol className="list-decimal list-outside mb-4 ml-6 space-y-2 text-foreground text-sm" {...props} />,
                            li: ({node, ...props}: any) => <li className="leading-7 mb-1" {...props} />,
                            code: ({node, inline, ...props}: any) => 
                              inline ? (
                                <code className="bg-muted/80 px-1.5 py-0.5 rounded text-xs font-mono text-foreground border border-border/50" {...props} />
                              ) : (
                                <code className="block bg-muted/80 px-1.5 py-0.5 rounded text-xs font-mono text-foreground border border-border/50" {...props} />
                              ),
                            pre: ({node, ...props}: any) => <pre className="bg-muted/80 p-4 rounded-lg overflow-x-auto mb-4 text-xs font-mono border border-border/50" {...props} />,
                            blockquote: ({node, ...props}: any) => <blockquote className="border-l-4 border-primary/50 pl-4 italic text-muted-foreground mb-4 bg-muted/30 py-2 rounded-r" {...props} />,
                            hr: ({node, ...props}: any) => <hr className="my-6 border-border" {...props} />,
                            a: ({node, ...props}: any) => <a className="text-primary hover:underline font-medium" {...props} />,
                          }}
                        >
                          {(() => {
                            let content = String(msg.content || "");
                            
                            // Remove any flashcard JSON that might have leaked in
                            content = content
                              .replace(/["']?flashcards?["']?\s*[:=]\s*\[[\s\S]*?\]/gi, '')
                              .replace(/["']?question["']?\s*[:=]\s*["'][^"']*["']/gi, '')
                              .replace(/["']?answer["']?\s*[:=]\s*["'][^"']*["']/gi, '')
                              .replace(/\{[^}]*"flashcards?"[^}]*\}/gi, '')
                              .trim();
                            
                            // Unescape common escape sequences
                            content = content
                              .replace(/\\n/g, '\n')
                              .replace(/\\t/g, '\t')
                              .replace(/\\"/g, '"')
                              .replace(/\\'/g, "'")
                              .replace(/\\\\/g, '\\');
                            
                            // Remove any remaining JSON artifacts and unwanted prefixes
                            content = content
                              .replace(/^Here's what I found in the notes:\s*/i, '')
                              .replace(/^Here's what I found:\s*/i, '')
                              .replace(/```json[\s\S]*?```/g, '') // Remove JSON code blocks
                              .replace(/```[\s\S]*?```/g, (match: string) => {
                                // Keep code blocks that aren't JSON
                                if (match.includes('"flashcards"') || match.includes('"question"') || match.includes('"answer"')) {
                                  return '';
                                }
                                return match;
                              })
                              .trim();
                            
                            // Fix: If content starts with a heading but is the entire response, convert to paragraph
                            // Check if the entire content is just one heading
                            const headingMatch = content.match(/^(#{1,6})\s+(.+)$/m);
                            if (headingMatch && content.split('\n').length <= 3) {
                              // If it's mostly just a heading, convert it to a paragraph
                              content = content.replace(/^(#{1,6})\s+/gm, '**').replace(/\n/g, ' ') + '**';
                            } else {
                              // If content starts with heading but should be paragraph, fix it
                              const firstLine = content.split('\n')[0];
                              if (firstLine.match(/^#{1,6}\s+/) && !content.includes('\n\n')) {
                                // Single heading without proper structure - convert to paragraph
                                content = content.replace(/^#{1,6}\s+/, '**').replace(/\n/g, ' ') + '**';
                              }
                            }
                            
                            // Ensure content starts with a paragraph if it doesn't have proper structure
                            if (content.trim().match(/^#{1,6}\s+/) && !content.includes('\n\n')) {
                              // Convert heading to bold paragraph
                              content = content.replace(/^#{1,6}\s+/, '**').replace(/\n/g, ' ') + '**';
                            }
                            
                            // Clean up multiple newlines
                            content = content.replace(/\n{3,}/g, '\n\n');
                            
                            return content;
                          })()}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    )}
                    {msg.timestamp && (
                      <p className={`text-xs mt-2 ${
                        msg.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"
                      }`}>
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Suggested Prompts */}
          {suggestedPrompts.length > 0 && messages.length === 0 && (
            <div className="space-y-2 mb-6">
              <p className="text-sm text-muted-foreground mb-2">Suggested prompts:</p>
              <div className="flex flex-wrap gap-2">
                {suggestedPrompts.map((prompt, index) => (
                  <button
                    key={index}
                    onClick={() => handlePromptClick(prompt)}
                    className="text-sm px-4 py-2 rounded-lg border border-border/50 bg-card/50 hover:bg-card hover:border-primary/50 transition-colors text-left"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t border-border/50 bg-card/30">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Start typing..."
                className="min-h-[60px] max-h-[200px] resize-none bg-background border-border/50 pr-12 focus:border-primary/50"
                disabled={!isReady}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || !isReady}
                size="sm"
                className="absolute right-2 bottom-2 h-8 w-8 p-0 bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Button
                type="button"
                variant={listening ? "destructive" : "outline"}
                size="icon"
                onClick={toggleListening}
                disabled={!isReady || !browserSupportsSpeech || microphoneAccess === false}
                className={`h-10 w-10 ${listening ? "animate-pulse" : ""}`}
                title={
                  !browserSupportsSpeech
                    ? "Speech recognition not supported in this browser"
                    : microphoneAccess === false
                    ? "Microphone access denied. Enable it in browser settings."
                    : listening
                    ? "Stop voice input"
                    : "Speak your question"
                }
              >
                {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
              <span className="text-[10px] text-muted-foreground">
                {listening ? "Listening" : "Voice"}
              </span>
            </div>
          </div>
          {listening && (
            <div className="mt-2 flex items-center text-xs text-destructive">
              <span className="inline-flex h-2 w-2 rounded-full bg-destructive mr-2 animate-ping" />
              Recording… Speak now
            </div>
          )}
          {!isReady && (
            <p className="text-xs text-muted-foreground mt-2">
              Document is still processing. Chat will be available soon.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Right Column: Navigation Menu
function RightColumn({ contentItem, selectedView, onSelectView }: { 
  contentItem?: ContentItem; 
  selectedView: string;
  onSelectView: (view: string) => void;
}) {
  const audio = useAudio();

  const menuOptions = [
    { id: "chat", label: "AI Chatbot", icon: MessageSquare, color: "bg-blue-500" },
    { id: "summary", label: "Summary", icon: FileText, color: "bg-green-500" },
    { id: "audio", label: "Audio/Podcast", icon: Headphones, color: "bg-purple-500" },
    { id: "flashcards", label: "Flashcards", icon: BookOpen, color: "bg-pink-500" },
    { id: "quiz", label: "Quiz", icon: Grid, color: "bg-yellow-500" },
  ];

  const isReady = contentItem?.status === "completed";

  return (
    <aside className="w-80 bg-background border-l border-border/50 flex flex-col h-full">
      <div className="p-4 border-b border-border/50">
        <h2 className="text-base font-semibold text-foreground">Studio</h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {!contentItem ? (
            <div className="text-center py-12">
              <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground">
                Select a document to view options
              </p>
            </div>
          ) : !isReady ? (
            <div className="text-center py-12">
              <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Processing document...</p>
              <p className="text-xs text-muted-foreground mt-1">Options will be available soon</p>
            </div>
          ) : (
            menuOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = selectedView === option.id;
              
              return (
                <button
                  key={option.id}
                  onClick={() => {
                    onSelectView(option.id);
                  }}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                    isSelected
                      ? "border-primary/50 bg-primary/5"
                      : "border-border/50 bg-card/50 hover:border-primary/30 hover:bg-card"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg ${option.color} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <span className={`text-sm font-medium ${
                    isSelected ? "text-foreground" : "text-foreground/90"
                  }`}>
                    {option.label}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
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

export default function Workspace() {
  const [selectedSession, setSelectedSession] = useState<ChatSession | undefined>();
  const [selectedView, setSelectedView] = useState<string>("chat"); // Default to chat
  const [showUpload, setShowUpload] = useState(false);
  const [uploadType, setUploadType] = useState<"document" | "video">("document"); // Track upload type
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

  // Reset to chat view when session changes
  useEffect(() => {
    if (selectedSession) {
      setSelectedView("chat");
    }
  }, [selectedSession?.id]);

  const handleSelectSession = (session: ChatSession) => {
    setSelectedSession(session);
    setSelectedView("chat"); // Always start with chat when selecting a session
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
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <Header />
      
      <div className="flex-1 flex overflow-hidden">
        <SessionsPanel 
          activeSessionId={selectedSession?.id} 
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          onDeleteSession={handleDeleteSession}
          autoSelectNew={autoSelectNew}
        />
        
        <CenterColumn 
          session={selectedSession}
          contentItem={contentItem || undefined}
          selectedView={selectedView}
          onSendMessage={handleSendMessage}
          onUpload={handleNewChat}
        />
        
        <RightColumn 
          contentItem={contentItem || undefined}
          selectedView={selectedView}
          onSelectView={setSelectedView}
        />
      </div>
    </div>
  );
}
