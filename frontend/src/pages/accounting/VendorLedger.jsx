import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { PartyStatementLedger } from '../../components/accounting/PartyStatementLedger';
import { VisaStatementPanel } from '../../components/accounting/VisaStatementPanel';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import { toast } from 'sonner';

const STATUS_LABELS = {
  SUBMITTED: 'Submitted',
  PENDING_PROCESS: 'Pending Process',
  VISA_SUBMITTED: 'Visa Submitted',
  VISA_ISSUED: 'Visa Issued',
  VISA_REJECTED: 'Visa Rejected',
  COMPLETED: 'Completed',
};

export const VendorLedger = () => {
  const { vendorId } = useParams();
  const { canViewVendorLedger, canViewGlobalAccounting } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const isStaffView = canViewGlobalAccounting() && vendorId;

  useEffect(() => {
    const url = isStaffView
      ? `/accounting/vendor-ledger?vendor_id=${vendorId}`
      : '/accounting/vendor-ledger';
    api.get(url)
      .then((res) => setData(res.data))
      .catch(() => toast.error('Failed to load vendor ledger'))
      .finally(() => setLoading(false));
  }, [vendorId, isStaffView]);

  if (!canViewVendorLedger()) {
    return <p className="text-muted-foreground p-6">You do not have permission to view this ledger.</p>;
  }

  if (loading) {
    return <p className="text-muted-foreground p-6">Loading ledger...</p>;
  }

  const summary = data?.summary || {};

  return (
    <div className="space-y-6">
      <div>
        {isStaffView && (
          <Link to="/accounting/vendor-ledgers" className="text-sm text-muted-foreground hover:underline">
            ← Vendor Ledgers
          </Link>
        )}
        <h1 className="text-3xl font-bold mt-1">Vendor Ledger</h1>
        <p className="text-muted-foreground mt-1">
          {data?.vendor_name} — visas processed and payments recorded
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Groups Assigned', value: summary.groups_assigned ?? 0 },
          { label: 'Visas Processed', value: summary.total_visas_processed ?? 0 },
          { label: 'Total Owed', value: `$${(summary.total_owed || 0).toFixed(2)}` },
          { label: 'Total Paid', value: `$${(summary.total_paid || 0).toFixed(2)}` },
          { label: 'Balance Due', value: `$${(summary.balance_due || 0).toFixed(2)}`, highlight: true },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className={`text-2xl font-bold ${item.highlight ? 'text-amber-600' : ''}`}>{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="statement">
        <TabsList>
          <TabsTrigger value="statement">Ledger (Dr / Cr)</TabsTrigger>
          <TabsTrigger value="visa-details">Visa Details</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="statement" className="mt-4">
          <PartyStatementLedger
            title="Vendor Account Statement"
            lines={data?.statement || []}
            emptyMessage="No visa charges or payments yet."
          />
        </TabsContent>

        <TabsContent value="visa-details" className="mt-4">
          <VisaStatementPanel partyType="vendor" partyId={isStaffView ? vendorId : undefined} />
        </TabsContent>

        <TabsContent value="summary" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Assigned Groups</CardTitle>
            </CardHeader>
            <CardContent>
              {(data?.groups || []).length === 0 ? (
                <p className="text-muted-foreground">No groups assigned yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 pr-4">Group</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Passengers</th>
                        <th className="py-2 pr-4">Rate</th>
                        <th className="py-2">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.groups.map((g) => (
                        <tr key={`${g.payable_number}-${g.group_id}`} className="border-b">
                          <td className="py-2 pr-4">
                            <p className="font-medium">{g.name || g.group_id}</p>
                            <p className="text-xs text-muted-foreground font-mono">{g.group_id}</p>
                          </td>
                          <td className="py-2 pr-4 capitalize">
                            {STATUS_LABELS[g.status] || g.status?.replace(/_/g, ' ')}
                          </td>
                          <td className="py-2 pr-4">{g.passenger_count}</td>
                          <td className="py-2 pr-4">${(g.unit_cost || 0).toFixed(2)}</td>
                          <td className="py-2 font-medium">${(g.expected_cost || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(data?.payments || []).length === 0 ? (
                <p className="text-muted-foreground">No payments recorded yet.</p>
              ) : (
                data.payments.map((p) => (
                  <div key={p.id} className="flex justify-between border-b py-3 text-sm gap-4">
                    <div>
                      <p className="font-medium">{p.payment_number}</p>
                      <p className="text-muted-foreground">{p.payment_date} · {p.payment_method}</p>
                      <p className="text-xs text-muted-foreground">Ref: {p.payment_reference}</p>
                      <p className="text-xs text-muted-foreground">Recorded by: {p.recorded_by}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold">${p.amount_usd?.toFixed(2)}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
