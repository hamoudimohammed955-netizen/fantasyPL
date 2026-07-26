import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { useToast } from '../hooks/use-toast';
import { useLanguage } from '../contexts/LanguageContext';
import { Navigation } from '../components/Navigation';
import { Footer } from '../components/Footer';
import { ChevronDown, Minus, Plus, RotateCcw, ArrowDownCircle, Trophy, Sparkles, Check, X, ShieldAlert } from 'lucide-react';
import { Header } from '../components/Header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

export default function Points() {
  const [user, setUser] = useState<any>(null);
  const [profileName, setProfileName] = useState<string>('');
  const [totalPoints, setTotalPoints] = useState<number>(0);
  const [round, setRound] = useState<number | null>(null);
  const [rounds, setRounds] = useState<number[]>([]);
  const [scoredRounds, setScoredRounds] = useState<number[]>([]);
  const [roundPoints, setRoundPoints] = useState<string>('');
  const [matchResult, setMatchResult] = useState<'win' | 'draw' | 'loss' | null>(null);
  const [pickedMoreThan4, setPickedMoreThan4] = useState<boolean | null>(false);
  const [playerValueHigh, setPlayerValueHigh] = useState<boolean | null>(false);
  const [leagueWinner, setLeagueWinner] = useState<boolean | null>(false);
  const [transferHits, setTransferHits] = useState<number>(0);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  const decrementHits = () => setTransferHits(prev => prev - 4);
  const incrementHits = () => setTransferHits(prev => Math.min(0, prev + 4));
  const resetHits = () => setTransferHits(0);

  const lastRoundNumber = 38;

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return;
      }
      setUser(user);
      const { data: membership } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();
      if (membership?.group_id) {
        setGroupId(membership.group_id);
      } else {
        navigate('/groups');
        return;
      }
      const allRounds = Array.from({ length: 38 }, (_, i) => i + 1);
      setRounds(allRounds);
      let nextRound = 1;
      if (membership?.group_id) {
        const { data: userRounds } = await (supabase as any)
          .from('scores')
          .select('round')
          .eq('user_id', user.id)
          .eq('group_id', membership.group_id);
        const finished = Array.isArray(userRounds) ? userRounds.map((r: any) => Number(r.round)).filter(Boolean) : [];
        setScoredRounds(finished);
        if (finished.length > 0) {
          const maxRound = Math.max(...finished);
          nextRound = Math.min(38, maxRound + 1);
        }
      }
      setRound(nextRound);
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      if (profile?.full_name) setProfileName(profile.full_name);
      if (membership?.group_id) {
        const { data: sumPoints } = await (supabase as any)
          .from('scores')
          .select('points')
          .eq('user_id', user.id)
          .eq('group_id', membership.group_id);
        if (sumPoints) setTotalPoints(sumPoints.reduce((a, b: any) => a + (b.points || 0), 0));
      }
    };
    init();
  }, [navigate]);

  const handleSavePoints = async () => {
    if (!user) { toast({ title: 'Error', description: t('signInToContinue'), variant: 'destructive' }); return; }
    if (!groupId) { toast({ title: 'Error', description: t('joinGroup'), variant: 'destructive' }); return; }
    if (round === null) { toast({ title: 'Error', description: t('selectRound'), variant: 'destructive' }); return; }
    if (!roundPoints || String(roundPoints).trim() === '') { toast({ title: 'Error', description: t('yourPointsThisRound'), variant: 'destructive' }); return; }
    // Prevent re-scoring a finished round (client-side guard)
    if (scoredRounds.includes(round)) {
      toast({ title: 'Info', description: t('roundAlreadyScored') || 'This round is already scored.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      // Server-side guard: check existing score for this round
      const { data: existing } = await (supabase as any)
        .from('scores')
        .select('id')
        .eq('user_id', user.id)
        .eq('group_id', groupId)
        .eq('round', round)
        .limit(1);
      if (existing && existing.length > 0) {
        toast({ title: 'Info', description: t('roundAlreadyScored') || 'This round is already scored.', variant: 'destructive' });
        setScoredRounds((prev) => Array.from(new Set([...prev, round!])));
        return;
      }
      const base = parseInt(roundPoints, 10) || 0;
      const delta = matchResult === 'win' ? 10 : matchResult === 'draw' ? -5 : matchResult === 'loss' ? -10 : 0;
      const bonus = round === lastRoundNumber && leagueWinner ? 50 : 0;
      const finalPoints = base + delta + bonus + transferHits;
      const { error: scoreError } = await (supabase as any).from('scores').insert([
        {
          user_id: user.id,
          group_id: groupId,
          round,
          points: finalPoints,
          base_points: base,
          match_result: matchResult,
          transfer_hits: transferHits,
        },
      ]);
      if (scoreError) throw scoreError;
      toast({ title: 'Success', description: t('pointsSavedSuccessfully') });
      setRoundPoints('');
      setMatchResult(null);
      setLeagueWinner(false);
      setTransferHits(0);
      // update totals and local scored rounds
      setScoredRounds((prev) => Array.from(new Set([...prev, round!])));
      const { data: sumPoints } = await (supabase as any)
        .from('scores')
        .select('points')
        .eq('user_id', user.id)
        .eq('group_id', groupId);
      if (sumPoints) setTotalPoints(sumPoints.reduce((a, b: any) => a + (b.points || 0), 0));
      // Auto-advance to next available round
      const maxRoundAfter = Math.max(0, ...scoredRounds, round!);
      const next = Math.min(lastRoundNumber, maxRoundAfter + 1);
      setRound(next);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <Navigation />

      <div className="max-w-2xl mx-auto p-4 md:p-8 flex-1 w-full space-y-6">
        {/* Premier League Score Header Card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-950 via-indigo-900 to-purple-900 text-white p-6 sm:p-8 shadow-2xl border border-white/15">
          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -left-10 -top-10 w-48 h-48 bg-teal-500/20 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-teal-300 border border-white/15">
                <Sparkles className="h-3.5 w-3.5" />
                {round !== null ? `${t('currentRound')} ${round}` : t('enterPoints')}
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white uppercase">
                {profileName || 'PLAYER'}
              </h1>
            </div>

            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/15 shrink-0">
              <Trophy className="h-6 w-6 text-yellow-400 drop-shadow-md" />
              <div>
                <span className="text-xs text-purple-200 block">{t('yourTotal')}</span>
                <span className="text-lg font-extrabold font-mono text-white">{totalPoints} {t('pointsLabel')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Points Form Card */}
        <Card className="p-6 sm:p-8 rounded-3xl border border-border/70 bg-card/90 backdrop-blur shadow-xl space-y-6">
          <div className="grid gap-6">
            {/* Round & Round Points Row */}
            <div className="grid sm:grid-cols-2 gap-4 items-end">
              <div className="grid gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('roundLabel')}
                </label>
                <div className="relative">
                  <select
                    className="appearance-none rounded-xl h-12 w-full border border-border/80 bg-background/60 px-4 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                    value={round ?? ''}
                    onChange={(e) => {
                      const chosen = parseInt(e.target.value, 10);
                      if (scoredRounds.includes(chosen)) {
                        toast({ title: 'Info', description: t('roundAlreadyScored') || 'This round is already scored.', variant: 'destructive' });
                        return;
                      }
                      setRound(chosen);
                    }}
                  >
                    <option value="" disabled>{t('selectRound')}</option>
                    {rounds.map((r) => (
                      <option key={r} value={r} disabled={scoredRounds.includes(r)}>{`${t('round')} ${r}`}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('yourPointsThisRound')}
                </label>
                <Input
                  type="number"
                  value={roundPoints}
                  onChange={(e) => setRoundPoints(e.target.value)}
                  placeholder="0"
                  className="rounded-xl h-12 border-border/80 bg-background/60 px-4 text-base font-semibold font-mono"
                />
              </div>
            </div>

            {/* Match Result Selector */}
            <div className="grid gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('matchResult')}
              </label>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setMatchResult('win')}
                  className={`py-3 px-2 rounded-xl text-xs sm:text-sm font-bold border transition-all duration-200 flex items-center justify-center gap-1.5 ${
                    matchResult === 'win'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-500/25 scale-[1.02]'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                  }`}
                >
                  <Check className="h-4 w-4 shrink-0" />
                  <span>{t('win')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMatchResult('draw')}
                  className={`py-3 px-2 rounded-xl text-xs sm:text-sm font-bold border transition-all duration-200 flex items-center justify-center gap-1.5 ${
                    matchResult === 'draw'
                      ? 'bg-amber-600 text-white border-amber-500 shadow-lg shadow-amber-500/25 scale-[1.02]'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                  }`}
                >
                  <Minus className="h-4 w-4 shrink-0" />
                  <span>{t('draw')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMatchResult('loss')}
                  className={`py-3 px-2 rounded-xl text-xs sm:text-sm font-bold border transition-all duration-200 flex items-center justify-center gap-1.5 ${
                    matchResult === 'loss'
                      ? 'bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-500/25 scale-[1.02]'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                  }`}
                >
                  <X className="h-4 w-4 shrink-0" />
                  <span>{t('loss')}</span>
                </button>
              </div>
            </div>

            {/* Transfer Penalty (Hits: 0, -4, -8, -12...) */}
            <div className="border rounded-2xl p-3.5 bg-secondary/40 border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <ArrowDownCircle className={`h-4 w-4 shrink-0 ${transferHits < 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                <span className="text-xs text-muted-foreground font-medium">{t('transferPenaltySub')}</span>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 w-full sm:w-auto">
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={decrementHits}
                    className="h-8 w-8 rounded-full border-destructive/40 text-destructive hover:bg-destructive/10"
                    title="Deduct -4"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={incrementHits}
                    disabled={transferHits >= 0}
                    className="h-8 w-8 rounded-full"
                    title="Add +4"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  {transferHits < 0 && (
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="sm" 
                      onClick={resetHits}
                      className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground ml-1"
                      title="Reset to 0"
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" /> 0
                    </Button>
                  )}
                </div>

                <div className={`text-sm font-bold font-mono px-3.5 py-1 rounded-full border transition-all ${
                  transferHits < 0 
                    ? 'bg-destructive/15 text-destructive border-destructive/40 shadow-sm' 
                    : 'bg-background text-foreground border-border'
                }`}>
                  {transferHits} {t('pointsLabel')}
                </div>
              </div>
            </div>

            {/* Additional Questions */}
            <div className="grid gap-4 sm:grid-cols-2">
              {round === 1 && (
                <div className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('didYouPickMore')}</span>
                  <div className="flex gap-2">
                    <Button className="rounded-xl flex-1 h-10" variant={pickedMoreThan4 === false ? 'default' : 'outline'} onClick={() => setPickedMoreThan4(false)}>{t('no')}</Button>
                    <Button className="rounded-xl flex-1 h-10" variant={pickedMoreThan4 === true ? 'default' : 'outline'} onClick={() => setPickedMoreThan4(true)}>{t('yes')}</Button>
                  </div>
                </div>
              )}
              <div className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('playerValue')}</span>
                <div className="flex gap-2">
                  <Button className="rounded-xl flex-1 h-10" variant={playerValueHigh === false ? 'default' : 'outline'} onClick={() => setPlayerValueHigh(false)}>{t('no')}</Button>
                  <Button className="rounded-xl flex-1 h-10" variant={playerValueHigh === true ? 'default' : 'outline'} onClick={() => setPlayerValueHigh(true)}>{t('yes')}</Button>
                </div>
              </div>
            </div>

            {round === lastRoundNumber && (
              <div className="grid gap-2 border rounded-2xl p-4 bg-primary/5 border-primary/20">
                <span className="text-xs font-semibold uppercase tracking-wider text-foreground">{t('didYourTeamWin')}</span>
                <div className="flex gap-2">
                  <Button className="rounded-xl flex-1 h-10" variant={leagueWinner === false ? 'default' : 'outline'} onClick={() => setLeagueWinner(false)}>{t('no')}</Button>
                  <Button className="rounded-xl flex-1 h-10" variant={leagueWinner === true ? 'default' : 'outline'} onClick={() => setLeagueWinner(true)}>{t('yes')}</Button>
                </div>
                <span className="text-xs text-muted-foreground">+50 {t('points')} {t('yes')}</span>
              </div>
            )}

            {/* Save Button */}
            <Button 
              onClick={handleSavePoints} 
              disabled={loading || !user || !groupId || round === null || String(roundPoints).trim() === ''} 
              className="w-full h-13 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-base shadow-xl shadow-purple-500/25 transition-all mt-2"
            >
              {loading ? t('saving') : t('savePoints')}
            </Button>
          </div>
        </Card>
      </div>
      <Footer />
    </div>
  );
}