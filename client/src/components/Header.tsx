import { Link, useLocation } from "wouter";
import { useTheme } from "@/lib/theme";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Header() {
  const { theme, toggle } = useTheme();
  const [location] = useLocation();
  const isWorkspace = location === "/workspace" || location.startsWith("/study");

  if (isWorkspace) {
    return (
      <header className="border-b border-border bg-background h-16 flex items-center justify-between px-4" role="banner">
        <Link href="/">
          <h1 className="text-xl font-bold text-foreground cursor-pointer" data-testid="link-home">
            <span className="text-primary">Project</span> Vidya
          </h1>
        </Link>
      </header>
    );
  }

  return (
    <header className="border-b border-border bg-background" role="banner">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" role="navigation" aria-label="Main navigation">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-4">
            <Link href="/">
              <h1 className="text-2xl font-bold text-foreground cursor-pointer" data-testid="link-home">
                <span className="text-primary">Project</span> Vidya
              </h1>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={toggle} aria-label="Toggle theme" className="p-2 rounded-full hover:bg-primary/10 transition-colors hidden md:inline-flex">
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
          <div className="hidden md:block ml-6">
            <div className="ml-10 flex items-baseline space-x-4">
              <a 
                href="/#features" 
                className="text-muted-foreground hover:text-foreground px-3 py-2 rounded-md text-lg font-medium focus-ring"
                data-testid="link-features"
              >
                Features
              </a>
              <a 
                href="/#how-it-works" 
                className="text-muted-foreground hover:text-foreground px-3 py-2 rounded-md text-lg font-medium focus-ring"
                data-testid="link-how-it-works"
              >
                How It Works
              </a>
              <Link href="/history">
                <Button 
                  variant={location === "/history" ? "default" : "ghost"}
                  className="text-lg font-medium"
                  data-testid="link-history"
                >
                  History
                </Button>
              </Link>
              <Link href="/workspace">
                <Button 
                  variant={location === "/workspace" ? "default" : "default"}
                  className="text-lg font-medium"
                  data-testid="link-get-started"
                >
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}
