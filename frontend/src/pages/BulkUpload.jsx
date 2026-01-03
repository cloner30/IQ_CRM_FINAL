import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ArrowLeft, Upload, FileText, Image, CheckCircle, AlertCircle, X, File, Download, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import api from '../utils/api';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const UploadZone = ({ type, onUpload, uploading, accept, icon: Icon, title, subtitle, note }) => {
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

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles(prev => [...prev, ...droppedFiles]);
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(prev => [...prev, ...selectedFiles]);
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
          multiple={type !== 'excel'}
          accept={accept}
          onChange={handleFileSelect}
          className="hidden"
          data-testid={`file-input-${type}`}
        />
        <div className="p-4 bg-indigo-100 rounded-full">
          <Icon className="w-8 h-8 text-indigo-600" />
        </div>
        <div>
          <p className="text-lg font-manrope font-semibold text-slate-900">{title}</p>
          <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
          {note && (
            <p className="text-xs text-indigo-600 mt-2 font-medium">{note}</p>
          )}
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
                  onClick={(e) => { e.stopPropagation(); removeFile(index); }}
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
  const [importResults, setImportResults] = useState(null);

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

  const handleImageUpload = async (files, type) => {
    setUploading(true);
    setUploadResults(null);
    setImportResults(null);
    
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

  const handleExcelUpload = async (files, type) => {
    if (files.length !== 1) {
      toast.error('Please select only one Excel/CSV file');
      return false;
    }
    
    setUploading(true);
    setUploadResults(null);
    setImportResults(null);
    
    const formData = new FormData();
    formData.append('file', files[0]);

    try {
      const response = await axios.post(
        `${API}/groups/${groupId}/import/excel`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      );
      
      setImportResults(response.data);
      
      const successCount = response.data.success?.length || 0;
      const failedCount = response.data.failed?.length || 0;
      const skippedCount = response.data.skipped?.length || 0;
      
      if (successCount > 0) {
        toast.success(`Imported ${successCount} passport records successfully.`);
      }
      if (skippedCount > 0) {
        toast.warning(`${skippedCount} records skipped (already exist).`);
      }
      if (failedCount > 0) {
        toast.error(`${failedCount} records failed to import.`);
      }
      
      return true;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Import failed. Please check your file format.');
      return false;
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await axios.get(`${API}/templates/passport-import`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'passport_import_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Template downloaded');
    } catch (error) {
      toast.error('Failed to download template');
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
          Upload passport data and images for <span className="font-medium">{group?.name}</span>
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
                <li>• Name image files with passport number (e.g., <span className="font-mono bg-indigo-100 px-1 rounded">AB1234567.jpg</span>)</li>
                <li>• System automatically maps images to matching passport records</li>
                <li>• Only JPG and JPEG formats accepted for images</li>
                <li>• Excel/CSV import supports bulk data entry</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload Tabs */}
      <Tabs defaultValue="excel" className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="excel" data-testid="tab-excel">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Excel Import
          </TabsTrigger>
          <TabsTrigger value="passports" data-testid="tab-passports">
            <FileText className="w-4 h-4 mr-2" />
            Passport Scans
          </TabsTrigger>
          <TabsTrigger value="photos" data-testid="tab-photos">
            <Image className="w-4 h-4 mr-2" />
            Profile Photos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="excel">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="font-manrope">Import from Excel/CSV</CardTitle>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleDownloadTemplate}
                  data-testid="download-template-btn"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Template
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <UploadZone 
                type="excel" 
                onUpload={handleExcelUpload} 
                uploading={uploading}
                accept=".xlsx,.xls,.csv"
                icon={FileSpreadsheet}
                title="Drop Excel or CSV file here"
                subtitle="or click to browse. Supports .xlsx, .xls, .csv files."
                note="Required column: passport_no. Other columns are auto-mapped."
              />
              
              {/* Column Mapping Info */}
              <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                <h4 className="font-medium text-slate-900 mb-3">Supported Column Names</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  <div><span className="font-mono text-indigo-600">passport_no</span> *</div>
                  <div><span className="font-mono text-slate-600">first_name_en</span></div>
                  <div><span className="font-mono text-slate-600">surname_en</span></div>
                  <div><span className="font-mono text-slate-600">nationality</span></div>
                  <div><span className="font-mono text-slate-600">gender</span></div>
                  <div><span className="font-mono text-slate-600">birth_date</span></div>
                  <div><span className="font-mono text-slate-600">expiry_date</span></div>
                  <div><span className="font-mono text-slate-600">issue_date</span></div>
                  <div><span className="font-mono text-slate-600">passport_type</span></div>
                  <div><span className="font-mono text-slate-600">place_of_issue</span></div>
                  <div><span className="font-mono text-slate-600">profession</span></div>
                  <div><span className="font-mono text-slate-600">father_name_en</span></div>
                </div>
                <p className="text-xs text-slate-500 mt-3">* Required field. Other column names like "name", "firstname", "surname" are also auto-detected.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="passports">
          <Card>
            <CardHeader>
              <CardTitle className="font-manrope">Upload Passport Scans</CardTitle>
            </CardHeader>
            <CardContent>
              <UploadZone 
                type="passports" 
                onUpload={handleImageUpload} 
                uploading={uploading}
                accept=".jpg,.jpeg"
                icon={FileText}
                title="Drop passport scans here"
                subtitle="or click to browse. Only JPG/JPEG files allowed."
                note="File names should be passport numbers (e.g., AB1234567.jpg)"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="photos">
          <Card>
            <CardHeader>
              <CardTitle className="font-manrope">Upload Profile Photos</CardTitle>
            </CardHeader>
            <CardContent>
              <UploadZone 
                type="photos" 
                onUpload={handleImageUpload} 
                uploading={uploading}
                accept=".jpg,.jpeg"
                icon={Image}
                title="Drop profile photos here"
                subtitle="or click to browse. Only JPG/JPEG files allowed."
                note="File names should be passport numbers (e.g., AB1234567.jpg)"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Image Upload Results */}
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

      {/* Excel Import Results */}
      {importResults && (
        <Card className="mt-6" data-testid="import-results">
          <CardHeader>
            <CardTitle className="font-manrope">Import Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {importResults.success?.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span className="font-medium text-emerald-700">Successfully Imported ({importResults.success.length})</span>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {importResults.success.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <span className="passport-number">{item.passport_no}</span>
                        <span className="text-slate-600">{item.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {importResults.skipped?.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span className="font-medium text-amber-700">Skipped ({importResults.skipped.length})</span>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {importResults.skipped.map((item, idx) => (
                      <div key={idx} className="text-sm text-amber-600">
                        Row {item.row}: {item.passport_no} - {item.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {importResults.failed?.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <span className="font-medium text-rose-700">Failed ({importResults.failed.length})</span>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {importResults.failed.map((item, idx) => (
                      <div key={idx} className="text-sm text-rose-600">
                        Row {item.row}: {item.reason}
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
