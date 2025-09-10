import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Image as ImageIcon } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function ImageUpload() {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [generateAudio, setGenerateAudio] = useState(true);
  const [generateSummary, setGenerateSummary] = useState(true);
  const [generateQuiz, setGenerateQuiz] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await apiRequest("POST", "/api/content/image", formData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Upload successful",
        description: "Your image is being processed. Check back soon for results.",
      });
      setFiles([]);
      setTitle("");
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

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
      file.type.startsWith("image/")
    );

    if (droppedFiles.length > 0) {
      setFiles(droppedFiles);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload image files only.",
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
        description: "Please select an image to upload.",
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
      generateQuiz,
    }));

    uploadMutation.mutate(formData);
  };

  return (
    <Card className="border border-border shadow-lg">
      <CardContent className="p-8">
        <h3 className="text-2xl font-semibold text-card-foreground mb-6">Upload Your Images</h3>
        
        {/* File Drop Zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
            dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          data-testid="dropzone-images"
        >
          <Upload className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h4 className="text-xl font-semibold text-card-foreground mb-2">
            {files.length > 0 ? `${files.length} file(s) selected` : "Drop your images here"}
          </h4>
          <p className="text-muted-foreground mb-4">or click to browse your computer</p>
          <p className="text-sm text-muted-foreground mb-4">Supports JPG, PNG, GIF, and other image formats</p>
          
          <Input
            type="file"
            className="hidden"
            id="image-upload"
            accept="image/*"
            multiple={false}
            onChange={handleFileSelect}
            data-testid="input-file-images"
          />
          <Button 
            type="button" 
            className="btn-primary cursor-pointer" 
            data-testid="button-choose-images"
            onClick={() => document.getElementById('image-upload')?.click()}
          >
            Choose Images
          </Button>
        </div>

        {/* Selected Files */}
        {files.length > 0 && (
          <div className="mt-6">
            <h4 className="font-semibold text-card-foreground mb-3">Selected Images:</h4>
            {files.map((file, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <ImageIcon className="h-5 w-5 text-primary" />
                <span className="flex-1 text-sm">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </span>
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
            data-testid="input-title-images"
          />
        </div>

        {/* Processing Options */}
        <div className="mt-8">
          <h4 className="text-lg font-semibold text-card-foreground mb-4">Processing Options</h4>
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="audio-image"
                checked={generateAudio}
                onCheckedChange={(checked) => setGenerateAudio(!!checked)}
                data-testid="checkbox-audio-images"
              />
              <div>
                <Label htmlFor="audio-image" className="font-medium">Convert to Audio</Label>
                <p className="text-sm text-muted-foreground">
                  Generate audio description of the image content
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Checkbox
                id="summary-image"
                checked={generateSummary}
                onCheckedChange={(checked) => setGenerateSummary(!!checked)}
                data-testid="checkbox-summary-images"
              />
              <div>
                <Label htmlFor="summary-image" className="font-medium">Create Summary</Label>
                <p className="text-sm text-muted-foreground">
                  Generate a concise summary of key visual elements
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Checkbox
                id="quiz-image"
                checked={generateQuiz}
                onCheckedChange={(checked) => setGenerateQuiz(!!checked)}
                data-testid="checkbox-quiz-images"
              />
              <div>
                <Label htmlFor="quiz-image" className="font-medium">Generate Quiz</Label>
                <p className="text-sm text-muted-foreground">
                  Create questions based on the image content
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Process Button */}
        <div className="mt-8 text-center">
          <Button
            onClick={handleSubmit}
            disabled={files.length === 0 || uploadMutation.isPending}
            className="btn-primary px-8 py-4 text-lg font-semibold"
            data-testid="button-process-images"
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="inline-block w-5 h-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <ImageIcon className="inline-block w-5 h-5 mr-2" />
                Process Images
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
