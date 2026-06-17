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
import { Camera, RotateCcw, Check, X, Loader2, Upload, ScanLine, ArrowLeft, Trash2, SkipForward, Layers } from 'lucide-react';

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

// Nationality to Country mapping (for Place of Issue & Country of Residence - matching e-visa form values)
const NATIONALITY_TO_COUNTRY = {
  "Afghan": "Afghanistan", "Albanian": "Albania", "Algerian": "Algeria", "American": "United States of America",
  "Andorran": "Andorra", "Angolan": "Angola", "Argentine": "Argentina", "Armenian": "Armenia",
  "Australian": "Australia", "Austrian": "Austria", "Azerbaijani": "Azerbaijan", "Bahraini": "Bahrain",
  "Bangladeshi": "Bangladesh", "Belarusian": "Belarus", "Belgian": "Belgium", "Bhutanese": "Bhutan",
  "Bolivian": "Bolivia", "Bosnian": "Bosnia and Herzegovina", "Brazilian": "Brazil", "British": "United Kingdom of Great Britain",
  "Bruneian": "Brunei Darussalam", "Bulgarian": "Bulgaria", "Cambodian": "Cambodia", "Cameroonian": "Cameroon",
  "Canadian": "Canada", "Chadian": "Chad", "Chilean": "Chile", "Chinese": "China", "Colombian": "Colombia",
  "Costa Rican": "Costa Rica", "Croatian": "Croatia", "Cuban": "Cuba", "Cypriot": "Cyprus", "Czech": "Czech Republic",
  "Danish": "Denmark", "Dutch": "Netherlands", "Ecuadorian": "Ecuador", "Egyptian": "Egypt", "Emirati": "United Arab Emirates",
  "Estonian": "Estonia", "Ethiopian": "Ethiopia", "Filipino": "Philippines", "Finnish": "Finland", "French": "France",
  "Georgian": "Georgia", "German": "Germany", "Ghanaian": "Ghana", "Greek": "Greece", "Guatemalan": "Guatemala",
  "Honduran": "Honduras", "Hungarian": "Hungary", "Icelandic": "Iceland", "Indian": "India", "Indonesian": "Indonesia",
  "Iranian": "Iran Islamic Republic of", "Iraqi": "Iraq", "Irish": "Ireland", "Israeli": "Israel", "Italian": "Italy",
  "Japanese": "Japan", "Jordanian": "Jordan", "Kazakhstani": "Kazakhstan", "Kenyan": "Kenya", "Kuwaiti": "Kuwait",
  "Kyrgyzstani": "Kyrgyzstan", "Latvian": "Latvia", "Lebanese": "Lebanon", "Libyan": "Libyan Arab Jamahiriya",
  "Lithuanian": "Lithuania", "Luxembourger": "Luxembourg", "Malaysian": "Malaysia", "Maldivian": "Maldives",
  "Maltese": "Malta", "Mexican": "Mexico", "Moldovan": "Moldova", "Mongolian": "Mongolia", "Moroccan": "Morocco",
  "Nepalese": "Nepal", "New Zealander": "New Zealand", "Nigerian": "Nigeria", "North Korean": "Democratic Peoples Republic of Korea",
  "Norwegian": "Norway", "Omani": "Oman", "Pakistani": "Pakistan", "Palestinian": "Palestinian", "Panamanian": "Panama",
  "Peruvian": "Peru", "Polish": "Poland", "Portuguese": "Portugal", "Qatari": "Qatar", "Romanian": "Romania",
  "Russian": "Russian Federation", "Saudi": "Saudi Arabia", "Serbian": "Serbia", "Singaporean": "Singapore",
  "Slovak": "Slovakia", "Slovenian": "Slovenia", "Somali": "Somalia", "South African": "South Africa",
  "South Korean": "Republic of Korea", "Spanish": "Spain", "Sri Lankan": "Sri Lanka", "Sudanese": "Sudan",
  "Swedish": "Sweden", "Swiss": "Switzerland", "Syrian": "Syrian Arab Republic", "Taiwanese": "China",
  "Tajikistani": "Tajikistan", "Tanzanian": "United Republic of Tanzania", "Thai": "Thailand", "Tunisian": "Tunisia",
  "Turkish": "Turkey", "Turkmen": "Turkmenistan", "Ugandan": "Uganda", "Ukrainian": "Ukraine", "Uruguayan": "Uruguay",
  "Uzbekistani": "Uzbekistan", "Venezuelan": "Venezuela Bolivarian Republic", "Vietnamese": "Viet Nam",
  "Yemeni": "Yemen", "Zambian": "Zambia", "Zimbabwean": "Zimbabwe"
};

// Gender options
const GENDERS = ["Male", "Female"];

// Passport types (matching e-visa form values)
const PASSPORT_TYPES = ["Normal", "Temporary", "Diplomatic", "Special", "TravelDoc", "UN", "passage"];

// Countries list (matching e-visa form values exactly)
const COUNTRIES = [
  "Afghanistan", "Aland Islands", "Albania", "Algeria", "American Samoa", "Andorra", "Angola",
  "Anguilla", "Antigua and Barbuda", "Antilles", "Argentina", "Armenia", "Aruba", "Australia",
  "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium",
  "Belize", "Benin", "Bermuda", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil",
  "British Virgin Islands", "Brunei Darussalam", "Bulgaria", "Burkina Faso", "Burundi", "Cambodia",
  "Cameroon", "Canada", "Cape Verde", "Cayman Islands", "Central African Republic", "Chad", "Chile",
  "China", "Colombia", "Comoros", "Congo", "Cook Islands", "Costa Rica", "Cote dIvoire", "Croatia",
  "Cuba", "Cyprus", "Czech Republic", "Democratic Peoples Republic of Korea",
  "Democratic Republic of the Congo", "Denmark", "Djibouti", "Dominica", "Dominican Republic",
  "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Ethiopia",
  "Faeroe Islands", "Falkland Islands Malvinas", "Fiji", "Finland", "France", "French Guiana",
  "French Polynesia", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Gibraltar", "Greece",
  "Greenland", "Grenada", "Guadeloupe", "Guam", "Guatemala", "Guernsey", "Guinea", "Guinea Bissau",
  "Guyana", "Haiti", "Holy See", "Honduras", "Hong Kong", "Hungary", "Iceland", "India", "Indonesia",
  "Iran Islamic Republic of", "Iraq", "Ireland", "Isle of Man", "Italy", "Jamaica", "Japan",
  "Jersey", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kosovo", "Kuwait", "Kyrgyzstan",
  "Lao Peoples Democratic Republic", "Latvia", "Lebanon", "Lesotho", "Liberia",
  "Libyan Arab Jamahiriya", "Liechtenstein", "Lithuania", "Luxembourg", "Macao", "Madagascar",
  "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Mariana Islands", "Marshall Islands",
  "Martinique", "Mauritania", "Mauritius", "Mayotte", "Mexico", "Micronesia", "Moldova", "Monaco",
  "Mongolia", "Montenegro", "Montserrat", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru",
  "Nepal", "Netherlands", "New Caledonia", "New Zealand", "Nicaragua", "Niger", "Nigeria", "Niue",
  "Norfolk Island", "Norway", "Oman", "Pakistan", "Palau", "Palestinian", "Panama",
  "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Pitcairn", "Poland", "Portugal",
  "Puerto Rico", "Qatar", "Republic of Korea", "Republic of Macedonia", "Romania", "Runion",
  "Russian Federation", "Rwanda", "Saint Barthelemy", "Saint Helena", "Saint Kitts", "Saint Lucia",
  "Saint Martin", "Saint Pierre and Miquelon", "Saint Vincent", "Samoa", "San Marino", "Sao Tome",
  "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leonean", "Singapore", "Slovakia",
  "Slovenia", "Solomon Islands", "Somalia", "South Africa", "Spain", "Sri Lanka", "Sudan",
  "Suriname", "Svalbard Islands", "Swaziland", "Sweden", "Switzerland", "Syrian Arab Republic",
  "Tajikistan", "Thailand", "Timor Leste", "Togo", "Tokelau", "Tonga", "Trinidad and Tobago",
  "Tunisia", "Turkey", "Turkmenistan", "Turks Islands", "Tuvalu", "Uganda", "Ukraine",
  "United Arab Emirates", "United Kingdom of Great Britain", "United Republic of Tanzania",
  "United States of America", "Uruguay", "Uzbekistan", "Vanuatu", "Venezuela Bolivarian Republic",
  "Viet Nam", "Virgin Islands", "Wallis Islands", "Western Sahara", "Yemen", "Zambia", "Zimbabwe"
];

// Professions list (matching e-visa form values)
const PROFESSIONS = ["Physician", "Engineer", "other"];

// Empty form template with default passport type
const EMPTY_FORM = {
  passport_no: '',
  passport_type: 'Normal',  // Default to Normal
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

// Helper function to calculate issue date from expiry date (expiry - 10 years)
const calculateIssueDate = (expiryDate) => {
  if (!expiryDate) return '';
  try {
    const expiry = new Date(expiryDate);
    if (isNaN(expiry.getTime())) return '';
    
    // Subtract 10 years and add 1 day
    const issue = new Date(expiry);
    issue.setFullYear(issue.getFullYear() - 10);
    issue.setDate(issue.getDate() + 1);
    
    // Format as YYYY-MM-DD
    const year = issue.getFullYear();
    const month = String(issue.getMonth() + 1).padStart(2, '0');
    const day = String(issue.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
};

const mapNationality = (extracted) => {
  if (extracted.nationality_code) {
    const mapped = COUNTRY_CODE_TO_NATIONALITY[extracted.nationality_code.toUpperCase()];
    if (mapped) return mapped;
  }
  if (extracted.nationality) {
    if (NATIONALITIES.includes(extracted.nationality)) {
      return extracted.nationality;
    }
    const lowerNat = extracted.nationality.toLowerCase();
    const found = NATIONALITIES.find(
      n => n.toLowerCase() === lowerNat
        || (lowerNat.length >= 4 && (n.toLowerCase().includes(lowerNat) || lowerNat.includes(n.toLowerCase())))
    );
    if (found) return found;
  }
  return '';
};

const sanitizePlaceValue = (value) => {
  if (!value) return '';
  const trimmed = value.trim();
  if (trimmed.length < 4) return '';
  return trimmed;
};

const mapCountryDropdown = (value) => {
  const sanitized = sanitizePlaceValue(value);
  if (!sanitized) return '';
  if (COUNTRIES.includes(sanitized)) return sanitized;
  const lower = sanitized.toLowerCase();
  const exact = COUNTRIES.find(c => c.toLowerCase() === lower);
  if (exact) return exact;
  if (sanitized.length >= 4) {
    const startsWith = COUNTRIES.find(
      c => c.toLowerCase().startsWith(lower) || lower.startsWith(c.toLowerCase())
    );
    if (startsWith) return startsWith;
  }
  return '';
};

const mergeExtractedData = (extracted) => {
  const nationality = mapNationality(extracted);
  const fallbackCountry = nationality ? (NATIONALITY_TO_COUNTRY[nationality] || '') : '';
  const expiryDate = extracted.expiry_date || '';
  const placeOfIssue = mapCountryDropdown(extracted.place_of_issue) || fallbackCountry;
  const countryOfResidence = mapCountryDropdown(extracted.country_of_residence) || placeOfIssue || fallbackCountry;

  const mergedData = {
    ...EMPTY_FORM,
    passport_no: extracted.passport_no || '',
    passport_type: extracted.passport_type || 'Normal',
    first_name_en: extracted.first_name_en || '',
    surname_en: extracted.surname_en || '',
    father_name_en: extracted.father_name_en || '',
    mother_name_en: extracted.mother_name_en || '',
    first_name_ar: extracted.first_name_ar || '',
    surname_ar: extracted.surname_ar || '',
    father_name_ar: extracted.father_name_ar || '',
    mother_name_ar: extracted.mother_name_ar || '',
    nationality,
    gender: extracted.gender || '',
    birth_date: extracted.birth_date || '',
    expiry_date: expiryDate,
    issue_date: extracted.issue_date || calculateIssueDate(expiryDate),
    place_of_issue: placeOfIssue,
    country_of_residence: countryOfResidence,
  };

  const missingRequired = !mergedData.passport_no || !mergedData.first_name_en
    || !mergedData.surname_en || !mergedData.nationality || !mergedData.expiry_date;

  return {
    formData: mergedData,
    arabicSuggested: !!extracted.arabic_names_suggested,
    missingRequired,
  };
};

const buildPassportPayload = (data) => ({
  passport_no: data.passport_no,
  first_name_en: data.first_name_en,
  surname_en: data.surname_en,
  nationality: data.nationality,
  expiry_date: data.expiry_date,
  passport_type: data.passport_type || null,
  first_name_ar: data.first_name_ar || null,
  father_name_en: data.father_name_en || null,
  father_name_ar: data.father_name_ar || null,
  grandfather_name_en: data.grandfather_name_en || null,
  grandfather_name_ar: data.grandfather_name_ar || null,
  surname_ar: data.surname_ar || null,
  mother_name_en: data.mother_name_en || null,
  mother_name_ar: data.mother_name_ar || null,
  mother_father_name_en: data.mother_father_name_en || null,
  mother_father_name_ar: data.mother_father_name_ar || null,
  gender: data.gender || null,
  birth_date: data.birth_date || null,
  place_of_issue: data.place_of_issue || null,
  issue_date: data.issue_date || null,
  profession: data.profession || null,
  country_of_residence: data.country_of_residence || null,
  applicant_type: data.applicant_type || null,
});

const isFormValid = (data) => (
  data?.passport_no && data?.first_name_en && data?.surname_en && data?.nationality && data?.expiry_date
);

const newQueueId = () => `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const STATUS_LABELS = {
  pending: 'Pending',
  processing: 'Processing',
  ready: 'Ready',
  error: 'Error',
  saved: 'Saved',
};

const STATUS_COLORS = {
  pending: 'bg-slate-600',
  processing: 'bg-blue-600',
  ready: 'bg-amber-600',
  error: 'bg-red-600',
  saved: 'bg-green-600',
};

export const PassportScanner = () => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const batchFileInputRef = useRef(null);
  
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [scanMode, setScanMode] = useState('single');
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [formData, setFormData] = useState(null);
  const [arabicSuggested, setArabicSuggested] = useState(false);
  const [saving, setSaving] = useState(false);
  const [facingMode, setFacingMode] = useState('environment');
  const [batchQueue, setBatchQueue] = useState([]);
  const [activeQueueId, setActiveQueueId] = useState(null);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [autoProcessOnAdd, setAutoProcessOnAdd] = useState(false);
  const [batchDragOver, setBatchDragOver] = useState(false);

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
    setArabicSuggested(false);
    if (scanMode === 'single') {
      startCamera();
    }
  };

  const activeQueueItem = batchQueue.find(item => item.id === activeQueueId);
  const displayFormData = scanMode === 'batch' ? activeQueueItem?.formData : formData;
  const displayArabicSuggested = scanMode === 'batch' ? !!activeQueueItem?.arabicSuggested : arabicSuggested;

  const updateField = (field, value) => {
    if (scanMode === 'batch' && activeQueueId) {
      setBatchQueue(prev => prev.map(item => (
        item.id === activeQueueId
          ? { ...item, formData: { ...item.formData, [field]: value } }
          : item
      )));
      return;
    }
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const scanImageBlob = async (blob, fileName = 'passport.jpg') => {
    const uploadData = new FormData();
    uploadData.append('image', blob, fileName);
    const result = await api.post('/ocr/scan-passport', uploadData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return result.data;
  };

  const addFilesToQueue = async (files) => {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      toast.error('Please select image files');
      return;
    }

    const newItems = await Promise.all(imageFiles.map(async (file) => {
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
      });
      return {
        id: newQueueId(),
        fileName: file.name,
        dataUrl,
        status: 'pending',
        formData: null,
        arabicSuggested: false,
        error: null,
      };
    }));

    setBatchQueue(prev => {
      const next = [...prev, ...newItems];
      if (autoProcessOnAdd) {
        setTimeout(() => processBatchQueue(next), 0);
      }
      return next;
    });
    if (!activeQueueId && newItems.length > 0) {
      setActiveQueueId(newItems[0].id);
    }
    toast.success(`Added ${newItems.length} image(s) to queue`);
  };

  const addCapturedToQueue = async () => {
    if (!capturedImage) {
      toast.error('Please capture a photo first');
      return;
    }
    const response = await fetch(capturedImage);
    const blob = await response.blob();
    const dataUrl = capturedImage;
    const item = {
      id: newQueueId(),
      fileName: `capture-${Date.now()}.jpg`,
      dataUrl,
      status: 'pending',
      formData: null,
      arabicSuggested: false,
      error: null,
    };
    setBatchQueue(prev => {
      const next = [...prev, item];
      if (autoProcessOnAdd) {
        setTimeout(() => processBatchQueue(next), 0);
      }
      return next;
    });
    setActiveQueueId(item.id);
    setCapturedImage(null);
    toast.success('Added to queue');
    if (!autoProcessOnAdd && !cameraActive) {
      startCamera();
    }
  };

  const removeQueueItem = (id) => {
    setBatchQueue(prev => {
      const next = prev.filter(item => item.id !== id);
      if (activeQueueId === id) {
        const firstReady = next.find(i => i.status === 'ready' || i.status === 'saved');
        setActiveQueueId(firstReady?.id || next[0]?.id || null);
      }
      return next;
    });
  };

  const clearBatchQueue = () => {
    setBatchQueue([]);
    setActiveQueueId(null);
    setBatchProgress({ current: 0, total: 0 });
  };

  const processQueueItem = async (item) => {
    setBatchQueue(prev => prev.map(i => (
      i.id === item.id ? { ...i, status: 'processing', error: null } : i
    )));

    try {
      const response = await fetch(item.dataUrl);
      const blob = await response.blob();
      const result = await scanImageBlob(blob, item.fileName);

      if (result.success) {
        const { formData: merged, arabicSuggested: suggested } = mergeExtractedData(result.extracted_data || {});
        setBatchQueue(prev => prev.map(i => (
          i.id === item.id
            ? { ...i, status: 'ready', formData: merged, arabicSuggested: suggested, error: null }
            : i
        )));
        setActiveQueueId(item.id);
        return { success: true };
      }
      setBatchQueue(prev => prev.map(i => (
        i.id === item.id ? { ...i, status: 'error', error: result.error || 'Failed to extract' } : i
      )));
      return { success: false };
    } catch (error) {
      setBatchQueue(prev => prev.map(i => (
        i.id === item.id ? { ...i, status: 'error', error: 'Scan failed' } : i
      )));
      return { success: false };
    }
  };

  const processBatchQueue = async (queueOverride = null) => {
    const queue = queueOverride || batchQueue;
    const pending = queue.filter(i => i.status === 'pending' || i.status === 'error');
    if (pending.length === 0) {
      toast.info('No pending items to process');
      return;
    }

    setBatchProcessing(true);
    setBatchProgress({ current: 0, total: pending.length });

    let successCount = 0;
    for (let i = 0; i < pending.length; i += 1) {
      setBatchProgress({ current: i + 1, total: pending.length });
      const result = await processQueueItem(pending[i]);
      if (result.success) successCount += 1;
    }

    setBatchProcessing(false);
    toast.success(`Processed ${successCount} of ${pending.length} passport(s)`);
  };

  const generateArabicNames = async () => {
    const data = displayFormData;
    if (!data?.first_name_en) {
      toast.error('Enter English first name first');
      return;
    }
    try {
      const result = await api.post('/utilities/generate-arabic-names', {
        first_name_en: data.first_name_en,
        father_name_en: data.father_name_en || undefined,
        grandfather_name_en: data.grandfather_name_en || undefined,
        surname_en: data.surname_en || undefined,
        mother_name_en: data.mother_name_en || undefined,
      });
      const arabic = result.data;
      const updates = {
        first_name_ar: arabic.first_name_ar || data.first_name_ar,
        father_name_ar: arabic.father_name_ar || data.father_name_ar,
        grandfather_name_ar: arabic.grandfather_name_ar || data.grandfather_name_ar,
        surname_ar: arabic.surname_ar || data.surname_ar,
        mother_name_ar: arabic.mother_name_ar || data.mother_name_ar,
      };
      if (scanMode === 'batch' && activeQueueId) {
        setBatchQueue(prev => prev.map(item => (
          item.id === activeQueueId
            ? { ...item, formData: { ...item.formData, ...updates }, arabicSuggested: true }
            : item
        )));
      } else {
        setFormData(prev => ({ ...prev, ...updates }));
        setArabicSuggested(true);
      }
      toast.success('Arabic names generated — please review');
    } catch (error) {
      console.error('Arabic name generation error:', error);
      toast.error('Failed to generate Arabic names');
    }
  };

  const scanPassport = async () => {
    if (!capturedImage) {
      toast.error('Please capture a photo first');
      return;
    }
    
    setScanning(true);
    
    try {
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      const result = await scanImageBlob(blob);

      if (result.success) {
        const { formData: merged, arabicSuggested: suggested, missingRequired } = mergeExtractedData(
          result.extracted_data || {}
        );
        setFormData(merged);
        setArabicSuggested(suggested);

        if (missingRequired) {
          toast.warning('Some required fields could not be read — please check image quality or fill manually.');
        } else {
          toast.success('Passport data extracted! Please review and complete the form.');
        }
      } else {
        toast.error(result.error || 'Failed to extract data');
      }
    } catch (error) {
      console.error('Scan error:', error);
      toast.error('Failed to scan passport');
    } finally {
      setScanning(false);
    }
  };

  const savePassportData = async (data, queueId = null) => {
    if (!selectedGroup) {
      toast.error('Please select a group first');
      return false;
    }
    if (!isFormValid(data)) {
      toast.error('Passport number, names, nationality, and expiry date are required');
      return false;
    }

    try {
      await api.post(`/groups/${selectedGroup}/passports`, buildPassportPayload(data));
      if (queueId) {
        setBatchQueue(prev => {
          const updated = prev.map(item => (
            item.id === queueId ? { ...item, status: 'saved' } : item
          ));
          const next = updated.find(
            i => i.id !== queueId && (i.status === 'ready' || i.status === 'error')
          );
          if (next) setActiveQueueId(next.id);
          return updated;
        });
      }
      return true;
    } catch (error) {
      console.error('Save error:', error);
      toast.error(error.response?.data?.detail || 'Failed to save passport');
      return false;
    }
  };

  const savePassport = async () => {
    setSaving(true);
    const data = scanMode === 'batch' ? activeQueueItem?.formData : formData;
    const queueId = scanMode === 'batch' ? activeQueueId : null;
    const ok = await savePassportData(data, queueId);
    if (ok) {
      toast.success('Passport saved successfully!');
      if (scanMode === 'single') {
        setCapturedImage(null);
        setFormData(null);
        setArabicSuggested(false);
      }
    }
    setSaving(false);
  };

  const saveAllValid = async () => {
    if (!selectedGroup) {
      toast.error('Please select a group first');
      return;
    }
    const readyItems = batchQueue.filter(i => i.status === 'ready' && isFormValid(i.formData));
    if (readyItems.length === 0) {
      toast.error('No valid passports ready to save');
      return;
    }

    setSaving(true);
    let saved = 0;
    let failed = 0;
    for (const item of readyItems) {
      const ok = await savePassportData(item.formData, item.id);
      if (ok) saved += 1;
      else failed += 1;
    }
    setSaving(false);
    toast.success(`Saved ${saved} passport(s)${failed ? `, ${failed} failed` : ''}`);
  };

  const skipToNext = () => {
    const idx = batchQueue.findIndex(i => i.id === activeQueueId);
    const next = batchQueue.slice(idx + 1).find(i => i.status === 'ready' || i.status === 'error')
      || batchQueue.find(i => i.status === 'ready' || i.status === 'error');
    if (next) setActiveQueueId(next.id);
    else toast.info('No more items to review');
  };

  const handleBatchDrop = (e) => {
    e.preventDefault();
    setBatchDragOver(false);
    if (e.dataTransfer.files?.length) {
      addFilesToQueue(e.dataTransfer.files);
    }
  };

  const handleModeChange = (mode) => {
    setScanMode(mode);
    if (mode === 'single') {
      setCapturedImage(null);
      setFormData(null);
      setArabicSuggested(false);
    } else {
      stopCamera();
      setCapturedImage(null);
      setFormData(null);
    }
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

        {/* Scan Mode Toggle */}
        <div className="bg-slate-800 rounded-xl p-1 flex gap-1">
          <Button
            variant={scanMode === 'single' ? 'default' : 'ghost'}
            className={`flex-1 ${scanMode === 'single' ? 'bg-blue-600 hover:bg-blue-700' : 'text-slate-300 hover:bg-slate-700'}`}
            onClick={() => handleModeChange('single')}
          >
            <Camera className="w-4 h-4 mr-2" />
            Single
          </Button>
          <Button
            variant={scanMode === 'batch' ? 'default' : 'ghost'}
            className={`flex-1 ${scanMode === 'batch' ? 'bg-blue-600 hover:bg-blue-700' : 'text-slate-300 hover:bg-slate-700'}`}
            onClick={() => handleModeChange('batch')}
          >
            <Layers className="w-4 h-4 mr-2" />
            Batch
          </Button>
        </div>

        {/* Batch Queue Panel */}
        {scanMode === 'batch' && (
          <div className="bg-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-slate-300">Batch Queue ({batchQueue.length})</h2>
              {batchQueue.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearBatchQueue}
                  className="text-slate-400 hover:text-white h-7 text-xs"
                >
                  Clear
                </Button>
              )}
            </div>

            <div
              className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                batchDragOver ? 'border-blue-500 bg-blue-500/10' : 'border-slate-600'
              }`}
              onDragEnter={(e) => { e.preventDefault(); setBatchDragOver(true); }}
              onDragLeave={(e) => { e.preventDefault(); setBatchDragOver(false); }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleBatchDrop}
              onClick={() => batchFileInputRef.current?.click()}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-slate-500" />
              <p className="text-sm text-slate-400">Drop images here or tap to upload multiple</p>
              <input
                ref={batchFileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => { addFilesToQueue(e.target.files); e.target.value = ''; }}
                className="hidden"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={autoProcessOnAdd}
                onChange={(e) => setAutoProcessOnAdd(e.target.checked)}
                className="rounded border-slate-600"
              />
              Auto-process when added
            </label>

            {batchQueue.length > 0 && (
              <>
                <div className="flex gap-2">
                  <Button
                    onClick={() => processBatchQueue()}
                    disabled={batchProcessing}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    {batchProcessing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <ScanLine className="w-4 h-4 mr-2" />
                    )}
                    {batchProcessing
                      ? `Processing ${batchProgress.current}/${batchProgress.total}...`
                      : 'Process Queue'}
                  </Button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {batchQueue.map(item => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer ${
                        activeQueueId === item.id ? 'bg-slate-700 ring-1 ring-blue-500' : 'bg-slate-750 hover:bg-slate-700'
                      }`}
                      onClick={() => setActiveQueueId(item.id)}
                    >
                      <img src={item.dataUrl} alt="" className="w-12 h-9 object-cover rounded" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white truncate">
                          {item.formData?.passport_no || item.fileName}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {item.formData
                            ? `${item.formData.first_name_en} ${item.formData.surname_en}`.trim()
                            : STATUS_LABELS[item.status]}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[item.status]} text-white`}>
                        {STATUS_LABELS[item.status]}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-red-400"
                        onClick={(e) => { e.stopPropagation(); removeQueueItem(item.id); }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

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
                {scanMode === 'batch' ? (
                  <Button
                    onClick={addCapturedToQueue}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    <Layers className="w-5 h-5 mr-2" />
                    Add to Queue
                  </Button>
                ) : (
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
                )}
              </div>
            </>
          )}
        </div>

        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Complete Passport Form */}
        {displayFormData && (
          <div className="bg-slate-800 rounded-xl p-4 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Check className="w-5 h-5 text-green-500" />
              Passport Details
              {scanMode === 'batch' && activeQueueItem && (
                <span className="text-xs text-slate-400 font-normal ml-auto">
                  {activeQueueItem.fileName}
                </span>
              )}
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
                    value={displayFormData.passport_no}
                    onChange={(e) => updateField('passport_no', e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    placeholder="e.g., AB1234567"
                  />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Passport Type</Label>
                  <Select value={displayFormData.passport_type} onValueChange={(v) => updateField('passport_type', v)}>
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
                    value={displayFormData.first_name_en}
                    onChange={(e) => updateField('first_name_en', e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Surname (EN) *</Label>
                  <Input
                    value={displayFormData.surname_en}
                    onChange={(e) => updateField('surname_en', e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400 text-xs">Father Name (EN) <span className="text-yellow-500">*Manual</span></Label>
                  <Input
                    value={displayFormData.father_name_en}
                    onChange={(e) => updateField('father_name_en', e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    placeholder="Enter manually"
                  />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Grandfather Name (EN) <span className="text-yellow-500">*Manual</span></Label>
                  <Input
                    value={displayFormData.grandfather_name_en}
                    onChange={(e) => updateField('grandfather_name_en', e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    placeholder="Enter manually"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400 text-xs">Nationality *</Label>
                  <Select value={displayFormData.nationality} onValueChange={(v) => updateField('nationality', v)}>
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
                  <Select value={displayFormData.gender} onValueChange={(v) => updateField('gender', v)}>
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
              <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                <h3 className="text-sm font-medium text-slate-300">Arabic Names</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generateArabicNames}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700 text-xs h-7"
                >
                  Generate Arabic Names
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400 text-xs">
                    First Name (AR)
                    {displayArabicSuggested && displayFormData.first_name_ar && (
                      <span className="text-yellow-500 ml-1">Suggested</span>
                    )}
                  </Label>
                  <Input
                    value={displayFormData.first_name_ar}
                    onChange={(e) => updateField('first_name_ar', e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white mt-1 text-right"
                    dir="rtl"
                  />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">
                    Surname (AR)
                    {displayArabicSuggested && displayFormData.surname_ar && (
                      <span className="text-yellow-500 ml-1">Suggested</span>
                    )}
                  </Label>
                  <Input
                    value={displayFormData.surname_ar}
                    onChange={(e) => updateField('surname_ar', e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white mt-1 text-right"
                    dir="rtl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400 text-xs">
                    Father Name (AR)
                    {displayArabicSuggested && displayFormData.father_name_ar && (
                      <span className="text-yellow-500 ml-1">Suggested</span>
                    )}
                  </Label>
                  <Input
                    value={displayFormData.father_name_ar}
                    onChange={(e) => updateField('father_name_ar', e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white mt-1 text-right"
                    dir="rtl"
                  />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">
                    Grandfather (AR)
                    {displayArabicSuggested && displayFormData.grandfather_name_ar && (
                      <span className="text-yellow-500 ml-1">Suggested</span>
                    )}
                  </Label>
                  <Input
                    value={displayFormData.grandfather_name_ar}
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
                    value={displayFormData.mother_name_en}
                    onChange={(e) => updateField('mother_name_en', e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Mother Name (AR)
                    {displayArabicSuggested && displayFormData.mother_name_ar && (
                      <span className="text-yellow-500 ml-1">Suggested</span>
                    )}
                  </Label>
                  <Input
                    value={displayFormData.mother_name_ar}
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
                    value={displayFormData.mother_father_name_en}
                    onChange={(e) => updateField('mother_father_name_en', e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Mother's Father (AR)</Label>
                  <Input
                    value={displayFormData.mother_father_name_ar}
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
                    value={displayFormData.birth_date}
                    onChange={(e) => updateField('birth_date', e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Expiry Date *</Label>
                  <Input
                    type="date"
                    value={displayFormData.expiry_date}
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
                    value={displayFormData.issue_date}
                    onChange={(e) => updateField('issue_date', e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Place of Issue</Label>
                  <Select value={displayFormData.place_of_issue} onValueChange={(v) => updateField('place_of_issue', v)}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400 text-xs">Profession</Label>
                  <Select value={displayFormData.profession} onValueChange={(v) => updateField('profession', v)}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                      <SelectValue placeholder="Select profession" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROFESSIONS.map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Country of Residence</Label>
                  <Select value={displayFormData.country_of_residence} onValueChange={(v) => updateField('country_of_residence', v)}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {scanMode === 'batch' && activeQueueItem?.status === 'saved' && (
              <p className="text-sm text-green-400 flex items-center gap-2">
                <Check className="w-4 h-4" /> Saved to group
              </p>
            )}
            
            {scanMode === 'batch' ? (
              <div className="flex flex-col gap-2 mt-4">
                <div className="flex gap-2">
                  <Button
                    onClick={savePassport}
                    disabled={saving || !selectedGroup || activeQueueItem?.status === 'saved'}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    {saving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Check className="w-5 h-5 mr-2" />}
                    {saving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={skipToNext}
                    className="border-slate-600 text-white hover:bg-slate-700"
                  >
                    <SkipForward className="w-5 h-5" />
                  </Button>
                </div>
                <Button
                  onClick={saveAllValid}
                  disabled={saving || !selectedGroup}
                  variant="outline"
                  className="w-full border-slate-600 text-white hover:bg-slate-700"
                >
                  Save All Valid ({batchQueue.filter(i => i.status === 'ready' && isFormValid(i.formData)).length})
                </Button>
              </div>
            ) : (
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
            )}
          </div>
        )}

        {scanMode === 'batch' && activeQueueItem && !displayFormData && !activeQueueItem.error && (
          <div className="bg-slate-800 rounded-xl p-4 text-sm text-slate-400 text-center">
            {activeQueueItem.status === 'processing' ? (
              <p className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Processing {activeQueueItem.fileName}...
              </p>
            ) : (
              <p>{activeQueueItem.fileName} is pending — click Process Queue to extract data.</p>
            )}
          </div>
        )}

        {scanMode === 'batch' && activeQueueItem?.error && !displayFormData && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-sm text-red-300">
            <p className="font-medium">Scan failed: {activeQueueItem.fileName}</p>
            <p className="text-xs mt-1">{activeQueueItem.error}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2 border-red-600 text-red-300"
              onClick={() => processQueueItem(activeQueueItem)}
            >
              Retry
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
