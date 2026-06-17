import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Search, Users, Shield, User, Building2 } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const UsersManagement = () => {
  const { token, user: currentUser, isSuperAdmin } = useAuth();
  const superAdmin = isSuperAdmin();
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
    role: 'client_staff',
    client_id: '',
    vendor_id: '',
    status: 'active',
  });
  const [vendors, setVendors] = useState([]);

  const fetchVendors = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/vendors`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) setVendors(await response.json());
    } catch (error) {
      console.error('Failed to fetch vendors:', error);
    }
  }, [token]);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchClients = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/clients`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setClients(data);
      }
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    }
  }, [token]);

  useEffect(() => {
    fetchUsers();
    if (superAdmin) {
      fetchClients();
      fetchVendors();
    }
  }, [fetchUsers, fetchClients, fetchVendors, superAdmin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const clientRoles = ['client_admin', 'client_staff', 'client_accounts'];
    const vendorRoles = ['vendor_admin', 'vendor_staff', 'vendor_accounts'];
    if (clientRoles.includes(formData.role) && !formData.client_id && isSuperAdmin()) {
      toast.error('Please select a client for this user');
      return;
    }
    if (vendorRoles.includes(formData.role) && !formData.vendor_id && isSuperAdmin()) {
      toast.error('Please select a vendor for this user');
      return;
    }
    
    try {
      const url = editingUser 
        ? `${API_URL}/api/users/${editingUser.id}`
        : `${API_URL}/api/users`;
      
      const method = editingUser ? 'PUT' : 'POST';
      
      // Don't send empty password on update
      const payload = { ...formData };
      if (editingUser && !payload.password) {
        delete payload.password;
      }
      
      if (!payload.client_id) payload.client_id = null;
      if (!payload.vendor_id) payload.vendor_id = null;
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Operation failed');
      }

      toast.success(editingUser ? 'User updated!' : 'User created!');
      setIsDialogOpen(false);
      resetForm();
      fetchUsers();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;

    try {
      const response = await fetch(`${API_URL}/api/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Delete failed');
      }

      toast.success('User deleted!');
      fetchUsers();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const openEditDialog = (user) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      name: user.name,
      password: '',
      role: user.role,
      client_id: user.client_id || '',
      vendor_id: user.vendor_id || '',
      status: user.status || 'active',
    });
    setIsDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingUser(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      email: '',
      name: '',
      password: '',
      role: 'client_staff',
      client_id: currentUser?.client_id || '',
      vendor_id: currentUser?.vendor_id || '',
      status: 'active',
    });
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.client_name && user.client_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const ROLE_LABELS = {
    system_admin: 'System Admin',
    system_staff: 'System Staff',
    system_accounts: 'System Accounts',
    client_admin: 'Client Admin',
    client_staff: 'Client Staff',
    client_accounts: 'Client Accounts',
    vendor_admin: 'Vendor Admin',
    vendor_staff: 'Vendor Staff',
    vendor_accounts: 'Vendor Accounts',
    super_admin: 'System Admin',
    admin: 'System Admin',
    staff: 'Client Staff',
  };

  const getRoleBadgeClass = (role) => {
    const r = role === 'admin' || role === 'super_admin' ? 'system_admin' : role;
    if (r.startsWith('system')) return 'bg-red-100 text-red-800';
    if (r.startsWith('client')) return 'bg-amber-100 text-amber-800';
    if (r.startsWith('vendor')) return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getRoleIcon = (role) => {
    const r = role === 'admin' || role === 'super_admin' ? 'system_admin' : role;
    if (r.startsWith('system')) return <Shield className="w-3 h-3 mr-1" />;
    if (r.startsWith('vendor')) return <Users className="w-3 h-3 mr-1" />;
    if (r === 'client_admin') return <Building2 className="w-3 h-3 mr-1" />;
    return <User className="w-3 h-3 mr-1" />;
  };

  const getRoleDisplayName = (role) => ROLE_LABELS[role] || role;

  const getVendorName = (vendorId) => vendors.find((v) => v.id === vendorId)?.name || '-';

  // Get available roles based on current user
  const getAvailableRoles = () => {
    if (isSuperAdmin()) {
      return [
        { value: 'system_admin', label: 'System Admin' },
        { value: 'system_staff', label: 'System Staff' },
        { value: 'system_accounts', label: 'System Accounts' },
        { value: 'client_admin', label: 'Client Admin' },
        { value: 'client_staff', label: 'Client Staff' },
        { value: 'client_accounts', label: 'Client Accounts' },
        { value: 'vendor_admin', label: 'Vendor Admin' },
        { value: 'vendor_staff', label: 'Vendor Staff' },
        { value: 'vendor_accounts', label: 'Vendor Accounts' },
      ];
    }
    if (currentUser?.role === 'vendor_admin') {
      return [
        { value: 'vendor_admin', label: 'Vendor Admin' },
        { value: 'vendor_staff', label: 'Vendor Staff' },
        { value: 'vendor_accounts', label: 'Vendor Accounts' },
      ];
    }
    return [
      { value: 'client_admin', label: 'Client Admin' },
      { value: 'client_staff', label: 'Client Staff' },
      { value: 'client_accounts', label: 'Client Accounts' },
    ];
  };

  const needsClient = ['client_admin', 'client_staff', 'client_accounts'].includes(formData.role);
  const needsVendor = ['vendor_admin', 'vendor_staff', 'vendor_accounts'].includes(formData.role);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground mt-1">
            {isSuperAdmin() 
              ? 'Manage all system users and their roles' 
              : 'Manage users in your organization'}
          </p>
        </div>
        <Button onClick={openNewDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-lg">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Users</p>
            <p className="text-2xl font-bold">{users.length}</p>
          </div>
        </div>
        {isSuperAdmin() && (
          <div className="bg-card border rounded-xl p-4 flex items-center gap-4">
            <div className="p-3 bg-red-500/10 rounded-lg">
              <Shield className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Super Admins</p>
              <p className="text-2xl font-bold">{users.filter(u => u.role === 'super_admin' || u.role === 'admin').length}</p>
            </div>
          </div>
        )}
        <div className="bg-card border rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 rounded-lg">
            <Building2 className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Client Admins</p>
            <p className="text-2xl font-bold">{users.filter(u => u.role === 'client_admin').length}</p>
          </div>
        </div>
        <div className="bg-card border rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-green-500/10 rounded-lg">
            <User className="w-6 h-6 text-green-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Staff</p>
            <p className="text-2xl font-bold">{users.filter((u) => u.role?.startsWith('client')).length}</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Users Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              {isSuperAdmin() && <TableHead>Client</TableHead>}
              {isSuperAdmin() && <TableHead>Vendor</TableHead>}
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={isSuperAdmin() ? 8 : 6} className="text-center py-8">Loading...</TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isSuperAdmin() ? 8 : 6} className="text-center py-8 text-muted-foreground">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeClass(user.role)}`}>
                      {getRoleIcon(user.role)}
                      {getRoleDisplayName(user.role)}
                    </span>
                  </TableCell>
                  {isSuperAdmin() && (
                    <TableCell>
                      {user.client_name ? (
                        <span className="text-sm">{user.client_name}</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                  )}
                  {isSuperAdmin() && (
                    <TableCell>
                      {user.vendor_id ? (
                        <span className="text-sm">{getVendorName(user.vendor_id)}</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    <span className={`text-xs capitalize ${user.status === 'inactive' ? 'text-red-600' : 'text-green-600'}`}>
                      {user.status || 'active'}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(user)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(user.id)}
                        disabled={user.id === currentUser?.id || (!isSuperAdmin() && (user.role === 'super_admin' || user.role === 'admin'))}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
            <DialogDescription>
              {editingUser ? 'Update user details' : 'Create a new user account'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">
                Password {editingUser && <span className="text-muted-foreground">(leave empty to keep current)</span>}
              </Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required={!editingUser}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableRoles().map(role => (
                    <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {isSuperAdmin() && needsClient && (
              <div className="space-y-2">
                <Label htmlFor="client">Client</Label>
                <Select
                  value={formData.client_id}
                  onValueChange={(value) => setFormData({ ...formData, client_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(client => (
                      <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {isSuperAdmin() && needsVendor && (
              <div className="space-y-2">
                <Label htmlFor="vendor">Vendor</Label>
                <Select
                  value={formData.vendor_id}
                  onValueChange={(value) => setFormData({ ...formData, vendor_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map(vendor => (
                      <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingUser ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
