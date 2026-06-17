import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import { toast } from 'sonner';

export const ChartOfAccounts = () => {
  const { hasPermission } = useAuth();
  const [accounts, setAccounts] = useState([]);

  const load = () => api.get('/accounting/accounts').then((res) => setAccounts(res.data));

  useEffect(() => { load().catch(() => toast.error('Failed to load accounts')); }, []);

  const initCoa = async () => {
    try {
      await api.post('/accounting/initialize');
      toast.success('Chart of accounts initialized');
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Initialize failed');
    }
  };

  const updateOpening = async (account) => {
    const val = prompt('Opening balance:', account.opening_balance);
    if (val === null) return;
    try {
      await api.put(`/accounting/accounts/${account.id}`, { opening_balance: parseFloat(val) });
      toast.success('Updated');
      load();
    } catch {
      toast.error('Update failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Link to="/accounting" className="text-sm text-muted-foreground hover:underline">← Accounting</Link>
          <h1 className="text-2xl font-bold mt-1">Chart of Accounts</h1>
          <p className="text-sm text-muted-foreground">Cash-basis GL accounts. Client and vendor balances are in Party Ledgers below.</p>
        </div>
        {hasPermission('can_initialize_accounts') && (
          <Button variant="outline" onClick={initCoa}>Initialize COA</Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Code</th>
                <th>Name</th>
                <th>Type</th>
                <th className="text-right">Balance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="border-b">
                  <td className="py-2 font-mono">{a.code}</td>
                  <td>{a.name}</td>
                  <td className="capitalize">{a.account_type}</td>
                  <td className="text-right font-semibold">${a.current_balance?.toFixed(2)}</td>
                  <td className="text-right">
                    <Button size="sm" variant="ghost" asChild>
                      <Link to={`/accounting/ledger/${a.id}`}>Ledger</Link>
                    </Button>
                    {hasPermission('can_initialize_accounts') && (
                      <Button size="sm" variant="ghost" onClick={() => updateOpening(a)}>Edit Opening</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Party Ledgers</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" asChild>
            <Link to="/accounting/client-ledgers">Client Ledgers</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/accounting/vendor-ledgers">Vendor Ledgers</Link>
          </Button>
          <p className="w-full text-sm text-muted-foreground mt-2">
            Per-client and per-vendor balances: visas/groups processed, payments recorded, and amount due.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
