// Content script for E-Visa Form Filler Extension
// This script runs on eservice.evisa.iq and fills the visa application form

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fillForm') {
    fillVisaForm(request.data);
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

// Dropdown mapping
const DROPDOWN_MAPPING = {
  nationality: 'select[id*="SNP_Beneficiary_Company.referenceSelector3"]',
  gender: 'select[id*="SNP_Beneficiary_Company.dropDown1"]',
  profession: 'select[id*="SNP_Beneficiary_Company.referenceSelector5"]',
  passport_type: 'select[id*="SNP_Passport_Company.dropDown4"]',
  place_of_issue: 'select[id*="SNP_Passport_Company.referenceSelector13"]',
  country_of_residence: 'select[id*="SNP_Beneficiary_Company.referenceSelector2"]',
  applicant_type: 'select[id*="Issuance_Company_Beneficiary"] select.form-control'
};

// Nationality mapping (Our values -> E-visa option text)
const NATIONALITY_MAP = {
  'American': 'American',
  'British': 'British',
  'Indian': 'Indian',
  'Pakistani': 'Pakistani',
  'Iraqi': 'Iraqi',
  'Iranian': 'Iranian',
  'Jordanian': 'Jordanian',
  'Egyptian': 'Egyptian',
  'Saudi': 'Saudi',
  'Emirati': 'Emirati',
  'Turkish': 'Turkish',
  'German': 'German',
  'French': 'French',
  'Chinese': 'Chinese',
  'Japanese': 'Japanese',
  'Korean': 'Korean',
  'Russian': 'Russian',
  'Canadian': 'Canadian',
  'Australian': 'Australian',
  // Add more as needed
};

// Passport type mapping
const PASSPORT_TYPE_MAP = {
  'Normal': 'Normal',
  'Temporary': 'Temporary',
  'Diplomatic': 'Diplomatic',
  'Special': 'Special',
  'Travel Doc': 'TravelDoc',
  'UN': 'UN',
  'Passage': 'passage'
};

// Profession mapping
const PROFESSION_MAP = {
  'Physician': 'Physician',
  'Engineer': 'Engineer',
  'Teacher': 'other',
  'Business': 'other',
  'Student': 'other',
  'Government': 'other',
  'Other': 'other'
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
    
    // Gender
    if (data.gender) {
      fillDropdown(DROPDOWN_MAPPING.gender, data.gender);
    }
    
    // Profession
    if (data.profession) {
      fillDropdown(DROPDOWN_MAPPING.profession, data.profession, PROFESSION_MAP);
    }
    
    // Passport Type
    if (data.passport_type) {
      fillDropdown(DROPDOWN_MAPPING.passport_type, data.passport_type, PASSPORT_TYPE_MAP);
    }
    
    // Place of Issue
    if (data.place_of_issue) {
      fillDropdown(DROPDOWN_MAPPING.place_of_issue, data.place_of_issue);
    }
    
    // Country of Residence
    if (data.country_of_residence) {
      fillDropdown(DROPDOWN_MAPPING.country_of_residence, data.country_of_residence);
    }
    
    // Applicant Type
    if (data.applicant_type) {
      const applicantSelect = document.querySelector('select[id*="dynamicEnumPicker1"]');
      if (applicantSelect) {
        fillDropdown('select[id*="dynamicEnumPicker1"]', data.applicant_type);
      }
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
