import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, FileText, CheckCircle2, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

type ProcessingState = {
  id: string;
  title: string;
  status: "pending" | "processing" | "completed" | "failed";
  errorMessage?: string | null;
};

interface DocumentUploadProps {
  onSuccess?: (contentItem: { id: string; title: string; status: string }) => void;
  hideProgress?: boolean; // Hide internal progress when used in workspace
}

export default function DocumentUpload({ onSuccess, hideProgress = false }: DocumentUploadProps = {}) {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [generateAudio, setGenerateAudio] = useState(true);
  const [generateSummary, setGenerateSummary] = useState(true);
  const [generateMindMap, setGenerateMindMap] = useState(true);
  const [generateQuiz, setGenerateQuiz] = useState(false);
  const [processingItem, setProcessingItem] = useState<ProcessingState | null>(null);
  const [progressValue, setProgressValue] = useState(15);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await apiRequest("POST", "/api/content/document", formData);
      return response.json();
    },
    onSuccess: (contentItem) => {
      toast({
        title: "Upload successful",
        description: "Your document is being processed. Check back soon for results.",
      });
      setFiles([]);
      setTitle("");
      setProcessingItem({
        id: contentItem.id,
        title: contentItem.title,
        status: contentItem.status,
      });
      setProgressValue(25);
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      onSuccess?.(contentItem);
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!processingItem || ["completed", "failed"].includes(processingItem.status)) {
      return;
    }

    const { id } = processingItem;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/content/${id}`, {
          credentials: "include",
        });
        if (!response.ok) return;
        const data = await response.json();
        setProcessingItem({
          id: data.id,
          title: data.title,
          status: data.status,
          errorMessage: data.errorMessage,
        });
        setProgressValue((prev) => Math.min(prev + 15, 90));
        if (data.status === "completed" || data.status === "failed") {
          clearInterval(interval);
          setProgressValue(data.status === "completed" ? 100 : 0);
          queryClient.invalidateQueries({ queryKey: ["/api/content"] });
        }
      } catch (error) {
        console.error(error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [processingItem?.status, processingItem?.id, queryClient]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(file => 
      file.type === "application/pdf" || 
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    if (droppedFiles.length > 0) {
      setFiles(droppedFiles);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload PDF or DOCX files only.",
        variant: "destructive",
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = async () => {
    if (files.length === 0) {
      toast({
        title: "No file selected", 
        description: "Please select a file to upload.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", files[0]);
    formData.append("title", title || files[0].name);
    formData.append("processingOptions", JSON.stringify({
      generateAudio,
      generateSummary,
      generateMindMap,
      generateQuiz,
    }));

    uploadMutation.mutate(formData);
  };

  return (
    <Card className="glass-card border border-border rounded-2xl shadow-lg">
      <CardContent className="p-8">
        <h3 className="text-2xl font-semibold text-card-foreground mb-6 font-serif">Upload Your Documents</h3>
        
        {/* File Drop Zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
            dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          data-testid="dropzone-documents"
        >
          <Upload className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h4 className="text-xl font-semibold text-card-foreground mb-2">
            {files.length > 0 ? `${files.length} file(s) selected` : "Drop your files here"}
          </h4>
          <p className="text-muted-foreground mb-4">or click to browse your computer</p>
          <p className="text-sm text-muted-foreground mb-4">Supports PDF and DOCX files up to 10MB</p>
          
          <Input
            type="file"
            className="hidden"
            id="file-upload"
            accept=".pdf,.docx"
            multiple={false}
            onChange={handleFileSelect}
            data-testid="input-file-documents"
          />
          <Button 
            type="button" 
            className="btn-primary cursor-pointer" 
            data-testid="button-choose-files"
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            Choose Files
          </Button>
        </div>

        {/* Selected Files */}
        {files.length > 0 && (
          <div className="mt-6">
            <h4 className="font-semibold text-card-foreground mb-3">Selected Files:</h4>
            {files.map((file, index) => (
                <div key={index} className="flex flex-col gap-2 p-3 bg-primary/5 border border-primary/10 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <FileText className="h-5 w-5 text-primary" />
                       <span className="text-sm font-medium text-foreground truncate max-w-[200px]">{file.name}</span>
                       <span className="text-[10px] text-muted-foreground uppercase">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/10"
                      onClick={() => {
                        toast({
                          title: "Preview Mode",
                          description: `Preparing preview for ${file.name}. Note: Large files may take a moment to render.`,
                        });
                      }}
                    >
                      Preview Source
                    </Button>
                  </div>
                </div>
            ))}
          </div>
        )}

        {/* Title Input */}
        <div className="mt-6">
          <Label htmlFor="title" className="text-base font-medium">Title (Optional)</Label>
          <Input
            id="title"
            type="text"
            placeholder="Enter a custom title for your content"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-2"
            data-testid="input-title-documents"
          />
        </div>

        {/* Processing Options */}
        <div className="mt-8">
          <h4 className="text-lg font-semibold text-card-foreground mb-4">Processing Options</h4>
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="audio"
                checked={generateAudio}
                onCheckedChange={(checked) => setGenerateAudio(!!checked)}
                data-testid="checkbox-audio-documents"
              />
              <div>
                <Label htmlFor="audio" className="font-medium">Convert to Audio</Label>
                <p className="text-sm text-muted-foreground">
                  Generate high-quality speech for visually impaired students
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Checkbox
                id="summary"
                checked={generateSummary}
                onCheckedChange={(checked) => setGenerateSummary(!!checked)}
                data-testid="checkbox-summary-documents"
              />
              <div>
                <Label htmlFor="summary" className="font-medium">Create Summary & Flashcards</Label>
                <p className="text-sm text-muted-foreground">
                  Get structured highlights with bold headings plus ready-to-use flashcards
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Checkbox
                id="mindmap"
                checked={generateMindMap}
                onCheckedChange={(checked) => setGenerateMindMap(!!checked)}
                data-testid="checkbox-mindmap-documents"
              />
              <div>
                <Label htmlFor="mindmap" className="font-medium">Generate Mind Map</Label>
                <p className="text-sm text-muted-foreground">
                  Create an interactive concept map with Mermaid.js
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Checkbox
                id="quiz"
                checked={generateQuiz}
                onCheckedChange={(checked) => setGenerateQuiz(!!checked)}
                data-testid="checkbox-quiz-documents"
              />
              <div>
                <Label htmlFor="quiz" className="font-medium">Generate Quiz</Label>
                <p className="text-sm text-muted-foreground">
                  Create interactive questions to test understanding
                </p>
              </div>
            </div>
          </div>
        </div>

        {processingItem && !hideProgress && (
          <div className="mt-8 rounded-2xl border border-border/60 bg-muted/20 p-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Processing</p>
                <h4 className="text-lg font-semibold text-foreground">{processingItem.title}</h4>
                <p className="text-sm text-muted-foreground">
                  Status:{" "}
                  <span className="font-medium text-primary">
                    {processingItem.status === "completed"
                      ? "Ready to study"
                      : processingItem.status === "failed"
                        ? "Failed"
                        : "Analyzing content"}
                  </span>
                </p>
                {processingItem.errorMessage && (
                  <p className="mt-2 text-xs text-destructive">{processingItem.errorMessage}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {processingItem.status === "completed" ? (
                  <CheckCircle2 className="h-10 w-10 text-primary" />
                ) : processingItem.status === "failed" ? (
                  <AlertTriangle className="h-10 w-10 text-destructive" />
                ) : (
                  <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>
            <Progress value={progressValue} className="mt-4" />
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
              <p className="text-xs text-muted-foreground">
                We'll automatically refresh this status. You can navigate away and come back anytime.
              </p>
              {!onSuccess && (
                <Button asChild disabled={processingItem.status !== "completed"}>
                  <Link href={`/study/${processingItem.id}`}>Continue to Study</Link>
                </Button>
              )}
              {onSuccess && processingItem.status === "completed" && (
                <p className="text-xs text-primary font-medium">
                  ✓ Processing complete! Returning to workspace...
                </p>
              )}
            </div>
          </div>
        )}

        {/* Process Button */}
        <div className="mt-8 text-center">
          <Button
            onClick={handleSubmit}
            disabled={files.length === 0 || uploadMutation.isPending}
            className="btn-primary px-8 py-4 text-lg font-semibold"
            data-testid="button-process-documents"
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="inline-block w-5 h-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <FileText className="inline-block w-5 h-5 mr-2" />
                Process Documents
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
