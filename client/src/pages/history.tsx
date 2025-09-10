import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AudioPlayer from "@/components/AudioPlayer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Download, Play, FileText, Image, Video } from "lucide-react";
import type { ContentItem } from "@shared/schema";

export default function History() {
  const { data: contentItems, isLoading, error } = useQuery<ContentItem[]>({
    queryKey: ["/api/content"],
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "document": return FileText;
      case "image": return Image;
      case "video": return Video;
      default: return FileText;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: "default",
      processing: "secondary", 
      pending: "outline",
      failed: "destructive"
    } as const;
    
    return <Badge variant={variants[status as keyof typeof variants] || "outline"}>{status}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2 mb-4" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <p>Failed to load content history. Please try again.</p>
              </div>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">Your Learning History</h1>
          <p className="text-xl text-muted-foreground">
            Access your previously processed materials anytime
          </p>
        </div>

        {!contentItems || contentItems.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No content yet</h3>
              <p className="text-muted-foreground mb-4">
                Upload your first document, image, or video to get started
              </p>
              <Button asChild>
                <a href="/#upload" data-testid="link-start-uploading">Start Uploading</a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {contentItems.map((item) => {
              const TypeIcon = getTypeIcon(item.type);
              
              return (
                <Card key={item.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <TypeIcon className="h-5 w-5 text-muted-foreground" />
                          <h3 className="font-semibold text-card-foreground" data-testid={`text-title-${item.id}`}>
                            {item.title}
                          </h3>
                        </div>
                        
                        <p className="text-muted-foreground text-sm mb-3">
                          {item.type.charAt(0).toUpperCase() + item.type.slice(1)} • 
                          {" "}Processed {new Date(item.createdAt).toLocaleDateString()}
                        </p>
                        
                        <div className="flex flex-wrap gap-2 mb-4">
                          {getStatusBadge(item.status)}
                          {item.audioUrl && (
                            <Badge variant="secondary" data-testid={`badge-audio-${item.id}`}>
                              Audio Available
                            </Badge>
                          )}
                          {item.summary && (
                            <Badge variant="outline" data-testid={`badge-summary-${item.id}`}>
                              Summary Available
                            </Badge>
                          )}
                          {item.quizData && Array.isArray(item.quizData) && (item.quizData as any[]).length > 0 && (
                            <Badge variant="outline" data-testid={`badge-quiz-${item.id}`}>
                              Quiz Generated
                            </Badge>
                          )}
                        </div>

                        {item.status === "failed" && item.errorMessage && (
                          <div className="flex items-center gap-2 text-destructive text-sm mb-4">
                            <AlertCircle className="h-4 w-4" />
                            <span>{item.errorMessage}</span>
                          </div>
                        )}

                        {item.summary && (
                          <div className="mb-4">
                            <h4 className="font-medium text-card-foreground mb-2">Summary:</h4>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {item.summary}
                            </p>
                          </div>
                        )}

                        {item.audioUrl && (
                          <div className="mb-4">
                            <AudioPlayer 
                              audioUrl={`/api/content/${item.id}/audio`}
                              title={item.title}
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 ml-4">
                        {item.audioUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            data-testid={`button-play-${item.id}`}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`button-download-${item.id}`}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
