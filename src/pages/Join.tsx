import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';

export default function Join() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        if (!code) {
          setError('Invalid invite link');
          setLoading(false);
          return;
        }
        const normalized = String(code || '').trim();
        const { data: grp } = await (supabase as any)
          .from('groups')
          .select('id, name, code')
          .ilike('code', normalized)
          .single();
        if (!grp) {
          setError('Invalid or expired invite');
          setLoading(false);
          return;
        }
        setGroup({ id: grp.id, name: grp.name });
      } catch (e: any) {
        setError(e.message || 'Unexpected error');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [code]);

  const handleJoin = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Save intended redirect
        sessionStorage.setItem('join_redirect_code', code || '');
        navigate('/auth');
        return;
      }
      // Insert membership if not exists
      const { error: insertError } = await supabase
        .from('group_members')
        .insert({ group_id: group!.id, user_id: session.user.id })
        .select()
        .single();
      if (insertError && !String(insertError.message).includes('duplicate')) {
        // If policy prevents duplicates, ignore
      }
      navigate(`/group/${group!.id}`);
    } catch (e) {
      // Navigate to groups on error
      navigate('/groups');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">Loading...</div>
    );
  }

  if (error || !group) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-6">{error || 'Invalid invite'}</Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="p-6 max-w-md w-full space-y-4 text-center">
        <h1 className="text-2xl font-bold">Join group</h1>
        <p>You are invited to join: <span className="font-semibold">{group.name}</span></p>
        <Button className="w-full rounded-full h-11" onClick={handleJoin}>Join</Button>
        <Button variant="outline" className="w-full rounded-full h-11" onClick={() => navigate('/auth')}>Sign in</Button>
      </Card>
    </div>
  );
}
