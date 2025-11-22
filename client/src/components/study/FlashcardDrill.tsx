import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";

interface Flashcard {
  question?: string;
  answer?: string;
  options?: string[];
  correctAnswer?: number;
}

export default function FlashcardDrill({ flashcards }: { flashcards?: Flashcard[] }) {
  const cards = flashcards || [];
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "ArrowRight") {
        setIndex((i) => Math.min(cards.length - 1, i + 1));
        setFlipped(false);
      } else if (e.key === "ArrowLeft") {
        setIndex((i) => Math.max(0, i - 1));
        setFlipped(false);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cards.length]);

  useEffect(() => {
    // focus container so keyboard works immediately
    containerRef.current?.focus();
  }, [index]);

  if (!cards || cards.length === 0) {
    return <div className="rounded-2xl border border-border/30 bg-card/60 p-6 text-sm text-muted-foreground">No flashcards available.</div>;
  }

  const card = cards[index];

  return (
    <div ref={containerRef} tabIndex={0} className="outline-none" aria-roledescription="Flashcard drill">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground">Card {index + 1} / {cards.length}</div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground">Press Space to flip</div>
        </div>
      </div>

      <div className="relative mx-auto max-w-3xl">
        <div className="h-60 w-full md:h-72">
          <div
            className="relative h-full w-full perspective-1000"
            style={{ perspective: 1000 }}
          >
            <div
              className="relative h-full w-full rounded-2xl shadow-xl bg-gradient-to-br from-card/80 to-background/60 p-6 flex items-center justify-center text-center text-white transition-transform duration-500"
              style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
            >
              {/* front */}
              <div
                className="absolute inset-0 backface-hidden flex items-center justify-center"
                style={{ WebkitBackfaceVisibility: 'hidden', backfaceVisibility: 'hidden' }}
              >
                <div>
                  <div className="text-lg md:text-2xl font-semibold">{card.question || 'Untitled'}</div>
                </div>
              </div>

              {/* back */}
              <div
                className="absolute inset-0 backface-hidden flex items-center justify-center rotate-y-180"
                style={{ transform: 'rotateY(180deg)', WebkitBackfaceVisibility: 'hidden', backfaceVisibility: 'hidden' }}
              >
                <div>
                  {card.options ? (
                    <ul className="space-y-2 text-left">
                      {card.options.map((o, i) => (
                        <li key={i} className={`${i === (card.correctAnswer ?? -1) ? 'font-semibold text-primary' : ''}`}>{o}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-base">{card.answer || 'No answer provided'}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setIndex((i) => Math.max(0, i - 1)); setFlipped(false); }}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={() => setFlipped((f) => !f)}>
              {flipped ? 'Hide answer' : 'Show answer'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setIndex((i) => Math.min(cards.length - 1, i + 1)); setFlipped(false); }}>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="text-sm text-muted-foreground">Use ← / → to navigate</div>
        </div>
      </div>
    </div>
  );
}
