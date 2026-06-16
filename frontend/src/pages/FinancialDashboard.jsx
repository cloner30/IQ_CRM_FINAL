import { useState, useEffect } from 'react';
import { Card, CardContent } from '../components/ui/card';
import api from '../utils/api';
import { toast } from 'sonner';

export const FinancialDashboard = () => {
  const [stats, setStats] = useState(null);
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [dashRes, invRes] = await Promise.all([
          api.get('/financial/dashboard'),
          api.get('/invoices'),
        ]);
        setStats(dashRes.data);
        setInvoices(invRes.data);
      } catch {
        toast.error('Failed to load financial data');
      }
    };
    load();
  }, []);

  const markPaid = async (invoiceId) => {
    try {
      await api.patch(`/invoices/${invoiceId}/mark-paid`);
      toast.success('Invoice marked as paid');
      const invRes = await api.get('/invoices');
      setInvoices(invRes.data);
    } catch {
      toast.error('Failed to update invoice');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Financial Dashboard</h1>
      <p className="text-muted-foreground">Last 30 days overview</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Revenue', value: `$${(stats?.revenue || 0).toFixed(2)}` },
          { label: 'Vendor Costs', value: `$${(stats?.cost || 0).toFixed(2)}` },
          { label: 'Profit', value: `$${(stats?.profit || 0).toFixed(2)}`, color: 'text-green-600' },
          { label: 'Margin', value: `${stats?.margin_percent || 0}%` },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className={`text-2xl font-bold ${item.color || ''}`}>{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <h2 className="font-semibold mb-4">Invoices</h2>
          {invoices.length === 0 ? (
            <p className="text-muted-foreground">No invoices yet.</p>
          ) : (
            <div className="space-y-2">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex justify-between items-center border-b py-2">
                  <div>
                    <p className="font-medium">{inv.invoice_number}</p>
                    <p className="text-sm text-muted-foreground">Group: {inv.group_id}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold">${inv.total_amount?.toFixed(2)}</span>
                    <span className="text-sm capitalize">{inv.status}</span>
                    {inv.status !== 'paid' && (
                      <button className="text-sm text-primary hover:underline" onClick={() => markPaid(inv.id)}>
                        Mark Paid
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
