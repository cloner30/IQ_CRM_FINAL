import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import api from '../../utils/api';
import { toast } from 'sonner';

export const AccountingReports = () => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [report, setReport] = useState(null);
  const [type, setType] = useState('pl');

  const run = async (t) => {
    if ((t === 'pl' || t === 'cf') && (!from || !to)) {
      toast.error('Select date range');
      return;
    }
    try {
      let res;
      if (t === 'pl') res = await api.get(`/accounting/profit-loss?from_date=${from}&to_date=${to}`);
      else if (t === 'bs') res = await api.get('/accounting/balance-sheet');
      else if (t === 'tb') res = await api.get('/accounting/trial-balance');
      else res = await api.get(`/accounting/cash-flow?from_date=${from}&to_date=${to}`);
      setReport({ type: t, data: res.data });
      setType(t);
    } catch {
      toast.error('Report failed');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link to="/accounting" className="text-sm text-muted-foreground hover:underline">← Accounting</Link>
        <h1 className="text-2xl font-bold mt-1">Reports</h1>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex gap-4 flex-wrap items-end">
            <div><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => run('pl')}>Profit & Loss</Button>
            <Button variant="outline" onClick={() => run('bs')}>Balance Sheet</Button>
            <Button variant="outline" onClick={() => run('tb')}>Trial Balance</Button>
            <Button variant="outline" onClick={() => run('cf')}>Cash Flow</Button>
          </div>
        </CardContent>
      </Card>

      {report && (
        <Card>
          <CardContent className="pt-6">
            <pre className="text-sm whitespace-pre-wrap overflow-auto">{JSON.stringify(report.data, null, 2)}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
