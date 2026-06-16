import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Plus, Pencil } from 'lucide-react';
import api from '../utils/api';
import { toast } from 'sonner';

export const VendorsManagement = () => {
  const [vendors, setVendors] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', email: '', phone: '', base_cost_per_passport: 0 });

  const fetchVendors = async () => {
    try {
      const res = await api.get('/vendors');
      setVendors(res.data);
    } catch {
      toast.error('Failed to load vendors');
    }
  };

  useEffect(() => { fetchVendors(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/vendors/${editing.id}`, form);
        toast.success('Vendor updated');
      } else {
        await api.post('/vendors', form);
        toast.success('Vendor created');
      }
      setOpen(false);
      setEditing(null);
      fetchVendors();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save vendor');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Vendor Management</h1>
        <Button onClick={() => { setEditing(null); setForm({ name: '', code: '', email: '', phone: '', base_cost_per_passport: 0 }); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add Vendor
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Cost/Passport</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {vendors.map((v) => (
            <TableRow key={v.id}>
              <TableCell>{v.name}</TableCell>
              <TableCell>{v.code}</TableCell>
              <TableCell>{v.email}</TableCell>
              <TableCell>${v.base_cost_per_passport}</TableCell>
              <TableCell className="capitalize">{v.status}</TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" onClick={() => { setEditing(v); setForm(v); setOpen(true); }}>
                  <Pencil className="w-4 h-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Vendor' : 'New Vendor'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required disabled={!!editing} /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Base Cost per Passport (USD)</Label><Input type="number" step="0.01" value={form.base_cost_per_passport} onChange={(e) => setForm({ ...form, base_cost_per_passport: parseFloat(e.target.value) })} /></div>
            <DialogFooter><Button type="submit">Save</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
