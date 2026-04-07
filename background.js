const DNR_RULE_ID_BASE = 1000;

const DEFAULT_BLOCKLIST = [
  "https://example.com/*",
  "*://*.doubleclick.net/*"
];

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.sync.get(["blocklist"]);
  if (!stored.blocklist) {
    await chrome.storage.sync.set({ blocklist: DEFAULT_BLOCKLIST });
  }
  await syncDynamicRules();
});

chrome.runtime.onStartup.addListener(async () => {
  await syncDynamicRules();
});

function wildcardToRegex(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp("^" + escaped + "$", "i");
}

async function getBlocklist() {
  const data = await chrome.storage.sync.get(["blocklist"]);
  return Array.isArray(data.blocklist) ? data.blocklist : DEFAULT_BLOCKLIST;
}

async function isBlockedUrl(url) {
  if (!url || url.startsWith("chrome://") || url.startsWith("brave://") || url.startsWith("edge://")) {
    return false;
  }

  const blocklist = await getBlocklist();

  for (const pattern of blocklist) {
    try {
      const regex = wildcardToRegex(pattern);
      if (regex.test(url)) {
        return true;
      }
    } catch (e) {
      console.warn("Invalid pattern:", pattern, e);
    }
  }

  return false;
}

async function closeIfBlocked(tabId, url) {
  if (!tabId || !url) return;

  const blocked = await isBlockedUrl(url);
  if (blocked) {
    try {
      await chrome.tabs.remove(tabId);
      console.log("Closed blocked tab:", url);
    } catch (err) {
      console.warn("Could not close tab:", err);
    }
  }
}

// Fires when a tab updates its URL/loading state
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const url = changeInfo.url || tab.url;
  await closeIfBlocked(tabId, url);
});

// Fires when a new tab is created
chrome.tabs.onCreated.addListener(async (tab) => {
  if (tab.id && tab.url) {
    await closeIfBlocked(tab.id, tab.url);
  }
});

// Optional: keep blocking requests too
async function syncDynamicRules() {
  const blocklist = await getBlocklist();

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const existingIds = existing.map(rule => rule.id);

  const newRules = blocklist.map((pattern, index) => ({
    id: DNR_RULE_ID_BASE + index,
    priority: 1,
    action: { type: "block" },
    condition: {
      urlFilter: patternToUrlFilter(pattern),
      resourceTypes: [
        "main_frame",
        "sub_frame",
        "script",
        "image",
        "xmlhttprequest",
        "media",
        "font",
        "stylesheet",
        "other"
      ]
    }
  })).filter(rule => !!rule.condition.urlFilter);

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existingIds,
    addRules: newRules
  });
}

function patternToUrlFilter(pattern) {
  // Very simple conversion:
  // https://example.com/* -> ||example.com
  // *://*.example.com/* -> ||example.com
  // fallback: return null if not safely convertible
  try {
    let p = pattern.trim();

    if (!p) return null;

    p = p.replace(/^\*:\/\/\*\./, "");
    p = p.replace(/^https?:\/\/\*\./, "");
    p = p.replace(/^\*:\/\/\*/, "");
    p = p.replace(/^https?:\/\//, "");
    p = p.replace(/\/\*.*$/, "");
    p = p.replace(/\*.*$/, "");
    p = p.replace(/^\*\./, "");

    if (!p) return null;

    return `||${p}`;
  } catch {
    return null;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "refreshRules") {
    syncDynamicRules()
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
});