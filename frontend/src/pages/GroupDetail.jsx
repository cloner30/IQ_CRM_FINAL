import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { ArrowLeft, Plus, Upload, FileText, User, Trash2, Edit, Search, CheckCircle, AlertCircle, Image } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const GroupDetail = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [passports, setPassports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddPassport, setShowAddPassport] = useState(false);
  const [deletePassportId, setDeletePassportId] = useState(null);
  const [passportForm, setPassportForm] = useState({
    passport_no: '',
    name: '',
    nationality: '',
    expiry_date: ''
  });
  const [formLoading, setFormLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [groupRes, passportsRes] = await Promise.all([
        axios.get(`${API}/groups/${groupId}`),
        axios.get(`${API}/groups/${groupId}/passports`)
      ]);
      setGroup(groupRes.data);
      setPassports(passportsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load group data');
      navigate('/groups');
    } finally {
      setLoading(false);
    }
  }, [groupId, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddPassport = async (e) => {
    e.preventDefault();
    if (!passportForm.passport_no || !passportForm.name || !passportForm.nationality || !passportForm.expiry_date) {
      toast.error('All fields are required');
      return;
    }
    
    setFormLoading(true);
    try {
      const response = await axios.post(`${API}/groups/${groupId}/passports`, passportForm);
      setPassports([...passports, response.data]);
      setShowAddPassport(false);
      setPassportForm({ passport_no: '', name: '', nationality: '', expiry_date: '' });
      toast.success('Passport added successfully');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add passport');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeletePassport = async () => {
    if (!deletePassportId) return;
    try {
      await axios.delete(`${API}/groups/${groupId}/passports/${deletePassportId}`);
      setPassports(passports.filter(p => p.id !== deletePassportId));
      toast.success('Passport deleted successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete passport');
    } finally {
      setDeletePassportId(null);
    }
  };

  const filteredPassports = passports.filter(p =>
    p.passport_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.nationality.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <div className="text-center py-12 text-slate-500">Loading...</div>;
  }

  return (
    <div data-testid="group-detail-page">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/groups')}
          className="mb-4 text-slate-600 hover:text-slate-900"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Groups
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-manrope font-bold text-slate-900 tracking-tight" data-testid="group-name">
              {group?.name}
            </h1>
            <p className="text-slate-600 mt-1">{group?.description || 'No description'}</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowAddPassport(true)}
              data-testid="add-passport-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Passport
            </Button>
            <Link to={`/groups/${groupId}/upload`}>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" data-testid="bulk-upload-btn">
                <Upload className="w-4 h-4 mr-2" />
                Bulk Upload
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="card-hover" data-testid="stat-total">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-100 rounded-lg">
                <FileText className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Passports</p>
                <p className="text-2xl font-manrope font-bold text-slate-900">{passports.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-hover" data-testid="stat-with-images">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">With Images</p>
                <p className="text-2xl font-manrope font-bold text-slate-900">
                  {passports.filter(p => p.passport_image || p.profile_image).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-hover" data-testid="stat-missing">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 rounded-lg">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Missing Images</p>
                <p className="text-2xl font-manrope font-bold text-slate-900">
                  {passports.filter(p => !p.passport_image && !p.profile_image).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Passports List */}
      <Card data-testid="passports-card">
        <CardHeader className="border-b border-slate-100">
          <div className="flex items-center justify-between">
            <CardTitle className="font-manrope">Passports</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search passports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="search-passports"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredPassports.length === 0 ? (
            <div className="p-8 text-center" data-testid="empty-passports">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">
                {searchQuery ? 'No passports match your search.' : 'No passports in this group yet.'}
              </p>
              {!searchQuery && (
                <Button variant="outline" onClick={() => setShowAddPassport(true)} data-testid="empty-add-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Passport
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100" data-testid="passports-list">
              {filteredPassports.map((passport) => (
                <div
                  key={passport.id}
                  className="flex items-center gap-6 px-6 py-4 hover:bg-slate-50 transition-colors"
                  data-testid={`passport-row-${passport.id}`}
                >
                  {/* Profile Image */}
                  <div className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden flex-shrink-0">
                    {passport.profile_image ? (
                      <img
                        src={`${process.env.REACT_APP_BACKEND_URL}${passport.profile_image}`}
                        alt={passport.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="w-6 h-6 text-slate-400" />
                      </div>
                    )}
                  </div>

                  {/* Passport Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-slate-900">{passport.name}</h3>
                      <span className="passport-number" data-testid={`passport-no-${passport.passport_no}`}>
                        {passport.passport_no}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                      <span>{passport.nationality}</span>
                      <span>Exp: {passport.expiry_date}</span>
                    </div>
                  </div>

                  {/* Image Status */}
                  <div className="flex items-center gap-3">
                    <div className="flex gap-2">
                      <span className={`status-badge ${passport.passport_image ? 'success' : 'neutral'}`}>
                        <FileText className="w-3 h-3 mr-1" />
                        Passport
                      </span>
                      <span className={`status-badge ${passport.profile_image ? 'success' : 'neutral'}`}>
                        <Image className="w-3 h-3 mr-1" />
                        Photo
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-rose-600"
                      onClick={() => setDeletePassportId(passport.id)}
                      data-testid={`delete-passport-${passport.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Passport Dialog */}
      <Dialog open={showAddPassport} onOpenChange={setShowAddPassport}>
        <DialogContent data-testid="add-passport-dialog">
          <DialogHeader>
            <DialogTitle className="font-manrope">Add New Passport</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddPassport} className="space-y-4">
            <div>
              <Label htmlFor="passport_no" className="text-slate-700 mb-2 block">Passport Number *</Label>
              <Input
                id="passport_no"
                type="text"
                placeholder="e.g., AB1234567"
                value={passportForm.passport_no}
                onChange={(e) => setPassportForm({ ...passportForm, passport_no: e.target.value })}
                className="font-mono"
                data-testid="input-passport-no"
              />
            </div>
            <div>
              <Label htmlFor="name" className="text-slate-700 mb-2 block">Full Name *</Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter full name"
                value={passportForm.name}
                onChange={(e) => setPassportForm({ ...passportForm, name: e.target.value })}
                data-testid="input-name"
              />
            </div>
            <div>
              <Label htmlFor="nationality" className="text-slate-700 mb-2 block">Nationality *</Label>
              <Input
                id="nationality"
                type="text"
                placeholder="Enter nationality"
                value={passportForm.nationality}
                onChange={(e) => setPassportForm({ ...passportForm, nationality: e.target.value })}
                data-testid="input-nationality"
              />
            </div>
            <div>
              <Label htmlFor="expiry_date" className="text-slate-700 mb-2 block">Expiry Date *</Label>
              <Input
                id="expiry_date"
                type="date"
                value={passportForm.expiry_date}
                onChange={(e) => setPassportForm({ ...passportForm, expiry_date: e.target.value })}
                data-testid="input-expiry-date"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddPassport(false)} data-testid="cancel-add-passport">
                Cancel
              </Button>
              <Button type="submit" disabled={formLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white" data-testid="submit-passport">
                {formLoading ? 'Adding...' : 'Add Passport'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletePassportId} onOpenChange={() => setDeletePassportId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Passport</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this passport? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-delete-passport">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePassport}
              className="bg-rose-600 hover:bg-rose-700"
              data-testid="confirm-delete-passport"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
