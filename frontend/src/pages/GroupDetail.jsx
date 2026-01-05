import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { ScrollArea } from '../components/ui/scroll-area';
import { ArrowLeft, Plus, Upload, FileText, User, Trash2, Edit, Search, CheckCircle, AlertCircle, Image, Eye, Download, AlertTriangle, Save, Calendar, Hash, Clock, CreditCard, BadgeCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../utils/api';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Visa status configuration
const VISA_STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-gray-100 text-gray-800', icon: Clock },
  form_submitted: { label: 'Form Submitted', color: 'bg-blue-100 text-blue-800', icon: FileText },
  payment_done: { label: 'Payment Done', color: 'bg-amber-100 text-amber-800', icon: CreditCard },
  visa_issued: { label: 'Visa Issued', color: 'bg-green-100 text-green-800', icon: BadgeCheck }
};

// Helper function to get proper image URL
const getImageUrl = (imageUrl) => {
  if (!imageUrl) return null;
  // If it's already a full URL (S3 presigned), return as is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  // Otherwise, prepend the API URL
  return `${API_URL}${imageUrl}`;
};

// Helper function to calculate age from birth date
const calculateAge = (birthDateStr) => {
  if (!birthDateStr) return 99; // Default to adult if no birth date
  try {
    const birthDate = new Date(birthDateStr);
    if (isNaN(birthDate.getTime())) return 99;
    
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  } catch {
    return 99;
  }
};

// Check if person is a minor (under 18)
const isMinor = (birthDateStr) => calculateAge(birthDateStr) < 18;

// Get applicant type based on age and gender
const getApplicantType = (birthDateStr, gender) => {
  if (!isMinor(birthDateStr)) return ""; // Empty for adults
  
  const genderLower = (gender || "").toLowerCase();
  if (genderLower === "male" || genderLower === "m") return "Son";
  if (genderLower === "female" || genderLower === "f") return "Daughter";
  return "";
};

// Exact nationality values from e-visa form (https://eservice.evisa.iq/)
const NATIONALITIES = [
  "Afghan", "Albanian", "Algerian", "American", "Argentine", "Armenian", "Australian", "Austrian",
  "Azerbaijani", "Bahraini", "Bangladeshi", "Barbadians", "Belarusians", "Belgian", "Belizeans",
  "Beninese", "Bermudian", "Bhutanese", "Bolivian", "Bosnian", "Batswana", "Brazilian", "British",
  "Bruneian", "Bulgarian", "Burkinabe", "Burundian", "Cambodian", "Cameroonian", "Canadian",
  "Cape Verde", "Chadian", "Chilean", "Chinese", "Colombian", "Comorian", "Congolese", "Costa Rican",
  "Croatian", "Cuban", "Cypriot", "Czech", "Danish", "Djiboutians", "Dominican", "Dutch",
  "Ecuadorian", "Egyptian", "Emirati", "Eritrean", "Estonian", "Ethiopian", "Fijian", "Filipino",
  "Finnish", "French", "Gabonese", "Gambian", "Georgian", "German", "Ghanaian", "Greek",
  "Greenland", "Grenadian", "Guatemalan", "Guinean", "Guyanese", "Haitian", "Honduran", "Hungarian",
  "Icelandic", "Indian", "Indonesian", "Iranian", "Iraqi", "Irish", "Italian", "Jamaican",
  "Japanese", "Jordanian", "Kazakh", "Kenyan", "Kiribati", "Korean", "Kosovoi", "Kuwaiti",
  "Kyrgyz", "Lao", "Latvian", "Lebanese", "Lesotho", "Liberian", "Libyan", "Liechtensteiners",
  "Lithuanian", "Luxembourgish", "Macedonians", "Malagasy", "Malawian", "Malaysian", "Maldivian",
  "Malian", "Maltese", "Mauritanian", "Mauritian", "Mexican", "Micronesia", "Moldavians",
  "Monegasque", "Mongolian", "Montenegrin", "Moroccan", "Mozambican", "Myanmar", "Namibian",
  "Naurun", "Nepalese", "New Zealand", "Nicaraguan", "Niger", "Nigerian", "Norwegian", "Omani",
  "Pakistani", "Palau", "Palestinian", "Panamanian", "Papua New Guinea", "Paraguayan", "Peruvian",
  "Philippine", "Polish", "Portuguese", "Puerto Rico", "Qatari", "Romanian", "Russian", "Rwandan",
  "Saint Lucia", "Samoa", "San Marino", "Sao Tome", "Saudi", "Senegalese", "Serbian", "Seychelles",
  "Sierra Leonean", "Singaporean", "Slovak", "Slovenia", "Solomon Islands", "Somalian",
  "South African", "Spanish", "Sri Lankan", "Sudanese", "Suriname", "Swazi", "Swedish", "Swiss",
  "Syrian", "Tajikistani", "Tanzanian", "Thai", "Timor Leste", "Togolese", "Tokelau", "Tongan",
  "Trinidad and Tobago", "Tunisian", "Turkish", "Turkmen", "Tuvalu", "Ugandan", "Ukrainian",
  "Uruguayan", "Uzbekistani", "Vanuatu", "Venezuelan", "Vietnamese", "Yemeni", "Zambian", "Zimbabwean"
];

// Exact country values from e-visa form place of issue / country of residence dropdowns
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

// Exact passport type values from e-visa form
const PASSPORT_TYPES = ["Normal", "Temporary", "Diplomatic", "Special", "TravelDoc", "UN", "passage"];

// Exact gender values from e-visa form
const GENDERS = ["Male", "Female"];

// Exact profession values from e-visa form
const PROFESSIONS = ["Physician", "Engineer", "other"];

// Exact applicant type values from e-visa form
const APPLICANT_TYPES = ["Son", "Daughter"];

// Exact accommodation types from e-visa form (for future use)
const ACCOMMODATION_TYPES = ["Hotel", "Villa", "Appartment", "Home", "CompanyHeadquarter"];

// Iraq governorates from e-visa form (for future use)
const IRAQ_GOVERNORATES = [
  "Baghdad province", "Wasit province", "Kirkuk", "Karbala", "Salahuddin province",
  "Dhi Qar", "Diyala province", "Maysan", "Babil province", "Najaf", "Muthanna",
  "Diwaniya", "Basra", "Anbar province", "AlMosul", "Al - Sulaimaniya", "Erbil", "Duhouk"
];

const emptyForm = {
  passport_no: '',
  passport_type: 'Normal',
  first_name_en: '',
  surname_en: '',
  first_name_ar: '',
  father_name_ar: '',
  father_name_en: '',
  grandfather_name_ar: '',
  grandfather_name_en: '',
  surname_ar: '',
  mother_name_ar: '',
  mother_name_en: '',
  mother_father_name_ar: '',
  mother_father_name_en: '',
  nationality: '',
  gender: '',
  birth_date: '',
  place_of_issue: '',
  issue_date: '',
  expiry_date: '',
  profession: '',
  country_of_residence: '',
  applicant_type: '',
  parent_passport_id: '',
  relationship_proof: ''
};

export const GroupDetail = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [passports, setPassports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, pending, done
  const [showAddPassport, setShowAddPassport] = useState(false);
  const [showEditPassport, setShowEditPassport] = useState(null);
  const [showViewPassport, setShowViewPassport] = useState(null);
  const [deletePassportId, setDeletePassportId] = useState(null);
  const [passportForm, setPassportForm] = useState({ ...emptyForm });
  const [formLoading, setFormLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [groupStats, setGroupStats] = useState({ total: 0, done: 0, pending: 0, progress_percent: 0, visa_stats: {} });
  const [relationshipProofFile, setRelationshipProofFile] = useState(null);  // For relationship proof upload
  
  // Submission details state
  const [approvalNumber, setApprovalNumber] = useState('');
  const [dateOfPayment, setDateOfPayment] = useState('');
  const [savingSubmissionDetails, setSavingSubmissionDetails] = useState(false);
  
  // Visa status state
  const [selectedPassports, setSelectedPassports] = useState([]);
  const [updatingVisaStatus, setUpdatingVisaStatus] = useState(false);
  const [visaStatusFilter, setVisaStatusFilter] = useState('all');

  const fetchData = useCallback(async () => {
    try {
      const [groupRes, passportsRes, statsRes] = await Promise.all([
        api.get(`/groups/${groupId}`),
        api.get(`/groups/${groupId}/passports`),
        api.get(`/groups/${groupId}/stats`)
      ]);
      setGroup(groupRes.data);
      setPassports(passportsRes.data);
      setGroupStats(statsRes.data);
      // Set submission details from group data
      setApprovalNumber(groupRes.data.approval_number || '');
      setDateOfPayment(groupRes.data.date_of_payment || '');
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

  const resetForm = () => {
    setPassportForm({ ...emptyForm });
  };
  
  // Save submission details handler
  const handleSaveSubmissionDetails = async () => {
    setSavingSubmissionDetails(true);
    try {
      const response = await api.put(`/groups/${groupId}/submission-details`, {
        approval_number: approvalNumber || null,
        date_of_payment: dateOfPayment || null
      });
      setGroup(response.data);
      toast.success('Submission details saved successfully');
      // Refresh data to get updated visa statuses
      fetchData();
    } catch (error) {
      console.error('Error saving submission details:', error);
      toast.error(error.response?.data?.detail || 'Failed to save submission details');
    } finally {
      setSavingSubmissionDetails(false);
    }
  };
  
  // Update single passport visa status
  const handleUpdateVisaStatus = async (passportId, newStatus) => {
    try {
      await api.put(`/passports/${passportId}/visa-status?visa_status=${newStatus}`);
      toast.success('Visa status updated');
      fetchData();
    } catch (error) {
      console.error('Error updating visa status:', error);
      toast.error(error.response?.data?.detail || 'Failed to update visa status');
    }
  };
  
  // Bulk update visa status
  const handleBulkVisaStatus = async (newStatus) => {
    if (selectedPassports.length === 0) {
      toast.error('Please select passports first');
      return;
    }
    
    setUpdatingVisaStatus(true);
    try {
      await api.put(`/groups/${groupId}/passports/bulk-visa-status?visa_status=${newStatus}`, selectedPassports);
      toast.success(`Updated ${selectedPassports.length} passports to ${VISA_STATUS_CONFIG[newStatus]?.label || newStatus}`);
      setSelectedPassports([]);
      fetchData();
    } catch (error) {
      console.error('Error bulk updating visa status:', error);
      toast.error(error.response?.data?.detail || 'Failed to update visa status');
    } finally {
      setUpdatingVisaStatus(false);
    }
  };
  
  // Mark all as visa issued
  const handleMarkAllVisaIssued = async () => {
    setUpdatingVisaStatus(true);
    try {
      const response = await api.post(`/groups/${groupId}/passports/mark-all-visa-issued`);
      toast.success(`Marked ${response.data.updated} passports as Visa Issued`);
      fetchData();
    } catch (error) {
      console.error('Error marking all as visa issued:', error);
      toast.error(error.response?.data?.detail || 'Failed to mark as visa issued');
    } finally {
      setUpdatingVisaStatus(false);
    }
  };
  
  // Toggle passport selection
  const togglePassportSelection = (passportId) => {
    setSelectedPassports(prev => 
      prev.includes(passportId) 
        ? prev.filter(id => id !== passportId)
        : [...prev, passportId]
    );
  };
  
  // Select all passports
  const selectAllPassports = () => {
    if (selectedPassports.length === filteredPassports.length) {
      setSelectedPassports([]);
    } else {
      setSelectedPassports(filteredPassports.map(p => p.id));
    }
  };

  const handleAddPassport = async (e) => {
    e.preventDefault();
    if (!passportForm.passport_no || !passportForm.first_name_en || !passportForm.surname_en || !passportForm.nationality || !passportForm.expiry_date) {
      toast.error('Please fill required fields: Passport No, First Name, Surname, Nationality, Expiry Date');
      return;
    }
    
    // Check if minor - show warning but don't block
    const minorStatus = isMinor(passportForm.birth_date);
    if (minorStatus && !relationshipProofFile && !passportForm.relationship_proof) {
      toast.warning('Note: Relationship proof is pending for this minor. You can upload it later.');
    }
    
    // Auto-set applicant type based on age and gender
    const autoApplicantType = getApplicantType(passportForm.birth_date, passportForm.gender);
    const formData = { ...passportForm, applicant_type: autoApplicantType };
    
    setFormLoading(true);
    try {
      const response = await api.post(`/groups/${groupId}/passports`, formData);
      const newPassport = response.data;
      
      // Upload relationship proof if provided
      if (relationshipProofFile && minorStatus) {
        const proofFormData = new FormData();
        proofFormData.append('file', relationshipProofFile);
        await api.post(`/groups/${groupId}/passports/${newPassport.id}/relationship-proof`, proofFormData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      
      setPassports([...passports, newPassport]);
      setShowAddPassport(false);
      resetForm();
      setRelationshipProofFile(null);
      toast.success('Passport added successfully');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add passport');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditPassport = async (e) => {
    e.preventDefault();
    if (!passportForm.passport_no || !passportForm.first_name_en || !passportForm.surname_en || !passportForm.nationality || !passportForm.expiry_date) {
      toast.error('Please fill required fields');
      return;
    }
    
    // Check if minor - show warning but don't block
    const minorStatus = isMinor(passportForm.birth_date);
    if (minorStatus && !relationshipProofFile && !passportForm.relationship_proof) {
      toast.warning('Note: Relationship proof is pending for this minor. You can upload it later.');
    }
    
    // Auto-set applicant type based on age and gender
    const autoApplicantType = getApplicantType(passportForm.birth_date, passportForm.gender);
    const formData = { ...passportForm, applicant_type: autoApplicantType };
    
    setFormLoading(true);
    try {
      await api.put(`/groups/${groupId}/passports/${showEditPassport.id}`, formData);
      
      // Upload relationship proof if provided
      if (relationshipProofFile && minorStatus) {
        const proofFormData = new FormData();
        proofFormData.append('file', relationshipProofFile);
        await api.post(`/groups/${groupId}/passports/${showEditPassport.id}/relationship-proof`, proofFormData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      
      setShowEditPassport(null);
      resetForm();
      setRelationshipProofFile(null);
      toast.success('Passport updated successfully');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update passport');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeletePassport = async () => {
    if (!deletePassportId) return;
    try {
      await api.delete(`/groups/${groupId}/passports/${deletePassportId}`);
      setPassports(passports.filter(p => p.id !== deletePassportId));
      toast.success('Passport deleted successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete passport');
    } finally {
      setDeletePassportId(null);
    }
  };

  const handleStatusUpdate = async (passportId, newStatus) => {
    try {
      await api.put(`/passports/${passportId}/status?status=${newStatus}`);
      setPassports(passports.map(p => 
        p.id === passportId 
          ? { ...p, status: newStatus, status_updated_at: newStatus === 'done' ? new Date().toISOString() : null }
          : p
      ));
      setGroupStats(prev => ({
        ...prev,
        done: newStatus === 'done' ? prev.done + 1 : prev.done - 1,
        pending: newStatus === 'done' ? prev.pending - 1 : prev.pending + 1,
        progress_percent: ((newStatus === 'done' ? prev.done + 1 : prev.done - 1) / prev.total * 100).toFixed(1)
      }));
      toast.success(`Marked as ${newStatus}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const openEditDialog = (passport) => {
    setPassportForm({
      passport_no: passport.passport_no || '',
      passport_type: passport.passport_type || 'Normal',
      first_name_en: passport.first_name_en || '',
      surname_en: passport.surname_en || '',
      first_name_ar: passport.first_name_ar || '',
      father_name_ar: passport.father_name_ar || '',
      father_name_en: passport.father_name_en || '',
      grandfather_name_ar: passport.grandfather_name_ar || '',
      grandfather_name_en: passport.grandfather_name_en || '',
      surname_ar: passport.surname_ar || '',
      mother_name_ar: passport.mother_name_ar || '',
      mother_name_en: passport.mother_name_en || '',
      mother_father_name_ar: passport.mother_father_name_ar || '',
      mother_father_name_en: passport.mother_father_name_en || '',
      nationality: passport.nationality || '',
      gender: passport.gender || '',
      birth_date: passport.birth_date || '',
      place_of_issue: passport.place_of_issue || '',
      issue_date: passport.issue_date || '',
      expiry_date: passport.expiry_date || '',
      profession: passport.profession || '',
      country_of_residence: passport.country_of_residence || '',
      applicant_type: passport.applicant_type || ''
    });
    setShowEditPassport(passport);
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const response = await api.get(`/groups/${groupId}/export/csv`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${group?.name || 'passports'}_export.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('CSV exported successfully');
    } catch (error) {
      toast.error('Failed to export CSV. Make sure there are passports in this group.');
    } finally {
      setExporting(false);
    }
  };

  const filteredPassports = passports.filter(p => {
    const matchesSearch = 
      p.passport_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.first_name_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.surname_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.nationality.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = 
      statusFilter === 'all' || 
      (statusFilter === 'pending' && (p.status === 'pending' || !p.status)) ||
      (statusFilter === 'done' && p.status === 'done');
    
    const matchesVisaStatus = 
      visaStatusFilter === 'all' || 
      p.visa_status === visaStatusFilter;
    
    return matchesSearch && matchesStatus && matchesVisaStatus;
  });

  if (loading) {
    return <div className="text-center py-12 text-slate-500">Loading...</div>;
  }

  const PassportForm = ({ onSubmit, submitLabel, isEdit = false }) => (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Passport Info Section */}
      <div className="space-y-4">
        <h3 className="font-semibold text-slate-900 border-b pb-2">Passport Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-slate-700 mb-2 block">Passport Number *</Label>
            <Input
              type="text"
              placeholder="e.g., AB1234567"
              value={passportForm.passport_no}
              onChange={(e) => setPassportForm({ ...passportForm, passport_no: e.target.value })}
              className="font-mono"
              disabled={isEdit}
              data-testid="input-passport-no"
            />
          </div>
          <div>
            <Label className="text-slate-700 mb-2 block">Passport Type</Label>
            <Select value={passportForm.passport_type} onValueChange={(v) => setPassportForm({ ...passportForm, passport_type: v })}>
              <SelectTrigger data-testid="select-passport-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {PASSPORT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-slate-700 mb-2 block">Place of Issue</Label>
            <Select value={passportForm.place_of_issue} onValueChange={(v) => setPassportForm({ ...passportForm, place_of_issue: v })}>
              <SelectTrigger data-testid="select-place-of-issue">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {NATIONALITIES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-slate-700 mb-2 block">Issue Date</Label>
            <Input
              type="date"
              value={passportForm.issue_date}
              onChange={(e) => setPassportForm({ ...passportForm, issue_date: e.target.value })}
              data-testid="input-issue-date"
            />
          </div>
          <div>
            <Label className="text-slate-700 mb-2 block">Expiry Date *</Label>
            <Input
              type="date"
              value={passportForm.expiry_date}
              onChange={(e) => setPassportForm({ ...passportForm, expiry_date: e.target.value })}
              data-testid="input-expiry-date"
            />
          </div>
        </div>
      </div>

      {/* Personal Info Section - English */}
      <div className="space-y-4">
        <h3 className="font-semibold text-slate-900 border-b pb-2">Personal Information (English) *</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-slate-700 mb-2 block">First Name *</Label>
            <Input
              type="text"
              placeholder="First Name"
              value={passportForm.first_name_en}
              onChange={(e) => setPassportForm({ ...passportForm, first_name_en: e.target.value })}
              data-testid="input-first-name-en"
            />
          </div>
          <div>
            <Label className="text-slate-700 mb-2 block">Surname *</Label>
            <Input
              type="text"
              placeholder="Surname"
              value={passportForm.surname_en}
              onChange={(e) => setPassportForm({ ...passportForm, surname_en: e.target.value })}
              data-testid="input-surname-en"
            />
          </div>
          <div>
            <Label className="text-slate-700 mb-2 block">Father Name</Label>
            <Input
              type="text"
              placeholder="Father Name"
              value={passportForm.father_name_en}
              onChange={(e) => setPassportForm({ ...passportForm, father_name_en: e.target.value })}
              data-testid="input-father-name-en"
            />
          </div>
          <div>
            <Label className="text-slate-700 mb-2 block">Grandfather Name</Label>
            <Input
              type="text"
              placeholder="Grandfather Name"
              value={passportForm.grandfather_name_en}
              onChange={(e) => setPassportForm({ ...passportForm, grandfather_name_en: e.target.value })}
              data-testid="input-grandfather-name-en"
            />
          </div>
        </div>
      </div>

      {/* Personal Info Section - Arabic */}
      <div className="space-y-4">
        <h3 className="font-semibold text-slate-900 border-b pb-2">Personal Information (Arabic)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-slate-700 mb-2 block">First Name - Arabic</Label>
            <Input
              type="text"
              placeholder="الاسم الأول"
              value={passportForm.first_name_ar}
              onChange={(e) => setPassportForm({ ...passportForm, first_name_ar: e.target.value })}
              dir="rtl"
              data-testid="input-first-name-ar"
            />
          </div>
          <div>
            <Label className="text-slate-700 mb-2 block">Surname - Arabic</Label>
            <Input
              type="text"
              placeholder="اللقب"
              value={passportForm.surname_ar}
              onChange={(e) => setPassportForm({ ...passportForm, surname_ar: e.target.value })}
              dir="rtl"
              data-testid="input-surname-ar"
            />
          </div>
          <div>
            <Label className="text-slate-700 mb-2 block">Father Name - Arabic</Label>
            <Input
              type="text"
              placeholder="اسم الأب"
              value={passportForm.father_name_ar}
              onChange={(e) => setPassportForm({ ...passportForm, father_name_ar: e.target.value })}
              dir="rtl"
              data-testid="input-father-name-ar"
            />
          </div>
          <div>
            <Label className="text-slate-700 mb-2 block">Grandfather Name - Arabic</Label>
            <Input
              type="text"
              placeholder="اسم الجد"
              value={passportForm.grandfather_name_ar}
              onChange={(e) => setPassportForm({ ...passportForm, grandfather_name_ar: e.target.value })}
              dir="rtl"
              data-testid="input-grandfather-name-ar"
            />
          </div>
        </div>
      </div>

      {/* Mother's Information Section */}
      <div className="space-y-4">
        <h3 className="font-semibold text-slate-900 border-b pb-2">Mother's Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-slate-700 mb-2 block">Mother Name - English</Label>
            <Input
              type="text"
              placeholder="Mother's Name"
              value={passportForm.mother_name_en}
              onChange={(e) => setPassportForm({ ...passportForm, mother_name_en: e.target.value })}
              data-testid="input-mother-name-en"
            />
          </div>
          <div>
            <Label className="text-slate-700 mb-2 block">Mother Name - Arabic</Label>
            <Input
              type="text"
              placeholder="اسم الأم"
              value={passportForm.mother_name_ar}
              onChange={(e) => setPassportForm({ ...passportForm, mother_name_ar: e.target.value })}
              dir="rtl"
              data-testid="input-mother-name-ar"
            />
          </div>
          <div>
            <Label className="text-slate-700 mb-2 block">Mother's Father Name - English</Label>
            <Input
              type="text"
              placeholder="Mother's Father's Name"
              value={passportForm.mother_father_name_en}
              onChange={(e) => setPassportForm({ ...passportForm, mother_father_name_en: e.target.value })}
              data-testid="input-mother-father-name-en"
            />
          </div>
          <div>
            <Label className="text-slate-700 mb-2 block">Mother's Father Name - Arabic</Label>
            <Input
              type="text"
              placeholder="اسم والد الأم"
              value={passportForm.mother_father_name_ar}
              onChange={(e) => setPassportForm({ ...passportForm, mother_father_name_ar: e.target.value })}
              dir="rtl"
              data-testid="input-mother-father-name-ar"
            />
          </div>
        </div>
      </div>

      {/* Additional Info */}
      <div className="space-y-4">
        <h3 className="font-semibold text-slate-900 border-b pb-2">Additional Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-slate-700 mb-2 block">Nationality *</Label>
            <Select value={passportForm.nationality} onValueChange={(v) => setPassportForm({ ...passportForm, nationality: v })}>
              <SelectTrigger data-testid="select-nationality">
                <SelectValue placeholder="Select nationality" />
              </SelectTrigger>
              <SelectContent>
                {NATIONALITIES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-slate-700 mb-2 block">Gender</Label>
            <Select value={passportForm.gender} onValueChange={(v) => setPassportForm({ ...passportForm, gender: v })}>
              <SelectTrigger data-testid="select-gender">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                {GENDERS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-slate-700 mb-2 block">Profession</Label>
            <Select value={passportForm.profession} onValueChange={(v) => setPassportForm({ ...passportForm, profession: v })}>
              <SelectTrigger data-testid="select-profession">
                <SelectValue placeholder="Select profession" />
              </SelectTrigger>
              <SelectContent>
                {PROFESSIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-slate-700 mb-2 block">Birth Date</Label>
            <Input
              type="date"
              value={passportForm.birth_date}
              onChange={(e) => setPassportForm({ ...passportForm, birth_date: e.target.value })}
              data-testid="input-birth-date"
            />
          </div>
          <div>
            <Label className="text-slate-700 mb-2 block">Country of Residence</Label>
            <Select value={passportForm.country_of_residence} onValueChange={(v) => setPassportForm({ ...passportForm, country_of_residence: v })}>
              <SelectTrigger data-testid="select-country-of-residence">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-slate-700 mb-2 block">Applicant Type</Label>
            <Select value={passportForm.applicant_type || "none"} onValueChange={(v) => setPassportForm({ ...passportForm, applicant_type: v === "none" ? "" : v })}>
              <SelectTrigger data-testid="select-applicant-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">(None)</SelectItem>
                {APPLICANT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            {/* Auto-calculated applicant type info */}
            {passportForm.birth_date && passportForm.gender && (
              <p className="text-xs text-slate-500 mt-1">
                Auto-calculated: {getApplicantType(passportForm.birth_date, passportForm.gender) || "(Adult - None)"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Minor Alert & Relationship Proof Upload */}
      {passportForm.birth_date && isMinor(passportForm.birth_date) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-yellow-800">Minor Detected (Under 18)</h4>
              <p className="text-sm text-yellow-700 mt-1">
                Age: {calculateAge(passportForm.birth_date)} years old | 
                Applicant Type: {getApplicantType(passportForm.birth_date, passportForm.gender) || "Select gender"}
              </p>
              <p className="text-sm text-yellow-700 mt-2 font-medium">
                Relationship Proof is REQUIRED for minors
              </p>
              
              <div className="mt-3">
                <Label className="text-yellow-800 mb-2 block">Upload Relationship Proof (JPG) *</Label>
                <Input
                  type="file"
                  accept=".jpg,.jpeg"
                  onChange={(e) => setRelationshipProofFile(e.target.files[0])}
                  className="bg-white border-yellow-300"
                  data-testid="relationship-proof-input"
                />
                {relationshipProofFile && (
                  <p className="text-xs text-green-600 mt-1">✓ Selected: {relationshipProofFile.name}</p>
                )}
                {passportForm.relationship_proof && !relationshipProofFile && (
                  <p className="text-xs text-green-600 mt-1">✓ Already uploaded</p>
                )}
                {!relationshipProofFile && !passportForm.relationship_proof && (
                  <p className="text-xs text-red-600 mt-1">⚠ Required: Please upload relationship proof document</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <DialogFooter className="pt-4">
        <Button type="button" variant="outline" onClick={() => { isEdit ? setShowEditPassport(null) : setShowAddPassport(false); resetForm(); }}>
          Cancel
        </Button>
        <Button type="submit" disabled={formLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white" data-testid="submit-passport">
          {formLoading ? 'Saving...' : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );

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
              onClick={handleExportCSV}
              disabled={exporting || passports.length === 0}
              data-testid="export-csv-btn"
            >
              <Download className="w-4 h-4 mr-2" />
              {exporting ? 'Exporting...' : 'Export CSV'}
            </Button>
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

      {/* Progress Stats Bar */}
      <Card className="mb-6 bg-gradient-to-r from-indigo-50 to-purple-50">
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-slate-700">Processing Progress</span>
              <span className="text-2xl font-bold text-indigo-600">{groupStats.progress_percent}%</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                Done: {groupStats.done}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                Pending: {groupStats.pending}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-slate-300"></span>
                Total: {groupStats.total}
              </span>
            </div>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-green-500 to-emerald-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${groupStats.progress_percent}%` }}
            ></div>
          </div>
        </CardContent>
      </Card>

      {/* Visa Status Stats */}
      <Card className="mb-6">
        <CardHeader className="border-b border-slate-100 pb-3">
          <CardTitle className="font-manrope flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BadgeCheck className="w-5 h-5 text-green-600" />
              Visa Status
            </div>
            <div className="flex items-center gap-2">
              {selectedPassports.length > 0 && (
                <span className="text-sm font-normal text-slate-500">
                  {selectedPassports.length} selected
                </span>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleMarkAllVisaIssued}
                disabled={updatingVisaStatus || !groupStats.visa_stats?.payment_done}
                className="text-green-600 border-green-600 hover:bg-green-50"
              >
                {updatingVisaStatus ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <BadgeCheck className="w-4 h-4 mr-1" />}
                Mark All Visa Issued
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {Object.entries(VISA_STATUS_CONFIG).map(([status, config]) => {
              const count = groupStats.visa_stats?.[status] || 0;
              const Icon = config.icon;
              return (
                <div 
                  key={status}
                  onClick={() => setVisaStatusFilter(visaStatusFilter === status ? 'all' : status)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    visaStatusFilter === status 
                      ? 'border-indigo-500 bg-indigo-50' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4 text-slate-600" />
                    <span className="text-sm font-medium text-slate-700">{config.label}</span>
                  </div>
                  <span className="text-2xl font-bold text-slate-900">{count}</span>
                </div>
              );
            })}
          </div>
          
          {/* Bulk actions */}
          {selectedPassports.length > 0 && (
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
              <span className="text-sm text-slate-600 mr-2">Change status to:</span>
              {Object.entries(VISA_STATUS_CONFIG).map(([status, config]) => (
                <Button
                  key={status}
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkVisaStatus(status)}
                  disabled={updatingVisaStatus}
                  className={`text-xs ${config.color}`}
                >
                  {config.label}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submission Details */}
      <Card className="mb-6" data-testid="submission-details-card">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="font-manrope flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Submission Details
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <Label className="text-slate-700 mb-2 block flex items-center gap-1">
                <Hash className="w-4 h-4" />
                Approval Number
              </Label>
              <Input
                type="text"
                placeholder="Enter approval number"
                value={approvalNumber}
                onChange={(e) => setApprovalNumber(e.target.value)}
                data-testid="input-approval-number"
              />
            </div>
            <div>
              <Label className="text-slate-700 mb-2 block flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Date of Payment
              </Label>
              <Input
                type="date"
                value={dateOfPayment}
                onChange={(e) => setDateOfPayment(e.target.value)}
                data-testid="input-date-of-payment"
              />
            </div>
            <div>
              <Button
                onClick={handleSaveSubmissionDetails}
                disabled={savingSubmissionDetails}
                className="bg-indigo-600 hover:bg-indigo-700 text-white w-full"
                data-testid="save-submission-details-btn"
              >
                <Save className="w-4 h-4 mr-2" />
                {savingSubmissionDetails ? 'Saving...' : 'Save Details'}
              </Button>
            </div>
          </div>
          {(group?.approval_number || group?.date_of_payment) && (
            <div className="mt-4 p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
              <span className="font-medium">Current Values: </span>
              {group?.approval_number && <span className="mr-4">Approval #: <strong>{group.approval_number}</strong></span>}
              {group?.date_of_payment && <span>Payment Date: <strong>{group.date_of_payment}</strong></span>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Passports List */}
      <Card data-testid="passports-card">
        <CardHeader className="border-b border-slate-100">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="font-manrope">Passports</CardTitle>
            <div className="flex items-center gap-3">
              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36" data-testid="status-filter">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ({passports.length})</SelectItem>
                  <SelectItem value="pending">🔴 Pending ({groupStats.pending})</SelectItem>
                  <SelectItem value="done">🟢 Done ({groupStats.done})</SelectItem>
                </SelectContent>
              </Select>
              {/* Search */}
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
              
              {/* Visa Status Filter */}
              <div>
                <Select value={visaStatusFilter} onValueChange={setVisaStatusFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Visa Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Visa Status</SelectItem>
                    {Object.entries(VISA_STATUS_CONFIG).map(([status, config]) => (
                      <SelectItem key={status} value={status}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
              {/* Select All Header */}
              <div className="flex items-center gap-4 px-6 py-2 bg-slate-50 border-b">
                <input
                  type="checkbox"
                  checked={selectedPassports.length === filteredPassports.length && filteredPassports.length > 0}
                  onChange={selectAllPassports}
                  className="w-4 h-4 rounded border-slate-300"
                />
                <span className="text-sm text-slate-600">
                  {selectedPassports.length > 0 
                    ? `${selectedPassports.length} selected` 
                    : 'Select all'}
                </span>
              </div>
              
              {filteredPassports.map((passport) => {
                const visaConfig = VISA_STATUS_CONFIG[passport.visa_status || 'pending'];
                const VisaIcon = visaConfig?.icon || Clock;
                
                return (
                <div
                  key={passport.id}
                  className={`flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors ${
                    selectedPassports.includes(passport.id) ? 'bg-indigo-50' : ''
                  }`}
                  data-testid={`passport-row-${passport.id}`}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedPassports.includes(passport.id)}
                    onChange={() => togglePassportSelection(passport.id)}
                    className="w-4 h-4 rounded border-slate-300"
                  />
                  
                  {/* Profile Image */}
                  <div className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden flex-shrink-0">
                    {passport.profile_image ? (
                      <img
                        src={getImageUrl(passport.profile_image)}
                        alt={passport.first_name_en}
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
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-medium text-slate-900">
                        {passport.first_name_en} {passport.surname_en}
                      </h3>
                      <span className="passport-number" data-testid={`passport-no-${passport.passport_no}`}>
                        {passport.passport_no}
                      </span>
                      {/* Processing Status Badge */}
                      {passport.status === 'done' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          ✓ Done
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          Pending
                        </span>
                      )}
                      {/* Visa Status Badge */}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${visaConfig?.color || 'bg-gray-100 text-gray-800'}`}>
                        <VisaIcon className="w-3 h-3" />
                        {visaConfig?.label || 'Unknown'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                      <span>{passport.nationality}</span>
                      <span>Exp: {passport.expiry_date}</span>
                      {passport.gender && <span>{passport.gender}</span>}
                      {passport.status === 'done' && passport.status_updated_at && (
                        <span className="text-green-600 text-xs">
                          Completed: {new Date(passport.status_updated_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status Toggle & Image Status & Actions */}
                  <div className="flex items-center gap-3">
                    {/* Mark Done/Pending Button */}
                    {passport.status === 'done' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-amber-600 border-amber-300 hover:bg-amber-50"
                        onClick={() => handleStatusUpdate(passport.id, 'pending')}
                        data-testid={`mark-pending-${passport.id}`}
                      >
                        Mark Pending
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-green-600 border-green-300 hover:bg-green-50"
                        onClick={() => handleStatusUpdate(passport.id, 'done')}
                        data-testid={`mark-done-${passport.id}`}
                      >
                        ✓ Mark Done
                      </Button>
                    )}
                    <div className="flex gap-2">
                      <span className={`status-badge ${passport.passport_image ? 'success' : 'neutral'}`}>
                        <FileText className="w-3 h-3 mr-1" />
                        Passport
                      </span>
                      <span className={`status-badge ${passport.profile_image ? 'success' : 'neutral'}`}>
                        <Image className="w-3 h-3 mr-1" />
                        Photo
                      </span>
                      {passport.insurance_pdf && (
                        <span className="status-badge success" title="Insurance PDF downloaded">
                          <Download className="w-3 h-3 mr-1" />
                          Insurance
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-indigo-600"
                      onClick={() => setShowViewPassport(passport)}
                      data-testid={`view-passport-${passport.id}`}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-indigo-600"
                      onClick={() => openEditDialog(passport)}
                      data-testid={`edit-passport-${passport.id}`}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-rose-600"
                      onClick={() => setDeletePassportId(passport.id)}
                      data-testid={`delete-passport-${passport.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    
                    {/* Visa Status Quick Change */}
                    <Select 
                      value={passport.visa_status || 'pending'} 
                      onValueChange={(value) => handleUpdateVisaStatus(passport.id, value)}
                    >
                      <SelectTrigger className="w-[140px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(VISA_STATUS_CONFIG).map(([status, config]) => (
                          <SelectItem key={status} value={status}>
                            <span className="flex items-center gap-1">
                              <config.icon className="w-3 h-3" />
                              {config.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )})}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Passport Dialog */}
      <Dialog open={showAddPassport} onOpenChange={setShowAddPassport}>
        <DialogContent className="max-w-3xl max-h-[90vh]" data-testid="add-passport-dialog">
          <DialogHeader>
            <DialogTitle className="font-manrope">Add New Passport</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <PassportForm onSubmit={handleAddPassport} submitLabel="Add Passport" />
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Edit Passport Dialog */}
      <Dialog open={!!showEditPassport} onOpenChange={() => { setShowEditPassport(null); resetForm(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh]" data-testid="edit-passport-dialog">
          <DialogHeader>
            <DialogTitle className="font-manrope">Edit Passport</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <PassportForm onSubmit={handleEditPassport} submitLabel="Save Changes" isEdit={true} />
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* View Passport Dialog */}
      <Dialog open={!!showViewPassport} onOpenChange={() => setShowViewPassport(null)}>
        <DialogContent className="max-w-2xl" data-testid="view-passport-dialog">
          <DialogHeader>
            <DialogTitle className="font-manrope">Passport Details</DialogTitle>
          </DialogHeader>
          {showViewPassport && (
            <div className="space-y-6">
              {/* Images Row */}
              <div className="flex gap-6">
                <div className="flex-1">
                  <Label className="text-slate-500 text-sm">Profile Photo</Label>
                  <div className="mt-2 w-32 h-32 rounded-lg bg-slate-100 overflow-hidden border">
                    {showViewPassport.profile_image ? (
                      <img
                        src={getImageUrl(showViewPassport.profile_image)}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="w-12 h-12 text-slate-300" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-1">
                  <Label className="text-slate-500 text-sm">Passport Scan</Label>
                  <div className="mt-2 w-32 h-32 rounded-lg bg-slate-100 overflow-hidden border">
                    {showViewPassport.passport_image ? (
                      <img
                        src={getImageUrl(showViewPassport.passport_image)}
                        alt="Passport"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileText className="w-12 h-12 text-slate-300" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-slate-500">Passport Number</Label>
                  <p className="font-mono font-medium text-slate-900">{showViewPassport.passport_no}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Passport Type</Label>
                  <p className="text-slate-900">{showViewPassport.passport_type}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Full Name (English)</Label>
                  <p className="text-slate-900">{showViewPassport.first_name_en} {showViewPassport.surname_en}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Full Name (Arabic)</Label>
                  <p className="text-slate-900" dir="rtl">{showViewPassport.first_name_ar} {showViewPassport.surname_ar}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Father Name</Label>
                  <p className="text-slate-900">{showViewPassport.father_name_en || '-'}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Grandfather Name</Label>
                  <p className="text-slate-900">{showViewPassport.grandfather_name_en || '-'}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Mother Name (English)</Label>
                  <p className="text-slate-900">{showViewPassport.mother_name_en || '-'}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Mother's Father Name</Label>
                  <p className="text-slate-900">{showViewPassport.mother_father_name_en || '-'}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Nationality</Label>
                  <p className="text-slate-900">{showViewPassport.nationality}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Gender</Label>
                  <p className="text-slate-900">{showViewPassport.gender || '-'}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Birth Date</Label>
                  <p className="text-slate-900">{showViewPassport.birth_date || '-'}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Profession</Label>
                  <p className="text-slate-900">{showViewPassport.profession || '-'}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Issue Date</Label>
                  <p className="text-slate-900">{showViewPassport.issue_date || '-'}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Expiry Date</Label>
                  <p className="text-slate-900">{showViewPassport.expiry_date}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Place of Issue</Label>
                  <p className="text-slate-900">{showViewPassport.place_of_issue || '-'}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Country of Residence</Label>
                  <p className="text-slate-900">{showViewPassport.country_of_residence || '-'}</p>
                </div>
              </div>
            </div>
          )}
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
