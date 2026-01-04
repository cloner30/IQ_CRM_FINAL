// Popup script for E-Visa Form Filler Extension

let selectedPassport = null;
let apiUrl = '';
let authToken = '';
let currentUser = null;
let allPassports = []; // Store all passports for filtering
let currentGroupId = null;
let lastSelectedGroupId = null; // Remember last selected group

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  setupEventListeners();
});

async function loadSettings() {
  const result = await chrome.storage.sync.get(['apiUrl', 'authToken', 'user', 'lastSelectedGroupId']);
  apiUrl = result.apiUrl || '';
  authToken = result.authToken || '';
  currentUser = result.user || null;
  lastSelectedGroupId = result.lastSelectedGroupId || null;
  
  if (!apiUrl) {
    document.getElementById('setup-required').classList.remove('hidden');
    document.getElementById('main-content').classList.add('hidden');
    document.querySelector('#setup-required p').textContent = 'API URL not configured.';
  } else if (!authToken) {
    document.getElementById('setup-required').classList.remove('hidden');
    document.getElementById('main-content').classList.add('hidden');
    document.querySelector('#setup-required p').innerHTML = 'Not logged in. <a href="#" id="open-settings">Open Settings</a> to login.';
    // Re-attach event listener for the new link
    document.getElementById('open-settings')?.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  } else {
    document.getElementById('setup-required').classList.add('hidden');
    document.getElementById('main-content').classList.remove('hidden');
    await loadGroups();
  }
}

// Helper function to make authenticated API requests
async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Accept': 'application/json',
    'Authorization': `Bearer ${authToken}`,
    ...options.headers
  };
  
  const response = await fetch(`${apiUrl}${endpoint}`, {
    ...options,
    headers
  });
  
  if (response.status === 401 || response.status === 403) {
    // Token expired or invalid
    showStatus('Session expired. Please login again in Settings.', 'error');
    throw new Error('Authentication failed');
  }
  
  return response;
}

function setupEventListeners() {
  // Settings links - use direct URL for better compatibility
  const openSettings = () => {
    const optionsUrl = chrome.runtime.getURL('options.html');
    chrome.tabs.create({ url: optionsUrl });
  };
  
  document.getElementById('open-settings')?.addEventListener('click', (e) => {
    e.preventDefault();
    openSettings();
  });
  
  document.getElementById('settings-link').addEventListener('click', (e) => {
    e.preventDefault();
    openSettings();
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
    
    // Show visa status in preview - check both fields
    const isDone = selectedPassport.status === 'done' || selectedPassport.visa_status === 'Done';
    const statusBadge = isDone ? '✅ Done' : '⏳ Pending';
    document.getElementById('preview-status').textContent = statusBadge;
    
    preview.classList.remove('hidden');
    fillBtn.disabled = false;
    // Enable upload button only if images exist
    uploadBtn.disabled = !(selectedPassport.passport_image || selectedPassport.profile_image);
    // Enable mark done button (disable if already done)
    markDoneBtn.disabled = isDone;
    markDoneBtn.textContent = isDone ? '✓ Already Done' : '✓ Mark as Done';
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
    const response = await apiRequest('/api/groups');
    if (!response.ok) throw new Error('Failed to fetch groups');
    
    let groups = await response.json();
    
    // Sort groups from newest to oldest (by created_at)
    groups.sort((a, b) => {
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return dateB - dateA; // Newest first
    });
    
    groupSelect.innerHTML = '<option value="">-- Select a group --</option>';
    groups.forEach(group => {
      const option = document.createElement('option');
      option.value = group.id;
      option.textContent = `${group.name} (${group.passport_count || 0} passengers)`;
      groupSelect.appendChild(option);
    });
    
    // Auto-select last used group if available
    if (lastSelectedGroupId) {
      const optionExists = Array.from(groupSelect.options).some(opt => opt.value === lastSelectedGroupId);
      if (optionExists) {
        groupSelect.value = lastSelectedGroupId;
        currentGroupId = lastSelectedGroupId;
        console.log(`Auto-selected last group: ${lastSelectedGroupId}`);
        // Automatically load passports for the last selected group
        await loadPassports(lastSelectedGroupId);
      }
    }
    
    hideStatus();
  } catch (error) {
    console.error('Error loading groups:', error);
    showStatus('Failed to load groups. Check settings.', 'error');
  }
}

async function loadPassports(groupId) {
  const passportSelect = document.getElementById('passport-select');
  showStatus('Loading passengers...', 'loading');
  
  // Save selected group to storage
  currentGroupId = groupId;
  lastSelectedGroupId = groupId;
  await chrome.storage.sync.set({ lastSelectedGroupId: groupId });
  console.log(`Saved group selection: ${groupId}`);
  
  try {
    const response = await apiRequest(`/api/groups/${groupId}/passports`);
    if (!response.ok) throw new Error('Failed to fetch passports');
    
    allPassports = await response.json();
    
    // Sort passports from newest to oldest (by created_at)
    allPassports.sort((a, b) => {
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return dateB - dateA; // Newest first
    });
    
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
  // Check both 'status' and 'visa_status' fields for compatibility
  const done = allPassports.filter(p => p.status === 'done' || p.visa_status === 'Done').length;
  const percentage = total > 0 ? (done / total) * 100 : 0;
  
  progressText.textContent = `${done}/${total} Done`;
  progressFill.style.width = `${percentage}%`;
  progressBar.classList.remove('hidden');
}

// Helper function to check if passport is done
function isPassportDone(passport) {
  return passport.status === 'done' || passport.visa_status === 'Done';
}

function filterAndDisplayPassports() {
  const passportSelect = document.getElementById('passport-select');
  const statusFilter = document.getElementById('status-filter').value;
  
  let filteredPassports = allPassports;
  
  if (statusFilter === 'pending') {
    filteredPassports = allPassports.filter(p => !isPassportDone(p));
  } else if (statusFilter === 'done') {
    filteredPassports = allPassports.filter(p => isPassportDone(p));
  }
  
  passportSelect.innerHTML = '<option value="">-- Select a passenger --</option>';
  
  filteredPassports.forEach(passport => {
    const option = document.createElement('option');
    option.value = passport.id;
    
    // Add visual status indicator to the option text
    const isDone = isPassportDone(passport);
    const statusIcon = isDone ? '✅' : '⏳';
    option.textContent = `${statusIcon} ${passport.first_name_en} ${passport.surname_en} (${passport.passport_no})`;
    option.dataset.passport = JSON.stringify(passport);
    
    // Add class for styling
    if (isDone) {
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
    
    // Check if we're on the right site (more flexible matching)
    const url = tab.url.toLowerCase();
    if (!url.includes('evisa.iq')) {
      showStatus('Please navigate to the Iraq e-visa site (evisa.iq) first.', 'error');
      return;
    }
    
    // Prepare passport data with image URLs (S3 presigned URLs are already full URLs)
    const passportData = {
      ...selectedPassport,
      passport_image_url: selectedPassport.passport_image || null,
      profile_image_url: selectedPassport.profile_image || null
    };
    
    // Try to inject content script first (in case it wasn't loaded)
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      console.log('Content script injected successfully');
    } catch (injectError) {
      console.log('Content script already loaded or injection failed:', injectError.message);
    }
    
    // Wait a bit for script to initialize
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Execute content script to fill form
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'fillForm',
        data: passportData
      });
      
      if (response && response.success) {
        showStatus('Form filled successfully! ✓', 'success');
      } else {
        showStatus('Form filled! Check the page for results.', 'success');
      }
    } catch (sendError) {
      console.error('sendMessage error:', sendError);
      // Try one more time with programmatic injection
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (data) => {
          // Inline form filling function as fallback
          console.log('Fallback form filling with data:', data);
          if (typeof fillVisaForm === 'function') {
            fillVisaForm(data);
          } else {
            alert('Form filler not ready. Please refresh the e-visa page and try again.');
          }
        },
        args: [passportData]
      });
      showStatus('Form fill attempted. Check the page.', 'success');
    }
    
    // DON'T close popup - keep it open for next passenger
    // Auto-advance to next pending passenger after a delay
    setTimeout(() => {
      selectNextPendingPassenger();
    }, 2000);
    
  } catch (error) {
    console.error('Error filling form:', error);
    showStatus('Failed to fill form. Please refresh the e-visa page and try again.', 'error');
  }
}

// Select the next pending passenger automatically
function selectNextPendingPassenger() {
  const passportSelect = document.getElementById('passport-select');
  const currentIndex = passportSelect.selectedIndex;
  
  // Find the next pending (not done) passenger
  for (let i = currentIndex + 1; i < passportSelect.options.length; i++) {
    const option = passportSelect.options[i];
    if (!option.value) continue; // Skip empty option
    
    try {
      const passport = JSON.parse(option.dataset.passport);
      if (passport.status !== 'done') {
        passportSelect.selectedIndex = i;
        selectPassport(passport);
        showStatus('Ready for next passenger ➡️', 'success');
        console.log(`Auto-selected next passenger: ${passport.first_name_en} ${passport.surname_en}`);
        return;
      }
    } catch (e) {
      console.error('Error parsing passport data:', e);
    }
  }
  
  // If no more pending passengers, show message
  showStatus('✅ All passengers done! No more pending.', 'success');
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
    
    // Check if we're on the right site (more flexible matching)
    const url = tab.url.toLowerCase();
    if (!url.includes('evisa.iq')) {
      showStatus('Please navigate to the Iraq e-visa site (evisa.iq) first.', 'error');
      return;
    }
    
    // Prepare image data (S3 presigned URLs are already full URLs)
    const imageData = {
      passport_no: selectedPassport.passport_no,
      passport_image_url: selectedPassport.passport_image || null,
      profile_image_url: selectedPassport.profile_image || null
    };
    
    // Try to inject content script first (in case it wasn't loaded)
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    } catch (injectError) {
      console.log('Content script already loaded or injection failed:', injectError.message);
    }
    
    // Wait a bit for script to initialize
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Execute content script to upload images
    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'uploadImages',
        data: imageData
      });
      showStatus('Images uploaded/downloaded! ✓', 'success');
    } catch (sendError) {
      console.error('sendMessage error:', sendError);
      showStatus('Failed to upload images. Please refresh the e-visa page and try again.', 'error');
    }
    
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
    const response = await apiRequest(`/api/passports/${selectedPassport.id}/status?status=done`, {
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
