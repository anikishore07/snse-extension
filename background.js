// Background service worker for SNSE extension
// Opens the side panel when the extension icon is clicked

if (chrome && chrome.action && chrome.sidePanel) {
  chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ windowId: tab.windowId });
  });
} else {
  console.warn('SNSE: chrome.action or chrome.sidePanel API is unavailable.');
}

