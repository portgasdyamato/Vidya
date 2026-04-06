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
}

export default function FlashcardDrill({ flashcards }: FlashcardDrillProps) {
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
      score >= 90 ? { emoji: "🏆", label: "Mastered!", color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20" } :
      score >= 70 ? { emoji: "🎯", label: "Excellent!", color: "text-primary", bg: "bg-primary/10 border-primary/20" } :
      score >= 50 ? { emoji: "📚", label: "Keep Going!", color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" } :
      { emoji: "💪", label: "Practice More", color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/20" };

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl mx-auto text-center space-y-8 py-8"
      >
        <div className={`inline-flex flex-col items-center gap-4 px-12 py-10 rounded-3xl border ${grade.bg}`}>
          <span className="text-6xl">{grade.emoji}</span>
          <div>
            <h2 className="text-3xl font-black text-white font-serif">{grade.label}</h2>
            <p className="text-white/50 mt-1">You scored {score}% on this deck</p>
          </div>
          <div className={`text-5xl font-black font-mono ${grade.color}`}>{score}%</div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Cards", value: total, icon: BookOpen, color: "text-white" },
            { label: "Correct", value: correctCount, icon: CheckCircle2, color: "text-green-400" },
            { label: "Needs Review", value: wrongCount, icon: XCircle, color: "text-orange-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="p-5 rounded-2xl bg-white/5 border border-white/5 flex flex-col items-center gap-2">
              <Icon className={`w-6 h-6 ${color}`} />
              <span className={`text-2xl font-black ${color}`}>{value}</span>
              <span className="text-xs text-white/40 font-medium">{label}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-4 justify-center">
          <Button
            onClick={restart}
            className="flex items-center gap-2 px-8 py-3 h-auto bg-primary hover:bg-primary/90 text-white font-bold rounded-2xl shadow-lg shadow-primary/20"
          >
            <RotateCcw className="w-4 h-4" />
            Study Again
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setCurrentIndex(0);
              setIsFlipped(false);
              setCompleted(false);
            }}
            className="flex items-center gap-2 px-8 py-3 h-auto border-white/10 hover:bg-white/5 text-white rounded-2xl"
          >
            <Eye className="w-4 h-4" />
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
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-white/40 font-bold uppercase tracking-wider">Card {currentIndex + 1} of {total}</p>
            <p className="text-sm font-bold text-white">Flashcard Drill</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
            <CheckCircle2 className="w-3 h-3 text-green-400" />
            <span className="text-xs font-bold text-green-400">{correctCount}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20">
            <XCircle className="w-3 h-3 text-orange-400" />
            <span className="text-xs font-bold text-orange-400">{wrongCount}</span>
          </div>
        </div>
      </div>

      <Progress value={progress} className="h-1.5 bg-white/5" />

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
                <BookOpen className="w-3 h-3 text-white/40" />
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Question</span>
              </div>
              {cardResult ? (
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-widest ${cardResult === "correct" ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-orange-500/10 border-orange-500/20 text-orange-400"}`}>
                  {cardResult === "correct" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
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

            <div className="flex items-center justify-center gap-2 text-white/20 text-[10px] font-bold uppercase tracking-widest">
              <Zap className="w-3 h-3" />
              Tap to flip
            </div>
          </div>

          {/* Back Face */}
          <div
            className="absolute inset-0 rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/8 to-transparent p-10 flex flex-col justify-between overflow-hidden"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 w-fit">
              <Target className="w-3 h-3 text-primary" />
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Answer</span>
            </div>

            <div className="flex-1 flex items-center justify-center py-8 relative z-10">
              <p className="text-base md:text-lg text-white/80 text-center leading-relaxed">
                {current.answer}
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-primary/40 text-[10px] font-bold uppercase tracking-widest">
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
          className="w-12 h-12 rounded-2xl border border-white/8 hover:bg-white/5 text-white/50 disabled:opacity-30"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        {isFlipped ? (
          <div className="flex-1 flex gap-3">
            <Button
              onClick={() => goNext("wrong")}
              className="flex-1 h-12 rounded-2xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 text-orange-300 font-bold gap-2"
            >
              <XCircle className="w-4 h-4" />
              Need to Review
            </Button>
            <Button
              onClick={() => goNext("correct")}
              className="flex-1 h-12 rounded-2xl bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-300 font-bold gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
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
              className="h-12 w-12 rounded-2xl border border-white/8 hover:bg-white/5 text-white/50"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={() => goNext()}
          disabled={currentIndex === total - 1}
          className="w-12 h-12 rounded-2xl border border-white/8 hover:bg-white/5 text-white/50 disabled:opacity-30"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
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
