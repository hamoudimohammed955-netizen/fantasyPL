import { memo } from 'react';
import { Link } from 'react-router-dom';
import plLogo from '../assets/premier-league-logo.png';
import { Facebook, Instagram, Github, Linkedin } from 'lucide-react';

export const Footer = memo(() => {
  return (
    <footer className="hidden sm:block text-white mt-auto w-full bg-gradient-to-r from-purple-900 via-purple-700 to-teal-500 rounded-tl-[64px] md:rounded-tl-[96px]">
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex flex-col items-center gap-3">
          <img
            src={plLogo}
            alt="Premier League"
            className="h-20 brightness-0 invert cursor-pointer"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          />
          <nav className="flex flex-wrap items-center justify-center gap-6 text-sm opacity-90">
            <Link to="/groups" className="hover:opacity-100 opacity-90">Home</Link>
            <Link to="/points" className="hover:opacity-100 opacity-90">Points</Link>
            <Link to="/rankings" className="hover:opacity-100 opacity-90">Rankings</Link>
            <Link to="/chat" className="hover:opacity-100 opacity-90">Chat</Link>
            <Link to="/profile" className="hover:opacity-100 opacity-90">Profile</Link>
          </nav>
        </div>
        <hr className="border-white/20 mt-4" />
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-4 text-xs sm:text-sm text-center sm:text-left">
          <div className="opacity-80">© All rights reserved. Mohammed Hamoudi.</div>
          <div className="flex items-center gap-4 opacity-90">
            <a href="https://www.facebook.com/profile.php?id=100009893058577" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="hover:opacity-100 transition-opacity"><Facebook className="h-5 w-5" /></a>
            <a href="https://www.instagram.com/hamoudi_mohammed2/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="hover:opacity-100 transition-opacity"><Instagram className="h-5 w-5" /></a>
            <a href="https://github.com/hamoudi-mohammed" target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="hover:opacity-100 transition-opacity"><Github className="h-5 w-5" /></a>
            <a href="https://www.linkedin.com/in/mohammed-hamoudi-1b3795388/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="hover:opacity-100 transition-opacity"><Linkedin className="h-5 w-5" /></a>
          </div>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = 'Footer';
