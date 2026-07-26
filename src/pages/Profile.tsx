import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Card } from '../components/ui/card';
import { useToast } from '../hooks/use-toast';
import { useLanguage } from '../contexts/LanguageContext';
import { Navigation } from '../components/Navigation';
import { Footer } from '../components/Footer';
import { Settings, User, Shield, History, Pencil, Check, TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react';
import { Header } from '../components/Header';
import { remoteLogoCandidates, getCachedLogo, setCachedLogo } from '../lib/logos';

const premierLeagueTeams = [
  'Arsenal',
  'Aston Villa',
  'AFC Bournemouth',
  'Brentford',
  'Brighton & Hove Albion',
  'Chelsea',
  'Coventry City',
  'Crystal Palace',
  'Everton',
  'Fulham',
  'Hull City',
  'Ipswich Town',
  'Leeds United',
  'Liverpool',
  'Manchester City',
  'Manchester United',
  'Newcastle United',
  'Nottingham Forest',
  'Sunderland',
  'Tottenham Hotspur',
];

export default function Profile() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [group, setGroup] = useState<any>(null);
  const [rounds, setRounds] = useState<any[]>([]);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  // Remote logo <img/> with caching in localStorage
  const LogoImg = ({ name, className }: { name?: string; className?: string }) => {
    if (!name) return null;
    const base = remoteLogoCandidates(name);
    const cached = getCachedLogo(name);
    const sources = base.length > 0 ? base : (cached ? [cached] : []);
    if (!sources.length) return null;

    return (
      <img
        src={sources[0]}
        data-ix={0}
        alt={`${name} logo`}
        className={`${className || ''} object-contain block`}
        style={{ objectFit: 'contain' }}
        loading="eager"
        referrerPolicy="no-referrer"
        onLoad={(e) => {
          try { setCachedLogo(name, (e.target as HTMLImageElement).src); } catch {}
        }}
        onError={(e) => {
          const el = e.target as HTMLImageElement;
          const ix = Number(el.getAttribute('data-ix') || '0');
          const next = sources[ix + 1];
          if (next) {
            el.setAttribute('data-ix', String(ix + 1));
            el.src = next;
          } else {
            el.style.display = 'none';
          }
        }}
      />
    );
  };

  // replaced by remote-based LogoImg above

  useEffect(() => {
    const fetchProfileData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const profileId = id || session?.user?.id;

      if (!profileId) {
        return;
      }

      setUser(session?.user);
      loadProfile(profileId);
    };

    fetchProfileData();
  }, [id, navigate]);

  const loadProfile = async (userId: string) => {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileData) {
      setProfile(profileData);
      setFullName(profileData.full_name);
      setEmail(profileData.email || '');
      setSelectedTeam(profileData.team || '');
    }

    const { data: membership } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    const gid = (membership as any)?.group_id;
    if (gid) {
      const { data: grp } = await supabase
        .from('groups')
        .select('*')
        .eq('id', gid)
        .single();
      if (grp) setGroup(grp);

      const { data: scoresData } = await (supabase as any)
        .from('scores')
        .select('*')
        .eq('user_id', userId)
        .eq('group_id', gid)
        .order('round', { ascending: false });

      if (scoresData) {
        setRounds(scoresData);
      }
    }
  };

  const updateProfile = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id || user?.id;
      if (!uid) {
        toast({ title: 'Error', description: 'You must be signed in to update your profile.', variant: 'destructive' });
        return;
      }

      // Update email in Supabase Auth if changed
      if (email && email !== profile?.email) {
        await supabase.auth.updateUser({ email });
      }

      // Update profile record in database
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          email: email,
          team: selectedTeam || null,
        })
        .eq('id', uid);

      if (error) throw error;

      setIsEditingEmail(false);

      toast({
        title: "Profile updated!",
      });

      loadProfile(uid);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <Navigation />

      <div className="max-w-2xl mx-auto p-4 md:p-8 flex-1 w-full space-y-6">
        {/* Premier League Profile Hero Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-950 via-indigo-900 to-purple-900 text-white p-6 sm:p-8 shadow-2xl border border-white/15">
          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -left-10 -top-10 w-48 h-48 bg-teal-500/20 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-teal-400 to-emerald-500 text-purple-950 flex items-center justify-center font-extrabold text-2xl shadow-xl ring-4 ring-white/20 shrink-0">
              {fullName ? fullName.trim().split(/\s+/).filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'U'}
            </div>

            <div className="space-y-1 flex-1 min-w-0">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-teal-300 border border-white/15">
                <User className="h-3.5 w-3.5" />
                {t('profile')}
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white truncate">
                {fullName || 'Premier League Manager'}
              </h1>
              <p className="text-xs text-purple-200/80 truncate font-mono">
                {profile?.email}
              </p>
            </div>

            {profile?.team && (
              <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/15 flex items-center gap-2.5 shrink-0">
                <LogoImg name={profile.team} className="h-8 w-8 aspect-square rounded-lg shadow-sm" />
                <div className="text-left">
                  <span className="text-[10px] uppercase text-purple-200 block font-semibold">{t('team')}</span>
                  <span className="text-xs font-bold text-white">{profile.team}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Personal Information Card */}
        <Card className="p-6 sm:p-8 rounded-3xl border border-border/70 bg-card/90 backdrop-blur shadow-xl space-y-5">
          <div className="flex items-center gap-3 border-b border-border/50 pb-4">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
              <Settings className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-bold">{t('personalInformation')}</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {t('fullName')}
              </label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-12 rounded-xl border-border/80 bg-background/60 px-4 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {t('email')}
              </label>
              <div className="relative flex items-center">
                <Input
                  value={isEditingEmail ? email : (email || profile?.email || '')}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!isEditingEmail}
                  className={`h-12 rounded-xl pr-12 text-sm font-mono transition-all ${
                    isEditingEmail 
                      ? 'bg-background border-primary shadow-sm focus:ring-2 focus:ring-primary/20' 
                      : 'bg-muted/60 text-muted-foreground border-border/80'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setIsEditingEmail(!isEditingEmail)}
                  className="absolute right-2 p-2 rounded-xl text-rose-500 hover:bg-rose-500/10 active:scale-95 transition-all"
                  title={isEditingEmail ? 'Done editing' : 'Edit Email'}
                >
                  {isEditingEmail ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Pencil className="h-4 w-4 text-rose-500" />
                  )}
                </button>
              </div>
            </div>

            {group && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {t('joinedGroup')}
                </label>
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-secondary/50 border border-border/60 text-sm">
                  <span className="font-bold flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    {group.name}
                  </span>
                  <span className="font-mono text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-lg font-bold">
                    {group.code}
                  </span>
                </div>
              </div>
            )}

            <Button 
              onClick={updateProfile} 
              disabled={loading}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-purple-500/25 transition-all text-sm mt-2"
            >
              {t('saveChanges')}
            </Button>
          </div>
        </Card>

        {/* Premier League Team Selection */}
        <Card className="p-6 sm:p-8 rounded-3xl border border-border/70 bg-card/90 backdrop-blur shadow-xl space-y-4">
          <div>
            <h2 className="text-xl font-bold">{t('chooseTeamWin')}</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {profile?.team ? `${t('chosen')}: ${profile.team}` : 'Pick the team you predict to win the Premier League'}
            </p>
          </div>
          
          {!profile?.team ? (
            <div className="space-y-4 pt-2">
              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger className="w-full h-12 rounded-xl border-border/80 bg-background/60 px-4 text-sm">
                  <SelectValue placeholder={t('selectTeam')} />
                </SelectTrigger>
                <SelectContent className="rounded-2xl max-h-60">
                  {premierLeagueTeams.map((team) => (
                    <SelectItem key={team} value={team} className="rounded-xl my-0.5">
                      <div className="flex items-center gap-2.5">
                        <LogoImg name={team} className="h-6 w-6 aspect-square rounded shadow-xs" />
                        <span className="font-medium text-sm">{team}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={updateProfile}
                disabled={loading || !selectedTeam}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-semibold shadow-lg shadow-teal-500/25 transition-all text-sm"
              >
                {t('confirmSelection')}
              </Button>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-secondary/50 border border-border/60 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <LogoImg name={profile.team} className="h-10 w-10 aspect-square rounded-xl shadow-sm" />
                <div>
                  <span className="font-extrabold text-base block">{profile.team}</span>
                  <span className="text-xs text-muted-foreground">{t('selectionCannotChange')}</span>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Premier League Rounds History Card */}
        <Card className="p-6 sm:p-8 rounded-3xl border border-border/70 bg-card/90 backdrop-blur-md shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-border/50 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-purple-600/10 text-purple-600 dark:text-purple-400">
                <History className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{t('roundsHistory')}</h2>
                <p className="text-xs text-muted-foreground">Gameweek points timeline</p>
              </div>
            </div>

            <div className="px-3 py-1 rounded-full bg-secondary text-xs font-semibold font-mono text-muted-foreground border border-border/50">
              {rounds.length} {rounds.length === 1 ? 'Gameweek' : 'Gameweeks'}
            </div>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto pr-1 scrollbar-none">
            {rounds.map((r) => {
              // Find previous round chronologically (round - 1)
              const prevRound = rounds.find(prev => prev.round === r.round - 1);
              
              let ArrowIcon = Minus;
              let arrowColor = "text-amber-300";

              if (prevRound) {
                if (r.points > prevRound.points) {
                  ArrowIcon = TrendingUp;
                  arrowColor = "text-emerald-400";
                } else if (r.points < prevRound.points) {
                  ArrowIcon = TrendingDown;
                  arrowColor = "text-rose-400";
                }
              }

              return (
                <div 
                  key={r.id || r.round} 
                  className="group relative flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-secondary/60 via-secondary/30 to-card border border-border/60 hover:border-purple-500/40 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-purple-600/15 text-purple-600 dark:text-purple-400 flex items-center justify-center font-extrabold text-xs font-mono shrink-0 shadow-xs border border-purple-500/20 group-hover:scale-105 transition-transform">
                      GW{r.round}
                    </div>
                    <div>
                      <span className="font-bold text-sm text-foreground block">{t('round')} {r.round}</span>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3 inline text-purple-500" />
                        Premier League Matchday
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-mono text-sm font-extrabold shadow-sm flex items-center gap-1.5">
                      <ArrowIcon className={`h-4 w-4 ${arrowColor}`} />
                      +{r.points} <span className="text-[11px] font-normal text-purple-200">pts</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {rounds.length === 0 && (
              <div className="text-muted-foreground text-center py-10 space-y-2">
                <div className="w-12 h-12 rounded-full bg-secondary/80 mx-auto flex items-center justify-center text-muted-foreground">
                  <History className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium">{t('noRoundsYet')}</p>
              </div>
            )}
          </div>
        </Card>
      </div>
      <Footer />
    </div>
  );
}