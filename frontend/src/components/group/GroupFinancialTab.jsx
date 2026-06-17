import { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import { toast } from 'sonner';

export const GroupFinancialTab = ({ groupId }) => {
  const { hasPermission } = useAuth();
  const hasFinancial = hasPermission('can_view_global_accounting');
  const canManagePricing = hasPermission('can_manage_financial');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pricingForm, setPricingForm] = useState({ base_price_per_passport: '', rush_fee: '' });

  const load = useCallback(async () => {
    try {
      const response = await api.get(`/groups/${groupId}/financial`);
      setData(response.data);
      setPricingForm({
        base_price_per_passport: String(response.data.base_price_per_passport ?? ''),
        rush_fee: String(response.data.rush_fee ?? ''),
      });
    } catch (error) {
      console.error('Failed to fetch financial data:', error);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    if (groupId && hasFinancial) load();
    else setLoading(false);
  }, [groupId, hasFinancial, load]);

  const savePricing = async () => {
    setSaving(true);
    try {
      const response = await api.patch(`/groups/${groupId}/pricing`, {
        base_price_per_passport: parseFloat(pricingForm.base_price_per_passport),
        rush_fee: parseFloat(pricingForm.rush_fee) || 0,
      });
      setData(response.data);
      setEditing(false);
      toast.success('Group pricing updated');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update pricing');
    } finally {
      setSaving(false);
    }
  };

  if (!hasFinancial) {
    return <p className="text-muted-foreground">You do not have permission to view financial data.</p>;
  }

  if (loading) return <p className="text-muted-foreground">Loading financial data...</p>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Group Financial Summary</CardTitle>
          {data?.is_custom_pricing && (
            <Badge variant="secondary">Custom rate</Badge>
          )}
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-4 bg-muted/50 rounded-lg space-y-2 text-sm">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <span>
                <span className="text-muted-foreground">Rate per passport: </span>
                <span className="font-medium">${(data?.base_price_per_passport || 0).toFixed(2)}</span>
              </span>
              <span>
                <span className="text-muted-foreground">Rush fee: </span>
                <span className="font-medium">${(data?.rush_fee || 0).toFixed(2)}</span>
              </span>
              <span>
                <span className="text-muted-foreground">Passengers: </span>
                <span className="font-medium">{data?.passenger_count ?? 0}</span>
              </span>
            </div>
            {data?.is_custom_pricing && (
              <p className="text-xs text-muted-foreground">
                Client default: ${(data?.client_base_price_per_passport || 0).toFixed(2)}/passport
                {data?.client_rush_fee > 0 ? ` + $${data.client_rush_fee.toFixed(2)} rush` : ''}
              </p>
            )}
            {canManagePricing && !editing && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                Edit group rate
              </Button>
            )}
            {canManagePricing && editing && (
              <div className="pt-2 space-y-3 border-t">
                <div className="grid grid-cols-2 gap-3 max-w-md">
                  <div>
                    <Label htmlFor="group_base_price">Rate per passport (USD)</Label>
                    <Input
                      id="group_base_price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={pricingForm.base_price_per_passport}
                      onChange={(e) => setPricingForm({ ...pricingForm, base_price_per_passport: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="group_rush_fee">Rush fee (USD)</Label>
                    <Input
                      id="group_rush_fee"
                      type="number"
                      min="0"
                      step="0.01"
                      value={pricingForm.rush_fee}
                      onChange={(e) => setPricingForm({ ...pricingForm, rush_fee: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={savePricing} disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(false);
                      setPricingForm({
                        base_price_per_passport: String(data?.base_price_per_passport ?? ''),
                        rush_fee: String(data?.rush_fee ?? ''),
                      });
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Suggested Revenue</p>
              <p className="text-2xl font-bold">${(data?.suggested_revenue || 0).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Pricing hint only</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Expected Vendor Cost</p>
              <p className="text-2xl font-bold">${(data?.expected_vendor_cost || 0).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">From vendor assignment</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
