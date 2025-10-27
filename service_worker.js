chrome.action.onClicked.addListener(async (tab) => {
  // Ensure side panel is open for the current tab
  if (!tab?.id) return;
  await chrome.sidePanel.open({ tabId: tab.id });
  // You could dynamically set a different page like this:
  // await chrome.sidePanel.setOptions({ tabId: tab.id, path: "sidepanel.html" });
});
