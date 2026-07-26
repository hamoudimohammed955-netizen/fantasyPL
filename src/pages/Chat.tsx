import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { Button } from '../components/ui/button';
 
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { useToast } from '../hooks/use-toast';
import { useLanguage } from '../contexts/LanguageContext';
import { Navigation } from '../components/Navigation';
import { Footer } from '../components/Footer';
import { Send, MessageCircle } from 'lucide-react';
import { Header } from '../components/Header';
import { getInitials, avatarColors, avatarColorsGroup } from '../lib/avatar';

export default function Chat() {
  const [user, setUser] = useState<any>(null);
  const [group, setGroup] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [colorMap, setColorMap] = useState<Record<string, { bg: string; fg: string }>>({});
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const profilesCacheRef = useRef<Map<string, any>>(new Map());
  const optimisticIdsRef = useRef<Set<string>>(new Set());
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (group) {
      loadMessages();
      subscribeToMessages();
      buildGroupColorMap();
    }
  }, [group]);

  // Auto scroll to bottom inside the messages container only
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return;
    }
    setUser(session.user);
    loadGroup(session.user.id);
  };

  // Build same color map as Rankings for exact visual consistency
  const buildGroupColorMap = async () => {
    if (!group) return;
    const gid = group.id as string;
    // get all members
    const { data: membershipRows } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', gid);
    const memberUserIds: string[] = (membershipRows || []).map((m: any) => m.user_id);
    // get all scores for those members
    const { data: scores } = await (supabase as any)
      .from('scores')
      .select('user_id, points')
      .eq('group_id', gid);
    const totals = new Map<string, number>();
    (scores || []).forEach((s: any) => {
      const uid = s.user_id as string;
      totals.set(uid, (totals.get(uid) || 0) + (s.points || 0));
    });
    // ensure include members with no scores yet
    memberUserIds.forEach((uid) => { if (!totals.has(uid)) totals.set(uid, 0); });
    // fallback to message senders if membership not available
    if ((memberUserIds || []).length === 0) {
      Array.from(new Set(messages.map(m => m.user_id).filter(Boolean))).forEach((uid: string) => {
        if (!totals.has(uid)) totals.set(uid, 0);
      });
    }
    // order ids the same way Rankings does (by total desc)
    const orderedIds = Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([uid]) => uid);
    const N = orderedIds.length || 1;
    const newMap: Record<string, { bg: string; fg: string }> = {};
    orderedIds.forEach((id, index) => {
      const hue = Math.round((360 / N) * index);
      const bg = `hsl(${hue} 85% 92%)`;
      const fg = `hsl(${hue} 45% 20%)`;
      newMap[id] = { bg, fg };
    });
    setColorMap(newMap);
  };

  const loadGroup = async (userId: string) => {
    // 1) fetch user's membership to get group_id
    const { data: membership } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    const gid = (membership as any)?.group_id;
    if (!gid) return;

    // 2) fetch group by id
    const { data: g } = await supabase
      .from('groups')
      .select('*')
      .eq('id', gid)
      .single();

    if (g) {
      setGroup(g);
      loadMessages();
    }
  };

  const loadMessages = async () => {
    if (!group) return;

    const { data } = await supabase
      .from('messages')
      .select(`
        *,
        profiles (
          id,
          full_name
        )
      `)
      .eq('group_id', group.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) {
      setMessages(data.slice().reverse());
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `group_id=eq.${group.id}`,
        },
        async (payload) => {
          const uid = payload.new.user_id as string;
          let profile: any = profilesCacheRef.current.get(uid) || null;
          if (!profile) {
            const { data } = await supabase
              .from('profiles')
              .select('id, full_name')
              .eq('id', uid)
              .single();
            if (data) {
              profile = data;
              profilesCacheRef.current.set(uid, data);
            }
          }

          setMessages((prev) => {
            const isOwn = uid === user?.id;
            if (isOwn) {
              const tempIndex = prev.findIndex(
                (m) => String(m.id || '').startsWith('temp-') && m.user_id === uid && m.content === (payload.new as any).content
              );
              if (tempIndex !== -1) {
                const copy = [...prev];
                copy.splice(tempIndex, 1);
                return [
                  ...copy,
                  {
                    ...payload.new,
                    profiles: profile,
                  },
                ];
              }
            }
            return [
              ...prev,
              {
                ...payload.new,
                profiles: profile,
              },
            ];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !group) return;
    if (!user) {
      toast({ title: 'Error', description: 'You must be signed in to send messages.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      // Optimistic UI: append temporary message immediately
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      optimisticIdsRef.current.add(tempId);
      const optimistic = {
        id: tempId,
        group_id: group.id,
        user_id: user.id,
        content: newMessage.trim(),
        created_at: new Date().toISOString(),
        profiles: profilesCacheRef.current.get(user.id) || { id: user.id, full_name: user.email || 'You' },
      } as any;
      setMessages((prev) => [...prev, optimistic]);
      setNewMessage('');

      const { error } = await supabase.from('messages').insert({
        group_id: group.id,
        user_id: user.id,
        content: newMessage.trim(),
      });

      if (error) throw error;
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

      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-4 md:p-6 space-y-4">
        <Card className="flex flex-col h-[65vh] md:h-[70vh] rounded-3xl border border-border/70 bg-card/90 backdrop-blur shadow-2xl overflow-hidden">
          {/* Premier League Chat Header */}
          <div className="px-6 py-4 bg-gradient-to-r from-purple-950 via-indigo-900 to-purple-900 text-white flex items-center justify-between border-b border-white/10 shadow-md">
            <div className="flex items-center gap-3.5">
              {(() => {
                const colors = avatarColorsGroup(group?.id, group?.id, group?.name);
                const initials = getInitials(group?.name || t('chat'));
                return (
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-extrabold shadow-md border border-white/20"
                    style={{ background: colors.bgCss || colors.bg, color: colors.fg }}
                    aria-hidden
                  >
                    {initials}
                  </div>
                );
              })()}
              <div>
                <h2 className="font-extrabold text-base tracking-tight text-white">{group?.name || t('chat')}</h2>
                <div className="flex items-center gap-1.5 text-xs text-teal-300">
                  <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                  <span>Live Group Chat</span>
                </div>
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold border border-white/15 text-purple-200">
              <MessageCircle className="h-3.5 w-3.5 inline mr-1 text-teal-300" />
              {messages.length} messages
            </div>
          </div>

          {/* Messages Container */}
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 scrollbar-none bg-secondary/10">
            {messages.map((message) => {
              const isOwn = message.user_id === user?.id;
              
              return (
                <div
                  key={message.id}
                  className={`flex items-start gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}
                >
                  {(() => {
                    const c = avatarColorsGroup(group?.id, message.user_id, message.profiles?.full_name) || colorMap[message.user_id] || avatarColors(message.user_id, message.profiles?.full_name);
                    const bg = (c as any).bgCss ?? c.bg;
                    const fg = c.fg;
                    return (
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-sm border border-border/40"
                        style={{ background: bg, color: fg }}
                        aria-hidden
                      >
                        {getInitials(message.profiles?.full_name || 'U')}
                      </div>
                    );
                  })()}

                  <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[75%] sm:max-w-[65%]`}>
                    {!isOwn && (
                      <span className="text-[11px] font-semibold text-muted-foreground mb-1 ml-1">
                        {message.profiles?.full_name || 'Member'}
                      </span>
                    )}
                    <div
                      className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        isOwn
                          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-tr-none shadow-md shadow-purple-500/20'
                          : 'bg-card text-card-foreground border border-border/70 rounded-tl-none shadow-sm'
                      }`}
                    >
                      <p className="break-words font-medium">{message.content}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1 px-1 font-mono">
                      {new Date(message.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Chat Input Bar */}
          <form onSubmit={sendMessage} className="p-3 sm:p-4 border-t border-border/60 bg-card">
            <div className="flex items-center gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!loading && newMessage.trim()) {
                      (e.currentTarget.closest('form') as HTMLFormElement)?.requestSubmit();
                    }
                  }
                }}
                placeholder={t('typeMessage')}
                className="flex-1 h-12 rounded-2xl border-border/80 bg-background/60 px-4 text-sm focus:bg-background transition-all"
              />
              <Button 
                type="submit" 
                disabled={loading || !newMessage.trim()} 
                className="h-12 w-12 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/25 shrink-0 transition-all"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </form>
        </Card>
      </div>
      <Footer />
    </div>
  );
}