import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import { toast } from 'sonner';

export const VendorLedgers = () => {
  const { canViewGlobalAccounting } = useAuth();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/accounting/vendor-ledgers')
      .then((res) => setVendors(res.data))
      .catch(() => toast.error('Failed to load vendor ledgers'))
      .finally(() => setLoading(false));
  }, []);

  const ledgerLink = (vendorId) => (
    canViewGlobalAccounting()
      ? `/accounting/vendor-ledger/${vendorId}`
      : '/accounting/vendor-ledger'
  );

  if (loading) {
    return <p className="text-muted-foreground p-6">Loading vendor ledgers...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/accounting" className="text-sm text-muted-foreground hover:underline">← Accounting</Link>
        <h1 className="text-2xl font-bold mt-1">Vendor Ledgers</h1>
        <p className="text-sm text-muted-foreground">
          Visas processed, payments made, and balance due per vendor
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 overflow-x-auto">
          {vendors.length === 0 ? (
            <p className="text-muted-foreground">No vendors yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">Vendor</th>
                  <th className="py-2 pr-4 text-right">Groups</th>
                  <th className="py-2 pr-4 text-right">Visas</th>
                  <th className="py-2 pr-4 text-right">Owed</th>
                  <th className="py-2 pr-4 text-right">Paid</th>
                  <th className="py-2 pr-4 text-right">Balance</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.vendor_id} className="border-b">
                    <td className="py-2 pr-4 font-medium">{v.vendor_name}</td>
                    <td className="py-2 pr-4 text-right">{v.groups_assigned ?? 0}</td>
                    <td className="py-2 pr-4 text-right">{v.total_visas_processed ?? 0}</td>
                    <td className="py-2 pr-4 text-right">${(v.total_owed || 0).toFixed(2)}</td>
                    <td className="py-2 pr-4 text-right">${(v.total_paid || 0).toFixed(2)}</td>
                    <td className="py-2 pr-4 text-right font-semibold text-amber-600">
                      ${(v.balance_due || 0).toFixed(2)}
                    </td>
                    <td className="py-2 text-right">
                      <Button size="sm" variant="outline" asChild>
                        <Link to={ledgerLink(v.vendor_id)}>View Ledger</Link>
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
