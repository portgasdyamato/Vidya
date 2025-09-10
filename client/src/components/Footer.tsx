import { Link } from "wouter";

export default function Footer() {
  return (
    <footer className="bg-foreground text-background py-12" role="contentinfo">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <h3 className="text-2xl font-bold mb-4">
              <span className="text-primary">Project</span> Vidya
            </h3>
            <p className="text-background/80 text-lg leading-relaxed mb-4">
              Making education accessible to all students through AI-powered learning tools. Breaking down barriers for students with disabilities.
            </p>
            <p className="text-background/60 text-sm">
              Built with ❤️ for inclusive education in India
            </p>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold mb-4">Features</h4>
            <ul className="space-y-2 text-background/80">
              <li>
                <a href="/#features" className="hover:text-primary transition-colors focus-ring rounded">
                  Document Processing
                </a>
              </li>
              <li>
                <a href="/#features" className="hover:text-primary transition-colors focus-ring rounded">
                  Image Recognition
                </a>
              </li>
              <li>
                <a href="/#features" className="hover:text-primary transition-colors focus-ring rounded">
                  Video Transcription
                </a>
              </li>
              <li>
                <a href="/#features" className="hover:text-primary transition-colors focus-ring rounded">
                  Text-to-Speech
                </a>
              </li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold mb-4">Support</h4>
            <ul className="space-y-2 text-background/80">
              <li>
                <Link href="/history" className="hover:text-primary transition-colors focus-ring rounded">
                  Your History
                </Link>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-colors focus-ring rounded">
                  User Guide
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-colors focus-ring rounded">
                  Accessibility Help
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-colors focus-ring rounded">
                  Contact Us
                </a>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-background/20 mt-8 pt-8 text-center">
          <p className="text-background/60">
            © 2024 Project Vidya. Built for educational accessibility and inclusion.
          </p>
        </div>
      </div>
    </footer>
  );
}
