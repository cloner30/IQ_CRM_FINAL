// Content script for E-Visa Form Filler Extension
// This script runs on eservice.evisa.iq and fills the visa application form

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fillForm') {
    fillVisaForm(request.data).then(() => {
      sendResponse({ success: true });
    }).catch(err => {
      console.error('Fill form error:', err);
      sendResponse({ success: false, error: err.message });
    });
    return true; // Keep channel open for async response
  }
  if (request.action === 'uploadImages') {
    uploadImages(request.data);
    sendResponse({ success: true });
  }
  if (request.action === 'startInsuranceDownload') {
    processInsuranceDownload(request.data).then(result => {
      sendResponse(result);
    }).catch(err => {
      console.error('Insurance download error:', err);
      sendResponse({ success: false, error: err.message });
    });
    return true; // Keep channel open for async response
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
  applicant_type: 'select[id*="dynamicEnumPicker1"]',
  // Accommodation fields
  accommodation_type: 'select[id*="dropDown3"]',
  governorate: 'select[id*="referenceSelector8"]'
};

// Default values for accommodation
const DEFAULT_VALUES = {
  accommodation_type: 'Hotel',
  governorate: 'Najaf',
  hotel_name: 'الخيمه بلاز'
};

// Hotel name text field selector
const HOTEL_NAME_SELECTOR = 'input[id*="textBox37"], input[id*="hotelName"], input[id*="HotelName"]';

// Helper function to calculate age from birth date
function calculateAge(birthDateStr) {
  if (!birthDateStr) return 99; // Default to adult
  
  try {
    let birthDate;
    
    // Handle various date formats
    if (birthDateStr.includes('-')) {
      // YYYY-MM-DD format
      birthDate = new Date(birthDateStr);
    } else if (birthDateStr.includes('/')) {
      // m/d/yyyy format
      const parts = birthDateStr.split('/');
      if (parts.length === 3) {
        const month = parseInt(parts[0]) - 1;
        const day = parseInt(parts[1]);
        const year = parseInt(parts[2]);
        birthDate = new Date(year, month, day);
      }
    } else {
      birthDate = new Date(birthDateStr);
    }
    
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
}

// Check if person is a minor (under 18)
function isMinor(birthDateStr) {
  return calculateAge(birthDateStr) < 18;
}

// Get applicant type based on age and gender
function getApplicantType(birthDateStr, gender) {
  if (!isMinor(birthDateStr)) return ""; // Empty for adults
  
  const genderLower = (gender || "").toLowerCase();
  if (genderLower === "male" || genderLower === "m") return "Son";
  if (genderLower === "female" || genderLower === "f") return "Daughter";
  return "";
}

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

// Convert date to m/d/yyyy format (e.g., 1/15/2025)
function formatDate(dateStr) {
  if (!dateStr) return '';
  
  console.log(`Formatting date: ${dateStr}`);
  
  // Handle various input formats
  let date;
  if (dateStr.includes('-')) {
    // YYYY-MM-DD format (from our app)
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1; // JS months are 0-indexed
      const day = parseInt(parts[2]);
      date = new Date(year, month, day);
    }
  } else if (dateStr.includes('/')) {
    // Already in slash format - check if it needs conversion
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      // Could be m/d/yyyy or d/m/yyyy - assume m/d/yyyy
      return dateStr;
    }
  } else {
    date = new Date(dateStr);
  }
  
  if (!date || isNaN(date.getTime())) {
    console.log(`Invalid date: ${dateStr}`);
    return dateStr;
  }
  
  const month = date.getMonth() + 1; // No leading zero
  const day = date.getDate(); // No leading zero
  const year = date.getFullYear();
  
  const formatted = `${month}/${day}/${year}`;
  console.log(`Formatted date: ${dateStr} -> ${formatted}`);
  return formatted;
}

// Fill a text input field
// IMPORTANT: If value is null, undefined, or empty string - skip filling (leave field blank)
function fillTextField(selector, value) {
  if (value === null || value === undefined || value === '') {
    console.log(`Skipping ${selector} - value is empty/null`);
    return false;
  }
  
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

// Fill a date field (datepicker) - Format: m/d/yyyy
// IMPORTANT: If value is null, undefined, or empty string - skip filling (leave field blank)
function fillDateField(selector, value) {
  if (value === null || value === undefined || value === '') {
    console.log(`Skipping date ${selector} - value is empty/null`);
    return false;
  }
  
  const formattedDate = formatDate(value);
  if (!formattedDate) {
    console.log(`Skipping date ${selector} - formatted date is empty`);
    return false;
  }
  
  console.log(`Filling date field ${selector} with: ${formattedDate}`);
  
  // Extract the FULL ID pattern from selector (e.g., "SNP_Beneficiary_Company.cLEVRDatePicker4")
  const selectorId = selector.match(/id\*="([^"]+)"/)?.[1] || '';
  console.log(`Looking for date field with FULL ID containing: ${selectorId}`);
  
  // Find all inputs
  const allInputs = document.querySelectorAll('input');
  console.log(`Total inputs on page: ${allInputs.length}`);
  
  // Log all inputs with date-related IDs for debugging
  console.log('=== Searching for date inputs ===');
  for (const input of allInputs) {
    const id = input.id || '';
    if (id.toLowerCase().includes('date') || id.toLowerCase().includes('picker')) {
      console.log(`  Date input found: id="${id.substring(0, 80)}..."`);
    }
  }
  
  // Method 1: Search by FULL ID match (most specific)
  for (const input of allInputs) {
    const id = input.id || '';
    
    // Check if input ID contains the FULL selector ID pattern
    if (selectorId && id.includes(selectorId)) {
      console.log(`✓ Found date field by FULL ID match: ${id}`);
      return setDateInputValue(input, formattedDate);
    }
  }
  
  // Method 2: Try matching component prefix + picker name separately
  // E.g., for "SNP_Beneficiary_Company.cLEVRDatePicker4", match both parts
  const [componentName, pickerName] = selectorId.split('.');
  if (componentName && pickerName) {
    console.log(`Trying component+picker match: ${componentName} + ${pickerName}`);
    for (const input of allInputs) {
      const id = input.id || '';
      // Must contain BOTH the component name and picker name
      if (id.includes(componentName) && id.includes(pickerName)) {
        console.log(`✓ Found date field by component+picker match: ${id}`);
        return setDateInputValue(input, formattedDate);
      }
    }
    
    // Method 3: Try just the picker name (e.g., cLEVRDatePicker4)
    console.log(`Trying picker name only: ${pickerName}`);
    for (const input of allInputs) {
      const id = input.id || '';
      if (id.includes(pickerName)) {
        console.log(`✓ Found date field by picker name: ${id}`);
        return setDateInputValue(input, formattedDate);
      }
    }
  }
  
  // Method 4: Direct querySelector as last resort
  const directInput = document.querySelector(selector);
  if (directInput) {
    console.log(`✓ Found date field by direct selector`);
    return setDateInputValue(directInput, formattedDate);
  }
  
  console.log(`Date field not found: ${selector}`);
  return false;
}

// Helper to set input value with proper events for Mendix
function setInputValue(input, value) {
  try {
    // Focus and click the input
    input.focus();
    input.click();
    
    // Clear existing value
    input.value = '';
    
    // Use native setter for React/Mendix compatibility
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeSetter.call(input, value);
    
    // Also set directly
    input.value = value;
    
    // Dispatch all necessary events
    input.dispatchEvent(new Event('focus', { bubbles: true }));
    input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', keyCode: 9, bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    
    console.log(`✓ Set value: ${value} on input: ${input.id}`);
    return true;
  } catch (err) {
    console.error(`Error setting value: ${err.message}`);
    // Fallback
    input.value = value;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
}

// Log all date-related inputs for debugging
function logDateInputs() {
  console.log('=== All potential date inputs on page ===');
  const allInputs = document.querySelectorAll('input');
  let dateInputs = [];
  
  for (const input of allInputs) {
    const id = input.id || '';
    const className = input.className || '';
    const type = input.type || '';
    const placeholder = input.placeholder || '';
    
    // Look for date-related inputs
    if (id.toLowerCase().includes('date') || 
        className.toLowerCase().includes('date') ||
        id.toLowerCase().includes('picker') ||
        placeholder.includes('/')) {
      dateInputs.push({
        id: id,
        class: className.substring(0, 50),
        type: type,
        placeholder: placeholder
      });
    }
  }
  
  console.log(`Found ${dateInputs.length} date-related inputs:`);
  dateInputs.forEach((inp, i) => {
    console.log(`${i + 1}. id="${inp.id}" class="${inp.class}" placeholder="${inp.placeholder}"`);
  });
}

// Fill date field by finding nearby label
function fillDateByLabel(labelKeyword, value) {
  const formattedDate = formatDate(value);
  if (!formattedDate) return false;
  
  console.log(`Trying to find date field by label containing: ${labelKeyword}`);
  
  // More specific label patterns to avoid wrong matches
  const labelPatterns = {
    'birth': ['date of birth', 'birth date', 'dob', 'تاريخ الميلاد'],
    'issue': ['date of issue', 'issue date', 'issuance date', 'تاريخ الإصدار'],
    'expir': ['date of expiry', 'expiry date', 'expiration date', 'تاريخ الانتهاء', 'valid until']
  };
  
  const patterns = labelPatterns[labelKeyword] || [labelKeyword];
  
  // Find all labels
  const labels = document.querySelectorAll('label, .control-label, .mx-label, span[class*="label"]');
  
  for (const label of labels) {
    const labelText = label.textContent.toLowerCase().trim();
    
    // Check if label matches any of our patterns
    const matches = patterns.some(pattern => labelText.includes(pattern.toLowerCase()));
    
    // IMPORTANT: Exclude "place of issue" when looking for issue date
    if (labelKeyword === 'issue' && labelText.includes('place')) {
      console.log(`Skipping "place of issue" - looking for date field`);
      continue;
    }
    
    if (matches) {
      console.log(`Found matching label: "${label.textContent.trim()}"`);
      
      // Method 1: Check 'for' attribute
      const forId = label.getAttribute('for');
      if (forId) {
        const input = document.getElementById(forId);
        // Make sure it's a text input (date field), not a select (dropdown)
        if (input && input.tagName === 'INPUT' && input.type !== 'hidden') {
          console.log(`Found input by 'for' attribute: ${input.id}`);
          return setDateInputValue(input, formattedDate);
        }
      }
      
      // Method 2: Find input in same container
      const container = label.closest('.form-group, .mx-dataview-content, .mx-dateinput, [class*="date"]');
      if (container) {
        const input = container.querySelector('input[type="text"], input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])');
        if (input && input.tagName === 'INPUT') {
          console.log(`Found input in same container: ${input.id}`);
          return setDateInputValue(input, formattedDate);
        }
      }
      
      // Method 3: Find next sibling input
      let sibling = label.nextElementSibling;
      while (sibling) {
        if (sibling.tagName === 'INPUT' && sibling.type !== 'hidden') {
          console.log(`Found input as sibling: ${sibling.id}`);
          return setDateInputValue(sibling, formattedDate);
        }
        const nestedInput = sibling.querySelector('input[type="text"], input:not([type="hidden"])');
        if (nestedInput) {
          console.log(`Found nested input: ${nestedInput.id}`);
          return setDateInputValue(nestedInput, formattedDate);
        }
        sibling = sibling.nextElementSibling;
      }
    }
  }
  
  console.log(`Could not find date field by label: ${labelKeyword}`);
  return false;
}

// Set date input value (separate from general setInputValue to avoid issues)
function setDateInputValue(input, value) {
  try {
    console.log(`Setting date value "${value}" on input: ${input.id || input.name || 'unknown'}`);
    
    // Focus the input
    input.focus();
    input.click();
    
    // Clear existing value
    input.value = '';
    
    // Set value directly first
    input.value = value;
    
    // Try native setter if available
    try {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (nativeSetter) {
        nativeSetter.call(input, value);
      }
    } catch (e) {
      // Ignore native setter errors
    }
    
    // Dispatch events
    input.dispatchEvent(new Event('focus', { bubbles: true }));
    input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', keyCode: 9, bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    
    console.log(`✓ Set date value: ${value}`);
    return true;
  } catch (err) {
    console.error(`Error setting date value: ${err.message}`);
    // Final fallback
    try {
      input.value = value;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (e) {
      return false;
    }
  }
}

// Fill a dropdown/select field
// IMPORTANT: If value is null, undefined, or empty string - skip filling (leave field blank)
function fillDropdown(selector, value, mapping = null) {
  if (value === null || value === undefined || value === '') {
    console.log(`Skipping dropdown ${selector} - value is empty/null`);
    return false;
  }
  
  // Map value if mapping provided
  const mappedValue = mapping ? (mapping[value] || value) : value;
  
  // If mapped value is empty, skip
  if (!mappedValue) {
    console.log(`Skipping dropdown ${selector} - mapped value is empty`);
    return false;
  }
  
  console.log(`Trying to fill dropdown ${selector} with value: ${value} -> ${mappedValue}`);
  
  // Method 1: Standard select element
  let select = document.querySelector(selector);
  
  // Method 2: Find by partial ID match if direct selector fails
  if (!select) {
    const selectorId = selector.match(/id\*="([^"]+)"/)?.[1] || '';
    if (selectorId) {
      const allSelects = document.querySelectorAll('select');
      for (const s of allSelects) {
        if (s.id && s.id.includes(selectorId)) {
          select = s;
          break;
        }
      }
    }
  }
  
  if (!select) {
    console.log(`Dropdown not found: ${selector}`);
    return false;
  }
  
  // Find matching option
  const options = Array.from(select.options);
  let found = false;
  let matchedOption = null;
  
  // Try exact match first
  for (const option of options) {
    if (option.value === mappedValue || option.text === mappedValue || 
        option.text.trim() === mappedValue.trim()) {
      matchedOption = option;
      found = true;
      break;
    }
  }
  
  // Try case-insensitive match
  if (!found) {
    const lowerMapped = mappedValue.toLowerCase().trim();
    for (const option of options) {
      const lowerText = option.text.toLowerCase().trim();
      const lowerValue = option.value.toLowerCase().trim();
      if (lowerText === lowerMapped || lowerValue === lowerMapped) {
        matchedOption = option;
        found = true;
        break;
      }
    }
  }
  
  // Try partial match (contains)
  if (!found) {
    const lowerMapped = mappedValue.toLowerCase().trim();
    for (const option of options) {
      const lowerText = option.text.toLowerCase().trim();
      if (lowerText.includes(lowerMapped) || lowerMapped.includes(lowerText)) {
        matchedOption = option;
        found = true;
        break;
      }
    }
  }
  
  if (found && matchedOption) {
    // Set the value
    select.value = matchedOption.value;
    
    // Trigger multiple events for Mendix compatibility
    select.dispatchEvent(new Event('focus', { bubbles: true }));
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    select.dispatchEvent(new Event('blur', { bubbles: true }));
    
    // Also try to trigger React/Mendix specific events
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    nativeInputValueSetter.call(select, matchedOption.value);
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    
    console.log(`✓ Selected ${selector}: "${value}" -> "${matchedOption.text}" (value: ${matchedOption.value})`);
    return true;
  } else {
    console.log(`✗ No matching option found for ${selector}: ${mappedValue}`);
    console.log(`Available options:`, options.map(o => `"${o.text}" (${o.value})`).slice(0, 10));
    return false;
  }
}

// Main function to fill the visa form
async function fillVisaForm(data) {
  console.log('Starting form fill with data:', data);
  console.log('Date fields in data:', {
    birth_date: data.birth_date,
    issue_date: data.issue_date,
    expiry_date: data.expiry_date
  });
  
  let filledCount = 0;
  let totalFields = 0;
  
  // Helper to add delay
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  // Fill text fields first (non-date fields)
  for (const [field, selector] of Object.entries(FIELD_MAPPING)) {
    if (field.includes('date')) continue; // Skip dates for now, handle separately
    
    totalFields++;
    const value = data[field];
    if (value !== null && value !== undefined && value !== '') {
      if (fillTextField(selector, value)) filledCount++;
    }
    await delay(50); // Small delay between fields
  }
  
  // Fill date fields with more care and delay
  await delay(500);
  console.log('=== Filling date fields ===');
  
  // First, let's log all date-related inputs on the page for debugging
  logDateInputs();
  
  // Birth Date
  if (data.birth_date) {
    totalFields++;
    console.log(`Filling birth_date: ${data.birth_date}`);
    // Try by selector first, then by label
    let filled = fillDateField(FIELD_MAPPING.birth_date, data.birth_date);
    if (!filled) {
      filled = fillDateByLabel('birth', data.birth_date);
    }
    if (filled) {
      filledCount++;
      console.log('✓ Birth date filled');
    } else {
      console.log('✗ Birth date NOT filled');
    }
    await delay(300);
  }
  
  // Issue Date
  if (data.issue_date) {
    totalFields++;
    console.log(`Filling issue_date: ${data.issue_date}`);
    let filled = fillDateField(FIELD_MAPPING.issue_date, data.issue_date);
    if (!filled) {
      filled = fillDateByLabel('issue', data.issue_date);
    }
    if (filled) {
      filledCount++;
      console.log('✓ Issue date filled');
    } else {
      console.log('✗ Issue date NOT filled');
    }
    await delay(300);
  }
  
  // Expiry Date
  if (data.expiry_date) {
    totalFields++;
    console.log(`Filling expiry_date: ${data.expiry_date}`);
    let filled = fillDateField(FIELD_MAPPING.expiry_date, data.expiry_date);
    if (!filled) {
      filled = fillDateByLabel('expir', data.expiry_date);
    }
    if (filled) {
      filledCount++;
      console.log('✓ Expiry date filled');
    } else {
      console.log('✗ Expiry date NOT filled');
    }
    await delay(300);
  }
  
  // Fill dropdowns with delays for Mendix to process
  await delay(300);
  
  // Nationality
  if (data.nationality) {
    totalFields++;
    if (fillDropdown(DROPDOWN_MAPPING.nationality, data.nationality, NATIONALITY_MAP)) filledCount++;
    await delay(200);
  }
  
  // Gender (E-visa uses: Male, Female)
  if (data.gender) {
    totalFields++;
    if (fillDropdown(DROPDOWN_MAPPING.gender, data.gender)) filledCount++;
    await delay(200);
  }
  
  // Profession (E-visa uses: Physician, Engineer, other)
  if (data.profession) {
    totalFields++;
    if (fillDropdown(DROPDOWN_MAPPING.profession, data.profession, PROFESSION_MAP)) filledCount++;
    await delay(200);
  }
  
  // Passport Type (E-visa uses: Normal, Temporary, Diplomatic, Special, TravelDoc, UN, passage)
  if (data.passport_type) {
    totalFields++;
    if (fillDropdown(DROPDOWN_MAPPING.passport_type, data.passport_type, PASSPORT_TYPE_MAP)) filledCount++;
    await delay(200);
  }
  
  // Place of Issue (uses country names)
  if (data.place_of_issue) {
    totalFields++;
    if (fillDropdown(DROPDOWN_MAPPING.place_of_issue, data.place_of_issue, COUNTRY_MAP)) filledCount++;
    await delay(200);
  }
  
  // Country of Residence (uses country names)
  if (data.country_of_residence) {
    totalFields++;
    if (fillDropdown(DROPDOWN_MAPPING.country_of_residence, data.country_of_residence, COUNTRY_MAP)) filledCount++;
    await delay(200);
  }
  
  // Applicant Type - AUTO-CALCULATED based on age and gender
  // Adults (18+): None/Empty
  // Minors (<18) Male: Son
  // Minors (<18) Female: Daughter
  totalFields++;
  const autoApplicantType = getApplicantType(data.birth_date, data.gender);
  console.log(`Auto-calculated applicant type: Age=${calculateAge(data.birth_date)}, Gender=${data.gender}, Type=${autoApplicantType || '(None - Adult)'}`);
  
  if (autoApplicantType) {
    if (fillDropdown(DROPDOWN_MAPPING.applicant_type, autoApplicantType, APPLICANT_TYPE_MAP)) {
      filledCount++;
      console.log(`✓ Applicant type set to: ${autoApplicantType}`);
    }
  } else {
    // Leave empty for adults
    console.log('✓ Applicant type: None (Adult)');
    filledCount++; // Count as success since we intentionally left it empty
  }
  await delay(200);
  
  // ========== DEFAULT ACCOMMODATION VALUES ==========
  console.log('=== Filling accommodation fields ===');
  
  // Log all dropdowns on page for debugging
  logAllDropdowns();
  
  // Accommodation Type - Default: Hotel
  totalFields++;
  let filled = fillDropdown(DROPDOWN_MAPPING.accommodation_type, DEFAULT_VALUES.accommodation_type);
  if (!filled) {
    filled = fillDropdownByLabel('accommodation', DEFAULT_VALUES.accommodation_type);
  }
  if (!filled) {
    filled = fillDropdownByLabel('type', DEFAULT_VALUES.accommodation_type);
  }
  if (filled) filledCount++;
  await delay(200);
  
  // Governorate - Default: Najaf
  totalFields++;
  filled = fillDropdown(DROPDOWN_MAPPING.governorate, DEFAULT_VALUES.governorate);
  if (!filled) {
    filled = fillDropdownByLabel('governorate', DEFAULT_VALUES.governorate);
  }
  if (!filled) {
    filled = fillDropdownByLabel('محافظة', DEFAULT_VALUES.governorate);
  }
  if (filled) filledCount++;
  await delay(200);
  
  // Hotel Name - Default: الخيمه بلاز
  totalFields++;
  if (fillHotelName(DEFAULT_VALUES.hotel_name)) filledCount++;
  
  // Show notification
  showNotification(`Form filled! ${filledCount}/${totalFields} fields populated.`);
  
  console.log(`Form fill complete: ${filledCount}/${totalFields} fields filled`);
}

// Log all dropdowns on the page for debugging
function logAllDropdowns() {
  console.log('=== All dropdowns on page ===');
  const selects = document.querySelectorAll('select');
  console.log(`Found ${selects.length} select elements:`);
  selects.forEach((select, i) => {
    const id = select.id || 'no-id';
    const name = select.name || 'no-name';
    const options = Array.from(select.options).slice(0, 3).map(o => o.text).join(', ');
    console.log(`${i + 1}. id="${id}" name="${name}" options: [${options}...]`);
  });
}

// Fill dropdown by finding it via label text
function fillDropdownByLabel(labelKeyword, value) {
  console.log(`Trying to find dropdown by label containing: ${labelKeyword}`);
  
  const labels = document.querySelectorAll('label, .control-label, .mx-label, span[class*="label"]');
  
  for (const label of labels) {
    const labelText = label.textContent.toLowerCase();
    
    if (labelText.includes(labelKeyword.toLowerCase())) {
      console.log(`Found label: "${label.textContent}"`);
      
      // Method 1: Check 'for' attribute
      const forId = label.getAttribute('for');
      if (forId) {
        const select = document.getElementById(forId);
        if (select && select.tagName === 'SELECT') {
          console.log(`Found select by 'for' attribute: ${select.id}`);
          return setSelectValue(select, value);
        }
      }
      
      // Method 2: Find select in same container
      const container = label.closest('.form-group, .mx-dataview-content, [class*="form"]');
      if (container) {
        const select = container.querySelector('select');
        if (select) {
          console.log(`Found select in same container: ${select.id}`);
          return setSelectValue(select, value);
        }
      }
      
      // Method 3: Find next sibling select
      let sibling = label.nextElementSibling;
      while (sibling) {
        if (sibling.tagName === 'SELECT') {
          console.log(`Found select as sibling: ${sibling.id}`);
          return setSelectValue(sibling, value);
        }
        const nestedSelect = sibling.querySelector('select');
        if (nestedSelect) {
          console.log(`Found nested select: ${nestedSelect.id}`);
          return setSelectValue(nestedSelect, value);
        }
        sibling = sibling.nextElementSibling;
      }
    }
  }
  
  console.log(`Could not find dropdown by label: ${labelKeyword}`);
  return false;
}

// Set select value helper
function setSelectValue(select, value) {
  const options = Array.from(select.options);
  
  // Try exact match
  for (const option of options) {
    if (option.text === value || option.value === value || 
        option.text.trim().toLowerCase() === value.toLowerCase()) {
      select.value = option.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      console.log(`✓ Set select value: ${value}`);
      return true;
    }
  }
  
  // Try partial match
  for (const option of options) {
    if (option.text.toLowerCase().includes(value.toLowerCase()) ||
        value.toLowerCase().includes(option.text.toLowerCase())) {
      select.value = option.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      console.log(`✓ Set select value (partial): ${option.text}`);
      return true;
    }
  }
  
  console.log(`Could not find option "${value}" in select`);
  return false;
}

// Fill hotel name field
function fillHotelName(value) {
  if (!value) return false;
  
  console.log(`Trying to fill hotel name: ${value}`);
  
  // Log all text inputs for debugging
  const allInputs = document.querySelectorAll('input[type="text"], input:not([type="hidden"]):not([type="file"]):not([type="checkbox"]):not([type="radio"])');
  console.log(`Found ${allInputs.length} text inputs on page`);
  
  // Try multiple selectors for hotel name
  const selectors = [
    'input[id*="textBox37"]',
    'input[id*="hotelName"]',
    'input[id*="HotelName"]',
    'input[id*="hotel"]',
    'input[id*="Hotel"]',
    'input[id*="accommodation"]',
    'input[id*="Accommodation"]'
  ];
  
  for (const selector of selectors) {
    const input = document.querySelector(selector);
    if (input) {
      return setTextInputValue(input, value, 'hotel name by selector');
    }
  }
  
  // Fallback: Find by label text
  const labels = document.querySelectorAll('label, .control-label, .mx-label, span');
  for (const label of labels) {
    const text = label.textContent.toLowerCase();
    if (text.includes('hotel') || text.includes('فندق') || text.includes('اسم الفندق') || 
        text.includes('name of hotel') || text.includes('accommodation name')) {
      console.log(`Found hotel label: "${label.textContent}"`);
      
      // Check for 'for' attribute
      const forId = label.getAttribute('for');
      if (forId) {
        const input = document.getElementById(forId);
        if (input && input.tagName === 'INPUT') {
          return setTextInputValue(input, value, 'hotel name by for attr');
        }
      }
      
      // Find in container
      const container = label.closest('.form-group, .mx-dataview-content, [class*="form"]');
      if (container) {
        const input = container.querySelector('input[type="text"], input:not([type="hidden"])');
        if (input) {
          return setTextInputValue(input, value, 'hotel name in container');
        }
      }
      
      // Find as sibling
      let sibling = label.nextElementSibling;
      while (sibling) {
        if (sibling.tagName === 'INPUT') {
          return setTextInputValue(sibling, value, 'hotel name as sibling');
        }
        const nestedInput = sibling.querySelector('input');
        if (nestedInput) {
          return setTextInputValue(nestedInput, value, 'hotel name nested');
        }
        sibling = sibling.nextElementSibling;
      }
    }
  }
  
  console.log(`Hotel name field not found`);
  return false;
}

// Helper to set text input value
function setTextInputValue(input, value, source) {
  try {
    input.focus();
    input.value = '';
    
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeSetter.call(input, value);
    input.value = value;
    
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    
    console.log(`✓ Filled ${source}: ${value}`);
    return true;
  } catch (err) {
    console.error(`Error setting ${source}:`, err);
    input.value = value;
    return true;
  }
}

// Make fillVisaForm work with both sync and async calls
function fillVisaFormWrapper(data) {
  fillVisaForm(data).catch(err => console.error('Form fill error:', err));
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

// ==================== IMAGE UPLOAD FUNCTIONS ====================

// Fetch image via background script (avoids CORS issues)
async function fetchImageAsFile(imageUrl, filename) {
  try {
    console.log(`Fetching image via background script: ${imageUrl}`);
    
    // Send message to background script to fetch image
    const result = await chrome.runtime.sendMessage({
      action: 'fetchImage',
      url: imageUrl
    });
    
    if (!result || !result.success) {
      console.error('Background fetch failed:', result?.error);
      return null;
    }
    
    console.log(`Image fetched successfully, size: ${result.size} bytes`);
    
    // Convert base64 data URL to File object
    const response = await fetch(result.dataUrl);
    const blob = await response.blob();
    const file = new File([blob], filename, { type: result.mimeType || 'image/jpeg' });
    
    console.log(`Created file: ${filename}, size: ${file.size} bytes`);
    return file;
  } catch (error) {
    console.error(`Failed to fetch image: ${error}`);
    return null;
  }
}

// Alternative: Download image directly using Chrome downloads API
async function downloadImageDirect(imageUrl, filename) {
  try {
    console.log(`Downloading image directly: ${filename}`);
    
    const result = await chrome.runtime.sendMessage({
      action: 'downloadImage',
      url: imageUrl,
      filename: filename
    });
    
    if (result && result.success) {
      console.log(`Download started: ${filename}`);
      return true;
    } else {
      console.error('Download failed:', result?.error);
      return false;
    }
  } catch (error) {
    console.error(`Download error: ${error}`);
    return false;
  }
}

// Simulate file input change using DataTransfer API
function setFileInput(inputElement, file) {
  try {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    inputElement.files = dataTransfer.files;
    
    // Trigger change event
    const changeEvent = new Event('change', { bubbles: true });
    inputElement.dispatchEvent(changeEvent);
    
    console.log(`Set file input: ${file.name}`);
    return true;
  } catch (error) {
    console.error(`Failed to set file input: ${error}`);
    return false;
  }
}

// Navigate to Personal Attachment tab
function navigateToAttachmentTab() {
  const tabs = document.querySelectorAll('.mx-tabcontainer-tabs a');
  for (const tab of tabs) {
    if (tab.textContent.includes('Personal Attachment')) {
      tab.click();
      console.log('Navigated to Personal Attachment tab');
      return true;
    }
  }
  console.log('Personal Attachment tab not found');
  return false;
}

// Select attachment row in the grid - MUST be done before clicking Upload
async function selectAttachmentRow(attachmentName) {
  console.log(`Attempting to select row: ${attachmentName}`);
  
  // Try multiple selectors for the grid rows
  const rows = document.querySelectorAll('.mx-datagrid tbody tr, .mx-listview-list tr, table tbody tr');
  console.log(`Found ${rows.length} rows in grid`);
  
  for (const row of rows) {
    const cells = row.querySelectorAll('td');
    let found = false;
    
    for (const cell of cells) {
      const text = cell.textContent.trim();
      if (text.toLowerCase().includes(attachmentName.toLowerCase())) {
        found = true;
        break;
      }
    }
    
    if (found) {
      // Click on the row to select it
      row.click();
      console.log(`Clicked on row: ${attachmentName}`);
      
      // Also try clicking the first cell
      const firstCell = row.querySelector('td');
      if (firstCell) {
        firstCell.click();
      }
      
      // Add selected class if needed
      row.classList.add('selected', 'mx-datagrid-selected');
      
      // Dispatch events to ensure selection is registered
      row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      row.dispatchEvent(new Event('select', { bubbles: true }));
      
      console.log(`✓ Selected row: ${attachmentName}`);
      
      // Wait for selection to be processed
      await sleep(500);
      return true;
    }
  }
  
  console.log(`Row not found: ${attachmentName}`);
  return false;
}

// Click Upload button and handle Mendix file upload popup
async function clickUploadAndSetFile(file, attachmentType = 'Personal Image') {
  return new Promise(async (resolve) => {
    console.log(`Starting upload for attachment type: ${attachmentType}`);
    
    // IMPORTANT: Verify row is selected before uploading
    const selectedRow = document.querySelector('.mx-datagrid-selected, .mx-datagrid tbody tr.selected, tr[class*="selected"]');
    if (selectedRow) {
      console.log(`Row selected before upload: ${selectedRow.textContent.substring(0, 50)}...`);
    } else {
      console.log('WARNING: No row appears to be selected');
    }
    
    // Find the Upload button in the grid toolbar
    const uploadBtn = document.querySelector('button.mx-name-actionButton1') ||
                     document.querySelector('button[class*="upload"]') ||
                     document.querySelector('.mx-datagrid-toolbar button:first-child');
    
    if (!uploadBtn) {
      console.log('Upload button not found');
      resolve(false);
      return;
    }
    
    console.log(`Found upload button: ${uploadBtn.textContent || uploadBtn.className}`);
    
    // Click the upload button to open the popup
    uploadBtn.click();
    console.log('Clicked Upload button');
    
    // Wait and retry finding the popup multiple times
    let popup = null;
    for (let attempt = 1; attempt <= 5; attempt++) {
      await sleep(500 * attempt); // Increasing wait: 500ms, 1000ms, 1500ms...
      
      // Try multiple selectors for the popup
      popup = document.querySelector('div.mx-window.mx-window-active[role="dialog"]') ||
              document.querySelector('div.mx-window[role="dialog"]') ||
              document.querySelector('.mx-window-active') ||
              document.querySelector('.mx-dialog') ||
              document.querySelector('[class*="modal"][class*="active"]');
      
      if (popup) {
        console.log(`Found upload popup on attempt ${attempt}`);
        break;
      }
      console.log(`Popup not found on attempt ${attempt}, retrying...`);
    }
    
    if (!popup) {
      console.log('Upload popup not found after 5 attempts');
      resolve(false);
      return;
    }
    console.log('Found upload popup');
    
    // Wait a bit more for popup content to load
    await sleep(500);
    
    // Find the file input inside the popup (try multiple selectors)
    let fileInput = popup.querySelector('input[type="file"]') ||
                   popup.querySelector('.mx-fileinput input[type="file"]') ||
                   popup.querySelector('.mx-filemanager input[type="file"]') ||
                   document.querySelector('.mx-window-active input[type="file"]');
    
    if (!fileInput) {
      // Try to find any file input that appeared recently
      const allFileInputs = document.querySelectorAll('input[type="file"]');
      if (allFileInputs.length > 0) {
        fileInput = allFileInputs[allFileInputs.length - 1]; // Get the last one
        console.log('Found file input via fallback method');
      }
    }
    
    if (fileInput) {
      console.log('Found file input element');
      
      // Set the file using DataTransfer API
      try {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
        
        // Trigger events
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        fileInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        console.log(`Set file: ${file.name}`);
        
        // Wait for the file to be processed
        await sleep(500);
        
        // Look for a save/confirm button in the popup
        const saveBtn = popup.querySelector('button.mx-button:not(.mx-fileinput-upload-button)');
        if (saveBtn && (saveBtn.textContent.includes('Save') || saveBtn.textContent.includes('OK') || saveBtn.textContent.includes('حفظ'))) {
          saveBtn.click();
          console.log('Clicked save button');
          await sleep(500);
        }
        
        resolve(true);
        return;
      } catch (error) {
        console.error('Error setting file:', error);
      }
    }
    
    // Fallback: Try clicking the Browse button and intercepting
    const browseBtn = popup.querySelector('button.mx-fileinput-upload-button, button:contains("Browse")');
    if (browseBtn) {
      console.log('Trying Browse button fallback');
      
      // Create observer to catch when file input becomes active
      const observer = new MutationObserver((mutations) => {
        const inputs = popup.querySelectorAll('input[type="file"]');
        for (const input of inputs) {
          if (!input._processed) {
            input._processed = true;
            try {
              const dt = new DataTransfer();
              dt.items.add(file);
              input.files = dt.files;
              input.dispatchEvent(new Event('change', { bubbles: true }));
              console.log('Set file via observer');
              observer.disconnect();
              resolve(true);
            } catch (e) {
              console.error('Observer file set error:', e);
            }
          }
        }
      });
      
      observer.observe(popup, { childList: true, subtree: true, attributes: true });
      browseBtn.click();
      
      // Timeout
      setTimeout(() => {
        observer.disconnect();
        resolve(false);
      }, 3000);
    } else {
      console.log('Browse button not found');
      resolve(false);
    }
  });
}

// Main function to upload images
async function uploadImages(data) {
  console.log('Starting image upload with data:', data);
  
  const results = { success: [], failed: [] };
  
  // Navigate to Personal Attachment tab first
  const tabFound = navigateToAttachmentTab();
  if (!tabFound) {
    showNotification('Please navigate to the Personal Attachment tab first');
    return results;
  }
  await sleep(1000);
  
  // Upload Personal Image (profile photo)
  if (data.profile_image_url) {
    try {
      showNotification('📷 Fetching profile image...');
      const profileFile = await fetchImageAsFile(data.profile_image_url, `${data.passport_no}_photo.jpg`);
      
      if (profileFile) {
        // STEP 1: Select "Personal Image" row FIRST
        console.log('=== STEP 1: Selecting Personal Image row ===');
        let rowSelected = await selectAttachmentRow('Personal Image');
        if (!rowSelected) {
          // Try alternative names
          rowSelected = await selectAttachmentRow('Photo') || await selectAttachmentRow('صورة شخصية');
        }
        
        if (!rowSelected) {
          console.log('Could not select Personal Image row');
          showNotification('⚠️ Could not find Personal Image row');
        }
        
        // Wait for row selection to be registered
        await sleep(800);
        
        // STEP 2: Then click Upload button
        console.log('=== STEP 2: Clicking Upload button ===');
        const uploaded = await clickUploadAndSetFile(profileFile, 'Personal Image');
        if (uploaded) {
          results.success.push('Personal Image');
          showNotification('✅ Profile image uploaded!');
        } else {
          // Fallback: download the file for manual upload
          downloadFile(profileFile, `${data.passport_no}_photo.jpg`);
          results.failed.push('Personal Image (downloaded for manual upload)');
          showNotification('📥 Profile image downloaded - please upload manually');
        }
        
        // Close any open popup
        closePopup();
        await sleep(800);
      } else {
        // Direct download as last resort
        showNotification('📥 Downloading profile image...');
        await downloadImageDirect(data.profile_image_url, `${data.passport_no}_photo.jpg`);
        results.failed.push('Personal Image (downloaded)');
        showNotification('📥 Profile image downloaded - please upload manually');
      }
    } catch (error) {
      console.error('Profile image upload error:', error);
      // Try direct download
      await downloadImageDirect(data.profile_image_url, `${data.passport_no}_photo.jpg`);
      results.failed.push('Personal Image (error - downloaded)');
    }
  }
  
  await sleep(1000);
  
  // Upload Passport Image
  if (data.passport_image_url) {
    try {
      showNotification('🛂 Fetching passport scan...');
      const passportFile = await fetchImageAsFile(data.passport_image_url, `${data.passport_no}_passport.jpg`);
      
      if (passportFile) {
        // STEP 1: Select "Passport" row FIRST
        console.log('=== STEP 1: Selecting Passport row ===');
        let rowSelected = await selectAttachmentRow('Passport');
        if (!rowSelected) {
          // Try alternative names
          rowSelected = await selectAttachmentRow('Passport Scan') || await selectAttachmentRow('جواز السفر');
        }
        
        if (!rowSelected) {
          console.log('Could not select Passport row');
          showNotification('⚠️ Could not find Passport row');
        }
        
        // Wait for row selection to be registered
        await sleep(800);
        
        // STEP 2: Then click Upload button
        console.log('=== STEP 2: Clicking Upload button ===');
        const uploaded = await clickUploadAndSetFile(passportFile, 'Passport');
        if (uploaded) {
          results.success.push('Passport');
          showNotification('✅ Passport scan uploaded!');
        } else {
          // Fallback: download the file for manual upload
          downloadFile(passportFile, `${data.passport_no}_passport.jpg`);
          results.failed.push('Passport (downloaded for manual upload)');
          showNotification('📥 Passport image downloaded - please upload manually');
        }
        
        // Close any open popup
        closePopup();
      } else {
        // Direct download as last resort
        showNotification('📥 Downloading passport scan...');
        await downloadImageDirect(data.passport_image_url, `${data.passport_no}_passport.jpg`);
        results.failed.push('Passport (downloaded)');
        showNotification('📥 Passport image downloaded - please upload manually');
      }
    } catch (error) {
      console.error('Passport image upload error:', error);
      // Try direct download
      await downloadImageDirect(data.passport_image_url, `${data.passport_no}_passport.jpg`);
      results.failed.push('Passport (error - downloaded)');
    }
  }
  
  // Show final status
  await sleep(500);
  if (results.success.length > 0) {
    showNotification(`✅ Uploaded: ${results.success.join(', ')}`);
  } else if (results.failed.length > 0) {
    showNotification(`📥 Images downloaded for manual upload`);
  }
  
  console.log('Upload results:', results);
  return results;
}

// Close any open Mendix popup
function closePopup() {
  const closeBtn = document.querySelector('.mx-window-active .mx-window-close, .mx-window-active button[aria-label="Close"]');
  if (closeBtn) {
    closeBtn.click();
    console.log('Closed popup');
  }
}

// Download file as fallback
function downloadFile(file, filename) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  console.log(`Downloaded file: ${filename}`);
}

// Sleep helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Enhanced notification with type
function showNotification(message, type = 'success') {
  const existing = document.getElementById('evisa-filler-notification');
  if (existing) existing.remove();
  
  const bgColor = type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : '#ef4444';
  
  const notification = document.createElement('div');
  notification.id = 'evisa-filler-notification';
  notification.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${bgColor};
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
  
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(100px)';
    notification.style.transition = 'all 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}
