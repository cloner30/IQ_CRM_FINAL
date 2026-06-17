import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import { toast } from 'sonner';

export const GroupSplitTab = ({ group, passportCount, onUpdate }) => {
  const { hasPermission } = useAuth();
  const [batches, setBatches] = useState('10,10');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  if (!hasPermission('can_split_groups')) return null;

  const split = async () => {
    const batch_sizes = batches.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !Number.isNaN(n));
    const sum = batch_sizes.reduce((a, b) => a + b, 0);
    if (sum !== passportCount) {
      toast.error(`Batch sizes must sum to ${passportCount} (got ${sum})`);
      return;
    }
    setLoading(true);
    try {
      const res = await api.post(`/groups/${group.id}/split`, { batch_sizes, reason });
      toast.success(`Split into ${res.data.new_groups?.length || 0} groups`);
      onUpdate?.();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Split failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Split Group</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Split {passportCount} passengers into batches (comma-separated sizes).
        </p>
        <div><Label>Batch Sizes</Label><Input value={batches} onChange={(e) => setBatches(e.target.value)} placeholder="e.g. 15,15,10" /></div>
        <div><Label>Reason</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} /></div>
        <Button onClick={split} disabled={loading}>{loading ? 'Splitting...' : 'Split Group'}</Button>
      </CardContent>
    </Card>
  );
};
