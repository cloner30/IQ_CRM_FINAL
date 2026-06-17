import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { ScrollArea } from '../ui/scroll-area';
import { toast } from 'sonner';
import api from '../../utils/api';

const MODES = {
  ALL_ISSUED: 'all_issued',
  SOME_REJECTED: 'some_rejected',
};

export const VisaOutcomeDialog = ({ open, onOpenChange, group, passports = [], onComplete }) => {
  const [mode, setMode] = useState(MODES.ALL_ISSUED);
  const [outcomes, setOutcomes] = useState({});
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const initial = {};
    passports.forEach((p) => {
      initial[p.id] = 'visa_issued';
    });
    setOutcomes(initial);
    setMode(MODES.ALL_ISSUED);
    setReason('');
  }, [open, passports]);

  const counts = useMemo(() => {
    const values = Object.values(outcomes);
    return {
      issued: values.filter((v) => v === 'visa_issued').length,
      rejected: values.filter((v) => v === 'visa_rejected').length,
    };
  }, [outcomes]);

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    if (nextMode === MODES.ALL_ISSUED) {
      const allIssued = {};
      passports.forEach((p) => {
        allIssued[p.id] = 'visa_issued';
      });
      setOutcomes(allIssued);
    }
  };

  const setPassengerOutcome = (passportId, visaStatus) => {
    setOutcomes((prev) => ({ ...prev, [passportId]: visaStatus }));
  };

  const handleConfirm = async () => {
    if (passports.length === 0) {
      toast.error('No passengers in this group');
      return;
    }
    if (counts.rejected > 0 && !reason.trim()) {
      toast.error('Please provide a reason when any passenger is rejected');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        outcomes: passports.map((p) => ({
          passport_id: p.id,
          visa_status: outcomes[p.id] || 'visa_issued',
        })),
        reason: reason.trim(),
      };
      const response = await api.post(`/groups/${group.id}/complete-visa-outcome`, payload);
      const summary = response.data.summary;
      toast.success(
        `Visa processing complete: ${summary.issued} issued, ${summary.rejected} rejected`
      );
      onOpenChange(false);
      onComplete?.(response.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to complete visa processing');
    } finally {
      setLoading(false);
    }
  };

  const passengerLabel = (p) => {
    const name = [p.first_name_en, p.surname_en].filter(Boolean).join(' ');
    return name || p.passport_no || p.id;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Complete visa processing</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-lg border bg-slate-50 p-3 text-sm">
          <span className="rounded-full bg-green-100 px-2.5 py-0.5 font-medium text-green-800">
            {counts.issued} Visa Issued
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="rounded-full bg-red-100 px-2.5 py-0.5 font-medium text-red-800">
            {counts.rejected} Visa Rejected
          </span>
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Outcome</Label>
          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => handleModeChange(MODES.ALL_ISSUED)}
              className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                mode === MODES.ALL_ISSUED
                  ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className="font-medium">All passengers — Visa Issued</span>
              <p className="mt-1 text-muted-foreground">Mark every passenger as visa issued</p>
            </button>
            <button
              type="button"
              onClick={() => handleModeChange(MODES.SOME_REJECTED)}
              className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                mode === MODES.SOME_REJECTED
                  ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className="font-medium">Some passengers — Visa Rejected</span>
              <p className="mt-1 text-muted-foreground">Choose issued or rejected per passenger</p>
            </button>
          </div>
        </div>

        {mode === MODES.SOME_REJECTED && (
          <ScrollArea className="max-h-56 rounded-lg border">
            <div className="divide-y">
              {passports.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{passengerLabel(p)}</p>
                    {p.passport_no && (
                      <p className="truncate text-xs text-muted-foreground">{p.passport_no}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={outcomes[p.id] === 'visa_issued' ? 'default' : 'outline'}
                      className={
                        outcomes[p.id] === 'visa_issued'
                          ? 'bg-green-600 hover:bg-green-700'
                          : ''
                      }
                      onClick={() => setPassengerOutcome(p.id, 'visa_issued')}
                    >
                      Issued
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={outcomes[p.id] === 'visa_rejected' ? 'destructive' : 'outline'}
                      onClick={() => setPassengerOutcome(p.id, 'visa_rejected')}
                    >
                      Rejected
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {counts.rejected > 0 && (
          <div className="space-y-1">
            <Label className="text-xs">Reason (required for rejections)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for visa rejection(s)"
              rows={2}
              className="text-sm"
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={loading || passports.length === 0}>
            {loading ? 'Saving...' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VisaOutcomeDialog;
