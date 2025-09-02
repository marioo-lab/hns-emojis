// Global Variables
let emojiData = {};
let favorites = new Set();
let copiedCount = 0;
let showPunycode = false;
let showAll = false;
let darkMode = false;

// Favorites Functions
function loadFavorites() {
  try {
    const savedFavorites = localStorage.getItem("emoji-collector-favorites");
    if (savedFavorites) {
      favorites = new Set(JSON.parse(savedFavorites));
    }
  } catch (error) {
    console.warn("Failed to load favorites:", error);
    favorites = new Set();
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(
      "emoji-collector-favorites",
      JSON.stringify([...favorites])
    );
  } catch (error) {
    console.warn("Failed to save favorites:", error);
  }
}

function toggleFavorite(emoji) {
  if (favorites.has(emoji)) {
    favorites.delete(emoji);
    showToast(`💔 Removed from favorites: ${emoji}`, "warning");
  } else {
    favorites.add(emoji);
    showToast(`❤️ Added to favorites: ${emoji}`, "success");
  }
  saveFavorites();

  // Re-render to update the favorites category and button states
  const searchTerm = document.getElementById("searchInput").value.trim();
  renderCategories(searchTerm);
  updateStats();
}

// Dark Mode Functions
function initializeDarkMode() {
  // Check localStorage for saved theme preference
  const savedTheme = localStorage.getItem("emoji-collector-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  // Set initial theme
  if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
    enableDarkMode();
  } else {
    disableDarkMode();
  }

  // Update toggle state
  document.getElementById("darkMode").checked = darkMode;
}

function enableDarkMode() {
  darkMode = true;
  document.documentElement.setAttribute("data-theme", "dark");
  localStorage.setItem("emoji-collector-theme", "dark");
}

function disableDarkMode() {
  darkMode = false;
  document.documentElement.removeAttribute("data-theme");
  localStorage.setItem("emoji-collector-theme", "light");
}

function toggleDarkMode() {
  if (darkMode) {
    disableDarkMode();
  } else {
    enableDarkMode();
  }

  // Show theme change notification
  showToast(
    darkMode ? "🌙 Dark mode enabled" : "☀️ Light mode enabled",
    "info"
  );
}

// Convert emoji to punycode or unicode
function emojiToPunycode(emoji) {
  // Return actual punycode
  try {
    const encoded = punycode.encode(emoji);
    return encoded ? `xn--${encoded}` : "Invalid";
  } catch (error) {
    console.warn("Punycode encoding failed for:", emoji, error);
    return "Invalid";
  }
}

// Load emoji data from Unicode.org official emoji test file and local JSON files
async function loadEmojiData() {
  try {
    showToast("Loading emojis & symbols...", "info");

    // Load from both Unicode.org and local JSON files
    const [unicodeData, localData] = await Promise.allSettled([
      loadFromUnicodeOrg(),
      loadFromLocalJSON(),
    ]);

    // Start with empty data
    let combinedData = {};

    // Add Unicode data if successful
    if (unicodeData?.status === "fulfilled" && unicodeData?.value) {
      combinedData = { ...combinedData, ...unicodeData.value };
    }

    // Add local JSON data if successful
    if (localData.status === "fulfilled" && localData.value) {
      combinedData = { ...combinedData, ...localData.value };
    }

    // Check if we have any data
    if (Object.keys(combinedData).length === 0) {
      throw new Error("No emoji data could be loaded");
    }

    emojiData = combinedData;

    console.log("Loaded categories:", Object.keys(emojiData));
    console.log(
      "Total emojis:",
      Object.values(emojiData).reduce((sum, arr) => sum + arr.length, 0)
    );

    // Render the interface
    renderCategories();
    updateStats();
    showToast(
      `Successfully loaded ${Object.keys(emojiData).length} emoji categories!`,
      "success"
    );
  } catch (error) {
    console.error("Error loading emoji data:", error);
  }
}

// Load from Unicode.org
async function loadFromUnicodeOrg() {
  const response = await fetch("data/emoji-test.txt");

  if (!response.ok) {
    throw new Error(`Failed to load Unicode data: ${response.status}`);
  }

  const emojiTestData = await response.text();
  return parseUnicodeEmojiData(emojiTestData);
}

// Load from local JSON files in data folder
async function loadFromLocalJSON() {
  const jsonFiles = [
    "card-symbol-pack.json",
    "domino-symbol-pack.json",
    "mahjong-symbol-pack.json",
    "card-suit-symbol-pack.json",
    "chess-symbol-pack.json",
    "star-symbol-pack.json",
  ];

  const localData = {};

  for (const filename of jsonFiles) {
    try {
      const response = await fetch(`data/${filename}`);

      if (response.ok) {
        const emojiArray = await response.json();

        // Expect simple array format: ["🂡", "🂢", "🂣", ...]
        if (Array.isArray(emojiArray) && emojiArray.length > 0) {
          // Convert filename to category name
          const categoryName = filename
            .replace(".json", "")
            .split("-")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");

          localData[categoryName] = emojiArray;
        } else {
          console.warn(
            `Invalid format in ${filename}: expected array of emojis, got:`,
            typeof emojiArray,
            emojiArray
          );
        }
      }
    } catch (error) {
      console.warn(`Could not load ${filename}:`, error);
    }
  }

  return localData;
}

// Parse the Unicode emoji-test.txt file
function parseUnicodeEmojiData(textData) {
  const lines = textData.split("\n");
  const categorizedEmojis = {};
  let currentGroup = "Miscellaneous";
  let currentSubgroup = "Other";

  for (let line of lines) {
    line = line.trim();

    // Skip empty lines and comments that aren't group headers
    if (
      !line ||
      (line.startsWith("#") &&
        !line.includes("group:") &&
        !line.includes("subgroup:"))
    ) {
      continue;
    }

    // Parse group headers
    if (line.startsWith("# group:")) {
      currentGroup = line.replace("# group:", "").trim();
      // Clean up group names
      currentGroup = currentGroup
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" & ");
      continue;
    }

    // Parse subgroup headers
    if (line.startsWith("# subgroup:")) {
      currentSubgroup = line.replace("# subgroup:", "").trim();
      // Clean up subgroup names
      currentSubgroup = currentSubgroup
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
      continue;
    }

    // Parse emoji lines (format: codepoints ; status # emoji name)
    if (line.includes(";") && !line.startsWith("#")) {
      const parts = line.split(";");
      if (parts.length >= 2) {
        const codepoints = parts[0].trim();
        const rest = parts[1].trim();

        // Extract status and check if it's a valid emoji
        // More flexible regex to handle various formats like "fully-qualified", "minimally-qualified", etc.
        const statusMatch = rest.match(/^([a-zA-Z-]+)\s*#\s*(.+)$/);
        if (statusMatch) {
          const status = statusMatch[1];
          const emojiPart = statusMatch[2];

          // Include fully-qualified, minimally-qualified, and component emojis
          if (
            status === "fully-qualified" ||
            (showAll && status === "minimally-qualified") ||
            status === "component"
          ) {
            // Extract the actual emoji character (first part before any text)
            const emojiMatch = emojiPart.match(/^(\S+)/);
            if (emojiMatch) {
              const emoji = emojiMatch[1];

              // Use a combination of group and subgroup for better categorization
              let categoryName = currentGroup;

              // For large groups, use subgroups to break them down
              if (
                currentGroup === "Smileys & Emotion" ||
                currentGroup === "People & Body" ||
                currentGroup === "Animals & Nature" ||
                currentGroup === "Food & Drink" ||
                currentGroup === "Travel & Places" ||
                currentGroup === "Activities" ||
                currentGroup === "Objects"
              ) {
                categoryName = `${currentGroup} - ${currentSubgroup}`;
              }

              // Initialize category if it doesn't exist
              if (!categorizedEmojis[categoryName]) {
                categorizedEmojis[categoryName] = [];
              }

              // Add emoji to category (avoid duplicates)
              if (!categorizedEmojis[categoryName].includes(emoji)) {
                categorizedEmojis[categoryName].push(emoji);
              }
            }
          }
        }
      }
    }
  }

  // Clean up categories with very few emojis by merging them
  const cleanedCategories = {};
  const minimumEmojisPerCategory = 5;

  Object.entries(categorizedEmojis).forEach(([category, emojis]) => {
    if (emojis.length >= minimumEmojisPerCategory) {
      cleanedCategories[category] = emojis;
    } else {
      // Merge small categories into their parent group
      const parentGroup = category.split(" - ")[0];
      if (!cleanedCategories[parentGroup]) {
        cleanedCategories[parentGroup] = [];
      }
      cleanedCategories[parentGroup].push(...emojis);
    }
  });

  // Remove duplicates from merged categories
  Object.keys(cleanedCategories).forEach((category) => {
    cleanedCategories[category] = [...new Set(cleanedCategories[category])];
  });

  return cleanedCategories;
}

// Render all categories with optional search filter
function renderCategories(searchTerm = "") {
  const container = document.getElementById("categoriesContainer");
  container.innerHTML = "";

  let hasResults = false;

  // Prepare categories to render, with favorites first
  const categoriesToRender = [];

  // Add favorites category if there are any favorites
  if (favorites.size > 0) {
    let favoritesArray = [...favorites];

    // Apply search filter to favorites if searching
    if (searchTerm) {
      favoritesArray = favoritesArray.filter(
        (emoji) =>
          emoji.includes(searchTerm) ||
          "favorites".toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (favoritesArray.length > 0) {
      categoriesToRender.push(["⭐ Favorites", favoritesArray, true]);
      hasResults = true;
    }
  }

  // Add regular categories
  Object.entries(emojiData).forEach(([categoryName, emojis]) => {
    let filteredEmojis = emojis;

    // Apply search filter
    if (searchTerm) {
      filteredEmojis = emojis.filter(
        (emoji) =>
          emoji.includes(searchTerm) ||
          categoryName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Skip empty categories when searching
    if (filteredEmojis.length === 0 && searchTerm) {
      return;
    }

    hasResults = true;
    categoriesToRender.push([categoryName, filteredEmojis, false]);
  });

  // Render all categories
  categoriesToRender.forEach(([categoryName, emojis, isFavorites]) => {
    // Create category element
    const categoryDiv = document.createElement("div");
    categoryDiv.className = "category";
    if (isFavorites) {
      categoryDiv.classList.add("favorites-category");
    }

    categoryDiv.innerHTML = `
            <div class="category-header" onclick="toggleCategory('${categoryName}')">
                <h2>${categoryName}</h2>
                <div class="category-info">
                    <span class="emoji-count">${emojis.length} emoji${
      emojis.length === 1 ? "" : "s"
    }</span>
                    <button class="copy-all-btn" onclick="copyAllEmojis(event, '${categoryName}', ${isFavorites})">
                        Copy All
                    </button>
                    <span class="toggle-icon">▼</span>
                </div>
            </div>
            <div class="emoji-grid" id="grid-${categoryName}">
                ${emojis
                  .map((emoji) => {
                    const punycode = emojiToPunycode(emoji);
                    const isFavorited = favorites.has(emoji);
                    return `<div class="emoji-item" onclick="copyEmoji(event, '${emoji}', this)" title="Click to copy: ${emoji} (${punycode})">
                        <span class="emoji-character">${emoji}</span>
                        <span class="emoji-punycode${
                          showPunycode ? " show" : ""
                        }">${punycode}</span>
                        <button class="favorite-btn ${
                          isFavorited ? "favorited" : ""
                        }" onclick="event.stopPropagation(); toggleFavorite('${emoji}')" title="${
                      isFavorited ? "Remove from favorites" : "Add to favorites"
                    }">
                            ${isFavorited ? "❤️" : "🩶"}
                        </button>
                        <a href="https://www.namebase.io/domains/${punycode}" target="_blank" class="emoji-link" style="left: 2px;" onclick="event.stopPropagation()" title="View on Namebase"><img src="nb-logo.png" width="12" ></a>
                        <a href="https://shakestation.io/domain/${punycode}" target="_blank" class="emoji-link" style="left: 20px;" onclick="event.stopPropagation()" title="View on Shakestation"><img src="ss-logo.png" width="12" ></a>
                        <a href="https://shakeshift.com/name/${punycode}" target="_blank" class="emoji-link" onclick="event.stopPropagation()" title="View in explorer">🔍</a>
                    </div>`;
                  })
                  .join("")}
            </div>
        `;

    container.appendChild(categoryDiv);
  });

  // Show no results message if search yielded nothing
  if (!hasResults && searchTerm) {
    container.innerHTML = `
            <div class="no-results">
                <h2>🔍 No emojis found</h2>
                <p>Try a different search term or browse categories above</p>
            </div>
        `;
  }
}

// Update statistics display
function updateStats() {
  const totalEmojis = Object.values(emojiData).reduce(
    (sum, arr) => sum + arr.length,
    0
  );
  const totalCategories =
    Object.keys(emojiData).length + (favorites.size > 0 ? 1 : 0);

  document.getElementById("totalEmojis").textContent =
    totalEmojis.toLocaleString();
  document.getElementById("totalCategories").textContent = totalCategories;
  document.getElementById("copiedCount").textContent = copiedCount;
}

function toggleShowAll() {
  showAll = !showAll;

  loadEmojiData();
}

// Toggle category visibility
function toggleCategory(categoryName) {
  const category = event.currentTarget.parentElement;
  category.classList.toggle("collapsed");
}

// Toggle punycode display
function togglePunycode() {
  showPunycode = !showPunycode;
  const punycodeElements = document.querySelectorAll(".emoji-punycode");
  const formatOptions = document.querySelector(".format-options");

  punycodeElements.forEach((element) => {
    if (showPunycode) {
      element.classList.add("show");
    } else {
      element.classList.remove("show");
    }
  });

  // Enable/disable format options
  if (formatOptions) {
    if (showPunycode) {
      formatOptions.classList.add("enabled");
    } else {
      formatOptions.classList.remove("enabled");
    }
  }
}

// Copy emoji with optional punycode
async function copyEmoji(event, emoji, element, copyPunycode = false) {
  event.stopPropagation();

  try {
    let textToCopy = emoji;

    // Handle modifier keys
    if (event && (event.ctrlKey || event.metaKey)) {
      if (event.metaKey && event.ctrlKey) {
        // Both Win/Cmd + Ctrl: append punycode
        try {
          const currentClipboard = await navigator.clipboard.readText();
          textToCopy = currentClipboard + "\n" + emojiToPunycode(emoji);
        } catch (err) {
          textToCopy = emojiToPunycode(emoji);
        }
        copyPunycode = true;
        copiedCount++;
      } else if (event.metaKey) {
        // Win/Cmd key alone: copy punycode
        textToCopy = emojiToPunycode(emoji);
        copyPunycode = true;
        copiedCount = 1;
      } else if (event.ctrlKey) {
        // Ctrl key alone: append emoji
        try {
          const currentClipboard = await navigator.clipboard.readText();
          textToCopy = currentClipboard + "\n" + emoji;
        } catch (err) {
          textToCopy = emoji;
        }
        copiedCount++;
      }
    } else {
      copiedCount = 1;
    }

    await navigator.clipboard.writeText(textToCopy);

    // Show appropriate toast message
    if (copyPunycode) {
      if (
        (event.metaKey && event.ctrlKey) ||
        (event.ctrlKey && !event.metaKey)
      ) {
        showToast(`Appended punycode: ${emojiToPunycode(emoji)}`);
      } else {
        showToast(`Copied punycode: ${emojiToPunycode(emoji)}`);
      }
    } else {
      if (event && event.ctrlKey && !event.metaKey) {
        showToast(`Appended: ${emoji}`);
      } else {
        showToast(`Copied: ${emoji}`);
      }
    }

    // Visual feedback
    element.classList.add("copied");
    setTimeout(() => element.classList.remove("copied"), 1000);

    document.getElementById("copiedCount").textContent = copiedCount;
  } catch (err) {
    console.error("Failed to copy: ", err);
    showToast("Failed to copy emoji", "error");
  }
}

// Copy all emojis from a category
async function copyAllEmojis(event, categoryName, isFavorites = false) {
  event.stopPropagation(); // Prevent category toggle

  let emojis;
  if (isFavorites) {
    emojis = [...favorites];
  } else {
    emojis = emojiData[categoryName];
  }

  let contentToCopy;
  let isUsingPunycode = false;

  // Determine what to copy based on modifier keys
  if (event.metaKey && event.ctrlKey) {
    // Both Win/Cmd + Ctrl: append punycode
    contentToCopy = emojis.map((emoji) => emojiToPunycode(emoji)).join("\n");
    isUsingPunycode = true;
    try {
      const currentClipboard = await navigator.clipboard.readText();
      contentToCopy = currentClipboard + "\n" + contentToCopy;
      copiedCount += emojis.length;
    } catch (err) {
      console.warn("Could not read clipboard for append:", err);
      copiedCount = emojis.length;
    }
  } else if (event.metaKey) {
    // Win/Cmd key alone: copy punycode
    contentToCopy = emojis.map((emoji) => emojiToPunycode(emoji)).join("\n");
    isUsingPunycode = true;
    copiedCount = emojis.length;
  } else if (event.ctrlKey) {
    // Ctrl key alone: append emojis
    contentToCopy = emojis.join("\n");
    try {
      const currentClipboard = await navigator.clipboard.readText();
      contentToCopy = currentClipboard + "\n" + contentToCopy;
      copiedCount += emojis.length;
    } catch (err) {
      console.warn("Could not read clipboard for append:", err);
      copiedCount = emojis.length;
    }
  } else {
    // No modifier: copy emojis normally
    contentToCopy = emojis.join("\n");
    copiedCount = emojis.length;
  }

  try {
    await navigator.clipboard.writeText(contentToCopy);

    // Show appropriate toast message
    const actionType =
      (event.metaKey && event.ctrlKey) || event.ctrlKey ? "Appended" : "Copied";
    const contentType = isUsingPunycode ? "punycode" : "emojis";
    showToast(
      `${actionType} ${emojis.length} ${contentType} from ${categoryName}!`
    );

    // Update counter
    document.getElementById("copiedCount").textContent = copiedCount;
  } catch (err) {
    console.error("Failed to copy: ", err);
    showToast("Failed to copy content", "error");
  }
}

// Show toast notification with different types
function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  const toastMessage = document.getElementById("toastMessage");

  toastMessage.textContent = message;

  // Set background color based on type
  switch (type) {
    case "error":
      toast.style.background = "#dc3545";
      break;
    case "warning":
      toast.style.background = "#ffc107";
      toast.style.color = "#000";
      break;
    case "info":
      toast.style.background = "#17a2b8";
      break;
    default:
      toast.style.background = "#28a745";
      toast.style.color = "#fff";
  }

  toast.classList.add("show");

  // Auto-hide after 3 seconds
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

// Event Listeners
document.addEventListener("DOMContentLoaded", function () {
  // Initialize dark mode and favorites first
  initializeDarkMode();
  loadFavorites();

  // Search functionality with debouncing
  const searchInput = document.getElementById("searchInput");
  let searchTimeout;

  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const searchTerm = e.target.value.trim();
      renderCategories(searchTerm);
    }, 300); // 300ms debounce
  });

  // Dark mode toggle
  document
    .getElementById("darkMode")
    .addEventListener("change", toggleDarkMode);

  //All toggle
  document.getElementById("showAll").addEventListener("change", toggleShowAll);

  // Punycode toggle
  document
    .getElementById("showPunycode")
    .addEventListener("change", togglePunycode);

  // Initialize the application
  loadEmojiData();
});

// Keyboard shortcuts
document.addEventListener("keydown", function (e) {
  // Focus search with Ctrl+F or Cmd+F
  if ((e.ctrlKey || e.metaKey) && e.key === "f") {
    e.preventDefault();
    document.getElementById("searchInput").focus();
  }

  // Clear search with Escape
  if (e.key === "Escape") {
    const searchInput = document.getElementById("searchInput");
    if (searchInput === document.activeElement) {
      searchInput.value = "";
      renderCategories("");
    }
  }

  // Toggle punycode with Ctrl+P or Cmd+P
  if ((e.ctrlKey || e.metaKey) && e.key === "p") {
    e.preventDefault();
    const punycodeToggle = document.getElementById("showPunycode");
    punycodeToggle.checked = !punycodeToggle.checked;
    togglePunycode();
  }

  // Toggle dark mode with Ctrl+D or Cmd+D
  if ((e.ctrlKey || e.metaKey) && e.key === "d") {
    e.preventDefault();
    const darkModeToggle = document.getElementById("darkMode");
    darkModeToggle.checked = !darkModeToggle.checked;
    toggleDarkMode();
  }
});

// Export functions for global access
window.toggleCategory = toggleCategory;
window.copyEmoji = copyEmoji;
window.copyAllEmojis = copyAllEmojis;
window.togglePunycode = togglePunycode;
window.toggleDarkMode = toggleDarkMode;
window.toggleFavorite = toggleFavorite;
