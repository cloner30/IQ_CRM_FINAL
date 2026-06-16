import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

export const CreateGroup = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const admin = isAdmin();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState([]);
  const [groupId, setGroupId] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    client_id: '',
    departure_date: '',
    passenger_count: '',
  });

  const fetchClients = useCallback(async () => {
    try {
      const response = await api.get('/clients');
      setClients(response.data);
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    }
  }, []);

  useEffect(() => {
    if (admin) fetchClients();
  }, [admin, fetchClients]);

  const handleDepartureDateChange = async (date) => {
    setFormData({ ...formData, departure_date: date });
    if (date) {
      try {
        const response = await api.get('/groups/preview-id', { params: { departure_date: date } });
        setGroupId(response.data.group_id);
      } catch {
        setGroupId('');
      }
    } else {
      setGroupId('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Group name is required');
      return;
    }
    if (!formData.departure_date) {
      toast.error('Departure date is required');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        client_id: formData.client_id || null,
        departure_date: formData.departure_date,
        passenger_count: formData.passenger_count ? parseInt(formData.passenger_count, 10) : null,
      };
      const response = await api.post('/groups', payload);
      toast.success('Group created successfully');
      navigate(`/groups/${response.data.id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="create-group-page">
      <div className="mb-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 text-slate-600 hover:text-slate-900" data-testid="back-btn">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold text-foreground">Create New Group</h1>
        <p className="text-muted-foreground mt-1">Set up a new passenger group for visa processing</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Group Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="departure_date">Departure Date *</Label>
              <Input
                id="departure_date"
                type="date"
                value={formData.departure_date}
                onChange={(e) => handleDepartureDateChange(e.target.value)}
                required
              />
            </div>

            {groupId && (
              <div className="space-y-2">
                <Label>Group ID (auto-generated)</Label>
                <Input value={groupId} readOnly className="bg-muted font-mono" />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Group Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. March 2026 Pilgrimage"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="passenger_count">Planned Passenger Count</Label>
              <Input
                id="passenger_count"
                type="number"
                min="1"
                value={formData.passenger_count}
                onChange={(e) => setFormData({ ...formData, passenger_count: e.target.value })}
                placeholder="e.g. 50"
              />
            </div>

            {admin && (
              <div className="space-y-2">
                <Label htmlFor="client">Client</Label>
                <Select value={formData.client_id} onValueChange={(value) => setFormData({ ...formData, client_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional notes about this group"
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Group'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
