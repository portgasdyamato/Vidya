import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Video, Link } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function VideoUpload() {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [generateAudio, setGenerateAudio] = useState(true);
  const [generateSummary, setGenerateSummary] = useState(true);
  const [generateQuiz, setGenerateQuiz] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/content/video", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Processing started",
        description: "Your video is being transcribed. Check back soon for results.",
      });
      setUrl("");
      setTitle("");
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
    },
    onError: (error: any) => {
      toast({
        title: "Processing failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async () => {
    if (!url.trim()) {
      toast({
        title: "No URL provided",
        description: "Please enter a video URL.",
        variant: "destructive",
      });
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid video URL.",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate({
      url,
      title: title || "Video Content",
      processingOptions: {
        generateAudio,
        generateSummary,
        generateQuiz,
      },
    });
  };

  const isYouTubeUrl = (url: string) => {
    return url.includes("youtube.com") || url.includes("youtu.be");
  };

  return (
    <Card className="border border-border shadow-lg">
      <CardContent className="p-8">
        <h3 className="text-2xl font-semibold text-card-foreground mb-6">Process Video Content</h3>
        
        {/* URL Input */}
        <div className="mb-6">
          <Label htmlFor="video-url" className="text-base font-medium">Video URL</Label>
          <div className="relative mt-2">
            <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              id="video-url"
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="pl-10"
              data-testid="input-video-url"
            />
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Supports YouTube, Vimeo, and other video platforms
          </p>
          
          {url && isYouTubeUrl(url) && (
            <div className="mt-3 p-3 bg-primary/10 rounded-lg">
              <p className="text-sm text-primary font-medium">
                ✓ YouTube URL detected - ready for transcription
              </p>
            </div>
          )}
        </div>

        {/* Title Input */}
        <div className="mb-8">
          <Label htmlFor="video-title" className="text-base font-medium">Title (Optional)</Label>
          <Input
            id="video-title"
            type="text"
            placeholder="Enter a custom title for this video"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-2"
            data-testid="input-title-videos"
          />
        </div>

        {/* Processing Options */}
        <div className="mb-8">
          <h4 className="text-lg font-semibold text-card-foreground mb-4">Processing Options</h4>
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="audio-video"
                checked={generateAudio}
                onCheckedChange={(checked) => setGenerateAudio(!!checked)}
                data-testid="checkbox-audio-videos"
              />
              <div>
                <Label htmlFor="audio-video" className="font-medium">Convert Transcript to Audio</Label>
                <p className="text-sm text-muted-foreground">
                  Generate audio version of the transcribed content
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Checkbox
                id="summary-video"
                checked={generateSummary}
                onCheckedChange={(checked) => setGenerateSummary(!!checked)}
                data-testid="checkbox-summary-videos"
              />
              <div>
                <Label htmlFor="summary-video" className="font-medium">Create Summary</Label>
                <p className="text-sm text-muted-foreground">
                  Generate a concise summary of the video content
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Checkbox
                id="quiz-video"
                checked={generateQuiz}
                onCheckedChange={(checked) => setGenerateQuiz(!!checked)}
                data-testid="checkbox-quiz-videos"
              />
              <div>
                <Label htmlFor="quiz-video" className="font-medium">Generate Quiz</Label>
                <p className="text-sm text-muted-foreground">
                  Create questions based on the video transcript
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Process Button */}
        <div className="text-center">
          <Button
            onClick={handleSubmit}
            disabled={!url.trim() || uploadMutation.isPending}
            className="btn-primary px-8 py-4 text-lg font-semibold"
            data-testid="button-process-videos"
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="inline-block w-5 h-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Video className="inline-block w-5 h-5 mr-2" />
                Process Video
              </>
            )}
          </Button>
        </div>

        {/* Info Box */}
        <div className="mt-8 p-4 bg-muted rounded-lg">
          <h5 className="font-medium text-card-foreground mb-2">How it works:</h5>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• We extract audio from the video using advanced AI</li>
            <li>• Whisper API transcribes the speech to accurate text</li>
            <li>• GPT-4 processes the content for summaries and quizzes</li>
            <li>• Text-to-speech creates accessible audio versions</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
