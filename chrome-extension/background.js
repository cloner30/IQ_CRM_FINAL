// Background script for E-Visa Form Filler Extension
// This script can make cross-origin requests without CORS restrictions

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchImage') {
    // Fetch image from S3 URL
    fetchImageAsBase64(request.url)
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        console.error('Background fetch error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'downloadImage') {
    // Download image using Chrome downloads API
    chrome.downloads.download({
      url: request.url,
      filename: request.filename,
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, downloadId: downloadId });
      }
    });
    return true;
  }
});

// Fetch image and convert to base64 data URL
async function fetchImageAsBase64(url) {
  try {
    console.log('Background: Fetching image from:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    
    // Convert blob to base64
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        console.log('Background: Image converted to base64, size:', reader.result.length);
        resolve({
          success: true,
          dataUrl: reader.result,
          mimeType: blob.type || 'image/jpeg',
          size: blob.size
        });
      };
      reader.onerror = () => {
        reject(new Error('Failed to read blob'));
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Background: Fetch error:', error);
    return { success: false, error: error.message };
  }
}

console.log('E-Visa Form Filler background script loaded');
