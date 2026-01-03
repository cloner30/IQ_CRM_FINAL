// Content script for E-Visa Form Filler Extension
// This script runs on eservice.evisa.iq and fills the visa application form

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fillForm') {
    fillVisaForm(request.data);
    sendResponse({ success: true });
  }
  if (request.action === 'uploadImages') {
    uploadImages(request.data);
    sendResponse({ success: true });
  }
  return true;
});

// Field mapping: Our app fields -> E-visa form field IDs/selectors
const FIELD_MAPPING = {
  // Names - Arabic
  first_name_ar: 'input[id*="SNP_Person_FullName.textBox14"]',
  father_name_ar: 'input[id*="SNP_Person_FullName.textBox16"]',
  grandfather_name_ar: 'input[id*="SNP_Person_FullName.textBox17"]',
  surname_ar: 'input[id*="SNP_Person_FullName.textBox18"]',
  
  // Names - English
  first_name_en: 'input[id*="SNP_Person_FullName.textBox19"]',
  father_name_en: 'input[id*="SNP_Person_FullName.textBox20"]',
  grandfather_name_en: 'input[id*="SNP_Person_FullName.textBox21"]',
  surname_en: 'input[id*="SNP_Person_FullName.textBox22"]',
  
  // Mother's names
  mother_name_ar: 'input[id*="SNP_Person_FullMotherName.textBox23"]',
  mother_father_name_ar: 'input[id*="SNP_Person_FullMotherName.textBox13"]',
  mother_name_en: 'input[id*="SNP_Person_FullMotherName.textBox24"]',
  mother_father_name_en: 'input[id*="SNP_Person_FullMotherName.textBox14"]',
  
  // Passport details
  passport_no: 'input[id*="SNP_Passport_Company.textBox34"]',
  
  // Dates (need special handling for datepickers)
  birth_date: 'input[id*="SNP_Beneficiary_Company.cLEVRDatePicker4"]',
  issue_date: 'input[id*="SNP_Passport_Company.cLEVRDatePicker4"]',
  expiry_date: 'input[id*="SNP_Passport_Company.cLEVRDatePicker5"]'
};

// Dropdown mapping - exact selectors from HTML
const DROPDOWN_MAPPING = {
  nationality: 'select[id*="SNP_Beneficiary_Company.referenceSelector3"]',
  gender: 'select[id*="SNP_Beneficiary_Company.dropDown1"]',
  profession: 'select[id*="SNP_Beneficiary_Company.referenceSelector5"]',
  passport_type: 'select[id*="SNP_Passport_Company.dropDown4"]',
  place_of_issue: 'select[id*="SNP_Passport_Company.referenceSelector13"]',
  country_of_residence: 'select[id*="SNP_Beneficiary_Company.referenceSelector2"]',
  applicant_type: 'select[id*="dynamicEnumPicker1"]'
};

// Nationality mapping (Our app values -> E-visa dropdown text)
// E-visa uses nationality adjectives like "Ethiopian", "American", etc.
const NATIONALITY_MAP = {
  'Afghan': 'Afghan',
  'Albanian': 'Albanian',
  'Algerian': 'Algerian',
  'American': 'American',
  'Argentine': 'Argentine',
  'Armenian': 'Armenian',
  'Australian': 'Australian',
  'Austrian': 'Austrian',
  'Azerbaijani': 'Azerbaijani',
  'Bahraini': 'Bahraini',
  'Bangladeshi': 'Bangladeshi',
  'Belgian': 'Belgian',
  'Bolivian': 'Bolivian',
  'Brazilian': 'Brazilian',
  'British': 'British',
  'Bulgarian': 'Bulgarian',
  'Canadian': 'Canadian',
  'Chilean': 'Chilean',
  'Chinese': 'Chinese',
  'Colombian': 'Colombian',
  'Croatian': 'Croatian',
  'Czech': 'Czech',
  'Danish': 'Danish',
  'Dutch': 'Dutch',
  'Egyptian': 'Egyptian',
  'Emirati': 'Emirati',
  'Estonian': 'Estonian',
  'Ethiopian': 'Ethiopian',
  'Filipino': 'Philippine',
  'Finnish': 'Finnish',
  'French': 'French',
  'Georgian': 'Georgian',
  'German': 'German',
  'Greek': 'Greek',
  'Hungarian': 'Hungarian',
  'Indian': 'Indian',
  'Indonesian': 'Indonesian',
  'Iranian': 'Iranian',
  'Iraqi': 'Iraqi',
  'Irish': 'Irish',
  'Israeli': 'Israeli',
  'Italian': 'Italian',
  'Japanese': 'Japanese',
  'Jordanian': 'Jordanian',
  'Kazakh': 'Kazakh',
  'Kenyan': 'Kenyan',
  'Korean': 'Korean',
  'Kuwaiti': 'Kuwaiti',
  'Latvian': 'Latvian',
  'Lebanese': 'Lebanese',
  'Libyan': 'Libyan',
  'Lithuanian': 'Lithuanian',
  'Malaysian': 'Malaysian',
  'Mexican': 'Mexican',
  'Moroccan': 'Moroccan',
  'New Zealand': 'New Zealand',
  'Nigerian': 'Nigerian',
  'Norwegian': 'Norwegian',
  'Omani': 'Omani',
  'Pakistani': 'Pakistani',
  'Palestinian': 'Palestinian',
  'Peruvian': 'Peruvian',
  'Polish': 'Polish',
  'Portuguese': 'Portuguese',
  'Qatari': 'Qatari',
  'Romanian': 'Romanian',
  'Russian': 'Russian',
  'Saudi': 'Saudi',
  'Serbian': 'Serbian',
  'Singaporean': 'Singaporean',
  'Slovak': 'Slovak',
  'Slovenian': 'Slovenia',
  'South African': 'South African',
  'Spanish': 'Spanish',
  'Sri Lankan': 'Sri Lankan',
  'Sudanese': 'Sudanese',
  'Swedish': 'Swedish',
  'Swiss': 'Swiss',
  'Syrian': 'Syrian',
  'Taiwanese': 'Taiwanese',
  'Thai': 'Thai',
  'Tunisian': 'Tunisian',
  'Turkish': 'Turkish',
  'Ukrainian': 'Ukrainian',
  'Uruguayan': 'Uruguayan',
  'Uzbek': 'Uzbekistani',
  'Venezuelan': 'Venezuelan',
  'Vietnamese': 'Vietnamese',
  'Yemeni': 'Yemeni'
};

// Passport type mapping (Our app values -> E-visa dropdown values)
// E-visa uses: Normal, Temporary, Diplomatic, Special, TravelDoc, UN, passage
const PASSPORT_TYPE_MAP = {
  'Normal': 'Normal',
  'Temporary': 'Temporary',
  'Diplomatic': 'Diplomatic',
  'Special': 'Special',
  'Travel Doc': 'TravelDoc',
  'UN': 'UN',
  'Passage': 'passage'
};

// Profession mapping (Our app values -> E-visa dropdown values)
// E-visa only has: Physician, Engineer, other
const PROFESSION_MAP = {
  'Physician': 'Physician',
  'Engineer': 'Engineer',
  'Teacher': 'other',
  'Business': 'other',
  'Student': 'other',
  'Government': 'other',
  'Other': 'other'
};

// Place of Issue / Country mapping (Our app values -> E-visa dropdown text)
// E-visa uses full country names
const COUNTRY_MAP = {
  'Afghan': 'Afghanistan',
  'Albanian': 'Albania',
  'Algerian': 'Algeria',
  'American': 'United States of America',
  'Argentine': 'Argentina',
  'Armenian': 'Armenia',
  'Australian': 'Australia',
  'Austrian': 'Austria',
  'Azerbaijani': 'Azerbaijan',
  'Bahraini': 'Bahrain',
  'Bangladeshi': 'Bangladesh',
  'Belgian': 'Belgium',
  'Bolivian': 'Bolivia',
  'Brazilian': 'Brazil',
  'British': 'United Kingdom of Great Britain',
  'Bulgarian': 'Bulgaria',
  'Canadian': 'Canada',
  'Chilean': 'Chile',
  'Chinese': 'China',
  'Colombian': 'Colombia',
  'Croatian': 'Croatia',
  'Czech': 'Czech Republic',
  'Danish': 'Denmark',
  'Dutch': 'Netherlands',
  'Egyptian': 'Egypt',
  'Emirati': 'United Arab Emirates',
  'Estonian': 'Estonia',
  'Ethiopian': 'Ethiopia',
  'Filipino': 'Philippines',
  'Finnish': 'Finland',
  'French': 'France',
  'Georgian': 'Georgia',
  'German': 'Germany',
  'Greek': 'Greece',
  'Hungarian': 'Hungary',
  'Indian': 'India',
  'Indonesian': 'Indonesia',
  'Iranian': 'Iran Islamic Republic of',
  'Iraqi': 'Iraq',
  'Irish': 'Ireland',
  'Israeli': 'Israel',
  'Italian': 'Italy',
  'Japanese': 'Japan',
  'Jordanian': 'Jordan',
  'Kazakh': 'Kazakhstan',
  'Kenyan': 'Kenya',
  'Korean': 'Republic of Korea',
  'Kuwaiti': 'Kuwait',
  'Latvian': 'Latvia',
  'Lebanese': 'Lebanon',
  'Libyan': 'Libyan Arab Jamahiriya',
  'Lithuanian': 'Lithuania',
  'Malaysian': 'Malaysia',
  'Mexican': 'Mexico',
  'Moroccan': 'Morocco',
  'New Zealand': 'New Zealand',
  'Nigerian': 'Nigeria',
  'Norwegian': 'Norway',
  'Omani': 'Oman',
  'Pakistani': 'Pakistan',
  'Palestinian': 'Palestinian',
  'Peruvian': 'Peru',
  'Polish': 'Poland',
  'Portuguese': 'Portugal',
  'Qatari': 'Qatar',
  'Romanian': 'Romania',
  'Russian': 'Russian Federation',
  'Saudi': 'Saudi Arabia',
  'Serbian': 'Serbia',
  'Singaporean': 'Singapore',
  'Slovak': 'Slovakia',
  'Slovenian': 'Slovenia',
  'South African': 'South Africa',
  'Spanish': 'Spain',
  'Sri Lankan': 'Sri Lanka',
  'Sudanese': 'Sudan',
  'Swedish': 'Sweden',
  'Swiss': 'Switzerland',
  'Syrian': 'Syrian Arab Republic',
  'Taiwanese': 'Taiwan',
  'Thai': 'Thailand',
  'Tunisian': 'Tunisia',
  'Turkish': 'Turkey',
  'Ukrainian': 'Ukraine',
  'Uruguayan': 'Uruguay',
  'Uzbek': 'Uzbekistan',
  'Venezuelan': 'Venezuela Bolivarian Republic',
  'Vietnamese': 'Viet Nam',
  'Yemeni': 'Yemen',
  // Direct country name mappings (if user stores country names)
  'Afghanistan': 'Afghanistan',
  'Albania': 'Albania',
  'Algeria': 'Algeria',
  'Argentina': 'Argentina',
  'Armenia': 'Armenia',
  'Australia': 'Australia',
  'Austria': 'Austria',
  'Azerbaijan': 'Azerbaijan',
  'Bahrain': 'Bahrain',
  'Bangladesh': 'Bangladesh',
  'Belgium': 'Belgium',
  'Bolivia': 'Bolivia',
  'Brazil': 'Brazil',
  'Bulgaria': 'Bulgaria',
  'Canada': 'Canada',
  'Chile': 'Chile',
  'China': 'China',
  'Colombia': 'Colombia',
  'Croatia': 'Croatia',
  'Czech Republic': 'Czech Republic',
  'Denmark': 'Denmark',
  'Egypt': 'Egypt',
  'Estonia': 'Estonia',
  'Ethiopia': 'Ethiopia',
  'Finland': 'Finland',
  'France': 'France',
  'Georgia': 'Georgia',
  'Germany': 'Germany',
  'Greece': 'Greece',
  'Hungary': 'Hungary',
  'India': 'India',
  'Indonesia': 'Indonesia',
  'Iran': 'Iran Islamic Republic of',
  'Iraq': 'Iraq',
  'Ireland': 'Ireland',
  'Israel': 'Israel',
  'Italy': 'Italy',
  'Japan': 'Japan',
  'Jordan': 'Jordan',
  'Kazakhstan': 'Kazakhstan',
  'Kenya': 'Kenya',
  'Korea': 'Republic of Korea',
  'Kuwait': 'Kuwait',
  'Latvia': 'Latvia',
  'Lebanon': 'Lebanon',
  'Libya': 'Libyan Arab Jamahiriya',
  'Lithuania': 'Lithuania',
  'Malaysia': 'Malaysia',
  'Mexico': 'Mexico',
  'Morocco': 'Morocco',
  'Netherlands': 'Netherlands',
  'New Zealand': 'New Zealand',
  'Nigeria': 'Nigeria',
  'Norway': 'Norway',
  'Oman': 'Oman',
  'Pakistan': 'Pakistan',
  'Palestine': 'Palestinian',
  'Peru': 'Peru',
  'Philippines': 'Philippines',
  'Poland': 'Poland',
  'Portugal': 'Portugal',
  'Qatar': 'Qatar',
  'Romania': 'Romania',
  'Russia': 'Russian Federation',
  'Saudi Arabia': 'Saudi Arabia',
  'Serbia': 'Serbia',
  'Singapore': 'Singapore',
  'Slovakia': 'Slovakia',
  'Slovenia': 'Slovenia',
  'South Africa': 'South Africa',
  'Spain': 'Spain',
  'Sri Lanka': 'Sri Lanka',
  'Sudan': 'Sudan',
  'Sweden': 'Sweden',
  'Switzerland': 'Switzerland',
  'Syria': 'Syrian Arab Republic',
  'Taiwan': 'Taiwan',
  'Thailand': 'Thailand',
  'Tunisia': 'Tunisia',
  'Turkey': 'Turkey',
  'Ukraine': 'Ukraine',
  'United Arab Emirates': 'United Arab Emirates',
  'United Kingdom': 'United Kingdom of Great Britain',
  'United States': 'United States of America',
  'Uruguay': 'Uruguay',
  'Uzbekistan': 'Uzbekistan',
  'Venezuela': 'Venezuela Bolivarian Republic',
  'Vietnam': 'Viet Nam',
  'Yemen': 'Yemen'
};

// Applicant Type mapping (E-visa uses: "", "Son", "Daughter")
const APPLICANT_TYPE_MAP = {
  '': '',
  'Son': 'Son',
  'Daughter': 'Daughter'
};

// Convert date to m/d/yyyy format
function formatDate(dateStr) {
  if (!dateStr) return '';
  
  // Handle various input formats
  let date;
  if (dateStr.includes('-')) {
    // YYYY-MM-DD format
    const parts = dateStr.split('-');
    date = new Date(parts[0], parts[1] - 1, parts[2]);
  } else if (dateStr.includes('/')) {
    // Already in some slash format
    return dateStr;
  } else {
    date = new Date(dateStr);
  }
  
  if (isNaN(date.getTime())) return dateStr;
  
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  
  return `${month}/${day}/${year}`;
}

// Fill a text input field
function fillTextField(selector, value) {
  if (!value) return false;
  
  const field = document.querySelector(selector);
  if (!field) {
    console.log(`Field not found: ${selector}`);
    return false;
  }
  
  // Clear existing value
  field.value = '';
  
  // Set new value
  field.value = value;
  
  // Trigger events to notify the form
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
  field.dispatchEvent(new Event('blur', { bubbles: true }));
  
  console.log(`Filled ${selector} with: ${value}`);
  return true;
}

// Fill a date field (datepicker)
function fillDateField(selector, value) {
  if (!value) return false;
  
  const formattedDate = formatDate(value);
  const container = document.querySelector(selector)?.closest('.mx-datepicker');
  
  if (container) {
    const input = container.querySelector('input.form-control');
    if (input) {
      input.value = formattedDate;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));
      console.log(`Filled date ${selector} with: ${formattedDate}`);
      return true;
    }
  }
  
  // Fallback: try direct selector
  return fillTextField(selector, formattedDate);
}

// Fill a dropdown/select field
function fillDropdown(selector, value, mapping = null) {
  if (!value) return false;
  
  const select = document.querySelector(selector);
  if (!select) {
    console.log(`Dropdown not found: ${selector}`);
    return false;
  }
  
  // Map value if mapping provided
  const mappedValue = mapping ? mapping[value] || value : value;
  
  // Find matching option
  const options = Array.from(select.options);
  let found = false;
  
  for (const option of options) {
    // Try exact match first
    if (option.value === mappedValue || option.text === mappedValue) {
      select.value = option.value;
      found = true;
      break;
    }
    // Try case-insensitive partial match
    if (option.text.toLowerCase().includes(mappedValue.toLowerCase()) ||
        mappedValue.toLowerCase().includes(option.text.toLowerCase())) {
      select.value = option.value;
      found = true;
      break;
    }
  }
  
  if (found) {
    select.dispatchEvent(new Event('change', { bubbles: true }));
    console.log(`Selected ${selector}: ${value} -> ${select.value}`);
  } else {
    console.log(`No matching option found for ${selector}: ${value}`);
  }
  
  return found;
}

// Main function to fill the visa form
function fillVisaForm(data) {
  console.log('Starting form fill with data:', data);
  
  let filledCount = 0;
  let totalFields = 0;
  
  // Fill text fields
  for (const [field, selector] of Object.entries(FIELD_MAPPING)) {
    totalFields++;
    if (data[field]) {
      if (field.includes('date')) {
        if (fillDateField(selector, data[field])) filledCount++;
      } else {
        if (fillTextField(selector, data[field])) filledCount++;
      }
    }
  }
  
  // Fill dropdowns
  setTimeout(() => {
    // Nationality
    if (data.nationality) {
      fillDropdown(DROPDOWN_MAPPING.nationality, data.nationality, NATIONALITY_MAP);
    }
    
    // Gender (E-visa uses: Male, Female)
    if (data.gender) {
      fillDropdown(DROPDOWN_MAPPING.gender, data.gender);
    }
    
    // Profession (E-visa uses: Physician, Engineer, other)
    if (data.profession) {
      fillDropdown(DROPDOWN_MAPPING.profession, data.profession, PROFESSION_MAP);
    }
    
    // Passport Type (E-visa uses: Normal, Temporary, Diplomatic, Special, TravelDoc, UN, passage)
    if (data.passport_type) {
      fillDropdown(DROPDOWN_MAPPING.passport_type, data.passport_type, PASSPORT_TYPE_MAP);
    }
    
    // Place of Issue (uses country names - dropdown has full country names)
    if (data.place_of_issue) {
      fillDropdown(DROPDOWN_MAPPING.place_of_issue, data.place_of_issue, COUNTRY_MAP);
    }
    
    // Country of Residence (uses country names - dropdown has full country names)
    if (data.country_of_residence) {
      fillDropdown(DROPDOWN_MAPPING.country_of_residence, data.country_of_residence, COUNTRY_MAP);
    }
    
    // Applicant Type (E-visa uses: "", "Son", "Daughter")
    if (data.applicant_type) {
      fillDropdown(DROPDOWN_MAPPING.applicant_type, data.applicant_type, APPLICANT_TYPE_MAP);
    }
  }, 500);
  
  // Show notification
  showNotification(`Form filled! ${filledCount} fields populated.`);
  
  console.log(`Form fill complete: ${filledCount}/${totalFields} fields filled`);
}

// Show a notification on the page
function showNotification(message) {
  // Remove existing notification
  const existing = document.getElementById('evisa-filler-notification');
  if (existing) existing.remove();
  
  // Create notification element
  const notification = document.createElement('div');
  notification.id = 'evisa-filler-notification';
  notification.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 8px;
      animation: slideIn 0.3s ease;
    ">
      <span style="font-size: 18px;">✓</span>
      ${message}
    </div>
    <style>
      @keyframes slideIn {
        from { transform: translateX(100px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    </style>
  `;
  
  document.body.appendChild(notification);
  
  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(100px)';
    notification.style.transition = 'all 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Log that content script is loaded
console.log('E-Visa Form Filler content script loaded');
