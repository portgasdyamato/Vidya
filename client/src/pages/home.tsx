import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DocumentUpload from "@/components/upload/DocumentUpload";
import ImageUpload from "@/components/upload/ImageUpload";
import VideoUpload from "@/components/upload/VideoUpload";
import { Card } from "@/components/ui/card";
import { FileText, Image, Video } from "lucide-react";

type TabType = "documents" | "images" | "videos";

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>("documents");

  const renderUploadComponent = () => {
    switch (activeTab) {
      case "documents":
        return <DocumentUpload />;
      case "images":
        return <ImageUpload />;
      case "videos":
        return <VideoUpload />;
      default:
        return <DocumentUpload />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main id="main-content" role="main">
        {/* Hero Section */}
        <section className="gradient-bg py-20" aria-labelledby="hero-heading">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 id="hero-heading" className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
              AI-Powered Learning
              <span className="block">for Everyone</span>
            </h1>
            <p className="text-xl text-white/90 mb-8 max-w-3xl mx-auto leading-relaxed">
              Transform documents, images, and videos into accessible content. Project Vidya makes learning materials available to students with visual or hearing impairments through advanced AI technology.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <a 
                href="#upload" 
                className="bg-white text-primary px-8 py-4 rounded-lg text-xl font-semibold hover:bg-gray-50 transition-colors focus-ring inline-flex items-center min-w-48"
                data-testid="link-start-learning"
              >
                Start Learning Now
                <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                </svg>
              </a>
              <a 
                href="#how-it-works" 
                className="text-white border-2 border-white px-8 py-4 rounded-lg text-xl font-semibold hover:bg-white hover:text-primary transition-colors focus-ring min-w-48"
                data-testid="link-how-it-works"
              >
                See How It Works
              </a>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-20 bg-muted" aria-labelledby="features-heading">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 id="features-heading" className="text-4xl font-bold text-foreground mb-4">
                Powerful Accessibility Features
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Our AI-powered platform transforms traditional learning materials into accessible formats for all students.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  title: "Document Processing",
                  description: "Upload PDFs and DOCX files to extract text and convert to high-quality audio. Perfect for reading assignments and study materials.",
                  icon: FileText
                },
                {
                  title: "Image Recognition", 
                  description: "Take photos of textbook pages and get detailed descriptions of images, diagrams, and charts using GPT-4 Vision API.",
                  icon: Image
                },
                {
                  title: "Video Transcription",
                  description: "Paste YouTube links or video URLs to get accurate transcriptions using Whisper API, making lectures accessible to deaf students.",
                  icon: Video
                }
              ].map((feature, index) => (
                <Card key={index} className="p-8 card-hover border border-border" role="article">
                  <div className="w-16 h-16 bg-gradient-to-br from-primary to-blue-600 rounded-lg flex items-center justify-center mb-6">
                    <feature.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-semibold text-card-foreground mb-4">{feature.title}</h3>
                  <p className="text-muted-foreground text-lg leading-relaxed">
                    {feature.description}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-20 bg-background" aria-labelledby="how-it-works-heading">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 id="how-it-works-heading" className="text-4xl font-bold text-foreground mb-4">
                How Project Vidya Works
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Simple steps to transform any learning material into accessible content
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-12">
              {[
                {
                  step: "1",
                  title: "Upload Content",
                  description: "Upload documents (PDF, DOCX), images of textbook pages, or paste video links from YouTube or other platforms."
                },
                {
                  step: "2", 
                  title: "AI Processing",
                  description: "Our AI analyzes your content using GPT-4 Vision, Whisper, and advanced language models to extract and understand information."
                },
                {
                  step: "3",
                  title: "Get Results", 
                  description: "Receive accessible output including audio, text descriptions, summaries, and interactive quizzes tailored to your needs."
                }
              ].map((step, index) => (
                <div key={index} className="text-center" role="article">
                  <div className="w-20 h-20 bg-gradient-to-br from-primary to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-2xl font-bold text-white">{step.step}</span>
                  </div>
                  <h3 className="text-2xl font-semibold text-foreground mb-4">{step.title}</h3>
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Upload Interface */}
        <section id="upload" className="py-20 bg-muted" aria-labelledby="upload-heading">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 id="upload-heading" className="text-4xl font-bold text-foreground mb-4">
                Start Learning Today
              </h2>
              <p className="text-xl text-muted-foreground">
                Choose how you'd like to upload your learning materials
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mb-12">
              {[
                { id: "documents", label: "Documents", description: "Upload PDF or Word files", icon: FileText },
                { id: "images", label: "Images", description: "Photos of textbook pages", icon: Image },
                { id: "videos", label: "Videos", description: "YouTube and lecture URLs", icon: Video }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`p-8 rounded-xl border-2 text-left hover:shadow-lg transition-all focus-ring ${
                    activeTab === tab.id
                      ? "border-primary bg-card"
                      : "border-border bg-card hover:border-primary"
                  }`}
                  data-testid={`button-tab-${tab.id}`}
                >
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${
                    activeTab === tab.id ? "bg-primary/10" : "bg-muted"
                  }`}>
                    <tab.icon className={`w-6 h-6 ${
                      activeTab === tab.id ? "text-primary" : "text-muted-foreground"
                    }`} />
                  </div>
                  <h3 className="text-xl font-semibold text-card-foreground mb-2">{tab.label}</h3>
                  <p className="text-muted-foreground">{tab.description}</p>
                </button>
              ))}
            </div>

            {/* Upload Component */}
            {renderUploadComponent()}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
