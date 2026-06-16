import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import api from '../../utils/api';

export const GroupFinancialTab = ({ groupId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFinancial = async () => {
      try {
        const response = await api.get(`/groups/${groupId}/financial`);
        setData(response.data);
      } catch (error) {
        console.error('Failed to fetch financial data:', error);
      } finally {
        setLoading(false);
      }
    };
    if (groupId) fetchFinancial();
  }, [groupId]);

  if (loading) return <p className="text-muted-foreground">Loading financial data...</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Financial Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Revenue</p>
            <p className="text-2xl font-bold">${(data?.revenue || 0).toFixed(2)}</p>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Vendor Cost</p>
            <p className="text-2xl font-bold">${(data?.cost || 0).toFixed(2)}</p>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Profit</p>
            <p className="text-2xl font-bold text-green-600">${(data?.profit || 0).toFixed(2)}</p>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Invoice Status</p>
            <p className="text-2xl font-bold capitalize">{data?.invoice?.status || 'N/A'}</p>
          </div>
        </div>
        {data?.invoice && (
          <div className="mt-4 text-sm text-muted-foreground">
            <p>Invoice: {data.invoice.invoice_number}</p>
            <p>Due: {data.invoice.due_date?.slice(0, 10)}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
