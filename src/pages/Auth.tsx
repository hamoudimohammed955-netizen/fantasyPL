import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useToast } from '../hooks/use-toast';
import { useLanguage } from '../contexts/LanguageContext';
import { LanguageSwitch } from '../components/LanguageSwitch';
import plLogo from '../assets/premier-league-logo.png';

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/groups');
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate('/groups');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);

  try {
    if (isSignUp) {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      });

      // If user already exists → auto switch to sign in
      if (signUpError) {
        if (signUpError.message.toLowerCase().includes('already registered') ||
            signUpError.message.toLowerCase().includes('already exists')) {
          toast({ title: t('info'), description: t('accountAlreadyExists') });
          const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
          if (loginErr) throw loginErr;
          navigate('/groups');
          return;
        }
        throw signUpError;
      }

      // Sign in immediately after signup
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      // Manually create profile record with full_name and email
      const userId = signInData.user?.id;
      if (userId) {
        await (supabase as any).from('profiles').upsert({
          id: userId,
          full_name: fullName,
          email: email,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });
      }

      toast({ title: t('welcome'), description: t('accountCreatedSuccessfully') });
      navigate('/groups');

    } else {
      const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Ensure profile exists with email (in case it was missing)
      const userId = signInData.user?.id;
      if (userId) {
        const { data: profile } = await (supabase as any)
          .from('profiles')
          .select('id, full_name')
          .eq('id', userId)
          .single();

        if (!profile?.full_name) {
          await (supabase as any).from('profiles').upsert({
            id: userId,
            email: email,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });
        }
      }

      toast({ title: t('welcome'), description: t('signedInSuccessfully') });
      navigate('/groups');
    }
  } catch (error: any) {
    toast({ title: t('error'), description: error?.message || t('somethingWentWrong'), variant: 'destructive' });
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitch />
      </div>
      
      <div className="w-full max-w-4xl bg-card rounded-2xl shadow-2xl overflow-hidden grid md:grid-cols-2 md:min-h-[520px]">
        <div className={`p-8 md:p-12 h-full transition-opacity duration-500 ease-in-out ${isSignUp ? 'md:order-2 opacity-100' : 'md:order-1 opacity-100'}`}>
          <h1 className="text-3xl font-bold mb-2">{isSignUp ? t('signUp') : t('signIn')}</h1>
          <p className="text-muted-foreground mb-8">{t('signInToContinue')}</p>

          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-sm font-medium mb-2">{t('fullName')}</label>
                <Input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">{t('email')}</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">{t('password')}</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full"
                minLength={6}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
              size="lg"
            >
              {loading ? '...' : (isSignUp ? t('signUp') : t('signIn'))}
            </Button>
          </form>

          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {isSignUp ? t('alreadyHaveAccount') : t('dontHaveAccount')}
          </button>
        </div>

        <div className={`hidden md:flex flex-col items-center justify-center p-12 h-full bg-gradient-to-br from-primary via-primary to-accent transition-opacity duration-500 ease-in-out ${isSignUp ? 'md:order-1 opacity-100' : 'md:order-2 opacity-100'}`}>
          <img 
            src={plLogo} 
            alt="Premier League" 
            className="w-64 h-auto mb-8 brightness-0 invert"
          />
        </div>
      </div>
    </div>
  );
}
