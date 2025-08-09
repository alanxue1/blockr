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
  console.log("Startup: Loaded blocked sites:", currentBlockedSites);
  await updateBlockingRules(currentBlockedSites);
});

// Also load on service worker startup
(async () => {
  const result = await chrome.storage.local.get(["blockedSites"]);
  currentBlockedSites = result.blockedSites || DEFAULT_BLOCKED_SITES;
  console.log(
    "Service worker startup: Loaded blocked sites:",
    currentBlockedSites
  );
  await updateBlockingRules(currentBlockedSites);
})();

// Update blocking rules - now using webRequest instead of declarativeNetRequest
async function updateBlockingRules(sites) {
  try {
    // Remove any existing declarativeNetRequest rules
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const ruleIdsToRemove = existingRules.map((rule) => rule.id);

    if (ruleIdsToRemove.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIdsToRemove,
      });
    }

    console.log(`Updated blocked sites list: ${sites.length} sites`);
    console.log("Sites:", sites);
    console.log("Now using webRequest API for blocking");
  } catch (error) {
    console.error("Error updating blocking rules:", error);
  }
}

// Listen for web requests to track and block
chrome.webRequest.onBeforeRequest.addListener(
  async (details) => {
    console.log(
      "🌐 WebRequest onBeforeRequest fired for:",
      details.url,
      "Type:",
      details.type
    );

    if (details.type === "main_frame") {
      try {
        const url = new URL(details.url);
        const hostname = url.hostname.replace(/^www\./, "");

        console.log(
          "🌐 Processing main_frame request to:",
          hostname,
          "Full URL:",
          details.url
        );
        console.log("🌐 Current blocked sites:", currentBlockedSites);

        // Check if this site is blocked
        const isBlocked = currentBlockedSites.some(
          (site) => hostname === site || hostname.endsWith("." + site)
        );

        console.log("🌐 Is blocked?", isBlocked);

        if (isBlocked) {
          console.log(
            "🚫 BLOCKING: Site is blocked, tracking visit attempt for:",
            hostname
          );
          await trackVisitAttempt(hostname);
          console.log("✅ Visit attempt tracked successfully");

          const redirectUrl = chrome.runtime.getURL(
            `blocked.html?url=${encodeURIComponent(hostname)}`
          );
          console.log("🔄 Redirecting to:", redirectUrl);

          // Return redirect to blocked page
          return {
            redirectUrl: redirectUrl,
          };
        } else {
          console.log("✅ ALLOWING: Site is not blocked:", hostname);
        }
      } catch (error) {
        console.error("❌ Error processing web request:", error);
      }
    }
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);

// Keep the webNavigation listener as backup
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  console.log("webNavigation.onBeforeNavigate fired (backup):", {
    url: details.url,
    frameId: details.frameId,
    tabId: details.tabId,
  });
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

// Function to track visit attempts with hourly granularity
async function trackVisitAttempt(site) {
  try {
    const now = new Date();
    const today = now.toISOString().split("T")[0]; // Format: YYYY-MM-DD
    const hour = now.getHours(); // 0-23
    console.log(
      "📊 Tracking visit attempt for:",
      site,
      "on date:",
      today,
      "at hour:",
      hour
    );

    // Get existing data from storage
    const result = await chrome.storage.local.get([today]);
    const todayData = result[today] || {};
    console.log("📦 Existing data for today:", todayData);

    // Initialize site data with hourly tracking if it doesn't exist
    if (!todayData[site]) {
      todayData[site] = {
        total: 0,
        hourly: Array(24).fill(0), // Array for 24 hours (0-23)
      };
    }

    // Increment total and hourly count
    todayData[site].total++;
    todayData[site].hourly[hour]++;

    console.log(
      "📈 Updated counts for",
      site,
      "- Total:",
      todayData[site].total,
      "Hour",
      hour + ":",
      todayData[site].hourly[hour]
    );

    // Save back to storage
    await chrome.storage.local.set({ [today]: todayData });
    console.log("💾 Saved to storage:", { [today]: todayData });

    // Verify it was saved
    const verification = await chrome.storage.local.get([today]);
    console.log("✓ Verification - data in storage:", verification);

    console.log(
      `🎯 SUCCESS: Blocked attempt to visit ${site}. Total attempts today: ${todayData[site].total}`
    );
  } catch (error) {
    console.error("❌ Error tracking visit attempt:", error);
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

      console.log("Received recordBlockedAttempt message with URL:", url);

      if (url.startsWith("http")) {
        hostname = new URL(url).hostname.replace(/^www\./, "");
      } else {
        hostname = url.replace(/^www\./, "");
      }

      console.log("Extracted hostname:", hostname);

      await trackVisitAttempt(hostname);
      console.log("Visit attempt tracked successfully");
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
    console.log("Getting visit data for date:", today);

    const result = await chrome.storage.local.get([today]);
    console.log("Storage result:", result);

    const visitData = result[today] || {};
    console.log("Returning visit data:", visitData);

    return visitData;
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
