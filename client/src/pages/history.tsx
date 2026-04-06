import { useQuery } from "@tanstack/react-query";
import { Dispatch, SetStateAction, useState, useEffect } from "react";
import { Link } from "wouter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AudioPlayer from "@/components/AudioPlayer";
import SummaryPanel from "@/components/summary/SummaryPanel";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Download, Play, FileText, Image, Video, Volume2, VolumeX, Loader2 } from "lucide-react";
import type { ContentItem } from "@shared/schema";

type Flashcard = {
  question?: string;
  answer?: string;
  options?: string[];
  correctAnswer?: number;
};

const statusVariants = {
  completed: "default",
  processing: "secondary",
  pending: "outline",
  failed: "destructive",
} as const;

function getTypeIcon(type: string) {
  switch (type) {
    case "document":
      return FileText;
    case "image":
      return Image;
    case "video":
      return Video;
    default:
      return FileText;
  }
}

function getStatusBadge(status: string) {
  return <Badge variant={statusVariants[status as keyof typeof statusVariants] || "outline"}>{status}</Badge>;
}

function entryLooksLikeFlashcard(entry: any): entry is Flashcard {
  return typeof entry?.answer === "string" && !Array.isArray(entry?.options);
}

function entryLooksLikeQuiz(entry: any): boolean {
  return Array.isArray(entry?.options) && entry.options.length > 0;
}

function deriveFlashcards(item: ContentItem): Flashcard[] | undefined {
  if (Array.isArray(item.flashcards) && item.flashcards.length > 0) {
    return item.flashcards as Flashcard[];
  }

  if (Array.isArray(item.quizData) && item.quizData.length > 0) {
    const maybeFlashcards = item.quizData.filter(entryLooksLikeFlashcard);
    if (maybeFlashcards.length === item.quizData.length) {
      return maybeFlashcards as Flashcard[];
    }
  }

  return undefined;
}

function hasQuizQuestions(data: unknown): boolean {
  return Array.isArray(data) && data.some(entryLooksLikeQuiz);
}

export default function History() {
  const { data: contentItems, isLoading, error, refetch } = useQuery<ContentItem[]>({
    queryKey: ["/api/content"],
  });

  // Poll the content list while any item is processing so the UI updates automatically
  useEffect(() => {
    if (!contentItems) return;
    const hasProcessing = contentItems.some((it) => it.status === "processing");
    if (!hasProcessing) return;

    const iv = setInterval(() => refetch(), 3000);
    return () => clearInterval(iv);
  }, [contentItems, refetch]);
  
  const [search, setSearch] = useState<string>("");
  const [filter, setFilter] = useState<string>("all");

  const [speakingItemId, setSpeakingItemId] = useState<string | null>(null);
  const [speechRate, setSpeechRate] = useState(0.9);
  
  const speakText = (text: string, itemId: string) => {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    if (speakingItemId === itemId) {
      setSpeakingItemId(null);
      return;
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = speechRate;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    utterance.onstart = () => setSpeakingItemId(itemId);
    utterance.onend = () => setSpeakingItemId(null);
    utterance.onerror = () => setSpeakingItemId(null);
    
    window.speechSynthesis.speak(utterance);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2 mb-4" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <p>Failed to load content history. Please try again.</p>
              </div>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">Your Learning History</h1>
          <p className="text-xl text-muted-foreground">
            Access your previously processed materials anytime
          </p>
        </div>

        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Input
              placeholder="Search materials"
              value={search}
              onChange={(e) => setSearch((e.target as HTMLInputElement).value)}
              className="w-64 rounded-xl bg-white/5 border-border/50"
              data-testid="input-search-history"
            />
            <div className="flex items-center gap-2">
              <Button variant={filter === "all" ? "default" : "ghost"} size="sm" onClick={() => setFilter("all")}>All</Button>
              <Button variant={filter === "processing" ? "default" : "ghost"} size="sm" onClick={() => setFilter("processing")}>Processing</Button>
              <Button variant={filter === "completed" ? "default" : "ghost"} size="sm" onClick={() => setFilter("completed")}>Completed</Button>
              <Button variant={filter === "failed" ? "destructive" : "ghost"} size="sm" onClick={() => setFilter("failed")}>Failed</Button>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">{contentItems ? contentItems.length : 0} items</div>
        </div>

        {!contentItems || contentItems.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No content yet</h3>
              <p className="text-muted-foreground mb-4">
                Upload your first document, image, or video to get started
              </p>
              <Button asChild>
                <a href="/#upload" data-testid="link-start-uploading">Start Uploading</a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {contentItems
              .filter((it) => {
                if (filter !== "all" && it.status !== filter) return false;
                if (!search) return true;
                return it.title.toLowerCase().includes(search.toLowerCase());
              })
              .map((item) => {
              const TypeIcon = getTypeIcon(item.type);
              const flashcards = deriveFlashcards(item);
              const quizGenerated = hasQuizQuestions(item.quizData);

              return (
                <Card key={item.id} className="glass-card rounded-2xl border border-border hover:border-primary/20 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <TypeIcon className="h-6 w-6 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-card-foreground truncate" data-testid={`text-title-${item.id}`}>{item.title}</h3>
                            <span className="text-xs text-muted-foreground">• {item.type}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">Uploaded {new Date(item.createdAt).toLocaleString()}</div>
                        </div>
                      </div>

                      <div className="w-48 flex flex-col items-end">
                        {item.status === "processing" ? (
                          <>
                            <div className="text-xs text-muted-foreground mb-1">Processing</div>
                            <Progress className="w-full" value={typeof (item as any).progress === 'number' ? (item as any).progress : 50} />
                          </>
                        ) : item.status === "completed" ? (
                          <div className="text-xs text-muted-foreground mb-1">Ready</div>
                        ) : item.status === "failed" ? (
                          <div className="text-xs text-destructive mb-1">Failed</div>
                        ) : (
                          <div className="text-xs text-muted-foreground mb-1">{item.status}</div>
                        )}

                        <div className="mt-3 flex items-center gap-2">
                          <Button asChild size="sm" className="bg-primary text-white" disabled={item.status !== "completed"}>
                            <Link href={`/study/${item.id}`}>{item.status === "completed" ? "Continue" : "View"}</Link>
                          </Button>
                          <Button variant="ghost" size="sm" data-testid={`button-download-${item.id}`}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    {item.summary && (
                      <div className="mt-3">
                        <SummaryPanel summary={item.summary} title={item.title} flashcards={flashcards} summaryTestId={`summary-audio-${item.id}`} previewOnly itemId={item.id} />
                      </div>
                    )}
                    <div className="mt-3">
                      <BadgesRow item={item} flashcards={flashcards} hasQuiz={quizGenerated} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

function BadgesRow({
  item,
  flashcards,
  hasQuiz,
}: {
  item: ContentItem;
  flashcards?: Flashcard[];
  hasQuiz: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {getStatusBadge(item.status)}
      {item.audioUrl && (
        <Badge variant="secondary" data-testid={`badge-audio-${item.id}`}>
          Audio Available
        </Badge>
      )}
      {item.summary && (
        <Badge variant="outline" data-testid={`badge-summary-${item.id}`}>
          Summary Available
        </Badge>
      )}
      {flashcards && flashcards.length > 0 && (
        <Badge variant="secondary" data-testid={`badge-flashcards-${item.id}`}>
          Flashcards Ready
        </Badge>
      )}
      {hasQuiz && (
        <Badge variant="outline" data-testid={`badge-quiz-${item.id}`}>
          Quiz Generated
        </Badge>
      )}
    </div>
  );
}

function ExtractedTextSection({
  item,
  speakText,
  speakingItemId,
  speechRate,
  setSpeechRate,
}: {
  item: ContentItem;
  speakText: (text: string, itemId: string) => void;
  speakingItemId: string | null;
  speechRate: number;
  setSpeechRate: Dispatch<SetStateAction<number>>;
}) {
  const textButtonId = `${item.id}-text`;

  return (
    <div className="mb-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-3">
        <h4 className="font-medium text-card-foreground">Extracted Text</h4>
        <div className="flex items-center gap-3">
          <label className="text-xs text-muted-foreground">
            Speech rate:
            <select
              className="ml-2 text-xs px-2 py-1 rounded border bg-white"
              value={String(speechRate)}
              onChange={(e) => setSpeechRate(Number(e.target.value))}
              aria-label="Speech rate for extracted text"
            >
              <option value="0.6">0.6x</option>
              <option value="0.8">0.8x</option>
              <option value="0.9">0.9x</option>
              <option value="1">1.0x</option>
              <option value="1.2">1.2x</option>
              <option value="1.5">1.5x</option>
            </select>
          </label>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => speakText(item.extractedText!, textButtonId)}
            className="text-muted-foreground hover:text-foreground"
            data-testid={`button-speak-text-${item.id}`}
          >
            {speakingItemId === textButtonId ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            <span className="ml-1 text-xs">{speakingItemId === textButtonId ? "Stop" : "Listen"}</span>
          </Button>
        </div>
      </div>
      <div className="bg-muted/20 rounded-lg p-4 max-h-48 overflow-y-auto">
        <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
          {item.extractedText && item.extractedText.length > 1000
            ? `${item.extractedText.substring(0, 1000)}...`
            : item.extractedText}
        </div>
      </div>
    </div>
  );
}
