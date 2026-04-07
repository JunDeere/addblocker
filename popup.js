async function getBlocklist() {
  const data = await chrome.storage.sync.get(["blocklist"]);
  return Array.isArray(data.blocklist) ? data.blocklist : [];
}

async function saveBlocklist(blocklist) {
  await chrome.storage.sync.set({ blocklist });

  const response = await chrome.runtime.sendMessage({ type: "refreshRules" });

  const status = document.getElementById("status");
  if (response?.ok) {
    status.textContent = "Saved successfully.";
  } else {
    status.textContent = "Saved, but rules may not have refreshed properly.";
  }

  setTimeout(() => {
    status.textContent = "";
  }, 2000);
}

function createItem(pattern, index, blocklist) {
  const item = document.createElement("div");
  item.className = "item";

  const text = document.createElement("div");
  text.className = "pattern";
  text.textContent = pattern;

  const actions = document.createElement("div");
  actions.className = "actions";

  const editBtn = document.createElement("button");
  editBtn.textContent = "Edit";
  editBtn.addEventListener("click", async () => {
    const updated = prompt("Edit blocked pattern:", pattern);
    if (updated === null) return;

    const trimmed = updated.trim();
    if (!trimmed) return;

    blocklist[index] = trimmed;
    await saveBlocklist(blocklist);
    await renderList();
  });

  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "Delete";
  deleteBtn.addEventListener("click", async () => {
    blocklist.splice(index, 1);
    await saveBlocklist(blocklist);
    await renderList();
  });

  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);

  item.appendChild(text);
  item.appendChild(actions);

  return item;
}

async function renderList() {
  const list = document.getElementById("list");
  list.innerHTML = "";

  const blocklist = await getBlocklist();

  if (!blocklist.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No blocked links yet.";
    list.appendChild(empty);
    return;
  }

  blocklist.forEach((pattern, index) => {
    const item = createItem(pattern, index, blocklist);
    list.appendChild(item);
  });
}

document.getElementById("addBtn").addEventListener("click", async () => {
  const input = document.getElementById("newPattern");
  const value = input.value.trim();

  if (!value) return;

  const blocklist = await getBlocklist();

  if (!blocklist.includes(value)) {
    blocklist.push(value);
    await saveBlocklist(blocklist);
    input.value = "";
    await renderList();
  }
});

document.getElementById("newPattern").addEventListener("keydown", async (e) => {
  if (e.key === "Enter") {
    document.getElementById("addBtn").click();
  }
});

renderList();