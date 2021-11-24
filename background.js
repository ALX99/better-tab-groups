const GROUP_TABS_BY_HOST_ID = "group-tabs-by-host";
const SET_GROUP_TITLE_ID = "set-group-title";
const AUTO_SORT_ID = "auto-sort";
let groupTabsByHost = false;
let autoSort = false;
let createGroupTitle = false;

// Setup listeners
chrome.runtime.onInstalled.addListener(onInstalled);
chrome.commands.onCommand.addListener(command => handleCmd(command));
chrome.contextMenus.onClicked.addListener((info, tabs) =>
  onContextMenusClicked(info, tabs)
);
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) =>
  onUpdated(tabId, changeInfo, tab)
);

function onInstalled() {
  chrome.contextMenus.create({
    id: AUTO_SORT_ID,
    checked: autoSort,
    type: "checkbox",
    title: "Auto sort",
    contexts: ["all"],
  });

  chrome.contextMenus.create({
    id: GROUP_TABS_BY_HOST_ID,
    checked: groupTabsByHost,
    type: "checkbox",
    title: "Group tabs by host",
    contexts: ["all"],
  });

  chrome.contextMenus.create({
    id: SET_GROUP_TITLE_ID,
    checked: groupTabsByHost,
    type: "checkbox",
    title: "Set group title",
    contexts: ["all"],
    enabled: createGroupTitle,
  });
}

async function onUpdated(tabId, changeInfo, tab) {
  console.log(
    "onUpdated called",
    autoSort,
    groupTabsByHost,
    createGroupTitle,
    changeInfo
  );

  if (!autoSort) return;
  if (changeInfo.hasOwnProperty("url")) {
    let tabs = await getWindowTabs();
    if (groupTabsByHost) groupTabs(tabs);
    else sortTabs(tabs);
  }
}

function onContextMenusClicked(info, tabs) {
  switch (info.menuItemId) {
    case GROUP_TABS_BY_HOST_ID:
      groupTabsByHost = info.checked;
      chrome.contextMenus.update(SET_GROUP_TITLE_ID, {
        enabled: groupTabsByHost,
      });
      break;

    case AUTO_SORT_ID:
      autoSort = info.checked;
      break;

    case SET_GROUP_TITLE_ID:
      createGroupTitle = info.checked;
      break;

    default:
      break;
  }
}

async function handleCmd(command) {
  switch (command) {
    case "sort-tabs":
      let tabs = await getWindowTabs();
      if (groupTabsByHost) groupTabs(tabs);
      else sortTabs(tabs);
      break;

    case "toggle-auto-groups-tabs":
      groupTabsByHost = !groupTabsByHost;
      chrome.contextMenus.update(GROUP_TABS_BY_HOST_ID, {
        checked: groupTabsByHost,
      });
      chrome.contextMenus.update(SET_GROUP_TITLE_ID, {
        enabled: groupTabsByHost,
      });
      break;

    case "ungroup-tabs":
      ungroupTabs(await getWindowTabs());
      break;

    default:
      break;
  }
}

async function groupTabs(tabs) {
  const hostMap = new Map();

  // Parse the URLs of all tabs into hostMap
  tabs.forEach(tab => {
    let host = new URL(tab.url).host;
    if (hostMap.has(host)) hostMap.get(host).push(tab);
    else hostMap.set(host, [tab]);
  });

  let tabIdsToUngroup = [];
  for (const [host, tabs] of hostMap.entries()) {
    // Only create a tab group if we have more than a single
    // tab for one domain
    if (tabs.length === 1) {
      tabIdsToUngroup.push(tabs[0].id);
      continue;
    }

    let hostname = "";
    hostSplit = host.split(".");

    // TODO find a better way to get the name of the site
    if (createGroupTitle) {
      if (hostSplit.length == 0) hostname = hostSplit[0];
      else if (hostSplit.length == 1)
        hostname = hostSplit[hostSplit.length - 1];
      else hostname = hostSplit[hostSplit.length - 2];
    }

    chrome.tabs.group({ tabIds: tabs.map(tab => tab.id) }, groupId =>
      chrome.tabGroups.update(groupId, { title: hostname })
    );
  }
  chrome.tabs.ungroup(tabIdsToUngroup);
}

async function ungroupTabs(tabs) {
  chrome.tabs.ungroup(tabs.map(tab => tab.id));
}

function getWindowTabs() {
  return chrome.tabs.query({ currentWindow: true });
}

function sortTabs(tabs) {
  ungroupTabs(tabs);
  tabs.sort((a, b) => {
    if (a.url < b.url) return -1;
    else if (a.url > b.url) return 1;
    else return 0;
  });

  tabs.forEach(tab => {
    chrome.tabs.move(tab.id, {
      index: tabs.length * 2,
    });
  });
}
