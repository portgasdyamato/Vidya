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
import type { ContentItem, Notebook } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { 
  FileText, BrainCircuit, Headphones, LayoutDashboard, LayoutTemplate, Share2, 
  Settings, Loader2, Sparkles, MessageSquare, ArrowUp, Send, Check, X,
  Search, BookOpen, Layers, Grid, BarChart3, Presentation, BookMarked, AlignLeft,
  Pin, ThumbsUp, ThumbsDown, Plus, CheckCircle2, AlertCircle, Trash2, Clock, 
  MoreVertical, Mic, MicOff, Copy, Download, ShieldCheck, Home, SquarePen, 
  Folder, Library, ChevronRight, ChevronLeft, UploadCloud, UserCircle, LogOut,
  Highlighter, CheckSquare, Book
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import PdfViewer from "@/components/study/PdfViewer";
import { motion, AnimatePresence } from "framer-motion";
import ReactQuill from 'react-quill-new';
import { marked } from 'marked';

import TurndownService from 'turndown';

const turndownService = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced'
});

const quillModules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    [{ 'size': ['small', false, 'large', 'huge'] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    ['clean']
  ],
};

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
  const { user, logoutMutation } = useAuth();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [displayName, setDisplayName] = useState(user?.name || user?.displayName || user?.username || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const queryClient = useQueryClient();

  const handleUpdateProfile = async () => {
    if (!displayName.trim()) return;
    setIsUpdating(true);
    try {
      const res = await fetch("/api/auth/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        setIsProfileModalOpen(false);
      }
    } catch (e) {
      console.error("Failed to update profile", e);
    } finally {
      setIsUpdating(false);
    }
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  const items = [
    { id: "home", icon: Home, label: "Home" },
    { id: "library", icon: Library, label: "Library" },
    { id: "models", icon: BrainCircuit, label: "Models" },
    { id: "notebooks", icon: BookMarked, label: "Notebooks" },
  ];

  return (
    <>
      <nav className="w-[76px] flex flex-col items-center py-6 bg-white/[0.03] backdrop-blur-[80px] border border-white/10 rounded-[32px] h-full gap-8 z-20 shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative shrink-0">
        <div className="absolute inset-0 pointer-events-none opacity-20 rounded-[32px] overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/10 to-transparent" />
        </div>

        <Link href="/">
          <div className="w-11 h-11 flex items-center justify-center mb-4 relative z-10 cursor-pointer hover:opacity-80 transition-opacity">
            <img src="/logo.png" alt="Vidya Logo" className="w-8 h-8 object-contain" />
          </div>
        </Link>
        
        <div className="flex-1 flex flex-col gap-4 relative z-10 w-full px-3">
          {items.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`w-full aspect-square flex items-center justify-center rounded-2xl transition-all duration-300 group relative ${
                activeTab === id 
                  ? "bg-white/10 text-white shadow-inner border border-white/5" 
                  : "text-white/40 hover:bg-white/5 hover:text-white/80"
              }`}
              title={label}
            >
              <Icon className={`w-5 h-5 transition-transform duration-300 ${activeTab === id ? 'scale-110' : 'group-hover:scale-110'}`} />
              <span className="absolute left-[70px] bg-white/10 backdrop-blur-xl border border-white/10 text-white text-[12px] font-semibold px-3 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl pointer-events-none">
                {label}
              </span>
            </button>
          ))}
        </div>
        
        <div className="mt-auto relative z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="rounded-full h-11 w-11 p-0 relative hover:scale-105 transition-transform border border-white/10 shadow-lg group">
                <div className="h-2.5 w-2.5 rounded-full bg-[#30D158] absolute bottom-0 right-0 border-2 border-black z-10 shadow-[0_0_8px_#30D158]" />
                <div className="h-full w-full rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-[11px] text-white font-bold overflow-hidden">
                  {user?.photo ? (
                    <img src={user.photo} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    getInitials(user?.name || user?.displayName || user?.username || 'JD')
                  )}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="right" sideOffset={16} className="w-60 p-2 bg-white/[0.05] backdrop-blur-[80px] border border-white/10 text-white rounded-[24px] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
              <div className={`px-3 py-3 flex flex-col gap-0.5 ${user?.username !== "default-user" ? "mb-2 border-b border-white/10" : ""}`}>
                <p className="text-[14px] font-bold tracking-tight truncate text-white">{user?.name || user?.displayName || user?.username}</p>
                <p className="text-[11px] font-medium tracking-wide text-white/40 uppercase truncate">
                  {user?.username === "default-user" ? "Guest Account" : "Student Account"}
                </p>
              </div>
              {user?.username !== "default-user" && (
                <>
                  <DropdownMenuItem 
                    onClick={() => setIsProfileModalOpen(true)}
                    className="rounded-[16px] cursor-pointer py-2.5 px-3 hover:bg-white/10 focus:bg-white/10 focus:text-white transition-colors"
                  >
                    <UserCircle className="w-4 h-4 mr-2.5 opacity-70" />
                    <span className="font-medium text-[13px]">Edit Profile Name</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => logoutMutation.mutate()}
                    className="rounded-[16px] cursor-pointer py-2.5 px-3 text-[#FF453A] hover:bg-[#FF453A]/10 focus:bg-[#FF453A]/10 focus:text-[#FF453A] mt-1 transition-colors"
                  >
                    <LogOut className="w-4 h-4 mr-2.5 opacity-70" />
                    <span className="font-medium text-[13px]">Log Out</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>

      <Dialog open={isProfileModalOpen} onOpenChange={setIsProfileModalOpen}>
        <DialogContent className="bg-white/[0.05] backdrop-blur-[120px] border border-white/10 text-white sm:rounded-[32px] sm:max-w-md p-8 shadow-[0_16px_64px_rgba(0,0,0,0.5)]">
          <DialogHeader className="space-y-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-2 shadow-inner">
              <UserCircle className="w-6 h-6 text-white/70" />
            </div>
            <DialogTitle className="text-2xl font-bold tracking-tight">Edit Profile</DialogTitle>
            <DialogDescription className="text-white/50 text-[14px] leading-relaxed">
              Choose how you want your name to appear across Vidya.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white/60 text-[12px] font-bold uppercase tracking-wider">Display Name</Label>
              <Input
                id="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-12 rounded-xl text-[15px] focus-visible:ring-1 focus-visible:ring-white/30 focus-visible:border-white/30 transition-all"
                placeholder="Enter your name"
              />
            </div>
          </div>
          
          <DialogFooter className="mt-8 gap-3 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setIsProfileModalOpen(false)}
              className="rounded-xl h-12 font-semibold hover:bg-white/5 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateProfile}
              disabled={isUpdating || !displayName.trim()}
              className="rounded-xl h-12 font-bold bg-white text-black hover:bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_25px_rgba(255,255,255,0.3)] transition-all disabled:opacity-50"
            >
              {isUpdating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Notebooks View
function NotebooksView({ onSelectNotebook }: { onSelectNotebook: (id: string) => void }) {
  const [isCreating, setIsCreating] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: notebooks = [], isLoading } = useQuery<Notebook[]>({
    queryKey: ["/api/notebooks"],
  });

  const { data: items = [] } = useQuery<ContentItem[]>({
    queryKey: ["/api/content"],
  });

  const handleCreate = async () => {
    if (!newNotebookName.trim()) return;
    try {
      const res = await fetch("/api/notebooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newNotebookName }),
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/notebooks"] });
        setNewNotebookName("");
        setIsCreating(false);
        toast({ title: "Notebook created" });
      } else {
        throw new Error("Failed to create notebook");
      }
    } catch (e) {
      toast({ title: "Failed to create notebook", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this notebook? All associated documents and chats will be permanently deleted.")) return;
    try {
      const res = await fetch(`/api/notebooks/${id}`, { method: "DELETE" });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/notebooks"] });
        queryClient.invalidateQueries({ queryKey: ["/api/content"] });
        toast({ title: "Notebook deleted" });
      } else {
        throw new Error("Failed to delete");
      }
    } catch (e) {
      toast({ title: "Failed to delete notebook", variant: "destructive" });
    }
  };

  const handleEdit = async (id: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newName = prompt("Enter new notebook name:", currentName);
    if (!newName || newName === currentName) return;
    try {
      const res = await fetch(`/api/notebooks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName })
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/notebooks"] });
        toast({ title: "Notebook updated" });
      } else {
        throw new Error("Failed to update");
      }
    } catch (e) {
      toast({ title: "Failed to update notebook", variant: "destructive" });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-transparent relative p-8 md:p-12 custom-scrollbar text-white w-full">
      <div className="max-w-5xl mx-auto relative z-10">
        <header className="mb-14 flex items-center justify-between">
          <div>
            <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-white/60 mb-3 tracking-tight font-serif">
              Notebooks
            </h1>
            <p className="text-lg text-white/50 font-medium">Organize your research effectively</p>
          </div>
          <Button onClick={() => setIsCreating(true)} className="glass-button-primary">
            <Plus className="w-4 h-4 mr-2" /> New Notebook
          </Button>
        </header>

        {isCreating && (
          <Card className="mb-8 bg-white/5 border-white/10 backdrop-blur-xl">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4 text-white">Create New Notebook</h3>
              <div className="flex items-center gap-4">
                <Input
                  autoFocus
                  placeholder="Notebook Name"
                  value={newNotebookName}
                  onChange={(e) => setNewNotebookName(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/30"
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
                <Button onClick={handleCreate} className="glass-button-primary shrink-0">Create</Button>
                <Button variant="ghost" onClick={() => setIsCreating(false)} className="shrink-0 text-white hover:bg-white/10">Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : notebooks.length === 0 ? (
          <div 
            className="rounded-[32px] border border-white/10 p-16 text-center"
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              backdropFilter: 'blur(40px)',
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2), inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
            }}
          >
            <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-6">
              <BookMarked className="h-10 w-10 text-white/20" />
            </div>
            <p className="text-white/50 mb-6 font-medium text-lg">You haven't created any notebooks yet.</p>
            <Button onClick={() => setIsCreating(true)} className="glass-button-primary px-8 py-6 rounded-full shadow-2xl font-bold text-base">
              Create your first notebook
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {notebooks.map(notebook => {
              const notebookItems = items.filter(item => item.notebookId === notebook.id);
              const docsCount = notebookItems.length;
              const completedDocs = notebookItems.filter(item => item.status === "completed").length;
              const progress = docsCount > 0 ? Math.round((completedDocs / docsCount) * 100) : 0;
              const chatCount = docsCount;

              return (
                <div
                  key={notebook.id}
                  onClick={() => onSelectNotebook(notebook.id)}
                  className="group relative rounded-[32px] p-7 text-left transition-all duration-300 hover:scale-[1.02] border border-white/10 overflow-hidden cursor-pointer"
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    backdropFilter: 'blur(40px)',
                    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3), inset 0 1px 0 0 rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                  
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white bg-primary/20 border border-primary/30 relative z-10">
                      <BookMarked className="h-6 w-6" />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-white hover:bg-white/10 relative z-20">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="z-[60]">
                        <DropdownMenuItem onClick={(e) => handleEdit(notebook.id, notebook.name, e)}>
                          <SquarePen className="h-4 w-4 mr-2" /> Edit Name
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => handleDelete(notebook.id, e)} className="text-destructive focus:text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" /> Delete Notebook
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  <h3 className="text-xl font-bold text-slate-100 mb-2 truncate relative z-10">{notebook.name}</h3>
                  <div className="flex gap-4 text-xs text-slate-400 font-medium mb-4 relative z-10">
                    <span>{docsCount} Documents</span>
                    <span>{chatCount} Chats</span>
                  </div>
                  <div className="space-y-1 relative z-10">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Study Progress</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-1.5 bg-white/10" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Left Column: Sources Panel (matches reference UI)
function SessionsPanel({ 
  activeSessionId, 
  onSelectSession, 
  onNewChat,
  onDeleteSession,
  autoSelectNew,
  activeNotebookId,
  activeNotebookName
}: { 
  activeSessionId?: string; 
  onSelectSession: (session: ChatSession) => void;
  onNewChat: () => void;
  onDeleteSession: (sessionId: string) => void;
  autoSelectNew?: boolean;
  activeNotebookId?: string | null;
  activeNotebookName?: string | null;
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
    
    // Filter by notebook if one is selected
    const filteredItems = activeNotebookId 
      ? items.filter(i => i.notebookId === activeNotebookId)
      : items.filter(i => !i.notebookId);

    // Create sessions for content items that don't have one
    const newSessions: ChatSession[] = filteredItems
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

    // Update existing sessions with latest data, and filter them out if they don't belong to the notebook
    const updatedSessions = existingSessions
      .filter(session => {
        const item = items.find(i => i.id === session.contentItemId);
        if (!item) return false;
        if (activeNotebookId && item.notebookId !== activeNotebookId) return false;
        if (!activeNotebookId && item.notebookId) return false;
        return true;
      })
      .map(session => {
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
  }, [items, activeSessionId, autoSelectNew, activeNotebookId]);

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
    <aside className="w-[300px] bg-white/[0.03] backdrop-blur-[80px] border-r border-white/10 flex flex-col h-full z-10 relative shadow-[10px_0_30px_rgba(0,0,0,0.3)] shrink-0">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-foreground">
            {activeNotebookName ? `${activeNotebookName}` : "Sources"}
          </h2>
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
              <p className="text-xs text-muted-foreground">Upload a document to get started</p>
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
                        className={`group relative rounded-[16px] p-4 transition-all cursor-pointer border ${
                          isActive 
                            ? "bg-white/10 border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.2)]" 
                            : "border-transparent hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 
                              className={`text-[13px] tracking-wide ${isActive ? "text-white font-bold" : "text-white/70 font-medium"}`} 
                              style={{
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                                whiteSpace: "normal",
                                wordBreak: "break-word"
                              }}
                            >
                              {session.title}
                            </h3>
                            {progress > 0 && progress < 100 && (
                              <div className="mt-2 h-[2px] bg-white/10 rounded-full overflow-hidden w-full">
                                <div
                                  className="h-full bg-primary/80 transition-all"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            )}
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
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [editedSummary, setEditedSummary] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
      <div className="flex-1 flex flex-col bg-transparent h-full relative min-w-0">
        {/* Ambient background is handled globally in Workspace now */}


        <div className="flex-1 flex items-center justify-center p-12 relative z-10">
          <div className="max-w-lg w-full text-center space-y-10">
            <div className="space-y-4">
              <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto shadow-2xl shadow-primary/10">
                <img src="/logo.png" alt="Vidya Logo" className="w-10 h-10 object-contain" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-foreground font-serif">Ready to learn?</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
                  Upload any document. Vidya AI will instantly generate summaries, mind maps, flashcards, and a podcast.
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
              className="h-14 px-10 text-base font-semibold rounded-2xl glass-button-primary shadow-2xl transition-all gap-3"
            >
              <UploadCloud className="h-5 w-5" />
              Upload Your First Source
            </Button>

            <p className="text-[11px] text-white/20">
              Supports PDF, DOCX, TXT
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isReady = contentItem?.status === "completed";
  const messages = session?.messages || [];

  // Render different views based on selectedView
  if (selectedView === "summary") {
    const rawSummary = contentItem.summary as string | undefined;

    const handleEditSummary = () => {
      if (contentItem?.summary) {
        // Parse the full summary object into just text
        const parsed = parseSummary(contentItem.summary as any);
        const textToEdit = parsed.text || (typeof contentItem.summary === "string" ? contentItem.summary : "");
        // Convert markdown to HTML for the WYSIWYG editor
        const htmlContent = marked.parse(textToEdit) as string;
        setEditedSummary(htmlContent);
      }
      setIsEditingSummary(true);
    };

    const handleSaveSummary = async () => {
      if (!contentItem) return;
      try {
        // Convert HTML back to Markdown for storage
        const markdownContent = turndownService.turndown(editedSummary);
        
        // Ensure we preserve the flashcards from the original summary!
        const parsedOld = parseSummary(contentItem.summary as any);
        const newSummaryObj = {
          summary_markdown: markdownContent,
          flashcards: parsedOld.flashcards || []
        };
        
        const res = await fetch(`/api/content/${contentItem.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ summary: newSummaryObj })
        });
        if (!res.ok) throw new Error("Failed to save");
        await queryClient.invalidateQueries({ queryKey: ["/api/content"] });
        await queryClient.invalidateQueries({ queryKey: ["/api/content", contentItem.id] });
        setIsEditingSummary(false);
        toast({ title: "Saved", description: "Summary updated successfully." });
      } catch (e) {
        toast({ title: "Error", description: "Could not save summary.", variant: "destructive" });
      }
    };

    return (
      <div className="flex-1 flex flex-col bg-transparent overflow-hidden h-full min-w-0">
        <div className="h-16 px-6 border-b border-white/10 bg-white/[0.02] backdrop-blur-3xl flex items-center justify-between shrink-0">
          <h2 className="text-[16px] font-bold tracking-wide text-foreground">Study Summary</h2>
          <div className="flex items-center gap-1">
            {isEditingSummary ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setIsEditingSummary(false)}>Cancel</Button>
                <Button size="sm" onClick={handleSaveSummary}>Save</Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={handleEditSummary}
              >
                <SquarePen className="h-4 w-4" />
              </Button>
            )}
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
        <ScrollArea className="flex-1 min-w-0">
          <div className="p-6 max-w-4xl mx-auto">
            {isEditingSummary ? (
              <div className="relative glass-card rounded-2xl overflow-visible quill-dark-theme p-0 border-white/10 mt-6 shadow-2xl">
                <ReactQuill 
                  theme="snow"
                  value={editedSummary} 
                  onChange={setEditedSummary}
                  modules={quillModules}
                  className="min-h-[500px]"
                />
              </div>
            ) : isReady && (contentItem.summary || contentItem.extractedText) ? (
              <div className="space-y-6">
                {(() => {
                  try {
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
                        <section className="rounded-[32px] border border-white/10 bg-white/[0.04] backdrop-blur-[60px] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.3)] break-words w-full overflow-hidden">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Summary Overview</p>
                          <h1 className="text-3xl font-bold text-foreground leading-tight">{heroTitle}</h1>
                          <p className="mt-3 text-base text-muted-foreground leading-relaxed max-w-3xl">{heroDescription}</p>
                        </section>

                        <section className="rounded-[32px] border border-white/10 bg-white/[0.02] backdrop-blur-[40px] p-8 break-words w-full overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
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
      <div className="flex-1 flex flex-col bg-transparent overflow-hidden h-full min-w-0">
        <div className="p-4 border-b border-white/10 bg-white/[0.02] backdrop-blur-3xl flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Original Document</h2>
           <div className="flex items-center gap-2">
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-primary/20">
              {"Original PDF"}
            </span>
          </div>
        </div>
        <div className="flex-1 w-full h-full p-4">
          <div className="w-full h-full rounded-2xl overflow-hidden shadow-2xl">
            {contentItem.type === "document" ? (
              <PdfViewer url={`/api/content/${contentItem.id}/original`} contentItemId={contentItem.id.toString()} />
            ) : (
              <div className="p-8 prose prose-sm prose-invert max-w-none border border-border/50 bg-black/40 h-full rounded-2xl">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                  {contentItem.extractedText || "No text could be extracted from this source."}
                </pre>
              </div>
            )}
          </div>
        </div>
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

    const RegenerateFlashcardsButton = () => {
      const [loading, setLoading] = React.useState(false);
      const handleRegenerate = async () => {
        setLoading(true);
        try {
          const res = await fetch(`/api/content/${contentItem.id}/regenerate-flashcards`, { method: 'POST', credentials: 'include' });
          if (!res.ok) throw new Error((await res.json()).message || 'Failed');
          const data = await res.json();
          if (data.exhausted) {
            toast({ title: '🎓 You are ready!', description: 'You have covered all the key concepts in this document. Amazing work!' });
          } else {
            queryClient.invalidateQueries({ queryKey: ['content-item', contentItem.id] });
            toast({ title: '✨ New Flashcards Ready!', description: 'A fresh set of flashcards has been generated for you.' });
          }
        } catch (e: any) {
          toast({ title: 'Error', description: e.message, variant: 'destructive' });
        } finally { setLoading(false); }
      };
      return (
        <button onClick={handleRegenerate} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-primary/30 text-primary hover:bg-primary/10 transition-all disabled:opacity-50">
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          {loading ? 'Generating…' : 'Regenerate'}
        </button>
      );
    };

    return (
      <div className="flex-1 flex flex-col bg-transparent overflow-hidden h-full min-w-0">
        <div className="p-4 border-b border-white/10 bg-white/[0.02] backdrop-blur-3xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookMarked className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Flashcards</h2>
            {flashcards.length > 0 && <span className="text-xs text-muted-foreground font-medium">{flashcards.length} cards</span>}
          </div>
          {isReady && flashcards.length > 0 && <RegenerateFlashcardsButton />}
        </div>
        <ScrollArea className="flex-1 min-w-0">
          <div className="p-6 max-w-4xl mx-auto">
            {isReady && flashcards && Array.isArray(flashcards) && flashcards.length > 0 ? (
              <FlashcardDrill flashcards={flashcards} contentId={contentItem.id} />
            ) : (
              <div className="text-center py-12">
                <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-sm text-muted-foreground">
                  {isReady ? "No flashcards available yet" : "Flashcards are being generated..."}
                </p>
                {!isReady && <Loader2 className="h-6 w-6 text-muted-foreground animate-spin mx-auto mt-3" />}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  if (selectedView === "audio") {
    const hasDocumentAudio = isReady && contentItem.audioUrl;
    
    // The podcast SCRIPT is always the spoken content (it is pre-cleaned plain text).
    // Fall back to extractedText only if no script exists.
    // NEVER use the markdown summary as spoken content — it reads symbols aloud.
    const podcastScript = contentItem.podcastScript as string | undefined;
    const hasScript = isReady && !!podcastScript;
    const hasAnyAudio = hasDocumentAudio;
    const hasAnyText = isReady && (hasScript || !!(contentItem.extractedText as string));
    
    const audioUrlToUse = hasDocumentAudio
        ? `/api/content/${contentItem.id}/audio`
        : "";

    // For Web Speech: prefer the clean podcast script; use extracted text as last resort
    const spokenText = podcastScript || (contentItem.extractedText as string) || "";
    // Summary is shown in the script panel, but NOT spoken aloud
    const summaryForDisplay = (contentItem.summary as string) || "";
    
    return (
      <div className="flex-1 flex flex-col bg-transparent overflow-hidden h-full min-w-0">
        <div className="p-4 border-b border-white/10 bg-white/[0.02] backdrop-blur-3xl flex items-center gap-3">
          <Headphones className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">AI Podcast</h2>
          {hasScript && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-bold uppercase tracking-wider">
              Script Ready
            </span>
          )}
        </div>
        <ScrollArea className="flex-1 min-w-0">
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
    
    // Premium component for a single question with interactive animations
    const QuizQuestion = ({ q, questionIndex }: { q: any, questionIndex: number }) => {
      const [selectedOption, setSelectedOption] = useState<number | null>(null);
      const isAnswered = selectedOption !== null;
      const isCorrect = isAnswered && selectedOption === Number(q.correctAnswer);

      return (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: questionIndex * 0.05, duration: 0.4 }}
          className="p-6 md:p-8 rounded-[28px] bg-[#1C1C1E]/60 backdrop-blur-2xl border border-white/5 shadow-2xl relative overflow-hidden"
        >
          {/* Subtle top highlight */}
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50" />
          
          <div className="flex items-start gap-4 mb-8">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 text-white/40 text-[13px] font-bold border border-white/5 shrink-0 mt-0.5">
              {questionIndex + 1}
            </span>
            <h3 className="text-[17px] font-medium text-[#F2F2F7] leading-relaxed tracking-wide">
              {q.question}
            </h3>
          </div>

          {q.options && (
            <div className="space-y-2.5">
              {q.options.map((opt: string, idx: number) => {
                const isSelected = selectedOption === idx;
                const isCorrectOption = Number(q.correctAnswer) === idx;
                
                let stateClass = "bg-[#2C2C2E]/40 border-transparent hover:bg-[#3A3A3C]/60 text-white/90";
                let letterClass = "bg-white/10 text-white/50";
                
                if (isAnswered) {
                  if (isCorrectOption) {
                    stateClass = "bg-[#34C759]/10 border-transparent text-[#34C759]";
                    letterClass = "bg-[#34C759] text-black shadow-[0_0_15px_rgba(52,199,89,0.3)]";
                  } else if (isSelected && !isCorrectOption) {
                    stateClass = "bg-[#2C2C2E]/40 border-transparent text-white/90 opacity-60";
                    letterClass = "bg-[#FF453A] text-white shadow-[0_0_15px_rgba(255,69,58,0.3)]";
                  } else {
                    stateClass = "bg-[#2C2C2E]/20 border-transparent opacity-30 cursor-not-allowed text-white/50";
                    letterClass = "bg-black/20 text-white/30";
                  }
                }

                return (
                  <motion.button 
                    key={idx} 
                    onClick={() => {
                      if (!isAnswered) {
                        setSelectedOption(idx);
                        if (contentItem) {
                          fetch(`/api/content/${contentItem.id}/stats`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({
                              type: 'quiz_attempt',
                              payload: {
                                score: idx === Number(q.correctAnswer) ? 1 : 0,
                                total: 1
                              }
                            })
                          }).catch(() => {});
                        }
                      }
                    }}
                    disabled={isAnswered}
                    whileHover={!isAnswered ? { scale: 1.005 } : {}}
                    whileTap={!isAnswered ? { scale: 0.99 } : {}}
                    animate={isAnswered && isSelected && !isCorrectOption ? { x: [-3, 3, -3, 3, 0] } : {}}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className={`w-full text-left p-4 rounded-2xl border transition-colors flex items-center gap-4 ${stateClass}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[13px] font-bold transition-all ${letterClass}`}>
                      {String.fromCharCode(65 + idx)}
                    </div>
                    <span className="text-[15px] font-medium tracking-wide leading-snug">{opt}</span>
                  </motion.button>
                );
              })}
            </div>
          )}
          
          <AnimatePresence>
            {isAnswered && (
              <motion.div 
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 24 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="overflow-hidden"
              >
                <div className={`p-4 rounded-2xl flex items-center gap-4 ${
                  isCorrect ? "bg-[#34C759]/10 text-[#34C759]" : "bg-[#2C2C2E]/60 text-white"
                }`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    isCorrect ? "bg-[#34C759] text-black" : "bg-[#FF453A] text-white shadow-[0_0_15px_rgba(255,69,58,0.2)]"
                  }`}>
                    {isCorrect ? <CheckCircle2 className="w-5 h-5" /> : <X className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="font-semibold text-[15px] leading-tight mb-0.5">
                      {isCorrect ? "Excellent!" : "Not quite right"}
                    </p>
                    <p className="text-[13.5px] opacity-70">
                      {isCorrect
                        ? "You nailed it. Keep up the great work!"
                        : `The correct answer is ${String.fromCharCode(65 + Number(q.correctAnswer))}.`
                      }
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      );
    };

    const RegenerateQuizButton = () => {
      const [loading, setLoading] = React.useState(false);
      const handleRegenerate = async () => {
        setLoading(true);
        try {
          const res = await fetch(`/api/content/${contentItem.id}/regenerate-quiz`, { method: 'POST', credentials: 'include' });
          if (!res.ok) throw new Error((await res.json()).message || 'Failed');
          const data = await res.json();
          if (data.exhausted) {
            toast({ title: '🎓 You are ready!', description: 'You have been tested on all the key topics in this document. Excellent!' });
          } else {
            queryClient.invalidateQueries({ queryKey: ['content-item', contentItem.id] });
            toast({ title: '✨ New Quiz Ready!', description: 'A completely new set of questions has been generated.' });
          }
        } catch (e: any) {
          toast({ title: 'Error', description: e.message, variant: 'destructive' });
        } finally { setLoading(false); }
      };
      return (
        <button onClick={handleRegenerate} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-primary/30 text-primary hover:bg-primary/10 transition-all disabled:opacity-50">
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          {loading ? 'Generating…' : 'New Questions'}
        </button>
      );
    };

    return (
      <div className="flex-1 flex flex-col bg-transparent overflow-hidden h-full min-w-0">
        <div className="p-4 border-b border-white/10 bg-white/[0.02] backdrop-blur-3xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
              <Check className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-base font-bold text-foreground">Interactive Quiz</h2>
          </div>
          {hasQuiz && <RegenerateQuizButton />}
        </div>
        <ScrollArea className="flex-1 custom-scrollbar min-w-0">
          <div className="p-6 max-w-3xl mx-auto">
            {hasQuiz ? (
              <div className="space-y-6">
                {quizList.map((q: any, i: number) => (
                  <QuizQuestion key={i} q={q} questionIndex={i} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 flex flex-col items-center">
                <div className="w-16 h-16 rounded-3xl bg-muted/30 flex items-center justify-center mb-4">
                  <Check className="h-8 w-8 text-muted-foreground opacity-50" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">No Quiz Available</h3>
                <p className="text-sm text-muted-foreground max-w-[250px]">
                  {isReady ? "Enable “Create Quiz” when uploading to generate interactive questions." : "Quiz is being generated..."}
                </p>
                {!isReady && <Loader2 className="h-6 w-6 text-primary animate-spin mt-6" />}
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
      <div className="flex-1 flex flex-col bg-transparent overflow-hidden h-full min-w-0">
        <div className="p-4 border-b border-white/10 bg-white/[0.02] backdrop-blur-3xl flex items-center justify-between">
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
        <div className="flex-1 relative w-full h-full flex flex-col p-4">
          {hasMindMap ? (
            <MermaidChart data={contentItem.mindMap as any} />
          ) : (
            <div className="flex flex-col items-center justify-center py-20 gap-6 text-center m-auto">
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
      </div>
    );
  }

  if (selectedView === "reports") {
    const stats: any = (contentItem as any).stats || {};
    const pagesRead: number[] = Array.isArray(stats.documentProgress?.pagesRead) ? stats.documentProgress.pagesRead : [];
    const quizScores: { date: string; score: number; total: number }[] = Array.isArray(stats.quizScores) ? stats.quizScores : [];
    const flashcardsConfidence: Record<string, string> = stats.flashcardConfidence || {};
    const highlightsCount: number = stats.documentProgress?.highlightsCount || 0;
    const chatInteractionsCount: number = stats.chatInteractionsCount || 0;

    let totalFlashcards = 0;
    if (contentItem.flashcards) {
      try {
        const fc = typeof contentItem.flashcards === 'string' ? JSON.parse(contentItem.flashcards) : contentItem.flashcards;
        totalFlashcards = Array.isArray(fc) ? fc.length : 0;
      } catch {}
    }
    let totalQuizQuestions = 0;
    if (contentItem.quizData) {
      try {
        const qd = typeof contentItem.quizData === 'string' ? JSON.parse(contentItem.quizData) : contentItem.quizData;
        totalQuizQuestions = Array.isArray(qd) ? qd.length : (qd?.questions?.length || 0);
      } catch {}
    }

    const gotItCount = Object.values(flashcardsConfidence).filter((v) => v === 'got_it').length;
    const needReviewCount = Object.values(flashcardsConfidence).filter((v) => v === 'need_review').length;
    const unseenCount = totalFlashcards - gotItCount - needReviewCount;
    const flashcardProgress = totalFlashcards > 0 ? Math.round((gotItCount / totalFlashcards) * 100) : 0;
    const lastQuizScore = quizScores.length > 0 ? quizScores[quizScores.length - 1] : null;
    const avgQuizScore = quizScores.length > 0
      ? Math.round(quizScores.reduce((acc, s) => acc + (s.score / s.total) * 100, 0) / quizScores.length)
      : 0;
    
    const options = (contentItem.processingOptions as any) || {};
    const hasQuiz = !!options.generateQuiz;
    const hasFlashcards = !!options.generateSummary;
    
    // Adjusted scoring model based on actual data
    const readingScoreRaw = Math.min(pagesRead.length * 5, 40); // cap at 40
    const flashScoreRaw = hasFlashcards ? flashcardProgress * 0.35 : 0;
    const quizScoreRaw = (hasQuiz && lastQuizScore) ? ((lastQuizScore.score / lastQuizScore.total) * 100) * 0.25 : 0;
    
    const totalAchievedRaw = readingScoreRaw + flashScoreRaw + quizScoreRaw;
    const maxPossibleRaw = 40 + (hasFlashcards ? 35 : 0) + (hasQuiz ? 25 : 0);
    
    const overallProgress = maxPossibleRaw > 0 ? Math.min(Math.round((totalAchievedRaw / maxPossibleRaw) * 100), 100) : 0;
    const circumference = 2 * Math.PI * 54;

    const masteryLabel =
      overallProgress < 20 ? 'Getting started' :
      overallProgress < 50 ? 'Building knowledge' :
      overallProgress < 80 ? 'Almost there' : 'Mastered';

    const masteryColor =
      overallProgress < 20 ? '#636366' :
      overallProgress < 50 ? '#0A84FF' :
      overallProgress < 80 ? '#FF9F0A' : '#30D158';

    return (
      <div className="flex-1 flex flex-col bg-transparent overflow-hidden h-full min-w-0" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif' }}>
        {/* Header */}
        <div className="px-8 pt-8 pb-6 bg-white/[0.02] backdrop-blur-3xl border-b border-white/10">
          <p className="text-[12px] font-bold tracking-[0.2em] text-white/40 uppercase mb-2">Progress</p>
          <h2 className="text-[28px] font-bold text-white tracking-tight" style={{ letterSpacing: '-0.5px' }}>
            Learning Analytics
          </h2>
        </div>

        <ScrollArea className="flex-1 min-w-0 custom-scrollbar relative">
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/5 blur-[120px] rounded-full" />
            <div className="absolute top-1/2 -right-40 w-80 h-80 bg-blue-500/5 blur-[100px] rounded-full" />
          </div>

          <div className="px-8 py-8 space-y-6 max-w-4xl mx-auto relative z-10">

            {/* Mastery Hero Card */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '28px',
                backdropFilter: 'blur(40px)',
              }} className="p-8 flex items-center gap-8 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50" />
              
              {/* Circular progress */}
              <div className="relative shrink-0" style={{ width: 140, height: 140 }}>
                <svg width="140" height="140" viewBox="0 0 130 130" style={{ transform: 'rotate(-90deg)' }}>
                  {/* Track */}
                  <circle cx="65" cy="65" r="54" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
                  {/* Progress */}
                  <circle
                    cx="65" cy="65" r="54" fill="none"
                    stroke={masteryColor}
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - overallProgress / 100)}
                    style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)', filter: `drop-shadow(0 0 12px ${masteryColor}60)` }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[36px] font-black text-white" style={{ letterSpacing: '-1.5px', lineHeight: 1 }}>{overallProgress}</span>
                  <span className="text-[12px] text-white/50 font-bold mt-1 tracking-wider">%</span>
                </div>
              </div>
              {/* Label */}
              <div className="flex flex-col gap-4 flex-1 min-w-0">
                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-2 h-2 rounded-full shadow-lg" style={{ background: masteryColor, boxShadow: `0 0 10px ${masteryColor}` }} />
                    <span className="text-[12px] font-bold tracking-widest text-white/50 uppercase">{masteryLabel}</span>
                  </div>
                  <p className="text-[17px] font-medium text-white/90 leading-relaxed max-w-xl">
                    {overallProgress < 20 ? 'Start reading, quiz yourself, and review flashcards to build progress.' :
                     overallProgress < 50 ? 'Good momentum. Keep practicing to strengthen your retention.' :
                     overallProgress < 80 ? "You're close to full mastery of this topic." :
                     'You have thoroughly covered this material. 🎓'}
                  </p>
                </div>
                {/* Mini progress segments */}
                <div className="space-y-2 mt-2 w-full max-w-md">
                  {[
                    { label: 'Reading', value: readingScoreRaw > 0 ? Math.round((readingScoreRaw/40)*100) : 0, color: '#0A84FF', show: true },
                    { label: 'Flashcards', value: flashcardProgress, color: '#30D158', show: hasFlashcards },
                    { label: 'Quiz', value: lastQuizScore ? Math.round((lastQuizScore.score / lastQuizScore.total) * 100) : 0, color: '#FF9F0A', show: hasQuiz },
                  ].filter(x => x.show).map(({ label, value, color }) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-[11px] text-white/40 w-20 font-semibold tracking-wide">{label}</span>
                      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color, transition: 'width 1s ease', boxShadow: `0 0 8px ${color}50` }} />
                      </div>
                      <span className="text-[11px] text-white/40 w-10 text-right font-bold">{value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Stats Bento Grid */}
            <div className={`grid gap-4 ${hasQuiz ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-1 md:grid-cols-3'}`}>
              {[
                { icon: <BookOpen className="w-5 h-5" />, label: 'Pages Read', value: pagesRead.length, sub: 'pages visited', color: '#0A84FF', bg: 'rgba(10, 132, 255, 0.15)', show: true },
                { icon: <Highlighter className="w-5 h-5" />, label: 'Highlights', value: highlightsCount, sub: 'annotations', color: '#BF5AF2', bg: 'rgba(191, 90, 242, 0.15)', show: true },
                { icon: <CheckSquare className="w-5 h-5" />, label: 'Quiz Attempts', value: quizScores.length, sub: quizScores.length > 0 ? `avg ${avgQuizScore}%` : 'none yet', color: '#FF9F0A', bg: 'rgba(255, 159, 10, 0.15)', show: hasQuiz },
                { icon: <MessageSquare className="w-5 h-5" />, label: 'AI Chat', value: chatInteractionsCount, sub: 'messages sent', color: '#FF375F', bg: 'rgba(255, 55, 95, 0.15)', show: true },
              ].filter(x => x.show).map(({ icon, label, value, sub, color, bg }, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + (i * 0.05), duration: 0.5 }}
                  key={label} 
                  className="p-5 flex flex-col gap-3 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300 shadow-xl"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '24px',
                    backdropFilter: 'blur(30px)',
                  }}
                >
                  <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50" />
                  
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold tracking-widest text-white/40 uppercase">{label}</span>
                    <div className="w-9 h-9 rounded-[10px] flex items-center justify-center transition-colors shadow-md group-hover:brightness-110" style={{ background: color, color: '#ffffff' }}>
                      {icon}
                    </div>
                  </div>
                  <div className="mt-2">
                    <p className="text-[34px] font-black text-white tracking-tight leading-none mb-1.5">{value}</p>
                    <p className="text-[12px] text-white/40 font-medium">{sub}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Bottom Row - Redesigned */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              {/* Flashcard Confidence */}
              {hasFlashcards && totalFlashcards > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '24px',
                    backdropFilter: 'blur(40px)',
                  }} className="p-8 relative overflow-hidden shadow-2xl flex flex-col justify-between group"
                >
                  <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/5 blur-[80px] rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none" />
                  
                  <div>
                     <div className="flex items-center justify-between mb-8 relative z-10">
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-[#30D158]/10 flex items-center justify-center border border-[#30D158]/20">
                             <Layers className="w-5 h-5 text-[#30D158]" />
                          </div>
                          <div>
                             <h3 className="text-[16px] font-bold text-white tracking-tight">Flashcard Recall</h3>
                             <p className="text-[12px] text-white/40 font-medium">{totalFlashcards} cards in deck</p>
                          </div>
                       </div>
                     </div>

                     <div className="flex items-end justify-between mb-6 relative z-10">
                        <div className="flex flex-col">
                           <span className="text-[48px] font-black text-white leading-none tracking-tighter">{gotItCount}</span>
                           <span className="text-[13px] font-bold text-[#30D158] uppercase tracking-wider mt-1">Mastered</span>
                        </div>
                        <div className="flex flex-col text-right">
                           <span className="text-[28px] font-bold text-white/60 leading-none">{needReviewCount}</span>
                           <span className="text-[11px] font-semibold text-[#FF9F0A] uppercase tracking-wider mt-1">Reviewing</span>
                        </div>
                     </div>
                  </div>

                  <div className="relative h-2 rounded-full overflow-hidden bg-white/5 w-full z-10 mt-auto">
                    <div className="absolute left-0 top-0 h-full rounded-full shadow-[0_0_12px_rgba(48,209,88,0.5)]" style={{ width: `${(gotItCount / totalFlashcards) * 100}%`, background: '#30D158', transition: 'width 1s cubic-bezier(0.4,0,0.2,1)' }} />
                    <div className="absolute top-0 h-full rounded-full shadow-[0_0_12px_rgba(255,159,10,0.5)]" style={{
                      left: `${(gotItCount / totalFlashcards) * 100}%`,
                      width: `${(needReviewCount / totalFlashcards) * 100}%`,
                      background: '#FF9F0A',
                      transition: 'all 1s cubic-bezier(0.4,0,0.2,1)'
                    }} />
                  </div>
                </motion.div>
              )}

              {/* Quiz History */}
              {hasQuiz && quizScores.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '24px',
                    backdropFilter: 'blur(40px)',
                  }} className="p-8 relative overflow-hidden shadow-2xl flex flex-col justify-between group"
                >
                  <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 blur-[80px] rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none" />
                  
                  <div>
                     <div className="flex items-center justify-between mb-8 relative z-10">
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-[#FF9F0A]/10 flex items-center justify-center border border-[#FF9F0A]/20">
                             <CheckSquare className="w-5 h-5 text-[#FF9F0A]" />
                          </div>
                          <div>
                             <h3 className="text-[16px] font-bold text-white tracking-tight">Quiz Performance</h3>
                             <p className="text-[12px] text-white/40 font-medium">Last {Math.min(quizScores.length, 3)} attempts</p>
                          </div>
                       </div>
                       <div className="text-right">
                          <span className="text-[24px] font-black text-white">{avgQuizScore}%</span>
                          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mt-0.5">Average</p>
                       </div>
                     </div>

                     <div className="space-y-4 relative z-10">
                       {quizScores.slice(-3).reverse().map((s, i) => {
                         const pct = Math.round((s.score / s.total) * 100);
                         const barColor = pct >= 80 ? '#30D158' : pct >= 60 ? '#FF9F0A' : '#FF453A';
                         return (
                           <div key={i} className="flex items-center gap-4">
                             <div className="w-8 flex justify-end shrink-0">
                                <span className="text-[11px] font-bold text-white/30 uppercase">#{quizScores.length - i}</span>
                             </div>
                             <div className="flex-1 h-2 rounded-full bg-white/5 relative overflow-hidden">
                               <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${pct}%`, background: barColor, boxShadow: `0 0 10px ${barColor}60` }} />
                             </div>
                             <div className="w-10 flex justify-end shrink-0">
                                <span className="text-[14px] font-bold" style={{ color: barColor }}>{pct}%</span>
                             </div>
                           </div>
                         );
                       })}
                     </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Empty state */}
            {pagesRead.length === 0 && quizScores.length === 0 && totalFlashcards === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20 text-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center shadow-lg">
                  <BarChart3 className="h-6 w-6 text-white/20" />
                </div>
                <div>
                  <p className="text-[16px] font-semibold text-white/60 mb-2">No activity yet</p>
                  <p className="text-[13px] text-white/30 max-w-[240px] mx-auto leading-relaxed">Read the document, take the quiz, and review flashcards to track your progress.</p>
                </div>
              </motion.div>
            )}

            <div className="h-8" />
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-transparent">
      <FileText className="h-16 w-16 text-muted-foreground opacity-50 mb-4" />
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
  const queryClient = useQueryClient();

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
    
    fetch(`/api/content/${contentItem.id}/stats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ type: 'chat_interaction' })
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: [`/api/content/${contentItem.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
    }).catch(() => {});
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!session || !contentItem) {
    return (
      <aside className="w-80 flex flex-col bg-transparent border-l border-white/5 h-full backdrop-blur-3xl">
        <div className="p-4 border-b border-white/10">
          <h2 className="text-sm font-bold text-foreground">AI Assistant</h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <img src="/logo.png" alt="Vidya Logo" className="w-8 h-8 object-contain opacity-30 mb-2" />
          <p className="text-xs text-muted-foreground">Select a source to start chatting</p>
        </div>
      </aside>
    );
  }

  const isReady = contentItem.status === "completed";
  const messages = session.messages || [];

  return (
    <aside className="w-[400px] shrink-0 flex flex-col bg-black/20 backdrop-blur-3xl border-l border-white/5 h-full absolute lg:relative right-0 top-0 bottom-0 shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-30">
      <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-transparent shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-white/30 to-white/10 flex items-center justify-center shadow-lg shadow-white/10">
            <img src="/logo.png" alt="Vidya AI" className="w-4 h-4 object-contain" />
          </div>
          <h2 className="text-[14px] font-bold text-foreground tracking-wide">Vidya AI</h2>
        </div>
        <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold tracking-widest uppercase text-white/60">
          GPT-4o
        </div>
      </div>

      <ScrollArea className="flex-1 px-4 custom-scrollbar">
        <div className="py-6 space-y-6">
          {messages.length === 0 ? (
            <div className="text-center py-12 flex flex-col items-center justify-center opacity-80">
              <div className="w-16 h-16 rounded-[24px] bg-gradient-to-br from-white/10 to-transparent flex items-center justify-center mb-5 border border-white/10 shadow-lg">
                <img src="/logo.png" alt="Vidya AI" className="w-7 h-7 object-contain opacity-70" />
              </div>
              <h3 className="text-[15px] font-semibold text-foreground mb-2">How can I help you?</h3>
              <p className="text-[13px] text-muted-foreground max-w-[220px] mx-auto leading-relaxed">
                Ask questions, get summaries, or clarify complex topics from your notes.
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex w-full ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-3 text-[14px] leading-[1.6] shadow-lg border border-white/10 ${
                    msg.role === "user"
                      ? "bg-gradient-to-br from-white/20 to-white/5 text-white rounded-[20px] rounded-br-[4px]"
                      : "bg-white/[0.05] text-white/90 rounded-[20px] rounded-bl-[4px]"
                  }`}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfmPlugin]}
                    components={{
                      p: ({ node, ...props }: any) => <p className="mb-2 last:mb-0" {...props} />,
                      ul: ({ node, ...props }: any) => <ul className="list-disc ml-4 mb-2 space-y-1" {...props} />,
                      li: ({ node, ...props }: any) => <li className="" {...props} />,
                      h1: ({ node, ...props }: any) => <h4 className="font-semibold mt-3 mb-1" {...props} />,
                      h2: ({ node, ...props }: any) => <h4 className="font-semibold mt-3 mb-1" {...props} />,
                      code: ({ node, inline, ...props }: any) => 
                        inline ? <code className="bg-black/20 rounded px-1.5 py-0.5 font-mono text-[12px]" {...props} /> 
                        : <code className="block bg-black/20 rounded-lg p-3 font-mono text-[12px] overflow-x-auto my-2" {...props} />,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} className="h-2" />
        </div>
      </ScrollArea>

      {/* macOS Style Input Area */}
      <div className="p-4 pt-2 shrink-0 bg-transparent">
        <div className="relative bg-white/[0.05] backdrop-blur-[40px] rounded-[24px] border border-white/10 p-1 flex items-end shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all focus-within:border-white/20 focus-within:bg-white/[0.08] focus-within:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Nova..."
            className="min-h-[44px] max-h-[150px] resize-none bg-transparent border-none focus:ring-0 text-[14px] py-3 pl-4 pr-12 text-[#F2F2F7] placeholder:text-muted-foreground custom-scrollbar"
            disabled={!isReady}
          />
          <div className="absolute right-2 bottom-2 flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={`h-8 w-8 rounded-full transition-all ${listening ? 'bg-red-500/20 text-red-500' : 'text-muted-foreground hover:bg-white/10'}`}
              onClick={toggleListening}
              disabled={!isReady || !browserSupportsSpeech}
              title={!browserSupportsSpeech ? "Speech recognition not supported in this browser" : listening ? "Stop recording" : "Use microphone"}
            >
              {listening ? <Mic className="h-4 w-4 animate-pulse" /> : <MicOff className="h-4 w-4" />}
            </Button>
            <Button
              onClick={handleSend}
              disabled={!input.trim() || !isReady}
              size="icon"
              className="h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 text-white disabled:bg-white/5 disabled:text-white/20 transition-all shrink-0"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="text-center mt-3">
          <p className="text-[10px] text-muted-foreground font-medium">Vidya AI can make mistakes. Consider verifying important information.</p>
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
    { id: "summary", label: "Summary", icon: AlignLeft },
    { id: "preview", label: "Original Document", icon: FileText },
    { id: "flashcards", label: "Flashcards", icon: BookMarked },
    { id: "mindmap", label: "Mind Map", icon: BrainCircuit },
    { id: "quiz", label: "Quiz", icon: Check },
    { id: "audio", label: "Audio", icon: Headphones },
    { id: "reports", label: "Reports", icon: BarChart3 },
  ] as const;

  return (
    <aside className="w-16 bg-white/[0.02] backdrop-blur-3xl border-l border-white/5 flex flex-col h-full py-4 items-center gap-4 z-10 relative shadow-[-10px_0_30px_rgba(0,0,0,0.2)]">
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
                    ? "bg-white/10 text-white shadow-lg" 
                    : "text-muted-foreground hover:bg-white/5"
                }`}
                title={label}
              >
                <Icon className="h-5 w-5" />
                <span className="absolute right-14 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                  {label}
                </span>
              </button>
            );
          })}
        </>
      )}
    </aside>
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
    <div className="flex-1 overflow-y-auto bg-transparent relative p-8 md:p-12 custom-scrollbar">
      
      <div className="max-w-5xl mx-auto relative z-10">
        <header className="mb-14">
          <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-white/60 mb-3 tracking-tight font-serif">
            Welcome back, Student
          </h1>
          <p className="text-lg text-white/50 font-medium">What would you like to research today?</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {[
            { title: "New Project", description: "Upload sources and start researching", icon: Plus, action: onUpload, color: "linear-gradient(135deg, #007AFF 0%, #0056b3 100%)", shadow: "rgba(0, 122, 255, 0.4)" },
            { title: "Continue Reading", description: "Pick up where you left off", icon: BookOpen, action: () => {}, color: "linear-gradient(135deg, #AF52DE 0%, #7B33A4 100%)", shadow: "rgba(175, 82, 222, 0.4)" },
            { title: "Practice Mode", description: "Review flashcards and quizzes", icon: Grid, action: () => {}, color: "linear-gradient(135deg, #34C759 0%, #248A3D 100%)", shadow: "rgba(52, 199, 89, 0.4)" },
          ].map((card, i) => (
            <button
              key={i}
              onClick={card.action}
              className="group relative rounded-[32px] p-7 text-left transition-all duration-300 hover:scale-[1.02] border border-white/10 overflow-hidden"
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(40px)',
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3), inset 0 1px 0 0 rgba(255, 255, 255, 0.1)',
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 text-white"
                style={{ 
                  background: card.color,
                  boxShadow: `0 8px 20px -4px ${card.shadow}, inset 0 2px 4px rgba(255,255,255,0.3)`
                }}
              >
                <card.icon className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-100 mb-2 tracking-tight">{card.title}</h3>
              <p className="text-sm text-slate-400 font-medium leading-relaxed">{card.description}</p>
            </button>
          ))}
        </div>

        <section>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-slate-100 tracking-tight font-serif">Recent Sources</h2>
            <Button variant="ghost" size="sm" className="text-white/60 hover:text-white hover:bg-white/10 rounded-full px-4">
              View Library
            </Button>
          </div>

          {recentSessions.length === 0 ? (
            <div 
              className="rounded-[32px] border border-white/10 p-16 text-center"
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                backdropFilter: 'blur(40px)',
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2), inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
              }}
            >
              <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-6">
                <FileText className="h-10 w-10 text-white/20" />
              </div>
              <p className="text-white/50 mb-6 font-medium text-lg">You haven't uploaded any sources yet.</p>
              <Button onClick={onUpload} className="glass-button-primary px-8 py-6 rounded-full shadow-2xl font-bold text-base">
                Upload your first source
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {recentSessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => onSelectSource(session)}
                  className="relative rounded-[24px] p-5 flex items-center gap-5 cursor-pointer group transition-all duration-300 hover:scale-[1.02] border border-white/10 overflow-hidden"
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    backdropFilter: 'blur(40px)',
                    boxShadow: '0 4px 24px -4px rgba(0,0,0,0.2), inset 0 1px 0 0 rgba(255,255,255,0.1)'
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-primary bg-primary/10 border border-primary/20 shadow-[0_0_15px_rgba(0,122,255,0.15)] group-hover:scale-110 transition-transform duration-300 relative z-10">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0 relative z-10">
                    <h4 className="font-bold text-slate-200 truncate tracking-tight text-base">{session.title}</h4>
                    <p className="text-xs text-slate-500 font-medium mt-1">{new Date(session.updatedAt).toLocaleDateString()}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-white/20 group-hover:text-white/60 transition-colors group-hover:translate-x-1 duration-300 relative z-10" />
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
    <div className="flex-1 flex flex-col bg-transparent h-full overflow-hidden">
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02] backdrop-blur-3xl">
        <div className="flex items-center gap-2">
          <SquarePen className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground truncate max-w-[200px]">Scratchpad: {title}</h2>
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
  const [activeMainNavTab, setActiveMainNavTab] = useState("notebooks"); // Start on notebooks view usually, but wait, library is default
  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [selectedSession, setSelectedSession] = useState<ChatSession | undefined>();
  const [selectedView, setSelectedView] = useState<string>("summary");
  const [showUpload, setShowUpload] = useState(false);

  const [autoSelectNew, setAutoSelectNew] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Debug: Log when component mounts
  useEffect(() => {
    console.log("Workspace component mounted");
  }, []);

  const { data: notebooks } = useQuery<any[]>({
    queryKey: ["/api/notebooks"],
    queryFn: async () => {
      const res = await fetch("/api/notebooks");
      if (!res.ok) return [];
      return res.json();
    }
  });

  const activeNotebookName = activeNotebookId 
    ? notebooks?.find((n: any) => n.id === activeNotebookId)?.name 
    : null;

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

  const handleDeleteSession = async (sessionId: string) => {
    if (selectedSession?.id === sessionId) {
      setSelectedSession(undefined);
      setSelectedView("summary");
    }

    try {
      // Extract original content item ID from our session ID prefix
      const contentId = sessionId.replace('session-', '');
      
      const res = await fetch(`/api/content/${contentId}`, {
        method: "DELETE",
        credentials: "include"
      });

      if (!res.ok) {
        throw new Error("Failed to delete from server");
      }

      toast({
        title: "Source deleted",
        description: "The source has been removed from your workspace.",
      });

      // Refresh the query to update the UI
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
    } catch (err) {
      console.error("Failed to delete session:", err);
      toast({
        title: "Error",
        description: "Could not delete the source. Please try again.",
        variant: "destructive"
      });
    }
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
      <div className="min-h-screen w-full bg-black flex overflow-hidden text-slate-200 relative">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-[0.65] mix-blend-screen"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')" }} 
        />
        <div className="absolute inset-0 bg-black/30 backdrop-blur-[120px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/80 pointer-events-none" />

        <div className="max-w-4xl w-full mx-auto p-6 relative z-10 overflow-y-auto custom-scrollbar pt-12">
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
                      className="w-full glass-button-primary"
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
                      onClick={() => {
                        setShowUpload(false);
                        setUploadedItemId(null);
                      }}
                      className="w-full mt-2 glass-button"
                    >
                      Return to Workspace
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          
          <DocumentUpload 
            notebookId={activeNotebookId || undefined}
            onSuccess={(contentItem) => {
              setUploadedItemId(contentItem.id);
              queryClient.invalidateQueries({ queryKey: ["/api/content"] });
              toast({
                title: "Upload successful",
                description: "Your document has been processed successfully.",
              });
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-black flex overflow-hidden text-slate-200 relative">
      {/* VisionOS Cinematic Environment Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-[0.65] mix-blend-screen"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')" }} 
      />
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[120px]" /> {/* Extreme blur for the glass aesthetic */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/80 pointer-events-none" />

      {/* Main Floating Interface */}
      <div className="flex w-full h-full p-4 gap-4 relative z-10">
        {/* 1. Main Navigation Sidebar (Floating) */}
        <MainNav activeTab={activeMainNavTab} onTabChange={setActiveMainNavTab} />
        
        {/* 2. Main Workspace Area (Floating Glass Pane) */}
        <div className="flex-1 flex overflow-hidden relative z-10 bg-white/[0.02] backdrop-blur-[80px] border border-white/10 rounded-[40px] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
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
                activeNotebookId={activeNotebookId}
                activeNotebookName={activeNotebookName}
              />
            )}
            
            {/* Sidebar Toggle Button */}
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`absolute z-40 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-12 bg-white/[0.05] backdrop-blur-[40px] border border-white/10 rounded-r-[12px] hover:bg-white/10 transition-all shadow-[0_4px_16px_rgba(0,0,0,0.3)] ${
                isSidebarOpen ? "left-[300px] border-l-transparent shadow-none" : "left-0"
              }`}
            >
              {isSidebarOpen ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>

            {/* 3. Main Stage (Content + AI Tools) */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
              {/* Main Stage Header */}
              <div className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-transparent shrink-0 min-w-0">
                <div className="flex items-center gap-4 min-w-0">
                  {selectedSession ? (
                    <>
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                        <h1 className="text-[14px] font-semibold text-foreground tracking-wide truncate max-w-[400px]">
                          {selectedSession.title}
                        </h1>
                      </div>
                      <div className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-full flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Active</span>
                      </div>
                      {activeNotebookName && (
                        <div className="px-3 py-1 bg-secondary border border-white/10 rounded-full flex items-center gap-1.5 ml-2">
                          <Book className="h-3 w-3 text-secondary-foreground" />
                          <span className="text-[10px] font-bold text-secondary-foreground uppercase tracking-widest">{activeNotebookName}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <h1 className="text-[14px] font-semibold text-foreground tracking-wide">Select a source</h1>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-6 w-[1px] bg-border/50 mx-2" />
                </div>
              </div>

              <div className="flex-1 flex overflow-hidden min-w-0">
                {/* Left part of Main Stage: Content Viewer */}
                <div className="flex-1 flex flex-col overflow-hidden border-r border-border/50 min-w-0">
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

            {/* Right Sidebar Toggle Button */}
            <button
              onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
              className={`absolute z-40 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-12 bg-white/[0.05] backdrop-blur-[40px] border border-white/10 rounded-l-[12px] hover:bg-white/10 transition-all shadow-[0_4px_16px_rgba(0,0,0,0.3)] ${
                isRightSidebarOpen ? (selectedSession ? "right-[400px] border-r-transparent shadow-none" : "right-[320px] border-r-transparent shadow-none") : "right-0"
              }`}
            >
              {isRightSidebarOpen ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
            </button>

            {/* 4. Far Right: Persistent AI Chat Panel */}
            {isRightSidebarOpen && (
              <ChatPanel 
                session={selectedSession}
                contentItem={contentItem || undefined}
                onSendMessage={handleSendMessage}
              />
            )}
          </>
        ) : activeMainNavTab === "notebooks" ? (
          <NotebooksView onSelectNotebook={(id) => {
            setActiveNotebookId(id);
            setSelectedSession(undefined); // Clear active session when switching notebooks
            setActiveMainNavTab("library");
          }} />
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
    </div>
  );
}
