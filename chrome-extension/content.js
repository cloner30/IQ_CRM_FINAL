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

// Fill a date field (datepicker)
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
  
  // Try multiple methods to find and fill the date field
  
  // Method 1: Find by partial ID match (Mendix generates long IDs)
  const allInputs = document.querySelectorAll('input');
  for (const input of allInputs) {
    const id = input.id || '';
    const name = input.name || '';
    const placeholder = input.placeholder || '';
    
    // Check if this input matches our selector pattern
    const selectorId = selector.match(/id\*="([^"]+)"/)?.[1] || '';
    if (selectorId && (id.includes(selectorId) || name.includes(selectorId))) {
      input.focus();
      input.value = formattedDate;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));
      console.log(`Filled date field (method 1): ${formattedDate}`);
      return true;
    }
  }
  
  // Method 2: Direct querySelector
  const directInput = document.querySelector(selector);
  if (directInput) {
    directInput.focus();
    directInput.value = formattedDate;
    directInput.dispatchEvent(new Event('input', { bubbles: true }));
    directInput.dispatchEvent(new Event('change', { bubbles: true }));
    directInput.dispatchEvent(new Event('blur', { bubbles: true }));
    console.log(`Filled date field (method 2): ${formattedDate}`);
    return true;
  }
  
  // Method 3: Find mx-datepicker container
  const container = document.querySelector(selector)?.closest('.mx-datepicker');
  if (container) {
    const input = container.querySelector('input');
    if (input) {
      input.focus();
      input.value = formattedDate;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));
      console.log(`Filled date field (method 3): ${formattedDate}`);
      return true;
    }
  }
  
  console.log(`Date field not found: ${selector}`);
  return false;
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
  
  let filledCount = 0;
  let totalFields = 0;
  
  // Helper to add delay
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  // Fill text fields first
  for (const [field, selector] of Object.entries(FIELD_MAPPING)) {
    totalFields++;
    const value = data[field];
    if (value !== null && value !== undefined && value !== '') {
      if (field.includes('date')) {
        if (fillDateField(selector, value)) filledCount++;
      } else {
        if (fillTextField(selector, value)) filledCount++;
      }
    }
    await delay(50); // Small delay between fields
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
  
  // Applicant Type (E-visa uses: "", "Son", "Daughter")
  if (data.applicant_type) {
    totalFields++;
    if (fillDropdown(DROPDOWN_MAPPING.applicant_type, data.applicant_type, APPLICANT_TYPE_MAP)) filledCount++;
  }
  
  // Show notification
  showNotification(`Form filled! ${filledCount}/${totalFields} fields populated.`);
  
  console.log(`Form fill complete: ${filledCount}/${totalFields} fields filled`);
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

// Fetch image from URL and convert to File object
async function fetchImageAsFile(imageUrl, filename) {
  try {
    console.log(`Fetching image: ${imageUrl}`);
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const blob = await response.blob();
    const file = new File([blob], filename, { type: 'image/jpeg' });
    console.log(`Created file: ${filename}, size: ${file.size} bytes`);
    return file;
  } catch (error) {
    console.error(`Failed to fetch image: ${error}`);
    return null;
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

// Select attachment row in the grid
function selectAttachmentRow(attachmentName) {
  const rows = document.querySelectorAll('.mx-datagrid tbody tr');
  for (const row of rows) {
    const cell = row.querySelector('td');
    if (cell && cell.textContent.includes(attachmentName)) {
      row.click();
      console.log(`Selected row: ${attachmentName}`);
      return true;
    }
  }
  console.log(`Row not found: ${attachmentName}`);
  return false;
}

// Click Upload button and handle file dialog
async function clickUploadAndSetFile(file) {
  return new Promise((resolve) => {
    // Find the Upload button
    const uploadBtn = document.querySelector('button.mx-name-actionButton1');
    if (!uploadBtn) {
      console.log('Upload button not found');
      resolve(false);
      return;
    }
    
    // Create a hidden file input to intercept the file dialog
    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'file';
    hiddenInput.accept = 'image/jpeg,image/jpg';
    hiddenInput.style.display = 'none';
    document.body.appendChild(hiddenInput);
    
    // Set the file and trigger change
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    hiddenInput.files = dataTransfer.files;
    
    // Listen for any file input that appears after clicking upload
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) {
            const fileInputs = node.querySelectorAll ? node.querySelectorAll('input[type="file"]') : [];
            for (const input of fileInputs) {
              setFileInput(input, file);
              observer.disconnect();
              resolve(true);
              return;
            }
          }
        }
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Click the upload button
    uploadBtn.click();
    console.log('Clicked Upload button');
    
    // Timeout after 3 seconds
    setTimeout(() => {
      observer.disconnect();
      hiddenInput.remove();
      resolve(false);
    }, 3000);
  });
}

// Main function to upload images
async function uploadImages(data) {
  console.log('Starting image upload with data:', data);
  
  const results = { success: [], failed: [] };
  
  // Navigate to Personal Attachment tab
  navigateToAttachmentTab();
  await sleep(500);
  
  // Upload Personal Image (profile photo)
  if (data.profile_image_url) {
    try {
      showNotification('Downloading profile image...');
      const profileFile = await fetchImageAsFile(data.profile_image_url, `${data.passport_no}_photo.jpg`);
      
      if (profileFile) {
        // Select "Personal Image" row
        selectAttachmentRow('Personal Image');
        await sleep(300);
        
        // Try to upload
        const uploaded = await clickUploadAndSetFile(profileFile);
        if (uploaded) {
          results.success.push('Personal Image');
          showNotification('✓ Profile image uploaded!');
        } else {
          // Fallback: download the file for manual upload
          downloadFile(profileFile, `${data.passport_no}_photo.jpg`);
          results.failed.push('Personal Image (downloaded for manual upload)');
          showNotification('Profile image downloaded - please upload manually');
        }
      }
    } catch (error) {
      console.error('Profile image upload error:', error);
      results.failed.push('Personal Image');
    }
  }
  
  await sleep(500);
  
  // Upload Passport Image
  if (data.passport_image_url) {
    try {
      showNotification('Downloading passport image...');
      const passportFile = await fetchImageAsFile(data.passport_image_url, `${data.passport_no}_passport.jpg`);
      
      if (passportFile) {
        // Select "Passport" row
        selectAttachmentRow('Passport');
        await sleep(300);
        
        // Try to upload
        const uploaded = await clickUploadAndSetFile(passportFile);
        if (uploaded) {
          results.success.push('Passport');
          showNotification('✓ Passport image uploaded!');
        } else {
          // Fallback: download the file for manual upload
          downloadFile(passportFile, `${data.passport_no}_passport.jpg`);
          results.failed.push('Passport (downloaded for manual upload)');
          showNotification('Passport image downloaded - please upload manually');
        }
      }
    } catch (error) {
      console.error('Passport image upload error:', error);
      results.failed.push('Passport');
    }
  }
  
  // Show final status
  if (results.success.length > 0) {
    showNotification(`✓ Uploaded: ${results.success.join(', ')}`);
  }
  if (results.failed.length > 0) {
    setTimeout(() => {
      showNotification(`⚠ Manual upload needed: ${results.failed.join(', ')}`, 'warning');
    }, 2000);
  }
  
  console.log('Image upload complete:', results);
  return results;
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
