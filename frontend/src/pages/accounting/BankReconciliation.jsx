import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import api from '../../utils/api';
import { toast } from 'sonner';

export const BankReconciliation = () => {
  const [unreconciled, setUnreconciled] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [selected, setSelected] = useState([]);
  const [form, setForm] = useState({ account_id: '', statement_date: '', statement_balance: '' });

  useEffect(() => {
    Promise.all([
      api.get('/accounting/reconciliation/unreconciled-receipts'),
      api.get('/accounting/accounts?account_type=asset'),
    ]).then(([u, a]) => {
      setUnreconciled(u.data);
      setAccounts((a.data || []).filter((x) => x.category === 'bank'));
    }).catch(() => toast.error('Failed to load reconciliation data'));
  }, []);

  const toggle = (id) => {
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  };

  const reconcile = async () => {
    try {
      const res = await api.post('/accounting/reconciliation/bank-statement', {
        account_id: form.account_id,
        statement_date: form.statement_date,
        statement_balance: parseFloat(form.statement_balance),
        matched_receipt_ids: selected,
      });
      toast.success(`Reconciled ${res.data.matched_receipts} receipts. Difference: $${res.data.difference}`);
      const u = await api.get('/accounting/reconciliation/unreconciled-receipts');
      setUnreconciled(u.data);
      setSelected([]);
    } catch {
      toast.error('Reconciliation failed');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link to="/accounting" className="text-sm text-muted-foreground hover:underline">← Accounting</Link>
        <h1 className="text-2xl font-bold mt-1">Bank Reconciliation</h1>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Bank Account</Label>
              <Select value={form.account_id} onValueChange={(v) => setForm({ ...form, account_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Statement Date</Label><Input type="date" value={form.statement_date} onChange={(e) => setForm({ ...form, statement_date: e.target.value })} /></div>
            <div><Label>Statement Balance</Label><Input type="number" value={form.statement_balance} onChange={(e) => setForm({ ...form, statement_balance: e.target.value })} /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="font-semibold mb-3">Unreconciled Receipts</h2>
          {unreconciled.length === 0 ? (
            <p className="text-muted-foreground">All receipts reconciled.</p>
          ) : unreconciled.map((r) => (
            <label key={r.id} className="flex items-center gap-3 border-b py-2 cursor-pointer">
              <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggle(r.id)} />
              <span className="flex-1">{r.receipt_number} — {r.client_name}</span>
              <span className="font-medium">${r.amount_usd?.toFixed(2)}</span>
            </label>
          ))}
          <Button className="mt-4" onClick={reconcile} disabled={!form.account_id}>Reconcile Selected</Button>
        </CardContent>
      </Card>
    </div>
  );
};
