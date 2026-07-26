import { supabase } from '../integrations/supabase/client';
import { Navigate, Outlet } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';

const ProtectedRoute = () => {
  const [session, setSession] = useState<any>(undefined);
  // Track whether the user explicitly signed out via the sign-out button
  const explicitSignOut = useRef(false);

  useEffect(() => {
    let mounted = true;

    // Initial session check — reads from localStorage cache, very fast
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (mounted) setSession(s ?? null);
    }).catch(() => {
      // Network error on initial check — keep undefined (show blank) and retry
      setTimeout(async () => {
        if (!mounted) return;
        try {
          const { data: { session: s } } = await supabase.auth.getSession();
          if (mounted) setSession(s ?? null);
        } catch {
          if (mounted) setSession(null);
        }
      }, 2000);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        explicitSignOut.current = false;
        setSession(s ?? null);

      } else if (event === 'SIGNED_OUT') {
        // Only redirect if user explicitly clicked sign-out
        // All other SIGNED_OUT events (token expiry, network glitch) are ignored
        if (explicitSignOut.current) {
          setSession(null);
        }
        // If not explicit: silently ignore — token will refresh on next request
      }
    });

    // Listen for explicit sign-out action from Header button
    const handleExplicitSignOut = () => {
      explicitSignOut.current = true;
    };
    window.addEventListener('explicit-sign-out', handleExplicitSignOut);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener('explicit-sign-out', handleExplicitSignOut);
    };
  }, []);

  // Still checking
  if (session === undefined) return null;

  // Confirmed no session
  if (!session) return <Navigate to="/auth" replace />;

  return <Outlet />;
};

export default ProtectedRoute;