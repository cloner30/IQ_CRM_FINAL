import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import api from '../../utils/api';
import { toast } from 'sonner';

export const ClientLedgers = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/accounting/client-ledgers')
      .then((res) => setClients(res.data))
      .catch(() => toast.error('Failed to load client ledgers'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-muted-foreground p-6">Loading client ledgers...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/accounting/accounts" className="text-sm text-muted-foreground hover:underline">← Chart of Accounts</Link>
        <h1 className="text-2xl font-bold mt-1">Client Ledgers</h1>
        <p className="text-sm text-muted-foreground">
          Billed amounts, payments received, and balance due per client
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 overflow-x-auto">
          {clients.length === 0 ? (
            <p className="text-muted-foreground">No clients yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">Client</th>
                  <th className="py-2 pr-4 text-right">Groups</th>
                  <th className="py-2 pr-4 text-right">Passengers</th>
                  <th className="py-2 pr-4 text-right">Billed</th>
                  <th className="py-2 pr-4 text-right">Paid</th>
                  <th className="py-2 pr-4 text-right">Balance</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.client_id} className="border-b">
                    <td className="py-2 pr-4 font-medium">{c.client_name}</td>
                    <td className="py-2 pr-4 text-right">{c.groups_submitted ?? 0}</td>
                    <td className="py-2 pr-4 text-right">{c.total_passengers ?? 0}</td>
                    <td className="py-2 pr-4 text-right">${(c.total_billed || 0).toFixed(2)}</td>
                    <td className="py-2 pr-4 text-right">${(c.total_paid || 0).toFixed(2)}</td>
                    <td className="py-2 pr-4 text-right font-semibold text-amber-600">
                      ${(c.balance_due || 0).toFixed(2)}
                    </td>
                    <td className="py-2 text-right">
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/accounting/client-ledger/${c.client_id}`}>View Ledger</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
