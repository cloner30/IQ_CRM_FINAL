import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import { toast } from 'sonner';

export const ClientReceipts = () => {
  const { hasPermission } = useAuth();
  const [receipts, setReceipts] = useState([]);
  const [clients, setClients] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    client_id: '', amount_usd: '', payment_date: '', payment_method: 'cash',
    payment_reference: '', notes: '',
  });

  const load = async () => {
    const [r, c] = await Promise.all([
      api.get('/accounting/client-receipts'),
      api.get('/clients').catch(() => ({ data: [] })),
    ]);
    setReceipts(r.data);
    setClients(c.data || []);
  };

  useEffect(() => { load().catch(() => toast.error('Failed to load receipts')); }, []);

  const canRecord = hasPermission('can_record_receipts');

  const submit = async () => {
    try {
      await api.post('/accounting/client-receipts', {
        ...form,
        amount_usd: parseFloat(form.amount_usd),
      });
      toast.success('Receipt recorded');
      setShowForm(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to record receipt');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Link to="/accounting" className="text-sm text-muted-foreground hover:underline">← Accounting</Link>
          <h1 className="text-2xl font-bold mt-1">Client Receipts</h1>
          <p className="text-sm text-muted-foreground">Lump-sum payments from clients (cash in hand)</p>
        </div>
        {canRecord && <Button onClick={() => setShowForm(true)}>Record Payment</Button>}
      </div>

      <Card>
        <CardContent className="pt-6 space-y-2">
          {receipts.length === 0 ? (
            <p className="text-muted-foreground">No receipts yet.</p>
          ) : receipts.map((r) => (
            <div key={r.id} className="flex justify-between border-b py-2">
              <div>
                <p className="font-medium">{r.receipt_number}</p>
                <p className="text-sm text-muted-foreground">{r.client_name} · {r.payment_date}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">${r.amount_usd?.toFixed(2)}</p>
                <p className="text-sm capitalize">{r.status}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Client Receipt</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Client</Label>
              <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Amount (USD)</Label><Input type="number" value={form.amount_usd} onChange={(e) => setForm({ ...form, amount_usd: e.target.value })} /></div>
            <div><Label>Payment Date</Label><Input type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} /></div>
            <div>
              <Label>Method</Label>
              <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['cash', 'bank_transfer', 'upi', 'cheque'].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Reference</Label><Input value={form.payment_reference} onChange={(e) => setForm({ ...form, payment_reference: e.target.value })} /></div>
            <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={submit}>Save Receipt</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
