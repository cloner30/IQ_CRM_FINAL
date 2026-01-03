import { useState, useEffect } from 'react';
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
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const CreateGroup = () => {
  const navigate = useNavigate();
  const { token, isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    client_id: ''
  });

  useEffect(() => {
    // Fetch clients for dropdown (admin only)
    if (isAdmin()) {
      fetchClients();
    }
  }, []);

  const fetchClients = async () => {
    try {
      const response = await axios.get(`${API}/clients`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClients(response.data);
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    }
  };

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
        client_id: formData.client_id || null
      };
      const response = await axios.post(`${API}/groups`, payload);
      toast.success('Group created successfully');
      navigate(`/groups/${response.data.id}`);
    } catch (error) {
      toast.error('Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="create-group-page">
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
          Create New Group
        </h1>
        <p className="text-slate-600 mt-1">Add a new passport group</p>
      </div>

      <Card className="max-w-2xl" data-testid="create-group-form-card">
        <CardHeader>
          <CardTitle className="font-manrope">Group Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
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
            {isAdmin() && clients.length > 0 && (
              <div>
                <Label htmlFor="client" className="text-slate-700 mb-2 block">Link to Client</Label>
                <Select
                  value={formData.client_id}
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
                {loading ? 'Creating...' : 'Create Group'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
