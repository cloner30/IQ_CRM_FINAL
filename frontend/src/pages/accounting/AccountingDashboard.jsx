import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import api from '../../utils/api';
import { toast } from 'sonner';

export const AccountingDashboard = () => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/accounting/dashboard')
      .then((res) => setStats(res.data))
      .catch(() => toast.error('Failed to load accounting dashboard'));
  }, []);

  const links = [
    { to: '/accounting/receipts', label: 'Client Receipts' },
    { to: '/accounting/payments', label: 'Vendor Payments' },
    { to: '/accounting/vendor-ledgers', label: 'Vendor Ledgers' },
    { to: '/accounting/client-ledgers', label: 'Client Ledgers' },
    { to: '/accounting/accounts', label: 'Chart of Accounts' },
    { to: '/accounting/reports', label: 'Reports' },
    { to: '/accounting/visa-statement', label: 'Visa Statement' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Accounting</h1>
      <p className="text-muted-foreground">Cash-based financial overview</p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Cash Balance', value: `$${(stats?.cash_balance || 0).toFixed(2)}` },
          { label: 'Revenue', value: `$${(stats?.total_revenue || 0).toFixed(2)}` },
          { label: 'Vendor Costs', value: `$${(stats?.total_costs || 0).toFixed(2)}` },
          { label: 'Net Profit', value: `$${(stats?.net_profit || 0).toFixed(2)}`, color: 'text-green-600' },
          { label: 'Total Vendor Balance Due', value: `$${(stats?.total_vendor_balance_due || 0).toFixed(2)}` },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className={`text-2xl font-bold ${item.color || ''}`}>{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        {links.map((l) => (
          <Button key={l.to} variant="outline" asChild>
            <Link to={l.to}>{l.label}</Link>
          </Button>
        ))}
      </div>
    </div>
  );
};
