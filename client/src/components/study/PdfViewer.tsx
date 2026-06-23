import React, { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Highlighter, Eraser, MousePointer2, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import { clsx } from 'clsx';

// Initialize PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Point { x: number; y: number; }
interface Stroke {
  points: Point[];
  color: string;
  size: number;
  mode: 'highlight' | 'erase';
}

const COLORS = [
  { name: 'Yellow', value: 'rgba(250, 204, 21, 0.4)' },
  { name: 'Green', value: 'rgba(74, 222, 128, 0.4)' },
  { name: 'Blue', value: 'rgba(96, 165, 250, 0.4)' },
  { name: 'Pink', value: 'rgba(244, 114, 182, 0.4)' },
];

export default function PdfViewer({ url, contentItemId }: { url: string, contentItemId?: string }) {
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState(1.2);
  const [mode, setMode] = useState<'pan' | 'highlight' | 'erase'>('pan');
  const [color, setColor] = useState(COLORS[0].value);
  
  // Store strokes per page
  const [strokes, setStrokes] = useState<Record<number, Stroke[]>>({});

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  return (
    <div className="flex flex-col h-full bg-black/40 rounded-2xl overflow-hidden border border-border/50 relative">
      {/* Floating Toolbar */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 p-2 bg-card/90 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl">
        <button
          onClick={() => setMode('pan')}
          className={clsx("p-2.5 rounded-full transition-all", mode === 'pan' ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-white/10")}
          title="Pan & Scroll"
        >
          <MousePointer2 className="w-4 h-4" />
        </button>
        <div className="w-px h-6 bg-white/10 mx-1" />
        <button
          onClick={() => setMode('highlight')}
          className={clsx("p-2.5 rounded-full transition-all flex items-center gap-2", mode === 'highlight' ? "bg-white/10 text-white shadow-inner" : "text-muted-foreground hover:bg-white/5")}
          title="Highlighter"
        >
          <Highlighter className="w-4 h-4" />
        </button>
        {mode === 'highlight' && (
          <div className="flex items-center gap-1.5 ml-1 mr-2 animate-in fade-in slide-in-from-left-2">
            {COLORS.map(c => (
              <button
                key={c.name}
                onClick={() => setColor(c.value)}
                className={clsx("w-5 h-5 rounded-full border-2 transition-all", color === c.value ? "border-white scale-110 shadow-lg" : "border-transparent hover:scale-110")}
                style={{ backgroundColor: c.value.replace('0.4', '1') }}
              />
            ))}
          </div>
        )}
        <div className="w-px h-6 bg-white/10 mx-1" />
        <button
          onClick={() => setMode('erase')}
          className={clsx("p-2.5 rounded-full transition-all", mode === 'erase' ? "bg-destructive/20 text-destructive border border-destructive/30" : "text-muted-foreground hover:bg-white/10")}
          title="Eraser"
        >
          <Eraser className="w-4 h-4" />
        </button>
        <div className="w-px h-6 bg-white/10 mx-1" />
        <button
          onClick={() => setScale(s => Math.max(0.5, s - 0.2))}
          className="p-2.5 rounded-full transition-all text-muted-foreground hover:bg-white/10"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="flex items-center justify-center min-w-[3rem] text-xs font-medium text-muted-foreground">
          {Math.round(scale * 100)}%
        </div>
        <button
          onClick={() => setScale(s => Math.min(3.0, s + 0.2))}
          className="p-2.5 rounded-full transition-all text-muted-foreground hover:bg-white/10"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto w-full custom-scrollbar relative" style={{ touchAction: mode === 'pan' ? 'auto' : 'none' }}>
        <div className="mx-auto w-fit py-20 px-8 flex flex-col gap-8">
          <Document
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex flex-col items-center gap-4 text-muted-foreground py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p>Loading document...</p>
              </div>
            }
            error={
              <div className="text-destructive p-8 bg-destructive/10 rounded-xl border border-destructive/20">
                Failed to load PDF. Please make sure the file is valid.
              </div>
            }
          >
            {Array.from(new Array(numPages), (el, index) => (
              <PdfPage
                key={`page_${index + 1}`}
                pageNumber={index + 1}
                scale={scale}
                mode={mode}
                color={color}
                strokes={strokes[index + 1] || []}
                setStrokes={(newStrokes) => setStrokes(prev => ({ ...prev, [index + 1]: newStrokes }))}
                contentItemId={contentItemId}
              />
            ))}
          </Document>
        </div>
      </div>
    </div>
  );
}

function PdfPage({ 
  pageNumber, 
  scale, 
  mode, 
  color, 
  strokes, 
  setStrokes,
  contentItemId
}: { 
  pageNumber: number, 
  scale: number, 
  mode: 'pan' | 'highlight' | 'erase', 
  color: string,
  strokes: Stroke[],
  setStrokes: (s: Stroke[]) => void,
  contentItemId?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [hasTrackedRead, setHasTrackedRead] = useState(false);

  useEffect(() => {
    if (!containerRef.current || hasTrackedRead || !contentItemId) return;
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Page is in view, we consider it "read" after 1 second of visibility
          setTimeout(() => {
            if (entry.target.getBoundingClientRect().top < window.innerHeight && entry.target.getBoundingClientRect().bottom > 0) {
              setHasTrackedRead(true);
              fetch(`/api/content/${contentItemId}/stats`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ type: 'page_read', payload: { page: pageNumber } })
              }).catch(() => {});
            }
          }, 1000);
        }
      });
    }, { threshold: 0.5 }); // require 50% of page to be visible
    
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [hasTrackedRead, contentItemId, pageNumber]);

  // Redraw canvas whenever strokes or scale changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const drawStroke = (stroke: Stroke) => {
      if (stroke.points.length === 0) return;
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.globalCompositeOperation = stroke.mode === 'erase' ? 'destination-out' : 'multiply';
      
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    };

    strokes.forEach(drawStroke);
    if (currentStroke) drawStroke(currentStroke);
  }, [strokes, currentStroke, scale]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    // Adjust for canvas logical size vs display size if necessary
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (mode === 'pan') return;
    if (e.cancelable) e.preventDefault(); // Stop scrolling while drawing
    setIsDrawing(true);
    const coords = getCoordinates(e);
    setCurrentStroke({
      points: [coords],
      color: mode === 'erase' ? 'rgba(0,0,0,1)' : color,
      size: mode === 'erase' ? 40 : 20 * scale,
      mode: mode
    });
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || mode === 'pan' || !currentStroke) return;
    if (e.cancelable) e.preventDefault();
    const coords = getCoordinates(e);
    setCurrentStroke({
      ...currentStroke,
      points: [...currentStroke.points, coords]
    });
  };

  const handleEnd = () => {
    if (!isDrawing || !currentStroke) return;
    setIsDrawing(false);
    setStrokes([...strokes, currentStroke]);
    setCurrentStroke(null);
    
    // Fire annotation added stat if we actually highlighted something (not erased)
    if (currentStroke.mode === 'highlight' && contentItemId) {
      fetch(`/api/content/${contentItemId}/stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: 'annotation_added' })
      }).catch(() => {});
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative mb-8 shadow-2xl bg-white rounded-md overflow-hidden"
      style={{ cursor: mode === 'pan' ? 'grab' : (mode === 'erase' ? 'crosshair' : 'text') }}
    >
      <Page 
        pageNumber={pageNumber} 
        scale={scale} 
        renderTextLayer={true}
        renderAnnotationLayer={false}
        loading={<div className="w-[600px] h-[800px] bg-white/5 animate-pulse rounded-md" />}
        onRenderSuccess={() => {
          // Sync canvas size with rendered page size
          if (containerRef.current && canvasRef.current) {
            const pageEl = containerRef.current.querySelector('.react-pdf__Page__canvas');
            if (pageEl) {
              canvasRef.current.width = (pageEl as HTMLCanvasElement).width;
              canvasRef.current.height = (pageEl as HTMLCanvasElement).height;
            }
          }
        }}
      />
      {/* Drawing Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-20 w-full h-full"
        style={{ touchAction: mode === 'pan' ? 'auto' : 'none', pointerEvents: mode === 'pan' ? 'none' : 'auto' }}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
        onTouchCancel={handleEnd}
      />
    </div>
  );
}
