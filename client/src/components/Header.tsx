import { Link, useLocation } from "wouter";
import { Hash } from "lucide-react";
import PlayerBanner from "./PlayerBanner";

export default function Header() {
  const [location] = useLocation();

  return (
    <header className="bg-primary text-white shadow-md">
      <div className="container mx-auto py-4 px-6 flex justify-between items-center">
        <div className="flex items-center">
          <Hash className="h-8 w-8 mr-2" />
          <h1 className="text-2xl font-heading font-bold">Prompt Guesser</h1>
        </div>
        
        <div className="flex items-center gap-8">
          <nav className="hidden md:block">
            <ul className="flex space-x-6">
              <li>
                <Link 
                  href="/" 
                  className={`hover:text-accent transition-colors duration-200 ${location === "/" ? "text-accent" : ""}`}
                >
                  Home
                </Link>
              </li>
              <li>
                <Link 
                  href="/how-to-play" 
                  className={`hover:text-accent transition-colors duration-200 ${location === "/how-to-play" ? "text-accent" : ""}`}
                >
                  How to Play
                </Link>
              </li>
              <li>
                <Link 
                  href="/about" 
                  className={`hover:text-accent transition-colors duration-200 ${location === "/about" ? "text-accent" : ""}`}
                >
                  About
                </Link>
              </li>
            </ul>
          </nav>
          
          {/* Player Banner */}
          <div className="bg-primary-foreground/10 py-1 px-3 rounded-full">
            <PlayerBanner />
          </div>
        </div>
      </div>
    </header>
  );
}
