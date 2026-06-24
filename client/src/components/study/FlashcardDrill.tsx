import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Check,
  X,
  Eye,
  Sparkles,
  Trophy,
  BookOpen,
  Target,
  Zap,
} from "lucide-react";

interface Flashcard {
  question: string;
  answer: string;
}

interface FlashcardDrillProps {
  flashcards: Flashcard[];
  contentId?: string;
}

export default function FlashcardDrill({ flashcards, contentId }: FlashcardDrillProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [results, setResults] = useState<Record<number, "correct" | "wrong">>({});
  const [completed, setCompleted] = useState(false);
  const [direction, setDirection] = useState(0);

  const total = flashcards.length;
  const current = flashcards[currentIndex];
  const progress = ((currentIndex) / total) * 100;
  const correctCount = Object.values(results).filter((r) => r === "correct").length;
  const wrongCount = Object.values(results).filter((r) => r === "wrong").length;
  const answeredCount = Object.keys(results).length;

  const goNext = (result?: "correct" | "wrong") => {
    if (result) {
      setResults((prev) => ({ ...prev, [currentIndex]: result }));
      // Report confidence to stats endpoint
      if (contentId) {
        fetch(`/api/content/${contentId}/stats`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            type: 'flashcard_confidence',
            payload: {
              flashcardId: String(currentIndex),
              confidence: result === 'correct' ? 'got_it' : 'need_review'
            }
          })
        }).catch(() => {});
      }
    }

    if (currentIndex === total - 1) {
      if (result) setCompleted(true);
      return;
    }

    setDirection(1);
    setIsFlipped(false);
    setTimeout(() => setCurrentIndex((i) => i + 1), 150);
  };

  const goPrev = () => {
    if (currentIndex === 0) return;
    setDirection(-1);
    setIsFlipped(false);
    setTimeout(() => setCurrentIndex((i) => i - 1), 150);
  };

  const restart = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setResults({});
    setCompleted(false);
  };

  const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  if (completed) {
    const grade =
      score >= 90 ? { emoji: "🏆", label: "Mastered!" } :
      score >= 70 ? { emoji: "⭐", label: "Excellent!" } :
      score >= 50 ? { emoji: "👍", label: "Keep Going!" } :
      { emoji: "💪", label: "Practice More" };

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl mx-auto text-center space-y-8 py-8"
      >
        <div className="inline-flex flex-col items-center gap-4 px-16 py-12 rounded-[32px] bg-white/10 backdrop-blur-xl border border-white/20 shadow-[inset_0_1px_4px_rgba(255,255,255,0.8),0_8px_32px_rgba(0,0,0,0.05)] transition-all">
          <span className="text-6xl">{grade.emoji}</span>
          <div>
            <h2 className="text-4xl font-black text-white font-serif mb-2">{grade.label}</h2>
            <p className="text-white font-medium">You scored {score}% on this deck</p>
          </div>
          <div className="text-6xl font-black font-mono text-white mt-2">{score}%</div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Cards", value: total, icon: BookOpen },
            { label: "Correct", value: correctCount, icon: Check },
            { label: "Needs Review", value: wrongCount, icon: X },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="p-6 rounded-[24px] bg-white/10 backdrop-blur-md border border-white/20 shadow-[inset_0_1px_4px_rgba(255,255,255,0.8),0_4px_16px_rgba(0,0,0,0.05)] flex flex-col items-center gap-3 transition-all hover:bg-white/20">
              <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center shadow-md mb-1">
                <Icon className="w-5 h-5 text-white" />
              </div>
              <span className="text-4xl font-black text-white">{value}</span>
              <span className="text-[11px] font-bold tracking-widest uppercase text-white">{label}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-4 justify-center">
          <Button
            onClick={restart}
            className="h-14 px-8 text-base font-semibold rounded-2xl glass-button-primary shadow-2xl transition-all gap-3"
          >
            <RotateCcw className="w-5 h-5" />
            Study Again
          </Button>
          <Button
            onClick={() => {
              setCurrentIndex(0);
              setIsFlipped(false);
              setCompleted(false);
            }}
            className="h-14 px-8 text-base font-semibold rounded-2xl glass-button-primary shadow-2xl transition-all gap-3"
          >
            <Eye className="w-5 h-5" />
            Review Deck
          </Button>
        </div>
      </motion.div>
    );
  }

  const cardResult = results[currentIndex];

  return (
    <div className="max-w-3xl mx-auto space-y-8 select-none">
      {/* Progress & Stats Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Flashcard Drill</h2>
          <p className="text-sm text-white font-medium">Card {currentIndex + 1} of {total}</p>
        </div>
        <div className="flex items-center gap-3 text-sm font-bold">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white backdrop-blur-md shadow-[inset_0_1px_4px_rgba(255,255,255,0.8),0_4px_12px_rgba(0,0,0,0.05)] hover:bg-white/20 transition-all">
            <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center">
              <Check className="w-3 h-3 text-white" />
            </div>
            <span className="font-bold">{correctCount}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white backdrop-blur-md shadow-[inset_0_1px_4px_rgba(255,255,255,0.8),0_4px_12px_rgba(0,0,0,0.05)] hover:bg-white/20 transition-all">
            <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center">
              <X className="w-3 h-3 text-white" />
            </div>
            <span className="font-bold">{wrongCount}</span>
          </div>
        </div>
      </div>

      <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mb-6">
        <div 
          className="h-full bg-primary rounded-full transition-all duration-500 ease-out" 
          style={{ width: `${progress}%` }} 
        />
      </div>

      {/* Card */}
      <div
        className="relative cursor-pointer group"
        style={{ perspective: "1200px" }}
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <motion.div
          style={{
            transformStyle: "preserve-3d",
            rotateY: isFlipped ? 180 : 0,
          }}
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.5, type: "spring", damping: 20 }}
          className="relative w-full"
        >
          {/* Front Face */}
          <div
            className="relative rounded-3xl border border-white/8 bg-gradient-to-br from-white/5 to-transparent p-10 min-h-[300px] flex flex-col justify-between overflow-hidden"
            style={{ backfaceVisibility: "hidden" }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-blue-500/3 pointer-events-none" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/3 blur-[80px] rounded-full pointer-events-none" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/8">
                <BookOpen className="w-3 h-3 text-white" />
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">Question</span>
              </div>
              {cardResult ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-white backdrop-blur-md shadow-[inset_0_1px_4px_rgba(255,255,255,0.8),0_4px_12px_rgba(0,0,0,0.05)] text-[10px] font-bold uppercase tracking-widest">
                  <div className="w-4 h-4 rounded-full bg-black flex items-center justify-center">
                    {cardResult === "correct" ? <Check className="w-2.5 h-2.5 text-white" /> : <X className="w-2.5 h-2.5 text-white" />}
                  </div>
                  {cardResult}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold">
                  <Eye className="w-3 h-3" />
                  Click to reveal
                </div>
              )}
            </div>

            <div className="flex-1 flex items-center justify-center py-8 relative z-10">
              <p className="text-xl md:text-2xl font-bold text-white text-center leading-relaxed font-serif">
                {current.question}
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-white text-[10px] font-bold uppercase tracking-widest">
              <Zap className="w-3 h-3" />
              Tap to flip
            </div>
          </div>

          {/* Back Face */}
          <div
            className="absolute inset-0 rounded-3xl border border-white/8 bg-gradient-to-br from-white/5 to-transparent p-10 flex flex-col justify-between overflow-hidden"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-blue-500/3 pointer-events-none" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/3 blur-[80px] rounded-full pointer-events-none" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/8 w-fit relative z-10">
                <Target className="w-3 h-3 text-white" />
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">Answer</span>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center py-8 relative z-10 overflow-y-auto">
              <p className="text-xl md:text-2xl font-bold text-white text-center leading-relaxed font-serif">
                {current.answer}
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-white text-[10px] font-bold uppercase tracking-widest">
              <RotateCcw className="w-3 h-3" />
              Tap to flip back
            </div>
          </div>
        </motion.div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="w-12 h-12 rounded-2xl border border-white/8 hover:bg-white/5 text-white disabled:opacity-30"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        {isFlipped ? (
          <div className="flex-1 flex gap-3">
            <Button
              onClick={() => goNext("wrong")}
              className="flex-1 h-12 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-bold gap-2 shadow-[inset_0_1px_4px_rgba(255,255,255,0.8),0_4px_16px_rgba(0,0,0,0.05)] transition-all group"
            >
              <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center">
                <X className="w-3 h-3 text-white group-hover:scale-110 transition-transform" />
              </div>
              Need to Review
            </Button>
            <Button
              onClick={() => goNext("correct")}
              className="flex-1 h-12 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-bold gap-2 shadow-[inset_0_1px_4px_rgba(255,255,255,0.8),0_4px_16px_rgba(0,0,0,0.05)] transition-all group"
            >
              <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center">
                <Check className="w-3 h-3 text-white group-hover:scale-110 transition-transform" />
              </div>
              Got It!
            </Button>
          </div>
        ) : (
          <div className="flex-1 flex gap-3">
            <Button
              onClick={() => setIsFlipped(true)}
              className="flex-1 h-12 rounded-2xl bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary font-bold gap-2"
            >
              <Eye className="w-4 h-4" />
              Reveal Answer
            </Button>
            <Button
              onClick={() => goNext()}
              variant="ghost"
              className="h-12 w-12 rounded-2xl border border-white/8 hover:bg-white/5 text-white"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        )}

      </div>

      {/* Card dots navigation */}
      <div className="flex items-center justify-center gap-1.5 flex-wrap">
        {flashcards.map((_, i) => {
          const r = results[i];
          return (
            <button
              key={i}
              onClick={() => { setDirection(i > currentIndex ? 1 : -1); setIsFlipped(false); setTimeout(() => setCurrentIndex(i), 100); }}
              className={`transition-all rounded-full
                ${i === currentIndex ? "w-6 h-2 bg-primary" :
                  r === "correct" ? "w-2 h-2 bg-green-500" :
                  r === "wrong" ? "w-2 h-2 bg-orange-500" :
                  "w-2 h-2 bg-white/15"
                }`}
              title={`Card ${i + 1}`}
            />
          );
        })}
      </div>
    </div>
  );
}
