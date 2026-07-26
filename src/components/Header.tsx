import { memo } from 'react';
import { Button } from './ui/button';
import { LanguageSwitch } from './LanguageSwitch';
import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import plLogo from '../assets/premier-league-logo.png';

export const Header = memo(() => {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    // Signal to ProtectedRoute that this is an intentional logout
    window.dispatchEvent(new Event('explicit-sign-out'));
    await supabase.auth.signOut();
    navigate('/auth');
  };

  return (
    <header className="bg-card/90 backdrop-blur-md border-b border-border/80 px-4 sm:px-8 h-[66px] flex items-center justify-between shadow-sm relative z-50 overflow-visible">
      <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/groups')}>
        <img 
          src={plLogo} 
          alt="Premier League" 
          className="h-20 sm:h-24 w-auto object-contain transition-transform group-hover:scale-105 drop-shadow-lg" 
        />
      </div>
      <div className="flex items-center gap-3">
        <LanguageSwitch />
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleSignOut} 
          title="Sign Out"
          className="h-10 w-10 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
});

Header.displayName = 'Header';
