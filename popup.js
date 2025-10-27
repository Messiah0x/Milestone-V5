// popup.js — Manifest V3 safe popup handler

async function openSidePanel() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Side Panel (Chrome, Brave with API) -> open it
    if (chrome.sidePanel?.open && tab?.id) {
      await chrome.sidePanel.open({ tabId: tab.id });
    } else {
      // Fallback (older Brave): open our sidepanel page in a new tab
      const url = chrome.runtime.getURL("sidepanel.html");
      await chrome.tabs.create({ url });
    }

    window.close();
  } catch (err) {
    console.error("Error opening side panel:", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("open");
  if (btn) btn.addEventListener("click", openSidePanel);
});
