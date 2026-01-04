import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import api from '../utils/api';
import { Camera, RotateCcw, Check, X, Loader2, Upload, ScanLine, ArrowLeft } from 'lucide-react';

// Country code to nationality mapping
const COUNTRY_CODE_TO_NATIONALITY = {
  'AFG': 'Afghan', 'ALB': 'Albanian', 'DZA': 'Algerian', 'AND': 'Andorran', 'AGO': 'Angolan',
  'ARG': 'Argentine', 'ARM': 'Armenian', 'AUS': 'Australian', 'AUT': 'Austrian', 'AZE': 'Azerbaijani',
  'BHR': 'Bahraini', 'BGD': 'Bangladeshi', 'BLR': 'Belarusian', 'BEL': 'Belgian', 'BTN': 'Bhutanese',
  'BOL': 'Bolivian', 'BIH': 'Bosnian', 'BRA': 'Brazilian', 'BRN': 'Bruneian', 'BGR': 'Bulgarian',
  'KHM': 'Cambodian', 'CMR': 'Cameroonian', 'CAN': 'Canadian', 'TCD': 'Chadian', 'CHL': 'Chilean',
  'CHN': 'Chinese', 'COL': 'Colombian', 'CRI': 'Costa Rican', 'HRV': 'Croatian', 'CUB': 'Cuban',
  'CYP': 'Cypriot', 'CZE': 'Czech', 'DNK': 'Danish', 'ECU': 'Ecuadorian', 'EGY': 'Egyptian',
  'EST': 'Estonian', 'ETH': 'Ethiopian', 'FIN': 'Finnish', 'FRA': 'French', 'GEO': 'Georgian',
  'DEU': 'German', 'GHA': 'Ghanaian', 'GRC': 'Greek', 'GTM': 'Guatemalan', 'HND': 'Honduran',
  'HKG': 'Hong Konger', 'HUN': 'Hungarian', 'ISL': 'Icelandic', 'IND': 'Indian', 'IDN': 'Indonesian',
  'IRN': 'Iranian', 'IRQ': 'Iraqi', 'IRL': 'Irish', 'ISR': 'Israeli', 'ITA': 'Italian',
  'JPN': 'Japanese', 'JOR': 'Jordanian', 'KAZ': 'Kazakhstani', 'KEN': 'Kenyan', 'KWT': 'Kuwaiti',
  'KGZ': 'Kyrgyzstani', 'LVA': 'Latvian', 'LBN': 'Lebanese', 'LBY': 'Libyan', 'LTU': 'Lithuanian',
  'LUX': 'Luxembourger', 'MYS': 'Malaysian', 'MDV': 'Maldivian', 'MLT': 'Maltese', 'MEX': 'Mexican',
  'MDA': 'Moldovan', 'MCO': 'Monacan', 'MNG': 'Mongolian', 'MAR': 'Moroccan', 'MMR': 'Myanmar',
  'NPL': 'Nepalese', 'NLD': 'Dutch', 'NZL': 'New Zealander', 'NGA': 'Nigerian', 'PRK': 'North Korean',
  'NOR': 'Norwegian', 'OMN': 'Omani', 'PAK': 'Pakistani', 'PSE': 'Palestinian', 'PAN': 'Panamanian',
  'PER': 'Peruvian', 'PHL': 'Filipino', 'POL': 'Polish', 'PRT': 'Portuguese', 'QAT': 'Qatari',
  'ROU': 'Romanian', 'RUS': 'Russian', 'SAU': 'Saudi', 'SRB': 'Serbian', 'SGP': 'Singaporean',
  'SVK': 'Slovak', 'SVN': 'Slovenian', 'SOM': 'Somali', 'ZAF': 'South African', 'KOR': 'South Korean',
  'ESP': 'Spanish', 'LKA': 'Sri Lankan', 'SDN': 'Sudanese', 'SWE': 'Swedish', 'CHE': 'Swiss',
  'SYR': 'Syrian', 'TWN': 'Taiwanese', 'TJK': 'Tajikistani', 'TZA': 'Tanzanian', 'THA': 'Thai',
  'TUN': 'Tunisian', 'TUR': 'Turkish', 'TKM': 'Turkmen', 'ARE': 'Emirati', 'UGA': 'Ugandan',
  'UKR': 'Ukrainian', 'GBR': 'British', 'USA': 'American', 'URY': 'Uruguayan', 'UZB': 'Uzbekistani',
  'VEN': 'Venezuelan', 'VNM': 'Vietnamese', 'YEM': 'Yemeni', 'ZMB': 'Zambian', 'ZWE': 'Zimbabwean'
};

// Nationality options for dropdown
const NATIONALITIES = [
  "Afghan", "Albanian", "Algerian", "American", "Andorran", "Angolan", "Argentine", "Armenian",
  "Australian", "Austrian", "Azerbaijani", "Bahraini", "Bangladeshi", "Belarusian", "Belgian",
  "Bhutanese", "Bolivian", "Bosnian", "Brazilian", "British", "Bruneian", "Bulgarian", "Cambodian",
  "Cameroonian", "Canadian", "Chadian", "Chilean", "Chinese", "Colombian", "Costa Rican", "Croatian",
  "Cuban", "Cypriot", "Czech", "Danish", "Dutch", "Ecuadorian", "Egyptian", "Emirati", "Estonian",
  "Ethiopian", "Filipino", "Finnish", "French", "Georgian", "German", "Ghanaian", "Greek",
  "Guatemalan", "Honduran", "Hungarian", "Icelandic", "Indian", "Indonesian", "Iranian", "Iraqi",
  "Irish", "Israeli", "Italian", "Japanese", "Jordanian", "Kazakhstani", "Kenyan", "Kuwaiti",
  "Kyrgyzstani", "Latvian", "Lebanese", "Libyan", "Lithuanian", "Luxembourger", "Malaysian",
  "Maldivian", "Maltese", "Mexican", "Moldovan", "Mongolian", "Moroccan", "Nepalese", "New Zealander",
  "Nigerian", "North Korean", "Norwegian", "Omani", "Pakistani", "Palestinian", "Panamanian",
  "Peruvian", "Polish", "Portuguese", "Qatari", "Romanian", "Russian", "Saudi", "Serbian",
  "Singaporean", "Slovak", "Slovenian", "Somali", "South African", "South Korean", "Spanish",
  "Sri Lankan", "Sudanese", "Swedish", "Swiss", "Syrian", "Taiwanese", "Tajikistani", "Tanzanian",
  "Thai", "Tunisian", "Turkish", "Turkmen", "Ugandan", "Ukrainian", "Uruguayan", "Uzbekistani",
  "Venezuelan", "Vietnamese", "Yemeni", "Zambian", "Zimbabwean"
];

// Gender options
const GENDERS = ["Male", "Female"];

// Passport types
const PASSPORT_TYPES = ["Normal", "Diplomatic", "Service", "Special", "Official"];

// Empty form template
const EMPTY_FORM = {
  passport_no: '',
  passport_type: '',
  first_name_en: '',
  surname_en: '',
  first_name_ar: '',
  father_name_en: '',
  father_name_ar: '',
  grandfather_name_en: '',
  grandfather_name_ar: '',
  surname_ar: '',
  mother_name_en: '',
  mother_name_ar: '',
  mother_father_name_en: '',
  mother_father_name_ar: '',
  nationality: '',
  gender: '',
  birth_date: '',
  place_of_issue: '',
  issue_date: '',
  expiry_date: '',
  profession: '',
  country_of_residence: '',
  applicant_type: ''
};

export const PassportScanner = () => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [formData, setFormData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' = back camera

  useEffect(() => {
    fetchGroups();
    return () => {
      stopCamera();
    };
  }, []);

  const fetchGroups = async () => {
    try {
      const response = await api.get('/groups');
      setGroups(response.data);
    } catch (error) {
      toast.error('Failed to load groups');
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch (error) {
      console.error('Camera error:', error);
      toast.error('Could not access camera. Please allow camera permissions.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const switchCamera = async () => {
    stopCamera();
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
    setTimeout(() => startCamera(), 100);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageData);
    stopCamera();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setCapturedImage(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setFormData(null);
    startCamera();
  };

  // Convert country code to nationality name
  const mapNationality = (extracted) => {
    if (extracted.nationality_code) {
      const mapped = COUNTRY_CODE_TO_NATIONALITY[extracted.nationality_code.toUpperCase()];
      if (mapped) return mapped;
    }
    if (extracted.nationality) {
      // Check if it's already a valid nationality
      if (NATIONALITIES.includes(extracted.nationality)) {
        return extracted.nationality;
      }
      // Try to find a matching nationality
      const lowerNat = extracted.nationality.toLowerCase();
      const found = NATIONALITIES.find(n => n.toLowerCase().includes(lowerNat) || lowerNat.includes(n.toLowerCase()));
      if (found) return found;
    }
    return '';
  };

  const scanPassport = async () => {
    if (!capturedImage) {
      toast.error('Please capture a photo first');
      return;
    }
    
    setScanning(true);
    
    try {
      // Convert base64 to blob
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      
      const uploadData = new FormData();
      uploadData.append('image', blob, 'passport.jpg');
      
      const result = await api.post('/ocr/scan-passport', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (result.data.success) {
        const extracted = result.data.extracted_data || {};
        
        // Map nationality from code to name
        const nationality = mapNationality(extracted);
        
        // Merge extracted data with empty form template
        const mergedData = {
          ...EMPTY_FORM,
          passport_no: extracted.passport_no || '',
          first_name_en: extracted.first_name_en || '',
          surname_en: extracted.surname_en || '',
          father_name_en: extracted.father_name_en || '',
          nationality: nationality,
          gender: extracted.gender || '',
          birth_date: extracted.birth_date || '',
          expiry_date: extracted.expiry_date || '',
          place_of_issue: extracted.place_of_issue || '',
          issue_date: extracted.issue_date || '',
        };
        
        setFormData(mergedData);
        toast.success('Passport data extracted! Please review and complete the form.');
      } else {
        toast.error(result.data.error || 'Failed to extract data');
      }
    } catch (error) {
      console.error('Scan error:', error);
      toast.error('Failed to scan passport');
    } finally {
      setScanning(false);
    }
  };

  const savePassport = async () => {
    if (!selectedGroup) {
      toast.error('Please select a group first');
      return;
    }
    
    if (!formData?.passport_no) {
      toast.error('Passport number is required');
      return;
    }
    
    if (!formData?.first_name_en || !formData?.surname_en) {
      toast.error('First name and surname are required');
      return;
    }
    
    if (!formData?.nationality) {
      toast.error('Nationality is required');
      return;
    }
    
    if (!formData?.expiry_date) {
      toast.error('Expiry date is required');
      return;
    }
    
    setSaving(true);
    
    try {
      // Prepare passport data - convert empty strings to null for optional fields
      const passportData = {
        passport_no: formData.passport_no,
        first_name_en: formData.first_name_en,
        surname_en: formData.surname_en,
        nationality: formData.nationality,
        expiry_date: formData.expiry_date,
        // Optional fields - send null if empty
        passport_type: formData.passport_type || null,
        first_name_ar: formData.first_name_ar || null,
        father_name_en: formData.father_name_en || null,
        father_name_ar: formData.father_name_ar || null,
        grandfather_name_en: formData.grandfather_name_en || null,
        grandfather_name_ar: formData.grandfather_name_ar || null,
        surname_ar: formData.surname_ar || null,
        mother_name_en: formData.mother_name_en || null,
        mother_name_ar: formData.mother_name_ar || null,
        mother_father_name_en: formData.mother_father_name_en || null,
        mother_father_name_ar: formData.mother_father_name_ar || null,
        gender: formData.gender || null,
        birth_date: formData.birth_date || null,
        place_of_issue: formData.place_of_issue || null,
        issue_date: formData.issue_date || null,
        profession: formData.profession || null,
        country_of_residence: formData.country_of_residence || null,
        applicant_type: formData.applicant_type || null,
      };
      
      await api.post(`/groups/${selectedGroup}/passports`, passportData);
      toast.success('Passport saved successfully!');
      
      // Reset for next scan
      setCapturedImage(null);
      setFormData(null);
      
    } catch (error) {
      console.error('Save error:', error);
      toast.error(error.response?.data?.detail || 'Failed to save passport');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-8">
      {/* Header */}
      <header className="bg-slate-800 p-4 flex items-center gap-4 sticky top-0 z-10">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate(-1)}
          className="text-white hover:bg-slate-700"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Passport Scanner</h1>
          <p className="text-sm text-slate-400">Scan & extract passport data</p>
        </div>
      </header>

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {/* Group Selection */}
        <div className="bg-slate-800 rounded-xl p-4">
          <Label className="text-slate-300 mb-2 block">Select Group *</Label>
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
              <SelectValue placeholder="Choose a group" />
            </SelectTrigger>
            <SelectContent>
              {groups.map(group => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Camera/Image Section */}
        <div className="bg-slate-800 rounded-xl overflow-hidden">
          {!capturedImage ? (
            <>
              {/* Camera View */}
              <div className="relative aspect-[4/3] bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                
                {/* Passport Frame Overlay */}
                {cameraActive && (
                  <div className="absolute inset-4 border-2 border-dashed border-white/50 rounded-lg pointer-events-none">
                    <div className="absolute top-2 left-2 right-2 text-center text-white/70 text-sm">
                      Position passport within frame
                    </div>
                  </div>
                )}
                
                {!cameraActive && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                    <div className="text-center text-slate-400">
                      <Camera className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p>Camera not active</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Camera Controls */}
              <div className="p-4 flex justify-center gap-4">
                {!cameraActive ? (
                  <>
                    <Button 
                      onClick={startCamera}
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                    >
                      <Camera className="w-5 h-5 mr-2" />
                      Start Camera
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 border-slate-600 text-white hover:bg-slate-700"
                    >
                      <Upload className="w-5 h-5 mr-2" />
                      Upload
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={switchCamera}
                      className="border-slate-600 text-white hover:bg-slate-700"
                    >
                      <RotateCcw className="w-5 h-5" />
                    </Button>
                    <Button
                      onClick={capturePhoto}
                      size="lg"
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <Camera className="w-5 h-5 mr-2" />
                      Capture
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={stopCamera}
                      className="border-slate-600 text-white hover:bg-slate-700"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Captured Image */}
              <div className="relative aspect-[4/3]">
                <img 
                  src={capturedImage} 
                  alt="Captured passport" 
                  className="w-full h-full object-cover"
                />
              </div>
              
              {/* Image Controls */}
              <div className="p-4 flex gap-4">
                <Button
                  variant="outline"
                  onClick={retakePhoto}
                  className="flex-1 border-slate-600 text-white hover:bg-slate-700"
                >
                  <RotateCcw className="w-5 h-5 mr-2" />
                  Retake
                </Button>
                <Button
                  onClick={scanPassport}
                  disabled={scanning}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {scanning ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <ScanLine className="w-5 h-5 mr-2" />
                  )}
                  {scanning ? 'Scanning...' : 'Extract Data'}
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Complete Passport Form */}
        {formData && (
          <div className="bg-slate-800 rounded-xl p-4 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Check className="w-5 h-5 text-green-500" />
              Passport Details
            </h2>
            
            <p className="text-xs text-slate-400">
              Review extracted data and fill in remaining fields. Fields marked with * are required.
            </p>

            {/* Basic Information */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-300 border-b border-slate-700 pb-2">Basic Information</h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400 text-xs">Passport No *</Label>
                  <Input
                    value={formData.passport_no}
                    onChange={(e) => updateField('passport_no', e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    placeholder="e.g., AB1234567"
                  />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Passport Type</Label>
                  <Select value={formData.passport_type} onValueChange={(v) => updateField('passport_type', v)}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {PASSPORT_TYPES.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400 text-xs">First Name (EN) *</Label>
                  <Input
                    value={formData.first_name_en}
                    onChange={(e) => updateField('first_name_en', e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Surname (EN) *</Label>
                  <Input
                    value={formData.surname_en}
                    onChange={(e) => updateField('surname_en', e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400 text-xs">Father Name (EN)</Label>
                  <Input
                    value={formData.father_name_en}
                    onChange={(e) => updateField('father_name_en', e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Grandfather Name (EN)</Label>
                  <Input
                    value={formData.grandfather_name_en}
                    onChange={(e) => updateField('grandfather_name_en', e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400 text-xs">Nationality *</Label>
                  <Select value={formData.nationality} onValueChange={(v) => updateField('nationality', v)}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                      <SelectValue placeholder="Select nationality" />
                    </SelectTrigger>
                    <SelectContent>
                      {NATIONALITIES.map(nat => (
                        <SelectItem key={nat} value={nat}>{nat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Gender</Label>
                  <Select value={formData.gender} onValueChange={(v) => updateField('gender', v)}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDERS.map(g => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Arabic Names */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-300 border-b border-slate-700 pb-2">Arabic Names</h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400 text-xs">First Name (AR)</Label>
                  <Input
                    value={formData.first_name_ar}
                    onChange={(e) => updateField('first_name_ar', e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white mt-1 text-right"
                    dir="rtl"
                  />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Surname (AR)</Label>
                  <Input
                    value={formData.surname_ar}
                    onChange={(e) => updateField('surname_ar', e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white mt-1 text-right"
                    dir="rtl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400 text-xs">Father Name (AR)</Label>
                  <Input
                    value={formData.father_name_ar}
                    onChange={(e) => updateField('father_name_ar', e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white mt-1 text-right"
                    dir="rtl"
                  />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Grandfather (AR)</Label>
                  <Input
                    value={formData.grandfather_name_ar}
                    onChange={(e) => updateField('grandfather_name_ar', e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white mt-1 text-right"
                    dir="rtl"
                  />
                </div>
              </div>
            </div>

            {/* Mother's Information */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-300 border-b border-slate-700 pb-2">Mother's Information</h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400 text-xs">Mother Name (EN)</Label>
                  <Input
                    value={formData.mother_name_en}
                    onChange={(e) => updateField('mother_name_en', e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Mother Name (AR)</Label>
                  <Input
                    value={formData.mother_name_ar}
                    onChange={(e) => updateField('mother_name_ar', e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white mt-1 text-right"
                    dir="rtl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400 text-xs">Mother's Father (EN)</Label>
                  <Input
                    value={formData.mother_father_name_en}
                    onChange={(e) => updateField('mother_father_name_en', e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Mother's Father (AR)</Label>
                  <Input
                    value={formData.mother_father_name_ar}
                    onChange={(e) => updateField('mother_father_name_ar', e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white mt-1 text-right"
                    dir="rtl"
                  />
                </div>
              </div>
            </div>

            {/* Dates & Other Info */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-300 border-b border-slate-700 pb-2">Dates & Other Details</h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400 text-xs">Birth Date</Label>
                  <Input
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) => updateField('birth_date', e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Expiry Date *</Label>
                  <Input
                    type="date"
                    value={formData.expiry_date}
                    onChange={(e) => updateField('expiry_date', e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400 text-xs">Issue Date</Label>
                  <Input
                    type="date"
                    value={formData.issue_date}
                    onChange={(e) => updateField('issue_date', e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Place of Issue</Label>
                  <Input
                    value={formData.place_of_issue}
                    onChange={(e) => updateField('place_of_issue', e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400 text-xs">Profession</Label>
                  <Input
                    value={formData.profession}
                    onChange={(e) => updateField('profession', e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Country of Residence</Label>
                  <Input
                    value={formData.country_of_residence}
                    onChange={(e) => updateField('country_of_residence', e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
              </div>
            </div>
            
            <Button
              onClick={savePassport}
              disabled={saving || !selectedGroup}
              className="w-full bg-green-600 hover:bg-green-700 mt-4"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Check className="w-5 h-5 mr-2" />
              )}
              {saving ? 'Saving...' : 'Save to Group'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
