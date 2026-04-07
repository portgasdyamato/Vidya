import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseSummary } from "@/lib/summaryUtils";
import StudySidebar from "@/components/study/StudySidebar";
import FlashcardDrill from "@/components/study/FlashcardDrill";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import DocumentUpload from "@/components/upload/DocumentUpload";
import PodcastPlayer from "@/components/audio/PodcastPlayer";
import MermaidChart from "@/components/study/MermaidChart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ContentItem } from "@shared/schema";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ResizableHandle, 
  ResizablePanel, 
  ResizablePanelGroup 
} from "@/components/ui/resizable";
import { 
  Copy, Download, UploadCloud, FileText, Speaker, 
  Video, Layers, BookOpen, File, Grid, 
  MoreVertical, Info, Search, User, ChevronLeft,
  MessageSquare, Eye, ExternalLink, Sparkles
} from "lucide-react";

function useContentItem(id: string) {
  return useQuery<ContentItem>({
    queryKey: ["content-item", id],
    queryFn: async () => {
      const res = await fetch(`/api/content/${id}`, { credentials: "include" });
      if (!res.ok) {
        throw new Error(`Failed to load study notes (${res.status})`);
      }
      return res.json();
    },
    enabled: Boolean(id),
  });
}

function SessionsList({ activeId }: { activeId?: string }) {
  const { data: items } = useQuery<any[]>({ queryKey: ["/api/content"] });

  return (
    <aside className="w-80 hidden lg:flex flex-col border-r border-white/5 h-[calc(100vh-64px)] overflow-y-auto overflow-x-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-serif text-white">Sources</h3>
          <Link href="/">
            <button className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
              <UploadCloud className="h-4 w-4 text-white/70" />
            </button>
          </Link>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input 
            placeholder="Search sources" 
            className="w-full rounded-2xl bg-white/5 border border-white/5 px-10 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50" 
          />
        </div>

        <div className="space-y-4">
          {items && items.length > 0 ? (
            items.map((it) => (
              <Link key={it.id} href={`/study/${it.id}`}>
                <motion.div
                  whileHover={{ x: 2 }}
                  className={`block w-full rounded-2xl p-4 transition-all border cursor-pointer ${
                    activeId === it.id 
                      ? 'glass-card border-primary/30 bg-primary/5' 
                      : 'border-transparent hover:bg-white/5'
                  }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] text-white/30 font-medium uppercase tracking-wider">
                      {new Date(it.createdAt).toLocaleDateString()}
                    </span>
                    {it.status === 'processing' && (
                      <div className="flex gap-1 animate-pulse">
                        <div className="w-1 h-1 rounded-full bg-primary" />
                        <div className="w-1 h-1 rounded-full bg-primary" />
                      </div>
                    )}
                  </div>
                  <div
                    className="font-medium text-sm text-white"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      wordBreak: "break-word",
                    }}
                  >
                    {it.title}
                  </div>
                  <div className="mt-3">
                    <div className="h-0.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${typeof it.progress === 'number' ? it.progress : (it.status === 'completed' ? 100 : 20)}%` }}
                        className="h-0.5 bg-primary rounded-full" 
                      />
                    </div>
                  </div>
                </motion.div>
              </Link>
            ))
          ) : (
            <div className="text-sm text-white/30 px-3 italic">No sources yet</div>
          )}
        </div>
      </div>
    </aside>
  );
}

export default function StudyPage({ params }: { params: { id: string } }) {
  const [, paramsMatch] = useRoute("/study/:id");
  const contentId = params?.id || paramsMatch?.id || "";
  const { data, isLoading, error, refetch } = useContentItem(contentId);
  const [selectedView, setSelectedView] = useState("summary");

  useEffect(() => {
    if (!contentId) return;
    refetch();
  }, [contentId, refetch]);

  useEffect(() => {
    if (data?.status !== "processing") return;
    const interval = setInterval(() => refetch(), 3000);
    return () => clearInterval(interval);
  }, [data?.status, refetch]);

  const learningTools = [
    { id: "summary", label: "Summary", icon: FileText },
    { id: "source", label: "Original", icon: Eye },
    { id: "flashcards", label: "Flashcards", icon: BookOpen },
    { id: "mindmap", label: "Mind Map", icon: Layers },
    { id: "quiz", label: "Quiz", icon: Grid },
    { id: "audio", label: "Podcast", icon: Speaker }
  ];

  const renderSourcePreview = () => {
    if (!data) return null;

    if (data.type === "video" && data.originalUrl) {
      const isYouTube = /youtube\.com|youtu\.be/.test(data.originalUrl);
      if (isYouTube) {
        let videoId = "";
        const match = data.originalUrl.match(/[?&]v=([^&]+)/) || data.originalUrl.match(/youtu\.be\/([^?]+)/);
        if (match) videoId = match[1];
        
        return (
          <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black border border-white/5">
            <iframe 
              src={`https://www.youtube.com/embed/${videoId}`}
              className="w-full h-full"
              allowFullScreen
            />
          </div>
        );
      }
      return (
        <video 
          src={data.originalUrl} 
          controls 
          className="w-full rounded-2xl border border-white/5 bg-black"
        />
      );
    }

    // For documents and images, point to the permanent original route we just added
    const previewUrl = `/api/content/${data.id}/original`;
    
    if (data.type === "image") {
      return (
        <div className="flex flex-col gap-4">
           <img 
            src={previewUrl} 
            alt={data.title} 
            className="w-full rounded-2xl border border-white/5 bg-white/5"
           />
           <Button variant="outline" className="w-fit" onClick={() => window.open(previewUrl)}>
              Open Full Image <ExternalLink className="ml-2 w-4 h-4" />
           </Button>
        </div>
      );
    }

    if (data.type === "document") {
      return (
        <div className="flex flex-col gap-6 h-[800px]">
           <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
              <div className="flex items-center gap-3">
                 <File className="w-5 h-5 text-primary" />
                 <div>
                    <div className="text-sm font-bold">{data.originalFileName || "Original Document"}</div>
                    <div className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Secure Preview</div>
                 </div>
              </div>
              <Button size="sm" variant="secondary" onClick={() => window.open(previewUrl)}>
                Open in New Tab <ExternalLink className="ml-2 w-4 h-4" />
              </Button>
           </div>
           <iframe 
            src={previewUrl} 
            className="flex-1 w-full rounded-2xl border border-white/5 bg-white/[0.02]"
            title="Document Preview"
           />
        </div>
      );
    }

    return <div className="p-20 text-center text-white/20 italic">No preview available for this content type</div>;
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      {/* Premium Top Bar */}
      <nav className="h-16 border-b border-white/5 flex items-center justify-between px-6 sticky top-0 bg-[#050505]/80 backdrop-blur-md z-40 shrink-0">
        <div className="flex items-center gap-6">
          <Link href="/workspace">
            <button className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm font-medium">
              <ChevronLeft className="w-4 h-4" /> Back to Library
            </button>
          </Link>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                <User className="w-4 h-4 text-primary-foreground" />
             </div>
             <div>
                <div className="text-sm font-medium leading-none mb-1 truncate max-w-[200px]">{data?.title || "Untitled Note"}</div>
                <div className="text-[10px] text-white/30 uppercase tracking-tighter font-semibold">
                   {data?.status || "Idle"}
                </div>
             </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
           {data?.audioUrl && (
              <button className="glass-button-primary !py-1.5 !px-4 !text-xs">
                Play Audio <Speaker className="w-3 h-3" />
              </button>
           )}
           <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded-lg border border-white/5">
              <button className="p-2 hover:bg-white/5 rounded-md transition-colors"><Info className="w-4 h-4 text-white/50" /></button>
              <button className="p-2 hover:bg-white/5 rounded-md transition-colors"><MoreVertical className="w-4 h-4 text-white/50" /></button>
           </div>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        <SessionsList activeId={contentId} />

        <div className="flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={75} minSize={40}>
               <main className="h-full overflow-y-auto px-4 lg:px-12 py-10 pb-32">
                <AnimatePresence mode="wait">
                  {!contentId ? (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      key="empty"
                      className="max-w-4xl mx-auto"
                    >
                      <div className="glass-card rounded-[2rem] p-12 text-center mb-8">
                        <h2 className="text-3xl font-serif mb-4">Start your study session</h2>
                        <p className="text-white/40 mb-10 max-w-md mx-auto">Upload a document or paste a link to generate summaries, chat with AI, and create study tools.</p>
                        <div className="bg-white/5 rounded-3xl p-8 border border-white/5">
                          <DocumentUpload />
                        </div>
                      </div>
                    </motion.div>
                  ) : isLoading ? (
                    <div className="max-w-4xl mx-auto space-y-6">
                      <Skeleton className="h-12 w-1/2 bg-white/5" />
                      <Skeleton className="h-64 w-full bg-white/5 rounded-[2rem]" />
                    </div>
                  ) : error || !data ? (
                    <div className="max-w-4xl mx-auto bg-destructive/10 border border-destructive/20 p-8 rounded-3xl text-center">
                       <h3 className="text-xl font-medium mb-2">Something went wrong</h3>
                       <p className="text-sm text-white/50 mb-6">{error?.message || "Content not found"}</p>
                       <Button variant="outline" onClick={() => refetch()}>Try Again</Button>
                    </div>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      key="content"
                      className="max-w-5xl mx-auto space-y-8"
                    >
                      {/* Learning Tool Tabs */}
                      <div className="glass-card rounded-2xl p-1.5 flex gap-1 overflow-x-auto no-scrollbar border-white/5 sticky top-[-2.5rem] bg-[#050505]/95 backdrop-blur-xl z-10 mx-auto w-fit">
                         {learningTools.map((tool) => (
                           <button 
                             key={tool.id} 
                             onClick={() => setSelectedView(tool.id)}
                             className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all whitespace-nowrap ${
                               selectedView === tool.id 
                                 ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                                 : 'hover:bg-white/5 text-white/40'
                             }`}
                           >
                              <tool.icon className="w-4 h-4" />
                              <span className="text-xs font-bold uppercase tracking-tight">{tool.label}</span>
                           </button>
                         ))}
                      </div>

                      <div className="space-y-8">
                        {selectedView === "summary" && (
                          <div className="glass-card rounded-[2.5rem] p-8 md:p-12">
                             <div className="flex items-center justify-between mb-8">
                                <h2 className="text-2xl font-serif">Study Summary</h2>
                                <div className="flex gap-2">
                                    <button className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors" title="Copy text"><Copy className="w-4 h-4 text-white/50" /></button>
                                    <button className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors" title="Download MD"><Download className="w-4 h-4 text-white/50" /></button>
                                </div>
                             </div>

                             <div className="prose prose-invert prose-p:text-white/70 prose-headings:font-serif prose-headings:text-white prose-p:leading-relaxed max-w-none">
                                {data.summary ? (
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {parseSummary(data.summary as any).text}
                                  </ReactMarkdown>
                                ) : (
                                  <div className="flex flex-col items-center justify-center py-20 text-white/20">
                                     <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center mb-6 animate-pulse">
                                        <FileText className="w-8 h-8" />
                                     </div>
                                     <p className="font-medium">AI is summarizing your notes...</p>
                                  </div>
                                )}
                             </div>
                          </div>
                        )}

                        {selectedView === "source" && (
                          <div className="glass-card rounded-[2.5rem] p-8 min-h-[600px]">
                             <div className="flex items-center justify-between mb-8">
                                <h2 className="text-2xl font-serif">Original Resource</h2>
                                <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">SECURE PREVIEW</Badge>
                             </div>
                             {renderSourcePreview()}
                          </div>
                        )}

                        {selectedView === "flashcards" && (
                          <div className="glass-card rounded-[2.5rem] p-12 min-h-[600px]">
                             <h2 className="text-2xl font-serif mb-8 text-center">Recall Practice</h2>
                             <FlashcardDrill flashcards={typeof data.flashcards === 'string' ? JSON.parse(data.flashcards) : (data.flashcards || [])} />
                          </div>
                        )}

                        {selectedView === "mindmap" && (
                           <div className="glass-card rounded-[2.5rem] p-12 min-h-[600px] flex flex-col items-center justify-center">
                              <h2 className="text-2xl font-serif mb-8">Concept Map</h2>
                              {data.mindMap ? (
                                <div className="w-full flex flex-col items-center">
                                   <MermaidChart data={data.mindMap as any} />
                                   <p className="mt-8 text-sm text-white/30 text-center italic font-sans tracking-wide">Interactive concept map generated by AI.</p>
                                </div>
                              ) : (
                                <div className="text-center opacity-20">
                                   <Layers className="w-16 h-16 mx-auto mb-6" />
                                   <p>Mind map generation not available for this session.</p>
                                </div>
                              )}
                           </div>
                        )}

                        {selectedView === "audio" && (
                          <div className="glass-card rounded-[2.5rem] p-12 min-h-[600px]">
                            <h2 className="text-2xl font-serif mb-8 text-center">Audio Podcast</h2>
                            <PodcastPlayer 
                              audioUrl={data.podcastAudioUrl ? `/api/content/${data.id}/podcast-audio` : ""} 
                              title={data.title}
                              transcript={data.podcastScript || data.extractedText || ""}
                              summary={data.summary || ""}
                              useWebSpeech={!data.podcastAudioUrl}
                            />
                          </div>
                        )}

                        {selectedView === "quiz" && (
                          <div className="glass-card rounded-[2.5rem] p-12 min-h-[600px] flex flex-col items-center justify-center">
                            <h2 className="text-2xl font-serif mb-8">Knowledge Check</h2>
                            {data.quizData ? (
                              <div className="text-center">
                                 <Grid className="w-16 h-16 mx-auto mb-6 text-primary" />
                                 <p className="mb-8">Your interactive quiz is ready.</p>
                                 <Button className="glass-button-primary">Start Quiz</Button>
                              </div>
                            ) : (
                              <div className="text-center opacity-20">
                                 <Grid className="w-16 h-16 mx-auto mb-6" />
                                 <p>Quiz generation in progress or not requested.</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </main>
            </ResizablePanel>

            <ResizableHandle withHandle className="bg-white/5 hover:bg-primary/20 transition-colors" />

            <ResizablePanel defaultSize={25} minSize={20}>
               {data && (
                 <StudySidebar 
                  id={data.id} 
                  summary={data.summary || ""} 
                  extractedText={data.extractedText || ""} 
                  title={data.title}
                  flashcards={typeof data.flashcards === 'string' ? JSON.parse(data.flashcards) : (data.flashcards || [])}
                  audioUrl={data.audioUrl ? `/api/content/${data.id}/audio` : undefined}
                  selectedSection={selectedView}
                  onSelectSection={setSelectedView}
                 />
               )}
               {!data && (
                 <div className="h-full flex flex-col items-center justify-center text-white/20 p-12 text-center">
                    <MessageSquare className="w-12 h-12 mb-4" />
                    <p className="text-sm font-medium">Select a source to start studying</p>
                 </div>
               )}
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
      
      {/* Persistent Player Positioning */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 px-6 pb-6 pointer-events-none">
         <div className="max-w-4xl mx-auto pointer-events-auto">
            {/* Audio player will mount here or via app component */}
         </div>
      </footer>
    </div>
  );
}

function ShieldCheck({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}
