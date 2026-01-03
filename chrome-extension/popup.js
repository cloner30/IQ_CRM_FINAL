// Popup script for E-Visa Form Filler Extension

let selectedPassport = null;
let apiUrl = '';
let allPassports = []; // Store all passports for filtering
let currentGroupId = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  setupEventListeners();
});

async function loadSettings() {
  const result = await chrome.storage.sync.get(['apiUrl']);
  apiUrl = result.apiUrl || '';
  
  if (!apiUrl) {
    document.getElementById('setup-required').classList.remove('hidden');
    document.getElementById('main-content').classList.add('hidden');
  } else {
    document.getElementById('setup-required').classList.add('hidden');
    document.getElementById('main-content').classList.remove('hidden');
    await loadGroups();
  }
}

function setupEventListeners() {
  // Settings links
  document.getElementById('open-settings').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
  
  document.getElementById('settings-link').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
  
  // Group selection
  document.getElementById('group-select').addEventListener('change', async (e) => {
    const groupId = e.target.value;
    const passportSelect = document.getElementById('passport-select');
    const preview = document.getElementById('passenger-preview');
    const fillBtn = document.getElementById('fill-form-btn');
    const markDoneBtn = document.getElementById('mark-done-btn');
    const progressBar = document.getElementById('group-progress');
    
    if (!groupId) {
      passportSelect.disabled = true;
      passportSelect.innerHTML = '<option value="">-- Select a passenger --</option>';
      preview.classList.add('hidden');
      progressBar.classList.add('hidden');
      fillBtn.disabled = true;
      markDoneBtn.disabled = true;
      selectedPassport = null;
      currentGroupId = null;
      allPassports = [];
      return;
    }
    
    currentGroupId = groupId;
    await loadPassports(groupId);
  });
  
  // Status filter change
  document.getElementById('status-filter').addEventListener('change', () => {
    filterAndDisplayPassports();
  });
  
  // Passport selection
  document.getElementById('passport-select').addEventListener('change', (e) => {
    const passportId = e.target.value;
    const preview = document.getElementById('passenger-preview');
    const fillBtn = document.getElementById('fill-form-btn');
    const uploadBtn = document.getElementById('upload-images-btn');
    const markDoneBtn = document.getElementById('mark-done-btn');
    
    if (!passportId) {
      preview.classList.add('hidden');
      fillBtn.disabled = true;
      uploadBtn.disabled = true;
      markDoneBtn.disabled = true;
      selectedPassport = null;
      return;
    }
    
    // Find selected passport from stored data
    const passportSelect = document.getElementById('passport-select');
    const selectedOption = passportSelect.options[passportSelect.selectedIndex];
    selectedPassport = JSON.parse(selectedOption.dataset.passport);
    
    // Update preview
    document.getElementById('preview-name').textContent = 
      `${selectedPassport.first_name_en} ${selectedPassport.surname_en}`;
    document.getElementById('preview-passport').textContent = selectedPassport.passport_no;
    document.getElementById('preview-nationality').textContent = selectedPassport.nationality;
    
    // Show image status
    const hasPassportImage = !!selectedPassport.passport_image;
    const hasProfileImage = !!selectedPassport.profile_image;
    let imageStatus = [];
    if (hasProfileImage) imageStatus.push('📷 Photo');
    if (hasPassportImage) imageStatus.push('🛂 Passport');
    document.getElementById('preview-images').textContent = imageStatus.length > 0 ? imageStatus.join(', ') : 'None';
    
    // Show visa status in preview
    const statusBadge = selectedPassport.visa_status === 'Done' ? '✅ Done' : '⏳ Pending';
    document.getElementById('preview-status').textContent = statusBadge;
    
    preview.classList.remove('hidden');
    fillBtn.disabled = false;
    // Enable upload button only if images exist
    uploadBtn.disabled = !(selectedPassport.passport_image || selectedPassport.profile_image);
    // Enable mark done button (disable if already done)
    markDoneBtn.disabled = selectedPassport.visa_status === 'Done';
    markDoneBtn.textContent = selectedPassport.visa_status === 'Done' ? '✓ Already Done' : '✓ Mark as Done';
  });
  
  // Fill form button
  document.getElementById('fill-form-btn').addEventListener('click', fillForm);
  
  // Upload images button
  document.getElementById('upload-images-btn').addEventListener('click', uploadImages);
  
  // Mark as Done button
  document.getElementById('mark-done-btn').addEventListener('click', markAsDone);
}

async function loadGroups() {
  const groupSelect = document.getElementById('group-select');
  showStatus('Loading groups...', 'loading');
  
  try {
    const response = await fetch(`${apiUrl}/api/groups`);
    if (!response.ok) throw new Error('Failed to fetch groups');
    
    const groups = await response.json();
    
    groupSelect.innerHTML = '<option value="">-- Select a group --</option>';
    groups.forEach(group => {
      const option = document.createElement('option');
      option.value = group.id;
      option.textContent = `${group.name} (${group.passport_count || 0} passengers)`;
      groupSelect.appendChild(option);
    });
    
    hideStatus();
  } catch (error) {
    console.error('Error loading groups:', error);
    showStatus('Failed to load groups. Check API URL in settings.', 'error');
  }
}

async function loadPassports(groupId) {
  const passportSelect = document.getElementById('passport-select');
  showStatus('Loading passengers...', 'loading');
  
  try {
    const response = await fetch(`${apiUrl}/api/groups/${groupId}/passports`);
    if (!response.ok) throw new Error('Failed to fetch passports');
    
    allPassports = await response.json();
    
    // Update progress bar
    updateProgressBar();
    
    // Filter and display passports
    filterAndDisplayPassports();
    
    passportSelect.disabled = false;
    hideStatus();
  } catch (error) {
    console.error('Error loading passports:', error);
    showStatus('Failed to load passengers.', 'error');
  }
}

function updateProgressBar() {
  const progressBar = document.getElementById('group-progress');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  
  const total = allPassports.length;
  const done = allPassports.filter(p => p.visa_status === 'Done').length;
  const percentage = total > 0 ? (done / total) * 100 : 0;
  
  progressText.textContent = `${done}/${total} Done`;
  progressFill.style.width = `${percentage}%`;
  progressBar.classList.remove('hidden');
}

function filterAndDisplayPassports() {
  const passportSelect = document.getElementById('passport-select');
  const statusFilter = document.getElementById('status-filter').value;
  
  let filteredPassports = allPassports;
  
  if (statusFilter === 'pending') {
    filteredPassports = allPassports.filter(p => p.visa_status !== 'Done');
  } else if (statusFilter === 'done') {
    filteredPassports = allPassports.filter(p => p.visa_status === 'Done');
  }
  
  passportSelect.innerHTML = '<option value="">-- Select a passenger --</option>';
  
  filteredPassports.forEach(passport => {
    const option = document.createElement('option');
    option.value = passport.id;
    
    // Add visual status indicator to the option text
    const statusIcon = passport.visa_status === 'Done' ? '✅' : '⏳';
    option.textContent = `${statusIcon} ${passport.first_name_en} ${passport.surname_en} (${passport.passport_no})`;
    option.dataset.passport = JSON.stringify(passport);
    
    // Add class for styling
    if (passport.visa_status === 'Done') {
      option.className = 'option-done';
    } else {
      option.className = 'option-pending';
    }
    
    passportSelect.appendChild(option);
  });
  
  // Reset selection
  selectedPassport = null;
  document.getElementById('passenger-preview').classList.add('hidden');
  document.getElementById('fill-form-btn').disabled = true;
  document.getElementById('upload-images-btn').disabled = true;
  document.getElementById('mark-done-btn').disabled = true;
}

async function fillForm() {
  if (!selectedPassport) {
    showStatus('Please select a passenger first.', 'error');
    return;
  }
  
  showStatus('Filling form...', 'loading');
  
  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Check if we're on the right site
    if (!tab.url.includes('eservice.evisa.iq')) {
      showStatus('Please navigate to eservice.evisa.iq first.', 'error');
      return;
    }
    
    // Prepare passport data with image URLs (S3 presigned URLs are already full URLs)
    const passportData = {
      ...selectedPassport,
      passport_image_url: selectedPassport.passport_image || null,
      profile_image_url: selectedPassport.profile_image || null
    };
    
    // Execute content script to fill form
    await chrome.tabs.sendMessage(tab.id, {
      action: 'fillForm',
      data: passportData
    });
    
    showStatus('Form filled successfully! ✓', 'success');
    
    // Close popup after delay
    setTimeout(() => {
      window.close();
    }, 1500);
    
  } catch (error) {
    console.error('Error filling form:', error);
    showStatus('Failed to fill form. Make sure you are on the visa application page.', 'error');
  }
}

async function uploadImages() {
  if (!selectedPassport) {
    showStatus('Please select a passenger first.', 'error');
    return;
  }
  
  if (!selectedPassport.passport_image && !selectedPassport.profile_image) {
    showStatus('No images available for this passenger.', 'error');
    return;
  }
  
  showStatus('Uploading images...', 'loading');
  
  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Check if we're on the right site
    if (!tab.url.includes('eservice.evisa.iq')) {
      showStatus('Please navigate to eservice.evisa.iq first.', 'error');
      return;
    }
    
    // Prepare image data (S3 presigned URLs are already full URLs)
    const imageData = {
      passport_no: selectedPassport.passport_no,
      passport_image_url: selectedPassport.passport_image || null,
      profile_image_url: selectedPassport.profile_image || null
    };
    
    // Execute content script to upload images
    await chrome.tabs.sendMessage(tab.id, {
      action: 'uploadImages',
      data: imageData
    });
    
    showStatus('Images uploaded/downloaded! ✓', 'success');
    
  } catch (error) {
    console.error('Error uploading images:', error);
    showStatus('Failed to upload images. Check console for details.', 'error');
  }
}

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;
  status.classList.remove('hidden');
}

function hideStatus() {
  const status = document.getElementById('status');
  status.classList.add('hidden');
}

async function markAsDone() {
  if (!selectedPassport) {
    showStatus('Please select a passenger first.', 'error');
    return;
  }
  
  if (selectedPassport.status === 'done' || selectedPassport.visa_status === 'Done') {
    showStatus('This passenger is already marked as done.', 'error');
    return;
  }
  
  showStatus('Marking as done...', 'loading');
  
  try {
    const response = await fetch(`${apiUrl}/api/passports/${selectedPassport.id}/status?status=done`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to update status');
    }
    
    // Update local data
    selectedPassport.status = 'done';
    selectedPassport.visa_status = 'Done';
    selectedPassport.status_updated_at = new Date().toISOString();
    
    // Update in allPassports array
    const index = allPassports.findIndex(p => p.id === selectedPassport.id);
    if (index !== -1) {
      allPassports[index].status = 'done';
      allPassports[index].visa_status = 'Done';
      allPassports[index].status_updated_at = selectedPassport.status_updated_at;
    }
    
    // Update progress bar
    updateProgressBar();
    
    // Update the button state
    const markDoneBtn = document.getElementById('mark-done-btn');
    markDoneBtn.disabled = true;
    markDoneBtn.innerHTML = '<span class="btn-icon">✓</span> Already Done';
    
    // Update preview status
    document.getElementById('preview-status').textContent = '✅ Done';
    
    // Update the option in dropdown to show done status
    const passportSelect = document.getElementById('passport-select');
    const selectedOption = passportSelect.options[passportSelect.selectedIndex];
    if (selectedOption) {
      selectedOption.textContent = `✅ ${selectedPassport.first_name_en} ${selectedPassport.surname_en} (${selectedPassport.passport_no})`;
      selectedOption.className = 'option-done';
      selectedOption.dataset.passport = JSON.stringify(selectedPassport);
    }
    
    showStatus('✓ Marked as Done!', 'success');
    
    // Auto-hide success message after 2 seconds
    setTimeout(() => {
      hideStatus();
    }, 2000);
    
  } catch (error) {
    console.error('Error marking as done:', error);
    showStatus(`Failed to mark as done: ${error.message}`, 'error');
  }
}
