import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useAuth } from '../../contexts/AuthContext';
import { useGroupStatus } from '../../contexts/GroupStatusContext';
import api from '../../utils/api';
import { toast } from 'sonner';

export const GroupVendorTab = ({ group, onUpdate }) => {
  const { hasPermission } = useAuth();
  const { defaultStatus } = useGroupStatus();
  const [vendors, setVendors] = useState([]);
  const [vendorId, setVendorId] = useState('');
  const [loading, setLoading] = useState(false);
  const [unassignReason, setUnassignReason] = useState('');
  const [assignedVendor, setAssignedVendor] = useState(null);

  const submittedStatus = 'SUBMITTED_FOR_PROCESS';
  const vendorAssignedStatus = 'VENDOR_ASSIGNED';
  const canAssign = hasPermission('can_assign_vendor');
  const isSubmitted = group?.status === submittedStatus;
  const isVendorAssigned = Boolean(group?.assigned_vendor_id);

  useEffect(() => {
    api.get('/vendors').then((res) => setVendors(res.data)).catch(() => {});
    if (group?.assigned_vendor_id) {
      api.get(`/vendors/${group.assigned_vendor_id}`)
        .then((res) => setAssignedVendor(res.data))
        .catch(() => setAssignedVendor(null));
    } else {
      setAssignedVendor(null);
    }
  }, [group?.assigned_vendor_id]);

  const assign = async () => {
    if (!vendorId) return;
    setLoading(true);
    try {
      await api.post(`/groups/${group.id}/assign-vendor`, { vendor_id: vendorId });
      toast.success('Vendor assigned — expected cost recorded');
      setVendorId('');
      onUpdate?.();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to assign vendor');
    } finally {
      setLoading(false);
    }
  };

  const unassign = async () => {
    if (!window.confirm('Unassign this vendor? The group will return to Submitted for Process.')) {
      return;
    }
    setLoading(true);
    try {
      await api.post(`/groups/${group.id}/unassign-vendor`, { reason: unassignReason });
      toast.success('Vendor unassigned');
      setUnassignReason('');
      onUpdate?.();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to unassign vendor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Vendor Assignment</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {assignedVendor ? (
          <div className="p-4 bg-muted rounded-lg">
            <p className="font-semibold">{assignedVendor.name}</p>
            <p className="text-sm text-muted-foreground">Code: {assignedVendor.code}</p>
            <p className="text-sm text-muted-foreground">Cost/passport: ${assignedVendor.base_cost_per_passport}</p>
            {group?.assigned_at && (
              <p className="text-xs text-muted-foreground mt-2">Assigned: {group.assigned_at.slice(0, 10)}</p>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground">No vendor assigned yet.</p>
        )}

        {canAssign && !group?.assigned_vendor_id && isSubmitted && (
          <div className="space-y-2">
            <Label>Assign Vendor</Label>
            <Select value={vendorId} onValueChange={setVendorId}>
              <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
              <SelectContent>
                {vendors.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name} (${v.base_cost_per_passport}/passport)</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={assign} disabled={loading || !vendorId}>
              {loading ? 'Assigning...' : 'Assign Vendor'}
            </Button>
          </div>
        )}

        {canAssign && !group?.assigned_vendor_id && group?.status === defaultStatus && (
          <p className="text-sm text-muted-foreground">
            Submit the group for process before assigning a vendor.
          </p>
        )}

        {canAssign && isVendorAssigned && (
          <div className="space-y-2 border-t pt-4">
            <Label>Unassign Vendor</Label>
            <p className="text-sm text-muted-foreground">
              To change vendor or send the group back for reassignment, unassign first. Status cannot be rolled back while a vendor is assigned.
            </p>
            <Textarea
              value={unassignReason}
              onChange={(e) => setUnassignReason(e.target.value)}
              placeholder="Reason for unassigning (optional)"
              rows={2}
            />
            <Button variant="destructive" onClick={unassign} disabled={loading}>
              {loading ? 'Unassigning...' : 'Unassign Vendor'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
