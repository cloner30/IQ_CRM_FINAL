import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ArrowLeft, Upload } from 'lucide-react';
import api from '../utils/api';
import { toast } from 'sonner';
import { GroupStatusStepper } from '../components/group/GroupStatusStepper';
import { GroupStatusBadge } from '../components/group/GroupStatusBadge';

export const VendorGroupDetail = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [passports, setPassports] = useState([]);
  const [uploading, setUploading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [groupRes, passportsRes] = await Promise.all([
        api.get(`/groups/${groupId}`),
        api.get(`/groups/${groupId}/passports`),
      ]);
      setGroup(groupRes.data);
      setPassports(passportsRes.data);
    } catch {
      toast.error('Failed to load group');
      navigate('/vendor');
    }
  }, [groupId, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleVisaUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    try {
      const response = await api.post(`/groups/${groupId}/upload/visas`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`Uploaded ${response.data.uploaded} files`);
      fetchData();
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (!group) return <p>Loading...</p>;

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate('/vendor')}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Back
      </Button>
      <div>
        <h1 className="text-2xl font-bold">{group.name}</h1>
        <p className="font-mono text-sm text-muted-foreground">{group.id}</p>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <GroupStatusBadge status={group.status} />
        </div>
        <div className="mt-4">
          <GroupStatusStepper status={group.status} />
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Upload Visa PDFs</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">Name files as passport number (e.g. AB1234567.pdf)</p>
          <input id="visa-upload-input" type="file" multiple accept=".pdf" className="hidden" onChange={handleVisaUpload} />
          <Button disabled={uploading} type="button" onClick={() => document.getElementById('visa-upload-input')?.click()}>
            <Upload className="w-4 h-4 mr-2" />{uploading ? 'Uploading...' : 'Select Visa Files'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Passengers ({passports.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {passports.map((p) => (
              <div key={p.id} className="flex justify-between border-b py-2">
                <span>{p.first_name_en} {p.surname_en} — {p.passport_no}</span>
                <span className="text-sm capitalize">{p.visa_status?.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
