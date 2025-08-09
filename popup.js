// Website Blocker and Tracker - Popup Script
// Simple analytics with website blocking stats

let currentTab = "stats";

// Initialize the popup when DOM is loaded
document.addEventListener("DOMContentLoaded", async function () {
  try {
    setupTabs();
    setupForm();

    // Set initial state
    setInitialState();

    // Load data
    await loadVisitData();
    await loadBlockedSites();
  } catch (error) {
    console.error("Error initializing popup:", error);
    showError("Failed to load data");
  }
});

// Set initial UI state before loading data
function setInitialState() {
  const statusMessage = document.getElementById("statusMessage");
  const totalAttempts = document.getElementById("totalAttempts");

  statusMessage.textContent = "No blocked attempts today";
  totalAttempts.textContent = "0 attempts blocked today";

  // Render empty chart
  renderSimpleChart({});
}

// Setup tab switching functionality
function setupTabs() {
  const statsTab = document.getElementById("statsTab");
  const manageTab = document.getElementById("manageTab");
  const statsView = document.getElementById("statsView");
  const manageView = document.getElementById("manageView");

  statsTab.addEventListener("click", () => {
    switchTab("stats");
  });

  manageTab.addEventListener("click", () => {
    switchTab("manage");
  });

  function switchTab(tab) {
    currentTab = tab;

    if (tab === "stats") {
      statsTab.className =
        "px-6 py-3 text-sm font-medium bg-white text-gray-900 rounded-lg";
      manageTab.className =
        "px-6 py-3 text-sm font-medium bg-gray-700 text-white rounded-lg ml-3";
      statsView.classList.remove("hidden");
      manageView.classList.add("hidden");
    } else {
      manageTab.className =
        "px-6 py-3 text-sm font-medium bg-white text-gray-900 rounded-lg ml-3";
      statsTab.className =
        "px-6 py-3 text-sm font-medium bg-gray-700 text-white rounded-lg";
      manageView.classList.remove("hidden");
      statsView.classList.add("hidden");
    }
  }
}

// Setup form handling
function setupForm() {
  const form = document.getElementById("addSiteForm");
  const input = document.getElementById("siteInput");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const site = input.value.trim().toLowerCase();

    if (site) {
      await addBlockedSite(site);
      input.value = "";
    }
  });
}

// Load visit data from storage directly
async function loadVisitData() {
  try {
    console.log("Loading visit data...");

    // Try direct storage access first
    const today = new Date().toISOString().split("T")[0];
    console.log("Looking for data for date:", today);

    const result = await chrome.storage.local.get([today]);
    console.log("Direct storage result:", result);

    const visitData = result[today] || {};
    console.log("Processing visit data:", visitData);

    // Filter out invalid URLs and handle both old and new data formats
    const cleanedData = {};
    for (const [site, data] of Object.entries(visitData)) {
      // Skip the random blocked page URLs
      if (!site.includes("ckaikkhf") && !site.match(/^[a-z]{20,}$/)) {
        // Handle both old format (number) and new format (object with total/hourly)
        if (typeof data === "number") {
          // Old format - convert to new format
          cleanedData[site] = {
            total: data,
            hourly: Array(24).fill(0), // No hourly data available for old entries
          };
        } else if (data && typeof data === "object" && data.total) {
          // New format
          cleanedData[site] = data;
        }
      } else {
        console.log("Filtered out invalid site:", site);
      }
    }

    console.log("Cleaned visit data:", cleanedData);

    // Update UI with the cleaned data
    updateUI(cleanedData);
    renderSimpleChart(cleanedData);
  } catch (error) {
    console.error("Error loading visit data:", error);
    showError("Error loading visit data");
  }
}

// Update UI elements with visit data
function updateUI(visitData) {
  const statusMessage = document.getElementById("statusMessage");
  const totalAttempts = document.getElementById("totalAttempts");

  const sites = Object.keys(visitData);
  const totalCount = Object.values(visitData).reduce(
    (sum, data) => sum + (data.total || 0),
    0
  );

  if (totalCount === 0) {
    statusMessage.textContent = "No blocked attempts today";
    totalAttempts.textContent = "0 attempts blocked today";
  } else {
    statusMessage.textContent = `${sites.length} site${
      sites.length !== 1 ? "s" : ""
    } blocked`;
    totalAttempts.textContent = `${totalCount} attempt${
      totalCount !== 1 ? "s" : ""
    } blocked today`;
  }
}

// Render simple website list sorted by block count
function renderSimpleChart(visitData) {
  const container = document.getElementById("simpleChart");

  // Clear existing content
  container.innerHTML = "";

  const sites = Object.keys(visitData);

  if (sites.length === 0) {
    container.innerHTML = `
      <div class="text-center text-gray-400 py-6">
        <div class="text-3xl mb-2">🎯</div>
        <div class="font-medium">No blocked attempts yet</div>
        <div class="text-sm mt-1 text-gray-500">Visit a blocked site to see stats here</div>
      </div>
    `;
    return;
  }

  // Sort sites by total count (highest first)
  const sortedData = sites
    .map((site) => ({
      site,
      total: visitData[site].total || visitData[site], // Handle both old and new format
    }))
    .sort((a, b) => b.total - a.total);

  // Create simple list items
  const listItems = sortedData
    .map(({ site, total }) => {
      return `
      <div class="flex items-center justify-between py-3 px-4 bg-gray-700 rounded-lg border border-gray-600 hover:bg-gray-600 transition-colors">
        <div class="flex items-center space-x-3">
          <div class="w-2.5 h-2.5 rounded-full bg-white flex-shrink-0"></div>
          <span class="font-medium text-white">${truncateSiteName(site)}</span>
        </div>
        <span class="text-sm font-semibold text-gray-300">${total}</span>
      </div>
    `;
    })
    .join("");

  container.innerHTML = `
    <div class="space-y-2">
      ${listItems}
    </div>
  `;

  // Add summary footer
  const totalAttempts = sortedData.reduce((sum, item) => sum + item.total, 0);
  const summaryDiv = document.createElement("div");
  summaryDiv.className = "mt-4 pt-3 border-t border-gray-600 text-center";
  summaryDiv.innerHTML = `
    <div class="text-sm text-gray-400">
      <span class="font-semibold text-white">${totalAttempts}</span> total blocks across 
      <span class="font-semibold text-white">${sites.length}</span> 
      ${sites.length === 1 ? "website" : "websites"} today
    </div>
  `;
  container.appendChild(summaryDiv);
}

// Truncate site names for better display and remove .com
function truncateSiteName(siteName) {
  // Remove .com, .org, .net, etc.
  let cleanName = siteName.replace(/\.(com|org|net|edu|gov|io|co|uk)$/, "");

  if (cleanName.length <= 15) {
    return cleanName;
  }
  return cleanName.substring(0, 15) + "...";
}

// Show error message
function showError(message) {
  const statusMessage = document.getElementById("statusMessage");
  const totalAttempts = document.getElementById("totalAttempts");

  statusMessage.textContent = message;
  statusMessage.className = "text-sm text-red-600";
  totalAttempts.textContent = "Please try again";
}

// Add a new site to block list
async function addBlockedSite(site) {
  try {
    // Clean up the site input
    site = site
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/$/, "");

    // Get current blocked sites
    const result = await chrome.storage.local.get(["blockedSites"]);
    const blockedSites = result.blockedSites || [];

    // Check if site already exists
    if (blockedSites.includes(site)) {
      showMessage("Site already blocked", "warning");
      return;
    }

    // Add the new site
    blockedSites.push(site);
    await chrome.storage.local.set({ blockedSites });

    // Notify background script to update blocked sites
    chrome.runtime.sendMessage({
      action: "updateBlockedSites",
      sites: blockedSites,
    });

    // Refresh the blocked sites list
    await loadBlockedSites();
    showMessage("Site added successfully", "success");
  } catch (error) {
    console.error("Error adding blocked site:", error);
    showMessage("Error adding site", "error");
  }
}

// Remove a site from block list
async function removeBlockedSite(site) {
  try {
    const result = await chrome.storage.local.get(["blockedSites"]);
    const blockedSites = result.blockedSites || [];

    const updatedSites = blockedSites.filter((s) => s !== site);
    await chrome.storage.local.set({ blockedSites: updatedSites });

    // Notify background script to update blocked sites
    chrome.runtime.sendMessage({
      action: "updateBlockedSites",
      sites: updatedSites,
    });

    // Refresh the blocked sites list
    await loadBlockedSites();
    showMessage("Site removed successfully", "success");
  } catch (error) {
    console.error("Error removing blocked site:", error);
    showMessage("Error removing site", "error");
  }
}

// Load and display blocked sites
async function loadBlockedSites() {
  try {
    const result = await chrome.storage.local.get(["blockedSites"]);
    const blockedSites = result.blockedSites || [];

    const listContainer = document.getElementById("blockedSitesList");
    const noSitesMessage = document.getElementById("noSitesMessage");

    // Clear existing content
    listContainer.innerHTML = "";

    if (blockedSites.length === 0) {
      noSitesMessage.classList.remove("hidden");
      return;
    }

    noSitesMessage.classList.add("hidden");

    // Create list items for each blocked site
    blockedSites.forEach((site) => {
      const siteItem = document.createElement("div");
      siteItem.className =
        "flex items-center justify-between p-3 bg-gray-700 rounded-lg";

      siteItem.innerHTML = `
        <span class="text-sm text-white flex-1 truncate">${site}</span>
        <button 
          class="ml-3 px-3 py-2 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 remove-btn"
          data-site="${site}"
        >
          Remove
        </button>
      `;

      // Add event listener to the remove button
      const removeBtn = siteItem.querySelector(".remove-btn");
      removeBtn.addEventListener("click", () => removeBlockedSite(site));

      listContainer.appendChild(siteItem);
    });
  } catch (error) {
    console.error("Error loading blocked sites:", error);
    showMessage("Error loading blocked sites", "error");
  }
}

// Show temporary message to user
function showMessage(message, type = "info") {
  // Create message element
  const messageEl = document.createElement("div");
  messageEl.className = `fixed top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-md text-sm z-50 ${
    type === "success"
      ? "bg-green-600 text-white border border-green-500"
      : type === "warning"
      ? "bg-yellow-600 text-white border border-yellow-500"
      : type === "error"
      ? "bg-red-600 text-white border border-red-500"
      : "bg-blue-600 text-white border border-blue-500"
  }`;
  messageEl.textContent = message;

  document.body.appendChild(messageEl);

  // Remove after 3 seconds
  setTimeout(() => {
    if (messageEl.parentNode) {
      messageEl.parentNode.removeChild(messageEl);
    }
  }, 3000);
}
