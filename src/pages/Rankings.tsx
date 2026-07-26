import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Separator } from '../components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { useLanguage } from '../contexts/LanguageContext';
import { Navigation } from '../components/Navigation';
import { Footer } from '../components/Footer';
import { Trophy, TrendingUp, TrendingDown, Users, ChevronDown, Award, Star, Flame, BarChart3, RotateCw, User, Shield, Calendar, Target, Zap } from 'lucide-react';
import { Header } from '../components/Header';
import { getInitials, avatarColorsGroup } from '../lib/avatar';
import { remoteLogoCandidates, getCachedLogo, setCachedLogo } from '../lib/logos';

export default function Rankings() {
  const [user, setUser] = useState<any>(null);
  const [group, setGroup] = useState<any>(null);
  const [rankings, setRankings] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [roundFilter, setRoundFilter] = useState<string>('all');
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const navigate = useNavigate();
  const { t } = useLanguage();

  const LogoImg = ({ name, className }: { name?: string; className?: string }) => {
    if (!name) return null;
    const base = remoteLogoCandidates(name);
    const cached = getCachedLogo(name);
    const sources = base.length > 0 ? base : (cached ? [cached] : []);
    if (!sources.length) return null;

    return (
      <img
        src={sources[0]}
        alt={`${name} logo`}
        className={`${className || ''} object-contain block`}
        style={{ objectFit: 'contain' }}
        loading="eager"
        referrerPolicy="no-referrer"
      />
    );
  };

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadRankings(user.id, roundFilter);
    }
  }, [roundFilter]);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return;
    }
    setUser(session.user);
    loadRankings(session.user.id, roundFilter);
  };

  const loadRankings = async (userId: string, filter: string = 'all') => {
    // 1) Get user's first group id
    const { data: membership } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    const gid = (membership as any)?.group_id;
    if (!gid) return;

    // 2) Fetch the group
    const { data: grp } = await supabase
      .from('groups')
      .select('*')
      .eq('id', gid)
      .single();
    if (!grp) return;
    setGroup(grp);

    // 3) Get all member user_ids for the group, then fetch their profiles
    const { data: membershipRows } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', gid);

    const memberUserIds: string[] = (membershipRows || []).map((m: any) => m.user_id);
    let members: Array<{ user_id: string; profiles?: { id: string; full_name: string; team?: string } }> = [];
    if (memberUserIds.length > 0) {
      const { data: profiles } = await (supabase as any)
        .from('profiles')
        .select('id, full_name, team')
        .in('id', memberUserIds);
      members = (profiles || []).map((p: any) => ({ user_id: p.id, profiles: { id: p.id, full_name: p.full_name, team: p.team } }));
    }

    // 4) Get scores for all members
    const { data: scores } = await (supabase as any)
      .from('scores')
      .select('user_id, points, round')
      .eq('group_id', gid);

    // Build a fallback member list from scores if needed
    let effectiveMembers = members || [];
    if ((!effectiveMembers || effectiveMembers.length === 0) && scores && scores.length > 0) {
      const userIds = Array.from(new Set(scores.map((s: any) => s.user_id)));
      if (userIds.length > 0) {
        const { data: profiles } = await (supabase as any)
          .from('profiles')
          .select('id, full_name, team')
          .in('id', userIds as string[]);
        effectiveMembers = (profiles || []).map((p: any) => ({
          user_id: p.id,
          profiles: { id: p.id, full_name: p.full_name, team: p.team },
        }));
      }
    }

    if (!effectiveMembers) return;

    const selectedRound = filter !== 'all' ? parseInt(filter, 10) : null;
    const maxRound = scores && scores.length ? Math.max(...scores.map((s: any) => s.round || 0)) : 0;
    const memberRankings = effectiveMembers.map((member: any) => {
      const memberScores = scores?.filter((s: any) => s.user_id === member.user_id) || [];
      const totalPointsAll = memberScores.reduce((sum: number, s: any) => sum + (s.points || 0), 0);
      const totalPointsUpTo = selectedRound
        ? memberScores.filter((s: any) => (s.round || 0) <= selectedRound).reduce((sum: number, s: any) => sum + (s.points || 0), 0)
        : totalPointsAll;
      const latestScore = memberScores.slice().sort((a: any, b: any) => (b.round || 0) - (a.round || 0))[0];
      const roundPoints = selectedRound
        ? (memberScores.find((s: any) => s.round === selectedRound)?.points || 0)
        : (latestScore?.points || 0);
      return {
        userId: member.user_id,
        name: member.profiles?.full_name || 'Unknown',
        team: member.profiles?.team || '',
        totalPoints: totalPointsUpTo,
        roundPoints,
        roundsCount: memberScores.length,
        scores: memberScores.slice().sort((a: any, b: any) => (a.round || 0) - (b.round || 0)),
      };
    });

    if (selectedRound) {
      memberRankings.sort((a, b) => b.roundPoints - a.roundPoints);
    } else {
      memberRankings.sort((a, b) => b.totalPoints - a.totalPoints);
    }
    setRankings(memberRankings);

    // Calculate stats
    const totalMembers = memberRankings.length;
    const activeMembers = memberRankings.filter(m => m.roundsCount > 0).length;
    const avgPoints = totalMembers > 0 
      ? memberRankings.reduce((sum, m) => sum + m.totalPoints, 0) / totalMembers 
      : 0;
    const highestRound = Math.max(...memberRankings.map(m => m.roundPoints), 0);
    const maxRounds = maxRound;
    const bestPlayer = memberRankings[0];

    setStats({
      average: Math.round(avgPoints),
      highestRoundPoints: highestRound,
      roundsCount: maxRounds,
      activeMembers,
      totalMembers,
      bestPlayer,
    });

    // Colors are now derived per member deterministically using groupId+userId across the app
  };

  
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <Navigation />

      <div className="max-w-4xl mx-auto p-4 md:p-8 flex-1 w-full space-y-6">
        {/* Premier League Header Control Card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-950 via-indigo-900 to-purple-950 text-white p-6 sm:p-7 shadow-2xl border border-white/15">
          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -left-10 -top-10 w-48 h-48 bg-teal-500/20 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl text-yellow-400 border border-white/15 shadow-md shrink-0">
                <Trophy className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-white via-purple-100 to-teal-200 bg-clip-text text-transparent">
                    {group?.name || t('groupRankings')}
                  </h1>
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-white/10 text-teal-300 border border-white/15">
                    {stats?.activeMembers || 0} {t('members')}
                  </span>
                </div>
                <p className="text-xs text-purple-200/80">{t('groupRankings')}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end shrink-0">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/15 text-xs text-purple-200">
                <span>{t('filterBy')}:</span>
                <select
                  className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer"
                  value={roundFilter}
                  onChange={(e) => setRoundFilter(e.target.value)}
                >
                  <option value="all" className="bg-purple-950 text-white">{t('allRounds')}</option>
                  {Array.from({ length: 38 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={String(n)} className="bg-purple-950 text-white">{`${t('round')} ${n}`}</option>
                  ))}
                </select>
              </div>

              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => loadRankings(user?.id, roundFilter)}
                className="bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs h-9 px-3 border border-white/15"
              >
                <RotateCw className="h-3.5 w-3.5 mr-1" />
                {t('refresh')}
              </Button>
            </div>
          </div>
        </div>

        {/* Clean Official FPL Standings Table */}
        <Card className="rounded-3xl border border-border/80 shadow-xl overflow-hidden bg-card/90 backdrop-blur-md">
          <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-secondary/30">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <h2 className="font-bold text-base">{t('rankings')}</h2>
            </div>
            <span className="text-xs font-mono text-muted-foreground">
              GW {stats?.roundsCount || 0} / 38
            </span>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[500px]">
              {/* Table Header */}
              <div className="grid grid-cols-12 text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-6 py-3 border-b border-border/40 bg-secondary/20">
                <div className="col-span-2 text-center">{t('rank')}</div>
                <div className="col-span-6">{t('player')}</div>
                <div className="col-span-2 text-center">{t('roundPoints')}</div>
                <div className="col-span-2 text-center">{t('totalPoints')}</div>
              </div>

              {/* Table Rows */}
              <div className="divide-y divide-border/30">
                {rankings.map((member, index) => {
                  const rankNum = index + 1;
                  const isCurrent = member.userId === user?.id;
                  const colors = avatarColorsGroup(group?.id, member.userId, member.name);

                  // Rank Badge Styling
                  let rankBadge = (
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-mono text-muted-foreground bg-secondary">
                      {rankNum}
                    </span>
                  );
                  if (rankNum === 1) {
                    rankBadge = (
                      <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold bg-amber-400 text-purple-950 shadow-sm ring-2 ring-amber-300">
                        1
                      </span>
                    );
                  } else if (rankNum === 2) {
                    rankBadge = (
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-slate-300 dark:bg-slate-700 text-foreground shadow-xs">
                        2
                      </span>
                    );
                  } else if (rankNum === 3) {
                    rankBadge = (
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-amber-700/80 text-white shadow-xs">
                        3
                      </span>
                    );
                  }

                  return (
                    <div 
                      key={member.userId} 
                      onClick={() => setSelectedMember(member)}
                      className={`grid grid-cols-12 items-center px-6 py-3.5 transition-all cursor-pointer ${
                        isCurrent 
                          ? 'bg-purple-500/10 dark:bg-purple-500/15 font-semibold hover:bg-purple-500/20' 
                          : 'hover:bg-secondary/60'
                      }`}
                    >
                      {/* Rank */}
                      <div className="col-span-2 flex justify-center">
                        {rankBadge}
                      </div>

                      {/* Player Avatar & Name */}
                      <div className="col-span-6 flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shadow-xs shrink-0"
                          style={{ background: colors.bgCss || colors.bg, color: colors.fg }}
                        >
                          {getInitials(member.name)}
                        </div>
                        <div className="flex items-center gap-2 truncate">
                          <span className={`text-sm font-medium ${isCurrent ? 'font-bold text-purple-600 dark:text-purple-400' : 'text-foreground'}`}>
                            {member.name}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-purple-600 text-white shrink-0">
                              YOU
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Round Points */}
                      <div className="col-span-2 text-center font-mono text-xs font-semibold text-muted-foreground">
                        {member.roundPoints > 0 ? `+${member.roundPoints}` : member.roundPoints}
                      </div>

                      {/* Total Points */}
                      <div className="col-span-2 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full font-mono text-sm font-bold ${
                          rankNum === 1 
                            ? 'bg-amber-400 text-purple-950 font-extrabold' 
                            : isCurrent
                            ? 'bg-purple-600 text-white'
                            : 'bg-secondary text-foreground'
                        }`}>
                          {member.totalPoints}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {rankings.length === 0 && (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No scores recorded yet in this group.
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Group Statistics Card (With Best Player & Competition Progress) */}
        {stats && (
          <Card className="p-6 sm:p-8 rounded-3xl border border-border/80 bg-card/90 backdrop-blur-md shadow-xl space-y-6">
            {/* Top Leader Highlight */}
            {stats.bestPlayer && (
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-transparent p-4 border border-amber-500/30 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-extrabold shadow-md ring-2 ring-amber-400 shrink-0"
                    style={{
                      background: avatarColorsGroup(group?.id, stats.bestPlayer.userId, stats.bestPlayer.name).bgCss || avatarColorsGroup(group?.id, stats.bestPlayer.userId, stats.bestPlayer.name).bg,
                      color: avatarColorsGroup(group?.id, stats.bestPlayer.userId, stats.bestPlayer.name).fg,
                    }}
                  >
                    {getInitials(stats.bestPlayer.name)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-amber-600 dark:text-amber-400">
                      <Star className="h-3 w-3" /> {t('bestPlayer') || 'Top Player'}
                    </div>
                    <span className="font-extrabold text-base text-foreground block">{stats.bestPlayer.name}</span>
                  </div>
                </div>

                <div className="px-3.5 py-1.5 rounded-full bg-amber-400 text-purple-950 font-mono text-sm font-extrabold shadow-sm shrink-0">
                  {stats.bestPlayer.totalPoints} {t('pointsLabel')}
                </div>
              </div>
            )}

            {/* 4 Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3.5 rounded-2xl border border-border/60 bg-secondary/30 space-y-1">
                <span className="text-[11px] text-muted-foreground font-semibold block uppercase tracking-wider">{t('average')}</span>
                <span className="text-xl font-extrabold font-mono text-foreground">{stats.average} pts</span>
              </div>

              <div className="p-3.5 rounded-2xl border border-border/60 bg-secondary/30 space-y-1">
                <span className="text-[11px] text-muted-foreground font-semibold block uppercase tracking-wider">{t('highestRoundPoints')}</span>
                <span className="text-xl font-extrabold font-mono text-teal-600 dark:text-teal-400">+{stats.highestRoundPoints} pts</span>
              </div>

              <div className="p-3.5 rounded-2xl border border-border/60 bg-secondary/30 space-y-1">
                <span className="text-[11px] text-muted-foreground font-semibold block uppercase tracking-wider">{t('roundsCount')}</span>
                <span className="text-xl font-extrabold font-mono text-purple-600 dark:text-purple-400">{stats.roundsCount}/38</span>
              </div>

              <div className="p-3.5 rounded-2xl border border-border/60 bg-secondary/30 space-y-1">
                <span className="text-[11px] text-muted-foreground font-semibold block uppercase tracking-wider">{t('activeMembers')}</span>
                <span className="text-xl font-extrabold font-mono text-foreground">{stats.activeMembers}</span>
              </div>
            </div>

            <Separator className="bg-border/60" />

            {/* Competition Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-muted-foreground uppercase tracking-wider">{t('competitionProgress')}</span>
                <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">
                  {stats.roundsCount || 0} / 38 {t('round')} ({Math.round(((stats.roundsCount || 0) / 38) * 100)}%)
                </span>
              </div>
              <Progress value={Math.min(100, Math.round(((stats.roundsCount || 0) / 38) * 100))} className="h-3 rounded-full bg-secondary" />
            </div>
          </Card>
        )}
      </div>

      {/* Competitor Details Modal Card */}
      <Dialog open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
        <DialogContent className="max-w-sm rounded-3xl p-5 bg-card/95 backdrop-blur-xl border border-purple-500/20 shadow-2xl space-y-4 overflow-hidden">
          {selectedMember && (
            <>
              {/* Header Profile Summary */}
              <div className="flex items-center gap-3 border-b border-border/40 pb-3.5">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-extrabold shadow-md ring-2 ring-white/10 shrink-0"
                  style={{
                    background: avatarColorsGroup(group?.id, selectedMember.userId, selectedMember.name).bgCss || avatarColorsGroup(group?.id, selectedMember.userId, selectedMember.name).bg,
                    color: avatarColorsGroup(group?.id, selectedMember.userId, selectedMember.name).fg,
                  }}
                >
                  {getInitials(selectedMember.name)}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-extrabold text-foreground truncate mb-0.5">
                    {selectedMember.name}
                  </h3>
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Shield className="h-3 w-3 text-purple-500 inline shrink-0" />
                    {group?.name || 'Group Member'}
                  </span>
                </div>
              </div>

              {/* Chosen Team Crest Banner */}
              <div className="p-3 rounded-2xl bg-gradient-to-r from-purple-950/60 via-indigo-950/40 to-purple-950/60 border border-white/15 shadow-md flex items-center justify-between gap-3 text-white">
                <div className="flex items-center gap-2.5 min-w-0">
                  {selectedMember.team ? (
                    <LogoImg name={selectedMember.team} className="h-8 w-8 aspect-square rounded-lg shadow-sm shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                      <Shield className="h-4 w-4 text-purple-300" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <span className="text-[9px] uppercase tracking-wider text-purple-200/80 font-bold block">
                      Chosen Winner
                    </span>
                    <span className="font-extrabold text-xs text-white truncate block">
                      {selectedMember.team || 'No team selected'}
                    </span>
                  </div>
                </div>

                {selectedMember.team && (
                  <span className="px-2 py-0.5 rounded-full bg-teal-400/20 text-teal-300 font-semibold text-[10px] border border-teal-400/30 shrink-0">
                    Premier League Champion
                  </span>
                )}
              </div>

              {/* Compact Metrics Grid */}
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-secondary/40 border border-border/40 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    {t('totalPoints')}
                  </span>
                  <span className="text-base font-extrabold font-mono text-purple-600 dark:text-purple-400">
                    {selectedMember.totalPoints} pts
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-secondary/40 border border-border/40 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    {t('roundPoints')}
                  </span>
                  <span className="text-base font-extrabold font-mono text-teal-500">
                    +{selectedMember.roundPoints} pts
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-secondary/40 border border-border/40 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    Gameweeks
                  </span>
                  <span className="text-sm font-bold font-mono text-foreground">
                    {selectedMember.roundsCount} / 38
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-secondary/40 border border-border/40 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    Average / GW
                  </span>
                  <span className="text-sm font-bold font-mono text-amber-500">
                    {selectedMember.roundsCount > 0 
                      ? (selectedMember.totalPoints / selectedMember.roundsCount).toFixed(1) 
                      : '0.0'} pts
                  </span>
                </div>
              </div>

              {/* Rounds Timeline History List */}
              {selectedMember.scores && selectedMember.scores.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                    Gameweek Points Log
                  </span>
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-1 scrollbar-none">
                    {selectedMember.scores.map((s: any) => (
                      <div key={s.round} className="px-3 py-1.5 rounded-xl bg-secondary/30 border border-border/30 flex items-center justify-between text-xs">
                        <span className="font-semibold text-foreground text-[11px]">Round {s.round}</span>
                        <span className="font-mono font-extrabold text-purple-600 dark:text-purple-400 text-[11px]">+{s.points} pts</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      <Footer />
    </div>
  );
}
