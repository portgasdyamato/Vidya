import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, RotateCw, Sparkles } from "lucide-react";

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
  const [isAnimating, setIsAnimating] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleFlip = () => {
    if (isAnimating) return;
    setFlipped((f) => !f);
  };

  const handleNext = () => {
    if (index < cards.length - 1 && !isAnimating) {
      setIndex(i => i + 1);
      setFlipped(false);
    }
  };

  const handlePrev = () => {
    if (index > 0 && !isAnimating) {
      setIndex(i => i - 1);
      setFlipped(false);
    }
  };

  // Handle animation state when flipping
  useEffect(() => {
    if (flipped) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 600);
      return () => clearTimeout(timer);
    } else {
      setIsAnimating(false);
    }
  }, [flipped]);

  // Handle animation state when changing cards
  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 300);
    return () => clearTimeout(timer);
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        handleFlip();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cards.length, index, isAnimating]);

  useEffect(() => {
    containerRef.current?.focus();
  }, [index]);

  if (!cards || cards.length === 0) {
    return (
      <div className="glass-card rounded-2xl border border-border/30 p-8 text-center animate-fade-in">
        <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
        <p className="text-sm text-muted-foreground">No flashcards available.</p>
      </div>
    );
  }

  const card = cards[index];

  return (
    <div ref={containerRef} tabIndex={0} className="outline-none animate-fade-in" aria-roledescription="Flashcard drill">
      <div className="glass-card rounded-xl p-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
            Card {index + 1} / {cards.length}
          </div>
          <div className="h-2 w-48 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary to-blue-500 transition-all duration-300"
              style={{ width: `${((index + 1) / cards.length) * 100}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <kbd className="px-2 py-1 bg-muted rounded text-xs">Space</kbd>
          <span>to flip</span>
        </div>
      </div>

      <div className="relative mx-auto max-w-3xl">
        <div className="h-72 w-full md:h-80">
          <div
            className="relative h-full w-full"
            style={{ perspective: "1000px" }}
          >
            <div
              className={`relative h-full w-full rounded-3xl shadow-2xl glass-card cursor-pointer p-8 flex items-center justify-center transition-transform duration-600 ${
                isAnimating ? 'pointer-events-none' : ''
              }`}
              style={{ 
                transformStyle: 'preserve-3d', 
                transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                transition: 'transform 0.6s cubic-bezier(0.4, 0.0, 0.2, 1)'
              }}
              onClick={handleFlip}
            >
              {/* front */}
              <div
                className="absolute inset-0 backface-hidden flex flex-col items-center justify-center p-8 rounded-3xl bg-gradient-to-br from-primary/20 to-blue-500/20"
                style={{ WebkitBackfaceVisibility: 'hidden', backfaceVisibility: 'hidden' }}
              >
                <Sparkles className="h-8 w-8 text-primary mb-6 animate-pulse-glow" />
                <div className="text-xl md:text-3xl font-bold text-foreground text-center leading-relaxed">
                  {card.question || 'Untitled'}
                </div>
                <div className="mt-6 text-sm text-muted-foreground flex items-center gap-2">
                  <RotateCw className="h-4 w-4" />
                  Click or press Space to reveal answer
                </div>
              </div>

              {/* back */}
              <div
                className="absolute inset-0 backface-hidden flex flex-col items-center justify-center p-8 rounded-3xl bg-gradient-to-br from-green-500/20 to-emerald-500/20"
                style={{ transform: 'rotateY(180deg)', WebkitBackfaceVisibility: 'hidden', backfaceVisibility: 'hidden' }}
              >
                <div className="w-full">
                  {card.options ? (
                    <ul className="space-y-3">
                      {card.options.map((o, i) => (
                        <li 
                          key={i} 
                          className={`px-4 py-3 rounded-xl glass-card text-base transition-all ${
                            i === (card.correctAnswer ?? -1) 
                              ? 'font-semibold text-primary border-2 border-primary shadow-lg scale-105' 
                              : 'text-foreground hover:scale-102'
                          }`}
                        >
                          {o}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-lg md:text-2xl text-foreground text-center leading-relaxed">
                      {card.answer || 'No answer provided'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between glass-card rounded-xl p-4">
          <Button 
            size="lg" 
            variant="ghost" 
            onClick={handlePrev}
            disabled={index === 0}
            className="hover:scale-110 transition-transform disabled:opacity-50"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Button 
            size="lg" 
            onClick={handleFlip}
            className="bg-primary hover:bg-primary/90 hover:scale-105 transition-all shadow-lg"
          >
            <RotateCw className="h-5 w-5 mr-2" />
            {flipped ? 'Hide Answer' : 'Show Answer'}
          </Button>
          <Button 
            size="lg" 
            variant="ghost" 
            onClick={handleNext}
            disabled={index === cards.length - 1}
            className="hover:scale-110 transition-transform disabled:opacity-50"
          >
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>

        <div className="mt-4 text-center text-sm text-muted-foreground">
          Use <kbd className="px-2 py-1 bg-muted rounded text-xs mx-1">←</kbd> and <kbd className="px-2 py-1 bg-muted rounded text-xs mx-1">→</kbd> to navigate
        </div>
      </div>
    </div>
  );
}
