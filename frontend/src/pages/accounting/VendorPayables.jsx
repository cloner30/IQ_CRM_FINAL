import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/card';
import api from '../../utils/api';
import { toast } from 'sonner';

export const VendorPayables = () => {
  const [payables, setPayables] = useState([]);

  const load = async () => {
    const p = await api.get('/accounting/vendor-payables');
    setPayables(p.data);
  };

  useEffect(() => { load().catch(() => toast.error('Failed to load expected costs')); }, []);

  return (
    <div className="space-y-6">
      <div>
        <Link to="/accounting" className="text-sm text-muted-foreground hover:underline">← Accounting</Link>
        <h1 className="text-2xl font-bold mt-1">Vendor Expected Costs</h1>
        <p className="text-sm text-muted-foreground">
          Expected costs from vendor assignments. Record actual payments on Vendor Payments.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-2">
          {payables.length === 0 ? (
            <p className="text-muted-foreground">No expected costs yet.</p>
          ) : payables.map((p) => (
            <div key={p.id} className="flex justify-between border-b py-2 items-center">
              <div>
                <p className="font-medium">{p.payable_number}</p>
                <p className="text-sm text-muted-foreground">{p.vendor_name} · Due {p.due_date}</p>
                <p className="text-xs text-muted-foreground">Groups: {(p.group_ids || []).join(', ')}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">${p.total_amount_usd?.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">{p.total_passengers} passengers @ ${p.unit_cost?.toFixed(2)}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
