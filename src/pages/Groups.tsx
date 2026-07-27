import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { useToast } from '../hooks/use-toast';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Plus, UserPlus, ArrowRight, Users, Shield, Copy, Trophy } from 'lucide-react';
import { Navigation } from '../components/Navigation';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';

interface Group {
  id: string;
  created_at: string;
  name: string;
  code: string;
  created_by: string;
}

interface GroupWithMembers extends Group {
  member_count: number;
}

export default function Groups() {
  const [groupName, setGroupName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [myGroups, setMyGroups] = useState<GroupWithMembers[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [newGroup, setNewGroup] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    const loadGroups = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUser(session.user);
      try {
        // 1) Get the user's group_ids from membership
        const { data: memberships, error: memErr } = await supabase
          .from('group_members')
          .select('group_id')
          .eq('user_id', session.user.id);

        if (memErr) throw memErr;

        const groupIds = (memberships || []).map((m: any) => m.group_id).filter(Boolean);
        if (groupIds.length === 0) {
          setMyGroups([]);
          return;
        }

        // 2) Fetch groups by ids
        const { data: groups, error: groupsErr } = await supabase
          .from('groups')
          .select('*')
          .in('id', groupIds);

        if (groupsErr) throw groupsErr;

        // 3) Compute member counts with a single query for all groupIds
        const { data: allMemberships } = await supabase
          .from('group_members')
          .select('group_id')
          .in('group_id', groupIds);

        const countsMap = new Map<string, number>();
        (allMemberships || []).forEach((m: any) => {
          countsMap.set(m.group_id, (countsMap.get(m.group_id) || 0) + 1);
        });

        const withCounts: GroupWithMembers[] = (groups || []).map((g: any) => ({
          ...g,
          member_count: countsMap.get(g.id) || 0,
        }));

        setMyGroups(withCounts);
      } catch (error) {
        console.error("Error loading groups:", error);
        toast({
          title: "Error",
          description: "Could not load your groups.",
          variant: "destructive",
        });
      }
    };

    loadGroups();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate, toast]);


  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!user) {
        throw new Error("User not authenticated");
      }
      // Generate unique code
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();

      const { data: group, error } = await supabase
        .from('groups')
        .insert({
          name: groupName,
          code,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Auto-join the creator
      await supabase.from('group_members').insert({
        group_id: group.id,
        user_id: user.id,
      });

      toast({
        title: "Group created!",
        description: `Code: ${code}`,
      });

      setGroupName('');
      const newGroupForState: GroupWithMembers = { ...group, member_count: 1 };
      setMyGroups(currentGroups => [...currentGroups, newGroupForState]);
      navigate(`/group/${group.id}`);

    } catch (error: any) {
      toast({
        title: t('error'),
        description: error?.message || t('somethingWentWrong'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const joinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!user) throw new Error("User not authenticated");

      // 1. Find the group by code
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('id, name')
        .eq('code', joinCode.toUpperCase())
        .single();

      if (groupError || !group) {
        throw new Error("Group not found");
      }

      // 2. Check if user is already a member
      const { data: existingMembership, error: memberCheckError } = await supabase
        .from('group_members')
        .select('id')
        .eq('user_id', user.id)
        .eq('group_id', group.id)
        .maybeSingle();

      if (memberCheckError) {
        throw memberCheckError;
      }

      if (existingMembership) {
        toast({
          title: "Info",
          description: "You are already a member of this group.",
        });
        setJoinCode('');
        return; // Stop execution, it's not an error.
      }

      // 3. If not a member, join the group
      const { error: insertError } = await supabase.from('group_members').insert({
        group_id: group.id,
        user_id: user.id,
      });

      if (insertError) {
        // Fallback for race conditions or other errors
        if (insertError.code === '23505') {
           toast({
              title: "Info",
              description: "You are already a member of this group.",
            });
            setJoinCode('');
            return;
        }
        throw insertError;
      }

      toast({
        title: "Joined group!",
        description: `Welcome to ${group.name}`,
      });

      setJoinCode('');
      navigate(`/group/${group.id}`);
    } catch (error: any) {
      toast({
        title: "Error joining group",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyGroupLink = (code: string) => {
    const link = `${window.location.origin}/join/${code}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Link copied!",
      description: "Share this link with your friends",
    });
  };

  

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <Navigation />

      <div className="max-w-6xl mx-auto p-4 md:p-8 flex-1 w-full space-y-8">
        {/* Premier League Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-950 via-indigo-900 to-purple-900 text-white p-6 sm:p-8 shadow-2xl border border-white/15">
          <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-12 -top-12 w-64 h-64 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-teal-300 border border-white/15">
                <Trophy className="h-3.5 w-3.5" /> Premier Fantasy Hub
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-purple-100 to-teal-200 bg-clip-text text-transparent">
                {t('groups')}
              </h1>
              <p className="text-xs sm:text-sm text-purple-200/80 leading-relaxed">
                Create or join private fantasy mini-leagues, track points each round, and compete with friends!
              </p>
            </div>

            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/15 shrink-0">
              <div className="bg-gradient-to-br from-teal-400 to-emerald-500 p-2.5 rounded-xl text-purple-950 font-bold shadow-md">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs text-purple-200">{t('myGroups') || 'My Groups'}</div>
                <div className="text-xl font-bold font-mono text-white">{myGroups.length}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Cards (Create & Join) */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Create Group */}
          <Card className="p-6 sm:p-8 rounded-3xl border border-border/60 bg-card/80 backdrop-blur shadow-xl hover:shadow-2xl transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full pointer-events-none transition-all group-hover:scale-110" />
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-gradient-to-br from-purple-600 to-indigo-700 p-3.5 rounded-2xl text-white shadow-lg shadow-purple-500/25">
                <Plus className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold">{t('createNewGroup')}</h2>
                <p className="text-xs text-muted-foreground">Start a new mini-league for your friends</p>
              </div>
            </div>

            <form onSubmit={createGroup} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {t('groupName')}
                </label>
                <Input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g., League Champions 2026"
                  required
                  className="h-12 rounded-xl border-border/80 bg-background/50 focus:bg-background transition-all px-4 text-sm"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full h-12 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-purple-500/25 transition-all text-sm"
                disabled={loading}
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('createGroup')}
              </Button>
            </form>
          </Card>

          {/* Join Group */}
          <Card className="p-6 sm:p-8 rounded-3xl border border-border/60 bg-card/80 backdrop-blur shadow-xl hover:shadow-2xl transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-bl-full pointer-events-none transition-all group-hover:scale-110" />
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-gradient-to-br from-teal-500 to-emerald-600 p-3.5 rounded-2xl text-white shadow-lg shadow-teal-500/25">
                <UserPlus className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold">{t('joinGroup')}</h2>
                <p className="text-xs text-muted-foreground">Enter code to join an existing group</p>
              </div>
            </div>

            <form onSubmit={joinGroup} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {t('groupCode')}
                </label>
                <Input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder={t('enterCode')}
                  required
                  className="uppercase h-12 rounded-xl border-border/80 bg-background/50 focus:bg-background font-mono tracking-wider transition-all px-4 text-sm"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full h-12 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-semibold shadow-lg shadow-teal-500/25 transition-all text-sm"
                disabled={loading}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                {t('join')}
              </Button>
            </form>
          </Card>
        </div>

        {/* My Groups Section */}
        <div className="space-y-5 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold tracking-tight">{t('myGroups') || 'My Groups'}</h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {myGroups.length}
              </span>
            </div>
          </div>

          {myGroups.length === 0 ? (
            <Card className="p-12 text-center rounded-3xl border border-dashed border-border bg-card/50">
              <div className="max-w-md mx-auto space-y-3">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                  <Users className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-lg">No groups joined yet</h3>
                <p className="text-sm text-muted-foreground">Create a new group above or enter a code to join your friends!</p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myGroups.map((group) => (
                <Link to={`/group/${group.id}`} key={group.id} className="block group">
                  <Card className="rounded-3xl border border-border/70 hover:border-primary/50 bg-card hover:bg-card/90 shadow-md hover:shadow-2xl transition-all duration-300 h-full flex flex-col overflow-hidden relative">
                    <div className="p-6 flex-grow flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-lg text-foreground group-hover:text-primary transition-colors truncate">
                            {group.name}
                          </span>
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary text-xs font-semibold text-secondary-foreground shrink-0">
                            <Users className="h-3.5 w-3.5 text-primary" />
                            <span>{group.member_count}</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 flex items-center justify-between border-t border-border/50 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{t('code')}:</span>
                          <span className="font-mono bg-primary/10 text-primary px-2.5 py-1 rounded-lg font-bold tracking-wider">
                            {group.code}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              copyGroupLink(group.code);
                            }}
                            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                            title="Copy Invite Link"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                          <ArrowRight className="h-4 w-4 transform group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
