// Website Blocker and Tracker - Popup Script
// Simple analytics with CSS bar charts

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
        "px-3 py-1 text-sm font-medium text-teal-600 border-b-2 border-teal-600";
      manageTab.className = "px-3 py-1 text-sm font-medium text-gray-500 ml-4";
      statsView.classList.remove("hidden");
      manageView.classList.add("hidden");
    } else {
      manageTab.className =
        "px-3 py-1 text-sm font-medium text-teal-600 border-b-2 border-teal-600 ml-4";
      statsTab.className = "px-3 py-1 text-sm font-medium text-gray-500";
      manageView.classList.remove("hidden");
      statsView.classList.add("hidden");
    }
  }
}

// Setup form handling
function setupForm() {
  const form = document.getElementById("addSiteForm");
  const input = document.getElementById("siteInput");
  const resetBtn = document.getElementById("resetTodayBtn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const site = input.value.trim().toLowerCase();

    if (site) {
      await addBlockedSite(site);
      input.value = "";
    }
  });

  // Reset today's data button
  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      if (
        confirm(
          "Are you sure you want to clear today's blocking statistics? This cannot be undone."
        )
      ) {
        await resetTodayData();
      }
    });
  } else {
    console.error("Reset button not found in DOM");
  }
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
      <div class="text-center text-gray-500 py-6">
        <div class="text-3xl mb-2">🎯</div>
        <div class="font-medium">No blocked attempts yet</div>
        <div class="text-sm mt-1 text-gray-400">Visit a blocked site to see stats here</div>
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
      <div class="flex items-center justify-between py-2.5 px-3 bg-white rounded-md border border-gray-200 hover:bg-gray-50 transition-colors">
        <div class="flex items-center space-x-3">
          <div class="w-2.5 h-2.5 rounded-full bg-teal-500 flex-shrink-0"></div>
          <span class="font-medium text-gray-800">${truncateSiteName(
            site
          )}</span>
        </div>
        <span class="text-sm font-semibold text-teal-600">${total}</span>
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
  summaryDiv.className = "mt-4 pt-3 border-t border-gray-200 text-center";
  summaryDiv.innerHTML = `
    <div class="text-sm text-gray-600">
      <span class="font-semibold text-teal-600">${totalAttempts}</span> total blocks across 
      <span class="font-semibold text-teal-600">${sites.length}</span> 
      ${sites.length === 1 ? "website" : "websites"} today
    </div>
  `;
  container.appendChild(summaryDiv);
}

// Generate hourly line graph HTML with SVG
// Render Chart.js bar graph
function renderChart(visitData) {
  const canvas = document.getElementById("visitsChart");

  // Check if Chart.js is loaded
  if (typeof Chart === "undefined") {
    console.error("Chart.js is not loaded");
    canvas.parentElement.innerHTML =
      '<div class="text-center text-gray-500 p-4">Chart unavailable</div>';
    return;
  }

  const ctx = canvas.getContext("2d");

  // Destroy existing chart if it exists
  if (chart) {
    chart.destroy();
  }

  const sites = Object.keys(visitData);
  const counts = Object.values(visitData);

  // Prepare chart data
  const chartData = {
    labels:
      sites.length > 0
        ? sites.map((site) => truncateSiteName(site))
        : ["No Data"],
    datasets: [
      {
        label: "Blocked Attempts",
        data: sites.length > 0 ? counts : [0],
        backgroundColor:
          sites.length > 0
            ? sites.map((_, index) => CHART_COLORS[index % CHART_COLORS.length])
            : ["#e5e7eb"],
        borderColor:
          sites.length > 0
            ? sites.map((_, index) => CHART_COLORS[index % CHART_COLORS.length])
            : ["#d1d5db"],
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  // Chart configuration
  const config = {
    type: "bar",
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: "rgba(15, 118, 110, 0.9)",
          titleColor: "white",
          bodyColor: "white",
          borderColor: "#0f766e",
          borderWidth: 1,
          callbacks: {
            title: function (context) {
              const index = context[0].dataIndex;
              return sites[index] || "No data";
            },
            label: function (context) {
              return `${context.parsed.y} attempt${
                context.parsed.y !== 1 ? "s" : ""
              }`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            color: "#6b7280",
            font: {
              size: 10,
            },
            maxRotation: 45,
          },
        },
        y: {
          beginAtZero: true,
          grid: {
            color: "#f3f4f6",
          },
          ticks: {
            color: "#6b7280",
            font: {
              size: 10,
            },
            stepSize: 1,
          },
        },
      },
      layout: {
        padding: {
          top: 10,
          bottom: 5,
        },
      },
    },
  };

  // Create the chart
  try {
    chart = new Chart(ctx, config);
  } catch (error) {
    console.error("Error creating chart:", error);
    canvas.parentElement.innerHTML =
      '<div class="text-center text-gray-500 p-4">Chart error: ' +
      error.message +
      "</div>";
  }
}

// Truncate site names for better display
function truncateSiteName(siteName) {
  if (siteName.length <= 12) {
    return siteName;
  }
  return siteName.substring(0, 12) + "...";
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
        "flex items-center justify-between p-2 bg-gray-50 rounded-md";

      siteItem.innerHTML = `
        <span class="text-sm text-gray-700 flex-1 truncate">${site}</span>
        <button 
          class="ml-2 px-2 py-1 bg-red-100 text-red-600 text-xs rounded hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 remove-btn"
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
      ? "bg-green-100 text-green-800"
      : type === "warning"
      ? "bg-yellow-100 text-yellow-800"
      : type === "error"
      ? "bg-red-100 text-red-800"
      : "bg-blue-100 text-blue-800"
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

// Reset today's data
async function resetTodayData() {
  try {
    const today = new Date().toISOString().split("T")[0];

    // Remove today's data from storage
    await chrome.storage.local.remove([today]);

    console.log("Today's data cleared successfully");
    showMessage("Today's statistics have been reset", "success");

    // Refresh the UI to show empty state
    await loadVisitData();
  } catch (error) {
    console.error("Error resetting today's data:", error);
    showMessage("Failed to reset data", "error");
  }
}
