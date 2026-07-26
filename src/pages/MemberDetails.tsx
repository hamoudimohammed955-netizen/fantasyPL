import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { Card } from '../components/ui/card';

export default function MemberDetails() {
  const { userId, groupId } = useParams<{ userId: string; groupId: string }>();
  const navigate = useNavigate();
  const [userName, setUserName] = useState<string>('');
  const [rounds, setRounds] = useState<Array<{ round: number; points: number }>>([]);

  useEffect(() => {
    const load = async () => {
      // Protected by route guard; do not redirect here on transient null sessions
      // fetch profile name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single();
      setUserName(profile?.full_name || 'Member');
      const { data: scores } = await (supabase as any)
        .from('scores')
        .select('round, points')
        .eq('user_id', userId)
        .eq('group_id', groupId)
        .order('round', { ascending: true });
      setRounds(scores || []);
    };
    load();
  }, [userId, groupId]);

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">{userName}</h1>
        <Card className="p-4">
          <div className="grid grid-cols-3 gap-2 font-medium text-sm text-muted-foreground mb-2">
            <div>Round</div>
            <div className="col-span-2 text-right">Points</div>
          </div>
          {rounds.map((r) => (
            <div key={r.round} className="grid grid-cols-3 gap-2 py-2 border-t">
              <div>Round {r.round}</div>
              <div className="col-span-2 text-right font-semibold">{r.points}</div>
            </div>
          ))}
          {rounds.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">No rounds yet</div>
          )}
        </Card>
      </div>
    </div>
  );
}
