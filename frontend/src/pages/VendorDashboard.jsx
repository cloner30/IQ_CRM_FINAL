import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import api from '../utils/api';
import { toast } from 'sonner';

const STATUS_COLORS = {
  PENDING_PROCESS: 'bg-amber-100 text-amber-800',
  VISA_SUBMITTED: 'bg-blue-100 text-blue-800',
  VISA_ISSUED: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-slate-100 text-slate-800',
};

export const VendorDashboard = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const userRes = await api.get('/auth/me');
      const vendorId = userRes.data.vendor_id;
      if (!vendorId) {
        toast.error('No vendor assigned to your account');
        return;
      }
      const response = await api.get(`/vendors/${vendorId}/groups`);
      setGroups(response.data);
    } catch (error) {
      toast.error('Failed to load assigned groups');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Vendor Dashboard</h1>
        <p className="text-muted-foreground mt-1">Groups assigned to your vendor account</p>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : groups.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No groups assigned yet.</CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {groups.map((group) => (
            <Card key={group.id}>
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold">{group.name}</p>
                  <p className="text-sm text-muted-foreground font-mono">{group.id}</p>
                  {group.departure_date && <p className="text-sm">Departure: {group.departure_date.slice(0, 10)}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[group.status] || 'bg-gray-100'}`}>
                    {(group.status || 'PENDING').replace(/_/g, ' ')}
                  </span>
                  <Link to={`/vendor/groups/${group.id}`}>
                    <Button size="sm">View Group</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
