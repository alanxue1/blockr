// Blocked page script
// Handles displaying blocked URL and recording the attempt

// Display the blocked URL
function displayBlockedUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const blockedUrl = urlParams.get("url") || "this site";

  console.log("All URL params:", urlParams.toString());
  console.log("Blocked URL from params:", blockedUrl);

  const urlDisplay = document.getElementById("blockedUrl");
  if (urlDisplay) {
    urlDisplay.textContent = blockedUrl;
  }
}

// Go back to previous page
function goBack() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.close();
  }
}

// Open extension popup (if possible)
function openExtension() {
  // This might not work in all contexts, but we can try
  if (chrome.runtime) {
    chrome.runtime.openOptionsPage();
  }
}

// Record the blocked attempt (backup - main tracking should happen via webRequest)
async function recordAttempt() {
  const urlParams = new URLSearchParams(window.location.search);
  const blockedUrl = urlParams.get("url");

  if (blockedUrl) {
    console.log("✅ URL parameter tracking worked for:", blockedUrl);
    return;
  }

  // Backup tracking using storage-based method
  try {
    const result = await chrome.storage.local.get(["blockedSites"]);
    const blockedSites = result.blockedSites || [];

    if (blockedSites.length === 0) {
      console.log("No blocked sites configured");
      return;
    }

    // Use storage-based tracking - check which site has recent activity
    const today = new Date().toISOString().split("T")[0];
    const storageResult = await chrome.storage.local.get([today]);
    const todayData = storageResult[today] || {};

    // Find which blocked site has activity (indicating it was recently accessed)
    const activeSites = Object.keys(todayData).filter((site) => {
      if (!blockedSites.includes(site)) return false;

      // Handle both old format (number) and new format (object)
      if (typeof todayData[site] === "number") {
        return todayData[site] > 0;
      } else if (todayData[site] && typeof todayData[site] === "object") {
        return todayData[site].total > 0;
      }
      return false;
    });

    if (activeSites.length > 0) {
      // Use the most active site as fallback
      const fallbackSite = activeSites.reduce((a, b) => {
        const aCount =
          typeof todayData[a] === "number" ? todayData[a] : todayData[a].total;
        const bCount =
          typeof todayData[b] === "number" ? todayData[b] : todayData[b].total;
        return aCount > bCount ? a : b;
      });
      console.log("📈 Storage-based tracking for:", fallbackSite);
      await trackVisitDirectly(fallbackSite);

      // Update display
      const urlDisplay = document.getElementById("blockedUrl");
      if (urlDisplay) {
        urlDisplay.textContent = fallbackSite;
      }
    } else {
      // If no activity yet, track the first blocked site
      const firstSite = blockedSites[0];
      console.log("📈 First-visit tracking for:", firstSite);
      await trackVisitDirectly(firstSite);

      // Update display
      const urlDisplay = document.getElementById("blockedUrl");
      if (urlDisplay) {
        urlDisplay.textContent = firstSite;
      }
    }
  } catch (error) {
    console.log("❌ Backup tracking failed:", error);
  }
}

// Direct storage tracking function with hourly granularity
async function trackVisitDirectly(site) {
  try {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const hour = now.getHours(); // 0-23

    const result = await chrome.storage.local.get([today]);
    const todayData = result[today] || {};

    // Initialize site data with hourly tracking if it doesn't exist or convert old format
    if (!todayData[site] || typeof todayData[site] === "number") {
      // Handle old format (just a number) or missing data
      const oldCount =
        typeof todayData[site] === "number" ? todayData[site] : 0;
      todayData[site] = {
        total: oldCount,
        hourly: Array(24).fill(0), // Array for 24 hours (0-23)
      };
    }

    // Increment total and hourly count
    todayData[site].total++;
    todayData[site].hourly[hour]++;

    await chrome.storage.local.set({ [today]: todayData });

    console.log(
      `📊 Direct tracking: ${site} now has ${todayData[site].total} attempts today (Hour ${hour}: ${todayData[site].hourly[hour]})`
    );
  } catch (error) {
    console.log("❌ Direct tracking failed:", error);
  }
}

// Initialize page
document.addEventListener("DOMContentLoaded", () => {
  displayBlockedUrl();
  recordAttempt();

  // Add event listeners
  document.getElementById("goBackBtn").addEventListener("click", goBack);
  document
    .getElementById("openExtensionBtn")
    .addEventListener("click", openExtension);
});
