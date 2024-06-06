try {
  self.addEventListener('install', () => {
      self.skipWaiting();
  });

  self.addEventListener('activate', event => {
      event.waitUntil(self.clients.claim());
  });

  chrome.action.onClicked.addListener(async (tab) => {
      await chrome.tabs.sendMessage(tab.id, {
          action: "toggleIframe"
      });
  });

} catch (e) {
  console.error(`Error in background service worker: ${e}`);
}