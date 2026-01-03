// Options page script for E-Visa Form Filler Extension

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  setupEventListeners();
});

async function loadSettings() {
  const result = await chrome.storage.sync.get(['apiUrl']);
  if (result.apiUrl) {
    document.getElementById('api-url').value = result.apiUrl;
  }
}

function setupEventListeners() {
  // Save settings form
  document.getElementById('settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveSettings();
  });
  
  // Test connection button
  document.getElementById('test-connection').addEventListener('click', testConnection);
}

async function saveSettings() {
  const apiUrl = document.getElementById('api-url').value.trim().replace(/\/$/, '');
  
  if (!apiUrl) {
    showStatus('Please enter an API URL.', 'error');
    return;
  }
  
  try {
    await chrome.storage.sync.set({ apiUrl });
    showStatus('Settings saved successfully! ✓', 'success');
  } catch (error) {
    console.error('Error saving settings:', error);
    showStatus('Failed to save settings.', 'error');
  }
}

async function testConnection() {
  const apiUrl = document.getElementById('api-url').value.trim().replace(/\/$/, '');
  
  if (!apiUrl) {
    showStatus('Please enter an API URL first.', 'error');
    return;
  }
  
  showStatus('Testing connection...', 'loading');
  
  try {
    const response = await fetch(`${apiUrl}/api/groups`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const groups = await response.json();
    showStatus(`Connection successful! Found ${groups.length} group(s). ✓`, 'success');
    
  } catch (error) {
    console.error('Connection test failed:', error);
    showStatus(`Connection failed: ${error.message}. Check the URL and try again.`, 'error');
  }
}

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;
  status.classList.remove('hidden');
}
