// Background script for E-Visa Form Filler Extension
// This script can make cross-origin requests without CORS restrictions

// Track PDF tabs
let pdfTabId = null;
let mainTabId = null;

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
  
  // PDF Download related actions
  if (request.action === 'getTabsCount') {
    chrome.tabs.query({}, (tabs) => {
      mainTabId = sender.tab?.id;
      sendResponse({ count: tabs.length });
    });
    return true;
  }
  
  if (request.action === 'getNewPdfTab') {
    // Find the most recently opened PDF tab
    chrome.tabs.query({ url: '*://*.evisa.iq/*' }, (tabs) => {
      // Look for a PDF tab that was opened after we clicked
      const pdfTab = tabs.find(tab => 
        tab.url && (tab.url.includes('.pdf') || tab.url.includes('insurance') || tab.url.includes('print'))
      );
      
      if (pdfTab) {
        pdfTabId = pdfTab.id;
        sendResponse({ success: true, url: pdfTab.url, tabId: pdfTab.id });
      } else {
        // Check all tabs for PDF
        chrome.tabs.query({}, (allTabs) => {
          const newTab = allTabs.find(tab => 
            tab.id !== mainTabId && 
            tab.url && 
            (tab.url.includes('.pdf') || tab.url.endsWith('.pdf'))
          );
          
          if (newTab) {
            pdfTabId = newTab.id;
            sendResponse({ success: true, url: newTab.url, tabId: newTab.id });
          } else {
            sendResponse({ success: false, error: 'No PDF tab found' });
          }
        });
      }
    });
    return true;
  }
  
  if (request.action === 'downloadPdf') {
    // Download PDF from URL
    fetchPdfAsBase64(request.url)
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        console.error('Background PDF fetch error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (request.action === 'closePdfTab') {
    if (pdfTabId) {
      chrome.tabs.remove(pdfTabId, () => {
        pdfTabId = null;
        sendResponse({ success: true });
      });
    } else {
      sendResponse({ success: true });
    }
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

// Fetch PDF and convert to base64
async function fetchPdfAsBase64(url) {
  try {
    console.log('Background: Fetching PDF from:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    
    // Convert blob to base64 (without data URL prefix)
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Remove the data URL prefix to get just base64
        const base64 = reader.result.split(',')[1];
        console.log('Background: PDF converted to base64, size:', base64.length);
        resolve({
          success: true,
          data: base64,
          mimeType: blob.type || 'application/pdf',
          size: blob.size
        });
      };
      reader.onerror = () => {
        reject(new Error('Failed to read PDF blob'));
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Background: PDF fetch error:', error);
    return { success: false, error: error.message };
  }
}

// Listen for new tabs being created to track PDF tabs
chrome.tabs.onCreated.addListener((tab) => {
  console.log('New tab created:', tab.id, tab.pendingUrl || tab.url);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && (changeInfo.url.includes('.pdf') || changeInfo.url.includes('insurance'))) {
    console.log('PDF tab detected:', tabId, changeInfo.url);
    pdfTabId = tabId;
  }
});

console.log('E-Visa Form Filler background script loaded (v1.5.0 with Insurance Download)');
