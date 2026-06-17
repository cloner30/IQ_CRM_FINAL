import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/card';
import api from '../../utils/api';
import { toast } from 'sonner';

export const AccountLedger = () => {
  const { accountId } = useParams();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get(`/accounting/ledger/${accountId}`)
      .then((res) => setData(res.data))
      .catch(() => toast.error('Failed to load ledger'));
  }, [accountId]);

  const account = data?.account;
  const entries = data?.entries || [];

  return (
    <div className="space-y-6">
      <div>
        <Link to="/accounting/accounts" className="text-sm text-muted-foreground hover:underline">← Accounts</Link>
        <h1 className="text-2xl font-bold mt-1">{account?.code} — {account?.name}</h1>
        <p className="text-muted-foreground">Current balance: ${account?.current_balance?.toFixed(2)}</p>
      </div>

      <Card>
        <CardContent className="pt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Date</th>
                <th>Description</th>
                <th className="text-right">Debit</th>
                <th className="text-right">Credit</th>
                <th className="text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.journal_entry_id} className="border-b">
                  <td className="py-2">{e.entry_date}</td>
                  <td>{e.description}</td>
                  <td className="text-right">{e.debit_amount ? `$${e.debit_amount.toFixed(2)}` : ''}</td>
                  <td className="text-right">{e.credit_amount ? `$${e.credit_amount.toFixed(2)}` : ''}</td>
                  <td className="text-right font-medium">${e.running_balance?.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};
