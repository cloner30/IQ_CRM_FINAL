import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import api from '../../utils/api';

const GROUP_STATUSES = [
  'DATA_ENTRY', 'SUBMITTED', 'PENDING_PROCESS', 'VISA_SUBMITTED',
  'VISA_ISSUED', 'VISA_REJECTED', 'COMPLETED',
];

const STATUS_LABELS = {
  DATA_ENTRY: 'Data Entry',
  SUBMITTED: 'Submitted',
  PENDING_PROCESS: 'Pending Process',
  VISA_SUBMITTED: 'Visa Submitted',
  VISA_ISSUED: 'Visa Issued',
  VISA_REJECTED: 'Visa Rejected',
  COMPLETED: 'Completed',
};

export const GroupStatusTab = ({ group, onUpdate }) => {
  const [newStatus, setNewStatus] = useState(group?.status || 'DATA_ENTRY');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.patch(`/groups/${group.id}/status`, { new_status: newStatus, reason });
      toast.success('Status updated');
      onUpdate?.();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Group Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Current Status</Label>
          <p className="text-lg font-semibold mt-1">
            {STATUS_LABELS[group?.status] || group?.status || 'DATA_ENTRY'}
          </p>
        </div>
        <div className="space-y-2">
          <Label>Change Status To</Label>
          <Select value={newStatus} onValueChange={setNewStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {GROUP_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Reason</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional reason for status change" rows={3} />
        </div>
        <Button onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Save Status'}</Button>
      </CardContent>
    </Card>
  );
};
