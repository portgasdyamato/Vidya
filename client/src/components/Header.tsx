import { Link, useLocation } from "wouter";
import { useTheme } from "@/lib/theme";
import { Sun, Moon, LogIn, User, LogOut, LayoutDashboard, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Header() {
  const { theme, toggle } = useTheme();
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const isWorkspace = location === "/workspace" || location.startsWith("/study");

  const NavContent = () => (
    <>
      <Link href="/history">
        <Button 
          variant="ghost"
          className={`flex items-center gap-2 ${location === "/history" ? "text-primary" : ""}`}
        >
          <History className="h-4 w-4" />
          <span>History</span>
        </Button>
      </Link>
      <Link href="/workspace">
        <Button 
          variant={location === "/workspace" ? "default" : "outline"}
          className="flex items-center gap-2 border-primary/20 hover:bg-primary/5"
        >
          <LayoutDashboard className="h-4 w-4" />
          <span>Workspace</span>
        </Button>
      </Link>
    </>
  );

  return (
    <header className="border-b border-border/10 h-16 flex items-center bg-[#0a0a0a]/80 backdrop-blur-xl sticky top-0 z-50 px-6">
      <div className="flex-1 flex items-center justify-between max-w-7xl mx-auto w-full">
        <Link href="/">
          <h1 className="text-xl font-bold text-white cursor-pointer font-serif flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center group-hover:scale-105 transition-transform">
              <span className="text-primary text-sm">V</span>
            </div>
            <span>Vidya</span>
          </h1>
        </Link>

        <div className="flex items-center gap-4">
          {!isWorkspace && (
            <div className="hidden md:flex items-center gap-2 mr-4 border-r border-white/10 pr-4">
              <NavContent />
            </div>
          )}

          <button 
            onClick={toggle} 
            className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-white/70"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
                  <Avatar className="h-10 w-10 border border-primary/20">
                    <AvatarImage src={user.photo || `https://api.dicebear.com/7.x/initials/svg?seed=${user.username}`} alt={user.username} />
                    <AvatarFallback className="bg-primary/10 text-primary">{user.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 glass-card border-white/10 bg-[#0a0a0a]" align="end" forceMount>
                <DropdownMenuLabel className="font-normal font-serif">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-bold leading-none text-white">{user.name || user.username}</p>
                    <p className="text-xs leading-none text-white/50">{user.username}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem className="text-white focus:bg-white/5 cursor-pointer" asChild>
                  <Link href="/workspace">Workspace</Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="text-white focus:bg-white/5 cursor-pointer" asChild>
                  <Link href="/history">History</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem 
                  className="text-destructive focus:bg-destructive/10 cursor-pointer flex items-center gap-2"
                  onClick={() => logoutMutation.mutate()}
                >
                  <LogOut className="h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/login">
              <Button className="bg-primary hover:bg-primary/90 text-white font-bold rounded-xl h-10 px-6 gap-2 flex items-center">
                <LogIn className="h-4 w-4 font-bold" />
                <span>Login</span>
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
