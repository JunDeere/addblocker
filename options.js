async function loadBlocklist() {
  const data = await chrome.storage.sync.get(["blocklist"]);
  const blocklist = Array.isArray(data.blocklist) ? data.blocklist : [];
  document.getElementById("blocklist").value = blocklist.join("\n");
}

async function saveBlocklist() {
  const raw = document.getElementById("blocklist").value;
  const lines = raw
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean);

  await chrome.storage.sync.set({ blocklist: lines });

  const response = await chrome.runtime.sendMessage({ type: "refreshRules" });

  const status = document.getElementById("status");
  if (response?.ok) {
    status.textContent = "Saved.";
  } else {
    status.textContent = "Saved, but rule refresh had an issue: " + (response?.error || "Unknown error");
  }
}

document.getElementById("saveBtn").addEventListener("click", saveBlocklist);
loadBlocklist();