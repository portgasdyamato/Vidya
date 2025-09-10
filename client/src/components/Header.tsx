import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function Header() {
  const [location] = useLocation();

  return (
    <header className="border-b border-border bg-background" role="banner">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" role="navigation" aria-label="Main navigation">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/">
              <h1 className="text-2xl font-bold text-foreground cursor-pointer" data-testid="link-home">
                <span className="text-primary">Project</span> Vidya
              </h1>
            </Link>
          </div>
          <div className="hidden md:block">
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
              <a 
                href="/#upload" 
                className="btn-primary text-primary-foreground px-6 py-2 rounded-md text-lg font-medium focus-ring"
                data-testid="link-get-started"
              >
                Get Started
              </a>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}
