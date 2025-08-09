// Website Blocker and Tracker - Popup Script
// Fetches today's visit data and renders a Chart.js bar graph

let chart = null;
let currentTab = "stats";

// Teal-based color palette for the chart
const CHART_COLORS = [
  "#14b8a6", // teal-500
  "#0d9488", // teal-600
  "#0f766e", // teal-700
  "#115e59", // teal-800
  "#134e4a", // teal-900
  "#5eead4", // teal-300
  "#99f6e4", // teal-200
  "#ccfbf1", // teal-100
];

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
  renderChart({});
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
  const testDataBtn = document.getElementById("addTestDataBtn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const site = input.value.trim().toLowerCase();

    if (site) {
      await addBlockedSite(site);
      input.value = "";
    }
  });

  // Add test data button event listener
  testDataBtn.addEventListener("click", async () => {
    await addTestData();
  });
} // Load visit data from background script
async function loadVisitData() {
  try {
    // Send message to background script to get visit data
    const visitData = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: "getVisitData" }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response || {});
        }
      });
    });

    // Update UI with the data (empty data is valid, not an error)
    updateUI(visitData);
    renderChart(visitData);
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
    (sum, count) => sum + count,
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

// Refresh data when popup is opened (optional enhancement)
chrome.runtime.onMessage?.addListener((request, sender, sendResponse) => {
  if (request.action === "refreshPopup") {
    loadVisitData();
    loadBlockedSites();
  }
});

// Add test data for development/testing
async function addTestData() {
  try {
    const today = new Date().toISOString().split("T")[0];
    const testData = {
      "facebook.com": 5,
      "twitter.com": 3,
      "youtube.com": 8,
      "example.com": 2,
    };

    await chrome.storage.local.set({ [today]: testData });
    showMessage("Test data added successfully", "success");

    // Refresh the UI
    await loadVisitData();
  } catch (error) {
    console.error("Error adding test data:", error);
    showMessage("Error adding test data", "error");
  }
}
