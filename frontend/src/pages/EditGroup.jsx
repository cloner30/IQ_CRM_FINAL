import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

export const EditGroup = () => {
  const navigate = useNavigate();
  const { groupId } = useParams();
  const { isAdmin } = useAuth();
  const admin = isAdmin();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [clients, setClients] = useState([]);
  const [groupStatus, setGroupStatus] = useState('DATA_ENTRY');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    client_id: '',
    departure_date: '',
    passenger_count: '',
  });

  const fetchGroup = useCallback(async () => {
    try {
      const response = await api.get(`/groups/${groupId}`);
      const group = response.data;
      setFormData({
        name: group.name || '',
        description: group.description || '',
        client_id: group.client_id || '',
        departure_date: group.departure_date ? group.departure_date.slice(0, 10) : '',
        passenger_count: group.passenger_count?.toString() || '',
      });
      setGroupStatus(group.status || 'DATA_ENTRY');
    } catch (error) {
      console.error('Failed to fetch group:', error);
      toast.error('Failed to load group');
      navigate('/groups');
    } finally {
      setFetching(false);
    }
  }, [groupId, navigate]);

  const fetchClients = useCallback(async () => {
    try {
      const response = await api.get('/clients');
      setClients(response.data);
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    }
  }, []);

  useEffect(() => {
    fetchGroup();
    if (admin) {
      fetchClients();
    }
  }, [groupId, fetchGroup, fetchClients, admin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Group name is required');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        client_id: formData.client_id || null,
        departure_date: formData.departure_date || null,
        passenger_count: formData.passenger_count ? parseInt(formData.passenger_count, 10) : null,
      };
      await api.put(`/groups/${groupId}`, payload);
      toast.success('Group updated successfully');
      navigate(`/groups/${groupId}`);
    } catch (error) {
      toast.error('Failed to update group');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div data-testid="edit-group-page">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-4 text-slate-600 hover:text-slate-900"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-manrope font-bold text-slate-900 tracking-tight" data-testid="page-title">
          Edit Group
        </h1>
        <p className="text-slate-600 mt-1">Update group details</p>
      </div>

      <Card className="max-w-2xl" data-testid="edit-group-form-card">
        <CardHeader>
          <CardTitle className="font-manrope">Group Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="departure_date" className="text-slate-700 mb-2 block">Departure Date</Label>
              <Input
                id="departure_date"
                type="date"
                value={formData.departure_date}
                onChange={(e) => setFormData({ ...formData, departure_date: e.target.value })}
                disabled={groupStatus !== 'DATA_ENTRY'}
              />
            </div>

            <div>
              <Label htmlFor="passenger_count" className="text-slate-700 mb-2 block">Planned Passenger Count</Label>
              <Input
                id="passenger_count"
                type="number"
                value={formData.passenger_count}
                onChange={(e) => setFormData({ ...formData, passenger_count: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="name" className="text-slate-700 mb-2 block">Group Name *</Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter group name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="group-name-input"
              />
            </div>
            
            {/* Client Selection (Admin only) */}
            {admin && clients.length > 0 && (
              <div>
                <Label htmlFor="client" className="text-slate-700 mb-2 block">Link to Client</Label>
                <Select
                  value={formData.client_id || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, client_id: value === 'none' ? '' : value })}
                >
                  <SelectTrigger data-testid="client-select">
                    <SelectValue placeholder="Select a client (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Client</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name} {client.company_name && `(${client.company_name})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Optionally link this group to a client for organization
                </p>
              </div>
            )}
            
            <div>
              <Label htmlFor="description" className="text-slate-700 mb-2 block">Description</Label>
              <Textarea
                id="description"
                placeholder="Enter group description (optional)"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                data-testid="group-description-input"
              />
            </div>
            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
                data-testid="cancel-btn"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                data-testid="submit-btn"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
