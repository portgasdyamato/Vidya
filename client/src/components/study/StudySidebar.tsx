import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import SummaryAudioControls from "@/components/summary/SummaryAudioControls";
import NotesChatbot from "./NotesChatbot";
import { useAudio } from "@/lib/AudioContext";
import { Badge } from "@/components/ui/badge";
import { FileText, Volume2, MessageSquare, BookOpen, Video, Layers, Grid, FileText as Doc, Speaker } from "lucide-react";

interface Flashcard {
  question?: string;
  answer?: string;
  options?: string[];
  correctAnswer?: number;
}

interface StudySidebarProps {
  id: string;
  summary?: string;
  extractedText?: string;
  title: string;
  flashcards?: Flashcard[];
  audioUrl?: string | null;
  // selected section name from parent (summary | audio | chatbot | flashcards)
  selectedSection?: string;
  onSelectSection?: (section: string) => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

function FlashcardList({ flashcards }: { flashcards?: Flashcard[] }) {
  if (!flashcards || flashcards.length === 0) {
    return <p className="text-sm text-muted-foreground">Flashcards will appear here when available.</p>;
  }

  return (
    <div className="space-y-3">
      {flashcards.map((card, index) => (
        <div key={index} className="rounded-xl border border-border/50 bg-muted/30 p-3 text-sm">
          <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
            <span>Card {index + 1}</span>
            <Badge variant="outline">{card.options ? "Multiple Choice" : "Recall"}</Badge>
          </div>
          <p className="mt-2 font-semibold text-foreground">{card.question || "Untitled concept"}</p>
          {card.options ? (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
              {card.options.map((option, idx) => (
                <li key={idx} className={idx === (card.correctAnswer ?? -1) ? "font-semibold text-primary" : ""}>
                  {option}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-muted-foreground">{card.answer || "No answer provided"}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export default function StudySidebar({ id, summary, extractedText, title, flashcards, audioUrl, selectedSection, onSelectSection, collapsed, onToggleCollapsed }: StudySidebarProps) {
  const audio = useAudio();
  const sections = [
    { id: "summary", label: "Summary", icon: FileText },
    { id: "audio", label: "Audio", icon: Volume2 },
    { id: "chatbot", label: "Assistant", icon: MessageSquare },
    { id: "flashcards", label: "Flashcards", icon: BookOpen },
  ];

  return (
    <div className={`w-full rounded-3xl border border-border/50 bg-card/70 p-4 shadow-lg md:max-w-sm ${collapsed ? "hidden md:block" : "block"}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold">Studio</h3>
          <p className="text-xs text-muted-foreground">Create study outputs</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="text-sm text-muted-foreground px-2 py-1 rounded-md hover:bg-muted/10"
            onClick={() => onToggleCollapsed?.()}
            aria-label="Toggle sidebar"
            aria-pressed={collapsed}
            title={collapsed ? "Expand studio" : "Collapse studio"}
          >
            {collapsed ? "»" : "«"}
          </button>
        </div>
      </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
        <button className="flex items-center gap-2 rounded-lg border p-3 bg-card hover:shadow-md hover:scale-[1.01] transition-transform duration-150 text-sm" onClick={() => {
          if (audioUrl) {
            audio.playSource(audioUrl, title);
          } else {
            onSelectSection?.('audio');
          }
        }}>
          <Speaker className="h-4 w-4" />
          Audio Overview
        </button>
        <button className="flex items-center gap-2 rounded-lg border p-3 bg-card hover:shadow-md hover:scale-[1.01] transition-transform duration-150 text-sm" onClick={() => onSelectSection?.('video')}>
          <Video className="h-4 w-4" />
          Video Overview
        </button>
        <button className="flex items-center gap-2 rounded-lg border p-3 bg-card hover:shadow-md hover:scale-[1.01] transition-transform duration-150 text-sm" onClick={() => onSelectSection?.('mindmap')}>
          <Layers className="h-4 w-4" />
          Mind Map
        </button>
        <button className="flex items-center gap-2 rounded-lg border p-3 bg-card hover:shadow-md hover:scale-[1.01] transition-transform duration-150 text-sm" onClick={() => onSelectSection?.('reports')}>
          <Doc className="h-4 w-4" />
          Reports
        </button>
        <button className="flex items-center gap-2 rounded-lg border p-3 bg-card hover:shadow-md hover:scale-[1.01] transition-transform duration-150 text-sm" onClick={() => onSelectSection?.('flashcards')}>
          <BookOpen className="h-4 w-4" />
          Flashcards
        </button>
        <button className="flex items-center gap-2 rounded-lg border p-3 bg-card hover:shadow-md hover:scale-[1.01] transition-transform duration-150 text-sm" onClick={() => onSelectSection?.('quiz')}>
          <Grid className="h-4 w-4" />
          Quiz
        </button>
        <button className="flex items-center gap-2 rounded-lg border p-3 bg-card hover:shadow-md hover:scale-[1.01] transition-transform duration-150 text-sm col-span-2" onClick={() => onSelectSection?.('slide')}>
          <FileText className="h-4 w-4" />
          Slide Deck
        </button>
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl overflow-hidden border border-border/30 bg-gradient-to-r from-card/60 to-background/40 p-3">
          <h4 className="text-sm font-semibold mb-2 text-foreground">Preview</h4>
          {flashcards && flashcards.length > 0 ? (
            <div className="rounded-xl bg-black/40 p-4 text-white">
              <div className="text-sm opacity-80">Flashcards • {flashcards.length} cards</div>
              <div className="mt-3 text-lg font-semibold">{flashcards[0].question || 'Card preview'}</div>
              <div className="mt-2 text-xs opacity-80">Press <span className="font-mono">Space</span> to flip</div>
            </div>
          ) : summary ? (
            <div className="text-xs text-muted-foreground max-h-36 overflow-hidden">
              <div className="prose prose-sm dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary?.substring(0, 600) || ""}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Add a source and generate study outputs to view previews here.</p>
          )}
            <div className="mt-3">
              <button className="w-full rounded-md border px-3 py-2 text-sm bg-primary/5 hover:bg-primary/10" onClick={() => onSelectSection?.('flashcards')}>
                Open flashcards
              </button>
            </div>
        </div>

        <div className="rounded-2xl border border-border/30 bg-background/80 px-3 py-2">
          <SummaryAudioControls text={summary || extractedText || ""} title={`Listen to ${title}`} testId="study-summary-audio" />
        </div>

        <div className="rounded-2xl border border-border/30 bg-background/80 px-3 py-2">
          <NotesChatbot id={id} summary={summary} extractedText={extractedText} />
        </div>
      </div>
    </div>
  );
}

