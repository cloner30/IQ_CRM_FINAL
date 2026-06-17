import { useState } from 'react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import api from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { useGroupStatus } from '../../contexts/GroupStatusContext';
import { VisaOutcomeDialog } from './VisaOutcomeDialog';

const VISA_OUTCOME_STATUSES = new Set(['VISA_ISSUED', 'VISA_REJECTED']);

export const GroupStatusUpdater = ({ group, passports = [], onUpdate, onSubmit }) => {
  const { canUpdateGroupStatus, canSubmitGroup } = useAuth();
  const { getAllowedTransitions, getActionLabel, defaultStatus } = useGroupStatus();
  const current = group?.status || defaultStatus;
  const allowed = getAllowedTransitions(current);
  const assignedVendorId = group?.assigned_vendor_id;
  const blockedTargets = assignedVendorId
    ? new Set([defaultStatus, 'SUBMITTED_FOR_PROCESS'])
    : new Set();
  const effectiveAllowed = allowed.filter((t) => !blockedTargets.has(t));
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [visaDialogOpen, setVisaDialogOpen] = useState(false);

  const canUpdate = canUpdateGroupStatus();
  const canSubmit = canSubmitGroup() && current === defaultStatus && !assignedVendorId;

  if (!canUpdate && !canSubmit) return null;

  const handleTransition = async (newStatus) => {
    if (VISA_OUTCOME_STATUSES.has(newStatus)) {
      setVisaDialogOpen(true);
      return;
    }
    setLoading(true);
    try {
      await api.patch(`/groups/${group.id}/status`, { new_status: newStatus, reason: '' });
      toast.success('Status updated');
      onUpdate?.();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await api.post(`/groups/${group.id}/submit`);
      toast.success('Group submitted for process');
      onSubmit?.();
      onUpdate?.();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit group');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="rounded-lg border bg-slate-50 p-4 space-y-3">
        <p className="text-sm font-medium text-slate-700">Status actions</p>
        <div className="flex flex-wrap gap-2">
          {canSubmit && (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={submitting || loading}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {submitting ? 'Submitting...' : 'Submit for Process'}
            </Button>
          )}
          {canUpdate && effectiveAllowed.map((target) => (
            <Button
              key={target}
              size="sm"
              variant={target === 'VISA_REJECTED' ? 'destructive' : 'outline'}
              onClick={() => handleTransition(target)}
              disabled={loading || submitting}
            >
              {getActionLabel(target)}
            </Button>
          ))}
          {canUpdate && effectiveAllowed.length === 0 && !canSubmit && (
            <p className="text-sm text-muted-foreground">No further status transitions available.</p>
          )}
        </div>
      </div>

      <VisaOutcomeDialog
        open={visaDialogOpen}
        onOpenChange={setVisaDialogOpen}
        group={group}
        passports={passports}
        onComplete={() => onUpdate?.()}
      />
    </>
  );
};

export default GroupStatusUpdater;
