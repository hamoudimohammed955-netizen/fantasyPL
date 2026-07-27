import { useCallback, memo } from 'react';
import { Users, Trophy, MessageCircle, User, Calculator } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { cn } from '../lib/utils';

export const Navigation = memo(() => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  const handleNav = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  const navItems = [
    { icon: Users, label: t('groups'), path: '/groups', matchPaths: ['/groups', '/group'] },
    { icon: Calculator, label: t('points'), path: '/points', matchPaths: ['/points'] },
    { icon: Trophy, label: t('rankings'), path: '/rankings', matchPaths: ['/rankings'] },
    { icon: MessageCircle, label: t('chat'), path: '/chat', matchPaths: ['/chat'] },
    { icon: User, label: t('profile'), path: '/profile', matchPaths: ['/profile'] },
  ];

  return (
    <>
      {/* ── Desktop: top sticky bar ── */}
      <nav className="hidden sm:block sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/60 py-2.5 px-3">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-2.5 p-1.5 rounded-2xl bg-secondary/50 border border-border/50 backdrop-blur-md shadow-inner">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.matchPaths.some(p => location.pathname.startsWith(p));
            return (
              <button
                key={item.path}
                onClick={() => handleNav(item.path)}
                className={cn(
                  'relative flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all duration-300 whitespace-nowrap text-sm font-semibold shrink-0 group select-none',
                  isActive
                    ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white shadow-lg shadow-purple-500/25 scale-[1.02]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/80'
                )}
              >
                <div className={cn(
                  'p-1 rounded-lg transition-transform group-hover:scale-110',
                  isActive ? 'bg-white/15 text-white' : 'text-muted-foreground group-hover:text-primary'
                )}>
                  <Icon className="h-4 w-4" />
                </div>
                <span>{item.label}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-300 animate-pulse shadow-sm shadow-teal-300/50" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Mobile: floating bubble bottom bar ── */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pb-5 pt-2 pointer-events-none">
        <nav
          className="pointer-events-auto rounded-3xl overflow-visible"
          style={{
            background: 'rgba(255,255,255,0.75)',
            backdropFilter: 'blur(28px) saturate(180%)',
            WebkitBackdropFilter: 'blur(28px) saturate(180%)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.9), 0 0 0 1px rgba(0,0,0,0.06)',
          }}
        >
          <div className="flex items-end justify-around px-3 pt-3 pb-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.matchPaths.some(p => location.pathname.startsWith(p));
              return (
                <button
                  key={item.path}
                  onClick={() => handleNav(item.path)}
                  className="relative flex flex-col items-center select-none outline-none transition-all duration-300 active:scale-90 flex-1"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  {isActive ? (
                    /* Active: floating purple bubble, no label */
                    <div
                      className="flex items-center justify-center rounded-full mb-1"
                      style={{
                        width: '48px',
                        height: '48px',
                        background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',
                        boxShadow: '0 6px 18px rgba(124,58,237,0.45)',
                        transform: 'translateY(-18px)',
                        transition: 'all 0.18s cubic-bezier(0.34,1.4,0.64,1)',
                      }}
                    >
                      <Icon style={{ width: '22px', height: '22px', color: '#ffffff' }} />
                    </div>
                  ) : (
                    /* Inactive: icon + label */
                    <div className="flex flex-col items-center gap-1 pb-1" style={{ transition: 'opacity 0.15s' }}>
                      <Icon style={{ width: '20px', height: '20px', color: '#9ca3af' }} />
                      <span className="text-[10px] font-semibold text-gray-400 tracking-wide">
                        {item.label}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </>
  );
});

Navigation.displayName = 'Navigation';
