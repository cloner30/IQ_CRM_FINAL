import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Users, Plus, Search, Trash2, Edit, ArrowRight, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../utils/api';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';

export const GroupsList = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteGroupId, setDeleteGroupId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const response = await api.get('/groups');
      setGroups(response.data);
    } catch (error) {
      console.error('Error fetching groups:', error);
      toast.error('Failed to fetch groups');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteGroupId) return;
    try {
      await api.delete(`/groups/${deleteGroupId}`);
      setGroups(groups.filter(g => g.id !== deleteGroupId));
      toast.success('Group deleted successfully');
    } catch (error) {
      toast.error('Failed to delete group');
    } finally {
      setDeleteGroupId(null);
    }
  };

  const filteredGroups = groups.filter(g => {
    const matchesSearch = g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (g.description && g.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (g.client_name && g.client_name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || g.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div data-testid="groups-list-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-manrope font-bold text-slate-900 tracking-tight" data-testid="groups-title">
            Groups
          </h1>
          <p className="text-slate-600 mt-1">Manage your passport groups</p>
        </div>
        <Link to="/groups/new">
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" data-testid="create-group-btn">
            <Plus className="w-4 h-4 mr-2" />
            New Group
          </Button>
        </Link>
      </div>

      <div className="mb-6 flex gap-4 flex-wrap">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="search-input"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="DATA_ENTRY">Data Entry</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="PENDING_PROCESS">Pending Process</option>
          <option value="VISA_SUBMITTED">Visa Submitted</option>
          <option value="VISA_ISSUED">Visa Issued</option>
          <option value="COMPLETED">Completed</option>
        </select>
      </div>

      {/* Groups Grid */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading...</div>
      ) : filteredGroups.length === 0 ? (
        <Card data-testid="empty-state">
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 mb-4">
              {searchQuery ? 'No groups match your search.' : 'No groups yet. Create your first group to get started.'}
            </p>
            {!searchQuery && (
              <Link to="/groups/new">
                <Button variant="outline" data-testid="empty-create-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Group
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" data-testid="groups-grid">
          {filteredGroups.map((group) => (
            <Card key={group.id} className="card-hover cursor-pointer" data-testid={`group-card-${group.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="font-manrope text-lg">{group.name}</CardTitle>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-slate-600"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(`/groups/${group.id}/edit`);
                      }}
                      data-testid={`edit-group-${group.id}`}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-rose-600"
                      onClick={(e) => {
                        e.preventDefault();
                        setDeleteGroupId(group.id);
                      }}
                      data-testid={`delete-group-${group.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {/* Client Badge */}
                {group.client_name && (
                  <div className="flex items-center gap-1 mt-1">
                    <Building2 className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{group.client_name}</span>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-500 mb-2 line-clamp-2">
                  {group.description || 'No description'}
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {group.departure_date && (
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                      {group.departure_date.slice(0, 10)}
                    </span>
                  )}
                  {group.status && (
                    <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                      {group.status.replace(/_/g, ' ')}
                    </span>
                  )}
                  <span className="text-xs font-mono text-slate-400">{group.id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="status-badge neutral">
                    {group.passport_count || 0} passports
                  </span>
                  <Link 
                    to={`/groups/${group.id}`}
                    className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                    data-testid={`view-group-${group.id}`}
                  >
                    View <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteGroupId} onOpenChange={() => setDeleteGroupId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this group? This will also delete all passports in this group. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-rose-600 hover:bg-rose-700"
              data-testid="confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
