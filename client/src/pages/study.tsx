import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import SummaryAudioControls from "@/components/summary/SummaryAudioControls";
import { useAudio } from "@/lib/AudioContext";
import { parseSummary } from "@/lib/summaryUtils";
import NotesChatbot from "@/components/study/NotesChatbot";
import FlashcardDrill from "@/components/study/FlashcardDrill";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StudySidebar from "@/components/study/StudySidebar";
import DocumentUpload from "@/components/upload/DocumentUpload";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ContentItem } from "@shared/schema";
import { Copy, Download, Share2, UploadCloud, FileText, Speaker, Video, Layers, BookOpen, File, Grid } from "lucide-react";

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

type StudyPageProps = {
  params: {
    id: string;
  };
};

function SessionsList({ activeId }: { activeId?: string }) {
  const { data: items } = useQuery<any[]>({ queryKey: ["/api/content"] });

  return (
    <aside className="w-72 hidden md:block">
      <div className="sticky top-24 space-y-4">
        <div className="px-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Sources</h3>
              <p className="text-xs text-muted-foreground">Add PDFs, web pages, audio, and more</p>
            </div>
            <Button size="sm" variant="ghost" asChild>
              <Link href="/"> <UploadCloud className="h-4 w-4" /> </Link>
            </Button>
          </div>
        </div>

        <div className="px-3">
          <div className="relative">
            <input placeholder="Search sources" className="w-full rounded-xl border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-3 px-3">
          {items && items.length > 0 ? (
            items.map((it) => (
              <Link key={it.id} href={`/study/${it.id}`}>
                <a className={`block rounded-xl p-3 border ${activeId === it.id ? 'border-primary bg-primary/5' : 'border-border bg-card/50'} hover:shadow-sm`}>
                  <div className="text-xs text-muted-foreground">{new Date(it.createdAt).toLocaleString()}</div>
                  <div className="font-medium text-sm text-foreground truncate">{it.title}</div>
                  <div className="mt-2">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-2 bg-primary`} style={{ width: `${typeof it.progress === 'number' ? it.progress : (it.status === 'completed' ? 100 : 20)}%` }} />
                    </div>
                  </div>
                </a>
              </Link>
            ))
          ) : (
            <div className="text-sm text-muted-foreground px-3">No sources yet</div>
          )}
        </div>
      </div>
    </aside>
  );
}

export default function StudyPage({ params }: StudyPageProps) {
  const [, paramsMatch] = useRoute("/study/:id");
  const contentId = params?.id || paramsMatch?.id || "";

  const { data, isLoading, error, refetch } = useContentItem(contentId);

  useEffect(() => {
    if (!contentId) return;
    refetch();
  }, [contentId, refetch]);

  const itemStatus = data?.status;

  useEffect(() => {
    if (itemStatus !== "processing") return;
    const interval = setInterval(() => {
      refetch();
    }, 3000);
    return () => clearInterval(interval);
  }, [itemStatus, refetch]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-10">
        {/* NotebookLM-like three column shell. If no contentId, show empty center state. */}
        {!contentId ? (
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr_340px] gap-6">
            <SessionsList />

            <div>
              <div className="rounded-2xl bg-card/80 p-6 shadow-lg">
                <h2 className="text-xl font-semibold mb-2">Upload a source</h2>
                <p className="text-sm text-muted-foreground mb-4">Drop a PDF or DOCX to start a study session in seconds.</p>
                <DocumentUpload />
              </div>
            </div>

            <div>
              <div className="sticky top-24 space-y-4">
                <div className="rounded-2xl border bg-card/60 p-4">
                  <h3 className="text-sm font-semibold">Studio</h3>
                  <p className="text-xs text-muted-foreground">Create study outputs</p>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3">
                  <button className="flex items-center gap-2 rounded-lg border p-3 bg-card hover:shadow-sm"><Speaker className="h-4 w-4" />Audio Overview</button>
                  <button className="flex items-center gap-2 rounded-lg border p-3 bg-card hover:shadow-sm"><Video className="h-4 w-4" />Video Overview</button>
                  <button className="flex items-center gap-2 rounded-lg border p-3 bg-card hover:shadow-sm"><Layers className="h-4 w-4" />Mind Map</button>
                  <button className="flex items-center gap-2 rounded-lg border p-3 bg-card hover:shadow-sm"><File className="h-4 w-4" />Reports</button>
                  <button className="flex items-center gap-2 rounded-lg border p-3 bg-card hover:shadow-sm"><BookOpen className="h-4 w-4" />Flashcards</button>
                  <button className="flex items-center gap-2 rounded-lg border p-3 bg-card hover:shadow-sm"><Grid className="h-4 w-4" />Quiz</button>
                  <button className="flex items-center gap-2 rounded-lg border p-3 bg-card hover:shadow-sm"><FileText className="h-4 w-4" />Infographic</button>
                  <button className="flex items-center gap-2 rounded-lg border p-3 bg-card hover:shadow-sm"><FileText className="h-4 w-4" />Slide Deck</button>
                </div>

                <div className="pt-4">
                  <Button className="w-full">Add note</Button>
                </div>
              </div>
            </div>
          </div>
        ) : isLoading ? (
          <StudySkeleton />
        ) : error ? (
          <ErrorState retry={refetch} message={(error as Error).message} />
        ) : !data ? (
          <ErrorState retry={refetch} message="Content not found." />
        ) : (
          <StudyLayout item={data} />
        )}
      </main>

      <Footer />
    </div>
  );
}

function StudyLayout({ item }: { item: ContentItem }) {
  const isReady = item.status === "completed";
  const [selectedSection, setSelectedSection] = useState<string>("summary");
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const audio = useAudio();
  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr_340px] gap-6">
      <SessionsList activeId={item.id} />

      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{item.type.toUpperCase()}</Badge>
              <Badge variant={isReady ? "default" : item.status === "failed" ? "destructive" : "secondary"}>{item.status}</Badge>
            </div>
            <h1 className="text-3xl font-semibold text-foreground mt-3">{item.title}</h1>
            <p className="text-sm text-muted-foreground">Uploaded {new Date(item.createdAt).toLocaleString()} • Last updated {new Date(item.updatedAt).toLocaleString()}</p>
          </div>

              <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => navigator.clipboard?.writeText(item.summary || '')}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => {
              const blob = new Blob([item.summary || ''], { type: 'text/markdown' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = `${(item.title||'summary').replace(/[^a-z0-9-_]/gi,'_')}.md`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
            }}>
              <Download className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { const shareUrl = `${location.origin}/study/${item.id}`; if ((navigator as any).share) { (navigator as any).share({ title: item.title, url: shareUrl }).catch(()=>{}); } else { navigator.clipboard?.writeText(shareUrl); } }}>
              <Share2 className="h-4 w-4" />
            </Button>
            {item.audioUrl && (
              <Button size="sm" className="ml-2 bg-primary text-white" onClick={() => audio.playSource(item.audioUrl!, item.title)}>
                Play Audio
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* notification / status bubble */}
          {!isReady && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
              <div className="text-sm text-primary">We're still preparing your study kit. This page will refresh automatically once everything is ready.</div>
            </div>
          )}

          {/* main summary bubble */}
          {selectedSection === 'flashcards' ? (
            <FlashcardDrill flashcards={(item.flashcards as any) || (Array.isArray(item.quizData) ? (item.quizData as any) : undefined)} />
          ) : (
            <div className="max-w-full">
              <div className="rounded-2xl bg-card/80 p-6 shadow-lg transition-shadow duration-200 hover:shadow-xl">
                <div className="prose prose-md dark:prose-invert text-sm text-muted-foreground">
                  {item.summary ? (
                    (() => {
                      const parsed = parseSummary(item.summary as any);
                      return <ReactMarkdown remarkPlugins={[remarkGfm]}>{parsed.text}</ReactMarkdown>;
                    })()
                  ) : (
                    <p className="text-sm text-muted-foreground">Summary not available yet.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Chat / assistant area */}
          <Card className="transition-transform duration-150 hover:scale-[1.01]">
            <CardContent>
              <h3 className="text-lg font-semibold text-foreground mb-3">Study Assistant</h3>
              <NotesChatbot summary={item.summary} extractedText={item.extractedText} />
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <StudySidebar
          summary={item.summary || undefined}
          extractedText={item.extractedText || undefined}
          title={item.title}
          flashcards={(item.flashcards as any) || (Array.isArray(item.quizData) ? (item.quizData as any) : undefined)}
          audioUrl={item.audioUrl}
          selectedSection={selectedSection}
          onSelectSection={(s) => setSelectedSection(s)}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        />
      </div>
    </div>
  );
}

function StudySkeleton() {
  return (
    <div className="grid gap-8 md:grid-cols-[2fr_1fr]">
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
      <Skeleton className="h-[500px] w-full" />
    </div>
  );
}

function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <CardContent className="py-6">
        <h2 className="text-lg font-semibold text-destructive">Unable to load study materials</h2>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <Button onClick={() => retry()} className="mt-4">
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

