// Website Blocker and Tracker - Background Service Worker
// Blocks specified websites using declarativeNetRequest API and tracks daily visit attempts

// Default list of websites to block (used for initial setup)
const DEFAULT_BLOCKED_SITES = [
  "example.com",
  "blocked-site.com",
  "facebook.com",
  "twitter.com",
  "youtube.com",
];

let currentBlockedSites = [];

// Initialize the extension
chrome.runtime.onInstalled.addListener(async () => {
  console.log("Website Blocker and Tracker installed");

  // Initialize blocked sites list if it doesn't exist
  const result = await chrome.storage.local.get(["blockedSites"]);
  if (!result.blockedSites) {
    await chrome.storage.local.set({ blockedSites: DEFAULT_BLOCKED_SITES });
    currentBlockedSites = DEFAULT_BLOCKED_SITES;
  } else {
    currentBlockedSites = result.blockedSites;
  }

  // Create initial blocking rules
  await updateBlockingRules(currentBlockedSites);
  console.log("Initialized with blocked sites:", currentBlockedSites);
});

// Load blocked sites on startup
chrome.runtime.onStartup.addListener(async () => {
  const result = await chrome.storage.local.get(["blockedSites"]);
  currentBlockedSites = result.blockedSites || DEFAULT_BLOCKED_SITES;
  await updateBlockingRules(currentBlockedSites);
});

// Update declarativeNetRequest rules based on blocked sites
async function updateBlockingRules(sites) {
  try {
    // Remove all existing rules
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const ruleIdsToRemove = existingRules.map((rule) => rule.id);

    if (ruleIdsToRemove.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIdsToRemove,
      });
    }

    // Create new rules for each blocked site
    const newRules = sites.map((site, index) => ({
      id: index + 1,
      priority: 1,
      action: {
        type: "redirect",
        redirect: {
          url: chrome.runtime.getURL("blocked.html"),
        },
      },
      condition: {
        urlFilter: `*://*.${site}/*`,
        resourceTypes: ["main_frame"],
      },
    }));

    // Also block exact domain matches (without subdomains)
    const exactDomainRules = sites.map((site, index) => ({
      id: index + sites.length + 1,
      priority: 1,
      action: {
        type: "redirect",
        redirect: {
          url: chrome.runtime.getURL("blocked.html"),
        },
      },
      condition: {
        urlFilter: `*://${site}/*`,
        resourceTypes: ["main_frame"],
      },
    }));

    const allRules = [...newRules, ...exactDomainRules];

    if (allRules.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: allRules,
      });
    }

    console.log(`Updated blocking rules for ${sites.length} sites`);
  } catch (error) {
    console.error("Error updating blocking rules:", error);
  }
}

// Listen for navigation events to track blocked attempts
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId === 0) {
    // Only track main frame navigations
    const url = new URL(details.url);
    const hostname = url.hostname.replace(/^www\./, "");

    // Check if this site is blocked
    const isBlocked = currentBlockedSites.some(
      (site) => hostname === site || hostname.endsWith("." + site)
    );

    if (isBlocked) {
      await trackVisitAttempt(hostname);
    }
  }
});

// Also listen for completed navigations to catch redirects to blocked page
chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId === 0) {
    const url = new URL(details.url);

    // Check if this is our blocked page
    if (url.pathname.includes("blocked.html")) {
      const blockedUrl = url.searchParams.get("url");
      if (blockedUrl) {
        try {
          const blockedHostname = new URL(blockedUrl).hostname.replace(
            /^www\./,
            ""
          );
          await trackVisitAttempt(blockedHostname);
        } catch (error) {
          console.log("Could not parse blocked URL:", blockedUrl);
        }
      }
    }
  }
});

// Function to track visit attempts
async function trackVisitAttempt(site) {
  try {
    const today = new Date().toISOString().split("T")[0]; // Format: YYYY-MM-DD

    // Get existing data from storage
    const result = await chrome.storage.local.get([today]);
    const todayData = result[today] || {};

    // Increment count for this site
    todayData[site] = (todayData[site] || 0) + 1;

    // Save back to storage
    await chrome.storage.local.set({ [today]: todayData });

    console.log(
      `Blocked attempt to visit ${site}. Total attempts today: ${todayData[site]}`
    );
  } catch (error) {
    console.error("Error tracking visit attempt:", error);
  }
}

// Function to get visit data for popup (exposed via messaging)
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === "getVisitData") {
    getVisitData().then(sendResponse);
    return true; // Indicates we will send a response asynchronously
  }

  if (request.action === "updateBlockedSites") {
    // Update the current blocked sites list
    currentBlockedSites = request.sites || [];
    await updateBlockingRules(currentBlockedSites);
    console.log("Updated blocked sites:", currentBlockedSites);
    sendResponse({ success: true });
    return true;
  }

  if (request.action === "recordBlockedAttempt") {
    try {
      const url = request.url;
      let hostname;

      if (url.startsWith("http")) {
        hostname = new URL(url).hostname.replace(/^www\./, "");
      } else {
        hostname = url.replace(/^www\./, "");
      }

      await trackVisitAttempt(hostname);
      sendResponse({ success: true });
    } catch (error) {
      console.error("Error recording blocked attempt:", error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  if (request.action === "getBlockedSites") {
    sendResponse(currentBlockedSites);
  }
});

// Helper function to get today's visit data
async function getVisitData() {
  try {
    const today = new Date().toISOString().split("T")[0];
    const result = await chrome.storage.local.get([today]);
    return result[today] || {};
  } catch (error) {
    console.error("Error getting visit data:", error);
    return {};
  }
}

// Clean up old data (keep only last 30 days)
async function cleanupOldData() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const allData = await chrome.storage.local.get();
    const keysToRemove = [];

    for (const key in allData) {
      const keyDate = new Date(key);
      if (keyDate < thirtyDaysAgo) {
        keysToRemove.push(key);
      }
    }

    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
      console.log(`Cleaned up ${keysToRemove.length} old data entries`);
    }
  } catch (error) {
    console.error("Error cleaning up old data:", error);
  }
}

// Run cleanup daily
chrome.alarms.create("dailyCleanup", {
  delayInMinutes: 1,
  periodInMinutes: 1440,
}); // 24 hours
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "dailyCleanup") {
    cleanupOldData();
  }
});
