import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { useToast } from '../hooks/use-toast';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { ArrowLeft, Loader2, Share2, Users, QrCode, LogOut as Leave, Shield, Copy, Check, Sparkles, ChevronRight, Trophy } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Header } from '../components/Header';
import { Navigation } from '../components/Navigation';
import { Footer } from '../components/Footer';
import { getInitials, avatarColorsGroup } from '../lib/avatar';
import { remoteLogoCandidates, getCachedLogo, setCachedLogo } from '../lib/logos';

type GroupRow = { id: string; name: string; code: string };
type Member = { id: string; full_name: string; team?: string | null };

export default function GroupDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [group, setGroup] = useState<GroupRow | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberRounds, setMemberRounds] = useState<Array<{ round: number; points: number; base_points?: number | null; match_result?: string | null; transfer_hits?: number | null }>>([]);
  const [openMember, setOpenMember] = useState<null | { id: string; name: string }>(null);
  const [selectedRoundModal, setSelectedRoundModal] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  const getRoundDetailsData = (roundNum: number, totalPts: number) => {
    const isWin = totalPts >= 35;
    const isDraw = totalPts >= 20 && totalPts < 35;
    const matchRes = isWin ? 'win' : isDraw ? 'draw' : 'loss';
    const matchResPts = isWin ? 10 : isDraw ? -5 : -10;
    const hits = totalPts % 4 === 0 && totalPts < 30 ? -4 : 0;
    const basePts = totalPts - matchResPts - hits;

    return {
      round: roundNum,
      totalPoints: totalPts,
      matchResult: matchRes,
      matchResultPts: matchResPts,
      transferHits: hits,
      basePoints: basePts > 0 ? basePts : Math.max(0, totalPts),
      matches: roundNum === 1 ? [
        { home: 'Arsenal', homeScore: 2, awayScore: 1, away: 'Chelsea', predHome: 2, predAway: 1, pts: 3, status: 'Exact Score 🎯' },
        { home: 'Liverpool', homeScore: 3, awayScore: 0, away: 'Everton', predHome: 2, predAway: 0, pts: 1, status: 'Correct Result ✅' },
        { home: 'Manchester City', homeScore: 4, awayScore: 1, away: 'Coventry City', predHome: 3, predAway: 0, pts: 1, status: 'Correct Result ✅' },
        { home: 'Tottenham Hotspur', homeScore: 2, awayScore: 2, away: 'Newcastle United', predHome: 2, predAway: 2, pts: 3, status: 'Exact Score 🎯' },
        { home: 'Aston Villa', homeScore: 1, awayScore: 0, away: 'Fulham', predHome: 1, predAway: 0, pts: 3, status: 'Exact Score 🎯' },
      ] : roundNum === 2 ? [
        { home: 'Manchester United', homeScore: 2, awayScore: 1, away: 'Arsenal', predHome: 2, predAway: 1, pts: 3, status: 'Exact Score 🎯' },
        { home: 'Chelsea', homeScore: 3, awayScore: 1, away: 'Brentford', predHome: 2, predAway: 0, pts: 1, status: 'Correct Result ✅' },
        { home: 'Newcastle United', homeScore: 1, awayScore: 1, away: 'Manchester City', predHome: 1, predAway: 1, pts: 3, status: 'Exact Score 🎯' },
        { home: 'Brighton & Hove Albion', homeScore: 2, awayScore: 0, away: 'Ipswich Town', predHome: 2, predAway: 0, pts: 3, status: 'Exact Score 🎯' },
      ] : [
        { home: 'Arsenal', homeScore: 2, awayScore: 0, away: 'Hull City', predHome: 2, predAway: 0, pts: 3, status: 'Exact Score 🎯' },
        { home: 'Liverpool', homeScore: 3, awayScore: 1, away: 'Coventry City', predHome: 2, predAway: 0, pts: 1, status: 'Correct Result ✅' },
        { home: 'Manchester City', homeScore: 2, awayScore: 1, away: 'Ipswich Town', predHome: 2, predAway: 1, pts: 3, status: 'Exact Score 🎯' },
      ]
    };
  };

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        if (!id) {
          setError(t('groupNotFound'));
          setLoading(false);
          return;
        }
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        if (!session?.user?.id) {
          setLoading(false);
          setError(t('groupNotFound'));
          return;
        }
        setUserId(session.user.id);

        // Ensure membership exists
        const { data: mem, error: memErr } = await supabase
          .from('group_members')
          .select('id')
          .eq('group_id', id)
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (memErr || !mem) {
          setError(t('groupNotFound'));
          setLoading(false);
          return;
        }

        // Fetch group
        const { data: g, error: gErr } = await supabase
          .from('groups')
          .select('id, name, code')
          .eq('id', id)
          .single();
        if (gErr || !g) {
          setError(t('groupNotFound'));
          setLoading(false);
          return;
        }
        setGroup(g);

        // Fetch members
        const { data: memberIds, error: mErr } = await supabase
          .from('group_members')
          .select('user_id')
          .eq('group_id', id);
        if (mErr) throw mErr;
        const ids = (memberIds || []).map((r: any) => r.user_id);
        if (ids.length === 0) {
          setMembers([]);
          setLoading(false);
          return;
        }
        const { data: profiles, error: pErr } = await supabase
          .from('profiles')
          .select('id, full_name, team')
          .in('id', ids);
        if (pErr) throw pErr;
        setMembers((profiles || []).map((p: any) => ({ id: p.id, full_name: p.full_name || 'Unknown', team: p.team })));
      } catch (e: any) {
        console.error('GroupDetails load error', e);
        setError(e?.message || t('groupNotFound'));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => { mounted = false; };
  }, [id, t]);

  const shareInviteLink = async () => {
    if (!group) return;
    const link = `${window.location.origin}/join/${group.code}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: group.name, text: 'Join my Premier Fantasy League group!', url: link });
      } else if (window.isSecureContext && navigator.clipboard) {
        await navigator.clipboard.writeText(link);
        toast({ title: t('codeCopied') });
      } else {
        const ok = window.prompt(t('copyThisLink'), link);
        if (ok !== null) toast({ title: t('linkReadyToCopy') });
      }
    } catch (_) {}
  };

  const copyCode = async () => {
    if (!group) return;
    const text = group.code;
    try {
      if (window.isSecureContext && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({ title: t('codeCopied') });
        return;
      }
    } catch {}
    const ok = window.prompt(t('copyThisLink'), text);
    if (ok !== null) toast({ title: t('linkReadyToCopy') });
  };

  const leaveGroup = async () => {
    if (!group || !userId) return;
    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', group.id)
        .eq('user_id', userId);
      if (error) throw error;
      toast({ title: t('groupLeftSuccessfully') });
      navigate('/groups');
    } catch (e: any) {
      toast({ title: t('error'), description: e?.message || t('somethingWentWrong'), variant: 'destructive' });
    }
  };

  const openMemberDialog = async (memberId: string, name: string) => {
    setOpenMember({ id: memberId, name });
    try {
      const { data } = await (supabase as any)
        .from('scores')
        .select('round, points, base_points, match_result, transfer_hits')
        .eq('group_id', id)
        .eq('user_id', memberId)
        .order('round', { ascending: true });
      setMemberRounds((data as any) || []);
    } catch {
      setMemberRounds([]);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <Navigation />
        <div className="max-w-4xl mx-auto p-4 md:p-8 flex-1 w-full space-y-6">
          <div className="h-9 w-32 rounded-xl bg-secondary/60 animate-pulse" />
          <div className="rounded-3xl bg-secondary/40 animate-pulse h-48" />
          <div className="rounded-3xl bg-secondary/40 animate-pulse h-36" />
          <div className="rounded-3xl bg-secondary/40 animate-pulse h-64" />
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8 flex flex-col items-center justify-center space-y-4">
        <Card className="p-8 max-w-md w-full text-center rounded-3xl border border-border/80 shadow-2xl space-y-5 bg-card/90 backdrop-blur">
          <div className="w-14 h-14 rounded-2xl bg-purple-600/10 text-purple-600 flex items-center justify-center mx-auto">
            <Shield className="h-7 w-7" />
          </div>
          <CardTitle className="text-xl font-extrabold">{t('groupNotFound')}</CardTitle>
          <Button onClick={() => navigate('/groups')} className="w-full h-11 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('backToGroups')}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <Navigation />

      <div className="max-w-4xl mx-auto p-4 md:p-8 flex-1 w-full space-y-6">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          onClick={() => navigate('/groups')} 
          className="rounded-xl hover:bg-secondary/80 text-muted-foreground text-xs font-semibold px-3 h-9 border border-border/50"
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          {t('backToGroups')}
        </Button>

        {/* Premier League Hero Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-950 via-indigo-900 to-purple-950 text-white p-6 sm:p-8 shadow-2xl border border-white/15">
          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -left-10 -top-10 w-48 h-48 bg-teal-500/20 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-teal-300 border border-white/15">
                <Shield className="h-3.5 w-3.5" />
                Premier Fantasy League Group
              </div>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
                {group.name}
              </h1>
              <div className="flex items-center gap-3 text-xs text-purple-200/90 font-medium">
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4 text-teal-400" />
                  {members.length} {t('members')}
                </span>
                <span className="text-purple-400">•</span>
                <span className="font-mono bg-white/10 px-2 py-0.5 rounded-md border border-white/10">
                  {t('code')}: <strong className="text-teal-300">{group.code}</strong>
                </span>
              </div>
            </div>

            {/* Action Buttons Header */}
            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto shrink-0">
              <Button 
                onClick={shareInviteLink} 
                className="flex-1 sm:flex-initial h-10 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold transition-all"
              >
                <Share2 className="h-3.5 w-3.5 mr-2 text-teal-300" /> 
                {t('shareLink')}
              </Button>

              <Button 
                onClick={copyCode} 
                className="flex-1 sm:flex-initial h-10 px-4 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-400/30 text-xs font-bold transition-all"
              >
                {copied ? <Check className="h-3.5 w-3.5 mr-2 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 mr-2" />} 
                {t('copyCode')}
              </Button>

              <Button 
                onClick={leaveGroup} 
                className="w-full sm:w-auto h-10 px-4 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-400/30 text-xs font-bold transition-all"
              >
                <Leave className="h-3.5 w-3.5 mr-2" /> 
                {t('leaveGroup')}
              </Button>
            </div>
          </div>
        </div>

        {/* QR Code Glassmorphism Section */}
        <Card className="rounded-3xl border border-border/80 shadow-xl overflow-hidden bg-card/90 backdrop-blur-md p-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                <QrCode className="h-4 w-4" />
                Easy Group Access QR Code
              </div>
              <h3 className="text-lg font-bold text-foreground">
                Scan to Join {group.name}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                Share this QR code with your friends so they can scan and join your fantasy prediction group instantly.
              </p>
              <div className="pt-1">
                <span className="font-mono text-xs px-3 py-1 rounded-lg bg-secondary border border-border/60 font-extrabold text-foreground inline-block">
                  Invite Code: {group.code}
                </span>
              </div>
            </div>

            <div className="p-3 bg-white rounded-2xl shadow-xl border border-border/40 shrink-0">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(window.location.origin + '/join/' + group.code)}`}
                alt="Group QR Code"
                className="w-36 h-36 rounded-lg block"
              />
            </div>
          </div>
        </Card>

        {/* Official Members Standings Table */}
        <Card className="rounded-3xl border border-border/80 shadow-xl overflow-hidden bg-card/90 backdrop-blur-md">
          <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-secondary/30">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <h2 className="font-bold text-base">{t('membersTitle')}</h2>
            </div>
            <span className="text-xs font-mono text-muted-foreground px-2.5 py-0.5 rounded-full bg-secondary border border-border/50">
              {members.length} Active {members.length === 1 ? 'Manager' : 'Managers'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-secondary/20">
                <TableRow className="border-b border-border/40">
                  <TableHead className="w-16 text-center text-[11px] font-bold uppercase tracking-wider">#</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider">{t('name')}</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider">{t('team')}</TableHead>
                  <TableHead className="text-right text-[11px] font-bold uppercase tracking-wider pr-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/30">
                {members.map((m, idx) => {
                  const colors = avatarColorsGroup(id, m.id, m.full_name);
                  return (
                    <TableRow 
                      key={m.id}
                      onClick={() => openMemberDialog(m.id, m.full_name)}
                      className="hover:bg-secondary/40 transition-colors cursor-pointer"
                    >
                      <TableCell className="text-center font-mono font-bold text-xs text-muted-foreground">
                        {idx + 1}
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-extrabold shadow-xs shrink-0"
                            style={{ background: colors.bgCss || colors.bg, color: colors.fg }}
                          >
                            {getInitials(m.full_name)}
                          </div>
                          <span className="font-bold text-sm text-foreground">
                            {m.full_name}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        {m.team ? (
                          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-xl bg-secondary/60 border border-border/50 text-xs font-semibold">
                            <LogoImg name={m.team} className="h-5 w-5 aspect-square rounded shadow-xs shrink-0" />
                            <span>{m.team}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic font-normal">
                            No team chosen
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-right pr-6">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-8 px-2.5 rounded-lg text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 font-bold"
                        >
                          View Stats
                          <ChevronRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Member Breakdown Sheet */}
        <Sheet open={!!openMember} onOpenChange={(v) => { if (!v) { setOpenMember(null); setMemberRounds([]); } }}>
          <SheetContent side="right" className="w-full sm:max-w-md rounded-l-3xl p-6 bg-card border-l border-border/70 shadow-2xl space-y-5">
            <SheetHeader className="text-left space-y-1">
              <SheetTitle className="text-xl font-black flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-400" />
                {openMember?.name}
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                Gameweek Points & Performance Timeline
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground pb-1">
                <div className="text-left">{t('round')}</div>
                <div className="text-right">{t('pointsLabel')}</div>
              </div>

              <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1 scrollbar-none">
                {memberRounds.map((r) => (
                  <div 
                    key={r.round} 
                    onClick={() => setSelectedRoundModal({
                      round: r.round,
                      totalPoints: r.points,
                      basePoints: r.base_points ?? null,
                      matchResult: r.match_result ?? null,
                      matchResultPts: r.match_result === 'win' ? 10 : r.match_result === 'draw' ? -5 : r.match_result === 'loss' ? -10 : null,
                      transferHits: r.transfer_hits ?? null,
                    })}
                    className="p-3.5 rounded-2xl bg-secondary/40 border border-border/50 hover:border-purple-500/50 hover:bg-secondary/70 flex items-center justify-between cursor-pointer transition-all active:scale-[0.98] group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-600/15 text-purple-600 dark:text-purple-400 flex items-center justify-center font-extrabold text-xs font-mono border border-purple-500/20 shadow-xs">
                        GW{r.round}
                      </div>
                      <div>
                        <span className="font-bold text-sm text-foreground block">Round {r.round}</span>
                        <span className="text-[10px] text-purple-500 font-medium flex items-center gap-1">
                          <Sparkles className="h-3 w-3 inline" /> View Calculated Details
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono font-extrabold text-purple-600 dark:text-purple-400 text-sm">
                        +{r.points} pts
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-purple-500 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                ))}
                {memberRounds.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-10">
                    {t('noRoundsYet')}
                  </div>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Gameweek Round Breakdown Modal */}
      <Dialog open={!!selectedRoundModal} onOpenChange={(open) => !open && setSelectedRoundModal(null)}>
        <DialogContent className="max-w-sm p-0 rounded-3xl overflow-hidden border-0 shadow-[0_32px_80px_rgba(0,0,0,0.7)] bg-transparent">
          {selectedRoundModal && (
            <div className="relative bg-gradient-to-b from-[#0f0f1a] via-[#13102a] to-[#0c0c18] text-white overflow-hidden">
              {/* Ambient glows */}
              <div className="absolute top-0 left-1/4 w-48 h-48 rounded-full bg-purple-600/20 blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 right-1/4 w-40 h-40 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none" />

              {/* Header */}
              <div className="relative px-6 pt-6 pb-4 border-b border-white/[0.07]">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-600/30 to-indigo-600/30 border border-purple-500/30 flex items-center justify-center font-black text-xs font-mono text-purple-300 backdrop-blur">
                    GW{selectedRoundModal.round}
                  </div>
                  <div>
                    <DialogTitle className="text-base font-black tracking-tight text-white">
                      Gameweek {selectedRoundModal.round}
                    </DialogTitle>
                    <DialogDescription className="text-[11px] text-white/40 mt-0.5">
                      {openMember?.name}
                    </DialogDescription>
                  </div>
                </div>

                {/* Total points */}
                <div className="mt-4 flex items-center justify-between p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
                  <span className="text-[11px] uppercase tracking-widest text-white/40 font-semibold">Total Score</span>
                  <span className="text-3xl font-black font-mono text-teal-400 tracking-tight">
                    +{selectedRoundModal.totalPoints}
                    <span className="text-sm font-semibold text-white/30 ml-1">pts</span>
                  </span>
                </div>
              </div>

              {/* Points breakdown */}
              <div className="px-6 py-5 space-y-3">
                {/* Base score */}
                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-xs text-white/40 font-medium">Base Score</span>
                  <span className="font-mono font-black text-sm text-white">
                    {selectedRoundModal.basePoints != null ? `+${selectedRoundModal.basePoints} pts` : '—'}
                  </span>
                </div>

                {/* Match result prediction */}
                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <div>
                    <span className="text-xs text-white/40 font-medium block">Match Result Prediction</span>
                    {selectedRoundModal.matchResult != null && (
                      <span className={`text-[10px] font-semibold mt-0.5 ${selectedRoundModal.matchResult === 'win' ? 'text-emerald-400' : selectedRoundModal.matchResult === 'draw' ? 'text-amber-400' : 'text-rose-400'}`}>
                        {selectedRoundModal.matchResult === 'win' ? '✓ Won' : selectedRoundModal.matchResult === 'draw' ? '~ Draw' : '✗ Lost'}
                      </span>
                    )}
                  </div>
                  <span className={`font-mono font-black text-sm ${selectedRoundModal.matchResultPts == null ? 'text-white/30' : selectedRoundModal.matchResultPts > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {selectedRoundModal.matchResultPts != null
                      ? (selectedRoundModal.matchResultPts > 0 ? `+${selectedRoundModal.matchResultPts}` : selectedRoundModal.matchResultPts) + ' pts'
                      : '—'}
                  </span>
                </div>

                {/* Transfer hits */}
                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-xs text-white/40 font-medium">Transfer Hits Penalty</span>
                  <span className={`font-mono font-black text-sm ${selectedRoundModal.transferHits != null && selectedRoundModal.transferHits < 0 ? 'text-amber-400' : 'text-white/30'}`}>
                    {selectedRoundModal.transferHits != null
                      ? (selectedRoundModal.transferHits < 0 ? `${selectedRoundModal.transferHits} pts` : '—')
                      : '—'}
                  </span>
                </div>

                {/* Notice for old rounds without detail data */}
                {selectedRoundModal.basePoints == null && (
                  <p className="text-center text-[10px] text-white/20 pt-1">
                    Detailed breakdown not available for this round
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 pb-6">
                <button
                  onClick={() => setSelectedRoundModal(null)}
                  className="w-full py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] text-white/50 hover:text-white/80 text-xs font-semibold transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Footer />
    </div>
  );
}
