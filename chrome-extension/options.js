// Options page script for E-Visa Form Filler Extension

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  setupEventListeners();
  await checkAuthStatus();
});

async function loadSettings() {
  const result = await chrome.storage.sync.get(['apiUrl']);
  if (result.apiUrl) {
    document.getElementById('api-url').value = result.apiUrl;
  }
}

function setupEventListeners() {
  // Save API URL form
  document.getElementById('api-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveApiUrl();
  });
  
  // Login form
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await login();
  });
  
  // Logout button
  document.getElementById('logout-btn').addEventListener('click', logout);
  
  // Test connection button
  document.getElementById('test-connection').addEventListener('click', testConnection);
}

async function saveApiUrl() {
  const apiUrl = document.getElementById('api-url').value.trim().replace(/\/$/, '');
  
  if (!apiUrl) {
    showStatus('auth-status', 'Please enter an API URL.', 'error');
    return;
  }
  
  try {
    await chrome.storage.sync.set({ apiUrl });
    showStatus('auth-status', 'API URL saved! Now login with your credentials.', 'success');
  } catch (error) {
    console.error('Error saving settings:', error);
    showStatus('auth-status', 'Failed to save settings.', 'error');
  }
}

async function login() {
  const apiUrl = document.getElementById('api-url').value.trim().replace(/\/$/, '');
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  
  if (!apiUrl) {
    showStatus('auth-status', 'Please save the API URL first.', 'error');
    return;
  }
  
  if (!email || !password) {
    showStatus('auth-status', 'Please enter email and password.', 'error');
    return;
  }
  
  showStatus('auth-status', 'Logging in...', 'loading');
  
  try {
    const response = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Login failed');
    }
    
    const data = await response.json();
    
    // Save token and user info
    await chrome.storage.sync.set({
      authToken: data.access_token,
      user: data.user
    });
    
    showStatus('auth-status', 'Login successful! ✓', 'success');
    
    // Update UI
    await checkAuthStatus();
    
    // Clear password field
    document.getElementById('password').value = '';
    
  } catch (error) {
    console.error('Login failed:', error);
    showStatus('auth-status', `Login failed: ${error.message}`, 'error');
  }
}

async function logout() {
  try {
    await chrome.storage.sync.remove(['authToken', 'user']);
    showStatus('auth-status', 'Logged out successfully.', 'success');
    await checkAuthStatus();
  } catch (error) {
    console.error('Logout failed:', error);
    showStatus('auth-status', 'Failed to logout.', 'error');
  }
}

async function checkAuthStatus() {
  const result = await chrome.storage.sync.get(['authToken', 'user', 'apiUrl']);
  
  const loginSection = document.getElementById('login-section');
  const loggedInSection = document.getElementById('logged-in-section');
  
  if (result.authToken && result.user) {
    // User is logged in
    loginSection.classList.add('hidden');
    loggedInSection.classList.remove('hidden');
    
    // Update user info display
    document.getElementById('user-name').textContent = result.user.name || 'User';
    document.getElementById('user-email').textContent = result.user.email || '';
    document.getElementById('user-role').textContent = result.user.role?.replace(/_/g, ' ') || 'User';
    document.getElementById('user-avatar').textContent = (result.user.name || 'U').charAt(0).toUpperCase();
    
    // Verify token is still valid
    if (result.apiUrl) {
      try {
        const response = await fetch(`${result.apiUrl}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${result.authToken}`
          }
        });
        
        if (!response.ok) {
          // Token expired, logout
          await logout();
          showStatus('auth-status', 'Session expired. Please login again.', 'error');
        }
      } catch (error) {
        console.error('Token validation failed:', error);
      }
    }
  } else {
    // User is not logged in
    loginSection.classList.remove('hidden');
    loggedInSection.classList.add('hidden');
  }
}

async function testConnection() {
  const result = await chrome.storage.sync.get(['apiUrl', 'authToken']);
  const apiUrl = result.apiUrl;
  const token = result.authToken;
  
  if (!apiUrl) {
    showStatus('connection-status', 'Please save the API URL first.', 'error');
    return;
  }
  
  if (!token) {
    showStatus('connection-status', 'Please login first.', 'error');
    return;
  }
  
  showStatus('connection-status', 'Testing connection...', 'loading');
  
  try {
    const response = await fetch(`${apiUrl}/api/groups`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Authentication failed. Please login again.');
      }
      throw new Error(`HTTP ${response.status}`);
    }
    
    const groups = await response.json();
    showStatus('connection-status', `Connection successful! Found ${groups.length} group(s). ✓`, 'success');
    
  } catch (error) {
    console.error('Connection test failed:', error);
    showStatus('connection-status', `Connection failed: ${error.message}`, 'error');
  }
}

function showStatus(elementId, message, type) {
  const status = document.getElementById(elementId);
  status.textContent = message;
  status.className = `status ${type}`;
  status.classList.remove('hidden');
}
