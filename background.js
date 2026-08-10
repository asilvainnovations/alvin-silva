// ASilva Form Assistant — Background Service Worker (MV3)
// ================================================================
// Handles toolbar-icon clicks. Injects content.js into the active tab
// using activeTab + scripting permissions — the extension has ZERO
// access to any page until the user deliberately clicks the icon.
//
// v2.0 changes:
//   • Toggle behavior: clicking the icon when the panel is already open
//     closes it (instead of injecting a duplicate).
//   • Sends a "ping" message first; if the content script responds,
//     we know it is already loaded and can toggle.
//   • Cleaner error surfacing via badge + console.

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) return;

  // Blocked browser-internal pages where scripting is forbidden
  const blocked = ['chrome://', 'edge://', 'about:', 'chrome-extension://', 'edge-extension://', 'https://chrome.google.com/webstore', 'https://microsoftedge.microsoft.com/addons'];
  if (blocked.some((p) => (tab.url || '').startsWith(p))) {
    showBadge(tab.id, '!', '#c23b3b');
    return;
  }

  try {
    // Try to ping the content script. If it answers, the panel exists
    // and we should toggle (close) it rather than re-injecting.
    await chrome.tabs.sendMessage(tab.id, { action: 'toggle' });
  } catch {
    // Content script not present yet — inject it now.
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    } catch (err) {
      console.error('[ASilva Form Assistant] Injection failed:', err);
      showBadge(tab.id, '!', '#c23b3b');
    }
  }
});

function showBadge(tabId, text, color) {
  chrome.action.setBadgeText({ tabId, text });
  chrome.action.setBadgeBackgroundColor({ tabId, color });
  setTimeout(() => chrome.action.setBadgeText({ tabId, text: '' }), 2500);
}
