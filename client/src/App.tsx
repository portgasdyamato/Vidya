import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/lib/theme";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AudioProvider } from "./lib/AudioContext";
import PersistentAudioPlayer from "@/components/audio/PersistentAudioPlayer";
import Home from "@/pages/home";
import History from "@/pages/history";
import StudyPage from "@/pages/study";
import Workspace from "@/pages/workspace";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/history" component={History} />
      <Route path="/workspace" component={Workspace} />
      <Route path="/study/:id" component={StudyPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AudioProvider>
          <Router />
          <PersistentAudioPlayer />
        </AudioProvider>
      </TooltipProvider>
    </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
