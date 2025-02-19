try {
  // Firefox uses browser namespace instead of chrome
  browser.browserAction.onClicked.addListener(async (tab) => {
      await browser.tabs.sendMessage(tab.id, {
          action: "toggleIframe"
      });
  });

} catch (e) {
  console.error(`Error in background script: ${e}`);
}