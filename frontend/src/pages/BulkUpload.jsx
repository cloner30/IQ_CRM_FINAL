import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Progress } from '../components/ui/progress';
import { ArrowLeft, Upload, FileText, Image, CheckCircle, AlertCircle, X, File } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const UploadZone = ({ type, onUpload, uploading }) => {
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState([]);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragIn = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragOut = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const validateFiles = (fileList) => {
    const validFiles = [];
    const invalidFiles = [];
    
    for (const file of fileList) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (['jpg', 'jpeg'].includes(ext)) {
        validFiles.push(file);
      } else {
        invalidFiles.push(file.name);
      }
    }
    
    if (invalidFiles.length > 0) {
      toast.error(`Invalid files skipped: ${invalidFiles.join(', ')}. Only JPG/JPEG allowed.`);
    }
    
    return validFiles;
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    const validFiles = validateFiles(droppedFiles);
    setFiles(prev => [...prev, ...validFiles]);
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    const validFiles = validateFiles(selectedFiles);
    setFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error('Please select files to upload');
      return;
    }
    
    const result = await onUpload(files, type);
    if (result) {
      setFiles([]);
    }
  };

  const icon = type === 'passports' ? FileText : Image;
  const Icon = icon;

  return (
    <div className="space-y-4">
      <div
        className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        data-testid={`upload-zone-${type}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg"
          onChange={handleFileSelect}
          className="hidden"
          data-testid={`file-input-${type}`}
        />
        <div className="p-4 bg-indigo-100 rounded-full">
          <Icon className="w-8 h-8 text-indigo-600" />
        </div>
        <div>
          <p className="text-lg font-manrope font-semibold text-slate-900">
            Drop {type === 'passports' ? 'passport scans' : 'profile photos'} here
          </p>
          <p className="text-sm text-slate-500 mt-1">
            or click to browse. Only JPG/JPEG files allowed.
          </p>
          <p className="text-xs text-indigo-600 mt-2 font-medium">
            File names should be passport numbers (e.g., AB1234567.jpg)
          </p>
        </div>
      </div>

      {/* Selected Files */}
      {files.length > 0 && (
        <div className="space-y-2" data-testid={`files-list-${type}`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">
              {files.length} file(s) selected
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFiles([])}
              className="text-slate-500 hover:text-slate-700"
              data-testid={`clear-files-${type}`}
            >
              Clear all
            </Button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-slate-200 p-2">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-md"
                data-testid={`file-item-${index}`}
              >
                <div className="flex items-center gap-2">
                  <File className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-700 font-mono">{file.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => removeFile(index)}
                  data-testid={`remove-file-${index}`}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
            data-testid={`upload-btn-${type}`}
          >
            {uploading ? (
              <>
                <Upload className="w-4 h-4 mr-2 animate-pulse" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload {files.length} File(s)
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export const BulkUpload = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState(null);

  useEffect(() => {
    const fetchGroup = async () => {
      try {
        const response = await axios.get(`${API}/groups/${groupId}`);
        setGroup(response.data);
      } catch (error) {
        toast.error('Failed to load group');
        navigate('/groups');
      } finally {
        setLoading(false);
      }
    };
    fetchGroup();
  }, [groupId, navigate]);

  const handleUpload = async (files, type) => {
    setUploading(true);
    setUploadResults(null);
    
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    try {
      const endpoint = type === 'passports' ? 'passports' : 'photos';
      const response = await axios.post(
        `${API}/groups/${groupId}/upload/${endpoint}`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      );
      
      setUploadResults(response.data);
      
      const successCount = response.data.success?.length || 0;
      const failedCount = response.data.failed?.length || 0;
      const mappedCount = response.data.mapped?.length || 0;
      
      if (successCount > 0) {
        toast.success(`Uploaded ${successCount} files. ${mappedCount} mapped to existing passports.`);
      }
      if (failedCount > 0) {
        toast.error(`${failedCount} files failed to upload.`);
      }
      
      return true;
    } catch (error) {
      toast.error('Upload failed. Please try again.');
      return false;
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-slate-500">Loading...</div>;
  }

  return (
    <div data-testid="bulk-upload-page">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => navigate(`/groups/${groupId}`)}
          className="mb-4 text-slate-600 hover:text-slate-900"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Group
        </Button>
        <h1 className="text-3xl font-manrope font-bold text-slate-900 tracking-tight" data-testid="page-title">
          Bulk Upload
        </h1>
        <p className="text-slate-600 mt-1">
          Upload passport scans and profile photos for <span className="font-medium">{group?.name}</span>
        </p>
      </div>

      {/* Info Card */}
      <Card className="mb-6 bg-indigo-50 border-indigo-200" data-testid="info-card">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="p-2 bg-indigo-100 rounded-lg h-fit">
              <AlertCircle className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-manrope font-semibold text-indigo-900">How file mapping works</h3>
              <ul className="mt-2 space-y-1 text-sm text-indigo-800">
                <li>• Name files with the passport number (e.g., <span className="font-mono bg-indigo-100 px-1 rounded">AB1234567.jpg</span>)</li>
                <li>• System will automatically map images to matching passport records</li>
                <li>• Only JPG and JPEG formats are accepted</li>
                <li>• You can upload files before or after creating passport records</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload Tabs */}
      <Tabs defaultValue="passports" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="passports" data-testid="tab-passports">
            <FileText className="w-4 h-4 mr-2" />
            Passport Scans
          </TabsTrigger>
          <TabsTrigger value="photos" data-testid="tab-photos">
            <Image className="w-4 h-4 mr-2" />
            Profile Photos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="passports">
          <Card>
            <CardHeader>
              <CardTitle className="font-manrope">Upload Passport Scans</CardTitle>
            </CardHeader>
            <CardContent>
              <UploadZone type="passports" onUpload={handleUpload} uploading={uploading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="photos">
          <Card>
            <CardHeader>
              <CardTitle className="font-manrope">Upload Profile Photos</CardTitle>
            </CardHeader>
            <CardContent>
              <UploadZone type="photos" onUpload={handleUpload} uploading={uploading} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Upload Results */}
      {uploadResults && (
        <Card className="mt-6" data-testid="upload-results">
          <CardHeader>
            <CardTitle className="font-manrope">Upload Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {uploadResults.success?.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span className="font-medium text-emerald-700">Successful ({uploadResults.success.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {uploadResults.success.map((item, idx) => (
                      <span key={idx} className="status-badge success">
                        {item.passport_no}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {uploadResults.mapped?.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-indigo-600" />
                    <span className="font-medium text-indigo-700">Mapped to Records ({uploadResults.mapped.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {uploadResults.mapped.map((no, idx) => (
                      <span key={idx} className="passport-number">
                        {no}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {uploadResults.failed?.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <span className="font-medium text-rose-700">Failed ({uploadResults.failed.length})</span>
                  </div>
                  <div className="space-y-1">
                    {uploadResults.failed.map((item, idx) => (
                      <div key={idx} className="text-sm text-rose-600">
                        {item.filename}: {item.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
