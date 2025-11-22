import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import remarkGfm from "remark-gfm";
import SummaryAudioControls from "./SummaryAudioControls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Download, Share2 } from "lucide-react";
import { parseSummary } from "@/lib/summaryUtils";

interface Flashcard {
  question?: string;
  answer?: string;
  options?: string[];
  correctAnswer?: number;
}

interface SummaryPanelProps {
  summary: string;
  title: string;
  flashcards?: Flashcard[];
  summaryTestId?: string;
  previewOnly?: boolean;
  itemId?: string;
}

export default function SummaryPanel({ summary, title, summaryTestId, previewOnly, itemId }: SummaryPanelProps) {
  let summaryText = summary;
  // Try to parse JSON and extract summary_markdown
  try {
    const parsed = JSON.parse(summaryText);
    if (parsed && typeof parsed.summary_markdown === 'string') {
      summaryText = parsed.summary_markdown;
    }
  } catch (e) {
    // Not JSON, use as-is
  }
  // Replace INLINE_MATH: and similar placeholders with proper code blocks
  summaryText = summaryText.replace(/`?INLINE_MATH:([^`\n]+)`?/g, (match, expr) => {
    return `\n\n\`\`\`math\n${expr.trim()}\n\`\`\`\n\n`;
  });
  summaryText = summaryText.replace(/```\s*(math|latex)\s*\n([\s\S]*?)\n```/gi, (match, expr) => {
    return `\n\n$$\n${expr.trim()}\n$$\n\n`;
  });

  // Ensure balanced $$ delimiters
  const dollarPairs = (summaryText.match(/\$\$/g) || []).length;
  if (dollarPairs % 2 !== 0) {
    const lastIndex = summaryText.lastIndexOf('$$');
    if (lastIndex !== -1) {
      summaryText = summaryText.slice(0, lastIndex) + summaryText.slice(lastIndex).replace('$$', '');
    }
  }

  // Adjust markdown components for consistent styling
  const markdownComponents = useMemo(
    () => ({
      h1: (props: any) => <h3 className="text-2xl font-bold text-primary mb-3" {...props} />,
      h2: (props: any) => (
        <h4 className="mt-6 border-l-4 border-primary/30 pl-3 text-xl font-semibold text-foreground" {...props} />
      ),
      h3: (props: any) => <h5 className="mt-4 text-lg font-semibold text-foreground" {...props} />,
      p: (props: any) => <p className="mb-3 text-sm leading-relaxed text-muted-foreground" {...props} />,
      ul: (props: any) => <ul className="ml-5 list-disc space-y-2 text-sm text-foreground" {...props} />,
      ol: (props: any) => <ol className="ml-5 list-decimal space-y-2 text-sm text-foreground" {...props} />,
      li: (props: any) => <li className="leading-relaxed" {...props} />,
      strong: (props: any) => <span className="font-semibold text-foreground" {...props} />,
      math: (props: any) => <span className="katex-inline" {...props} />,
      blockMath: (props: any) => <div className="katex-block" {...props} />,
    }),
    []
  );

  // Format summary and key points as chat bubbles
  const keyPoints = summaryText
    .split(/\n|\r|\r\n/)
    .filter((line) => line.trim().length > 0 && !/^#+/.test(line))
    .slice(0, 4)
    .map((line, i) => `${i + 1}. ${line.trim()}`)
    .join("\n");

  return (
    <Card className="border border-border/60 bg-card/60">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="text-2xl font-semibold text-foreground">AI Summary</CardTitle>
            <p className="text-sm text-muted-foreground">
              Structured highlights with clear headings, subpoints, and bold callouts.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <SummaryAudioControls text={summary} title={`Listen to summary of ${title}`} testId={summaryTestId} />
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => navigator.clipboard?.writeText(summary || "") } aria-label="Copy summary">
                <Copy className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => {
                const blob = new Blob([summary || ""], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${(title || 'summary').replace(/[^a-z0-9-_]/gi,'_')}.md`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
              }} aria-label="Download summary">
                <Download className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => {
                const shareUrl = itemId ? `${location.origin}/study/${itemId}` : location.href;
                if ((navigator as any).share) {
                  (navigator as any).share({ title: `Summary: ${title}`, url: shareUrl }).catch(() => {});
                } else {
                  navigator.clipboard?.writeText(shareUrl);
                }
              }} aria-label="Share summary">
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          {summaryText && (
              <div className="rounded-lg p-3 bg-primary/10 text-primary-foreground">
                <div className="text-xs font-semibold uppercase tracking-wide mb-1">Study AI</div>
                <div className="text-sm">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {summaryText}
                  </ReactMarkdown>
                </div>
              </div>
          )}
          {keyPoints && (
            <div className="rounded-lg p-3 bg-primary/10 text-primary-foreground">
              <div className="text-xs font-semibold uppercase tracking-wide mb-1">Key Points (Simple)</div>
              <p className="text-sm whitespace-pre-line">{keyPoints}</p>
            </div>
          )}
        </div>
        {/* flashcards intentionally not rendered here — they belong in the Flashcards section */}
      </CardContent>
    </Card>
  );
}

function FlashcardItem({ card, index }: { card: Flashcard; index: number }) {
  const [showAnswer, setShowAnswer] = useState(false);

  const isMultipleChoice = Array.isArray(card.options) && card.options.length > 0;
  const answerText = isMultipleChoice
    ? card.options?.[card.correctAnswer ?? 0] ?? card.options?.[0] ?? "No answer provided"
    : card.answer || "No answer provided";

  return (
    <div className="h-full">
      <button
        type="button"
        onClick={() => setShowAnswer((prev) => !prev)}
        className={`group w-full h-full rounded-2xl border border-border/50 bg-muted/40 p-4 text-left transition-transform transform ${showAnswer ? 'scale-[1.01]' : ''} hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40`}
        data-testid={`flashcard-${index}`}
        aria-expanded={showAnswer}
      >
        <div className="text-xs font-semibold uppercase tracking-wide text-primary/80">Card {index + 1}</div>
        <div className="mt-2 text-sm font-semibold text-foreground">{card.question || "Untitled concept"}</div>
        <div className={`mt-3 text-sm text-muted-foreground transition-max-height duration-300 overflow-hidden ${showAnswer ? 'max-h-96' : 'max-h-0'}`}>
          {isMultipleChoice && card.options ? (
            <ul className="list-disc pl-5 space-y-1 text-xs">
              {card.options.map((option, idx) => (
                <li key={idx} className={idx === (card.correctAnswer ?? -1) ? 'font-semibold text-primary' : ''}>{option}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm">{card.answer || 'No answer provided'}</p>
          )}
        </div>
        <div className="mt-3 inline-flex items-center text-xs font-medium text-primary/80">
          {showAnswer ? 'Hide answer' : 'Reveal answer'}
          <svg className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-1" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </button>
    </div>
  );
}

