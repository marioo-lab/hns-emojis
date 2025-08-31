// Global Variables
let emojiData = {};
let copiedCount = 0;
let showPunycode = false;
let punycodeFormat = "punycode"; // 'punycode' or 'unicode'

// Convert emoji to punycode or unicode
function emojiToPunycode(emoji) {
  if (punycodeFormat === "unicode") {
    // Return Unicode code points
    return Array.from(emoji)
      .map((char) => {
        const codePoint = char.codePointAt(0);
        return `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
      })
      .join(" ");
  } else {
    // Return actual punycode
    try {
      const encoded = punycode.encode(emoji);
      return encoded ? `xn--${encoded}` : "Invalid";
    } catch (error) {
      console.warn("Punycode encoding failed for:", emoji, error);
      return "Invalid";
    }
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
    loadFallbackData();
    showToast("Failed to load data, using offline fallback", "warning");
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
            status === "minimally-qualified" ||
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

// Fallback emoji data (comprehensive offline collection)
function loadFallbackData() {
  emojiData = {
    "Smileys & Emotion": [
      "😀",
      "",
      "😄",
      "😁",
      "😆",
      "😅",
      "😂",
      "🤣",
      "🥲",
      "🥹",
      "😊",
      "😇",
      "🙂",
      "🙃",
      "😉",
      "😌",
      "😍",
      "🥰",
      "😘",
      "😗",
      "😙",
      "😚",
      "😋",
      "😛",
      "😝",
      "😜",
      "🤪",
      "🤨",
      "🧐",
      "🤓",
      "😎",
      "🥸",
      "🤩",
      "🥳",
      "😏",
      "😒",
      "😞",
      "😔",
      "😟",
      "😕",
      "🙁",
      "☹️",
      "😣",
      "😖",
      "😫",
      "😩",
      "🥺",
      "😢",
      "😭",
      "😤",
      "😠",
      "😡",
      "🤬",
      "🤯",
      "😳",
      "🥵",
      "🥶",
      "😱",
      "😨",
      "😰",
      "😥",
      "😓",
      "🤗",
      "🤔",
    ],
    "People & Body": [
      "👋",
      "🤚",
      "🖐️",
      "✋",
      "🖖",
      "👌",
      "🤌",
      "🤏",
      "✌️",
      "🤞",
      "🫰",
      "🤟",
      "🤘",
      "🤙",
      "👈",
      "👉",
      "👆",
      "",
      "👇",
      "☝️",
      "👍",
      "👎",
      "👊",
      "✊",
      "🤛",
      "🤜",
      "👏",
      "🙌",
      "👐",
      "🤲",
      "🤝",
      "🙏",
    ],
    "Animals & Nature": [
      "🐶",
      "🐱",
      "🐭",
      "🐹",
      "🐰",
      "🦊",
      "🐻",
      "🐼",
      "🐨",
      "🐯",
      "🦁",
      "🐮",
      "🐷",
      "🐸",
      "🐵",
      "🐔",
      "🐧",
      "🐦",
      "🐤",
      "🐣",
      "🐥",
      "🦆",
      "🦅",
      "🦉",
      "🦇",
      "🐺",
      "🐗",
      "🐴",
      "🦄",
      "🐝",
      "🐛",
      "🦋",
      "🌸",
      "💐",
      "🌹",
      "🥀",
      "🌺",
      "🌻",
      "🌼",
      "🌷",
      "🌱",
      "🪴",
      "🌲",
      "🌳",
      "🌴",
      "🌵",
      "🌾",
      "🌿",
    ],
    "Food & Drink": [
      "🍎",
      "",
      "🍊",
      "🍋",
      "🍌",
      "🍉",
      "🍇",
      "🍓",
      "🫐",
      "🍈",
      "🍒",
      "🍑",
      "🥭",
      "🍍",
      "🥥",
      "🥝",
      "🍅",
      "",
      "🥑",
      "🥦",
      "🥬",
      "🥒",
      "🌶️",
      "🫑",
      "🌽",
      "🥕",
      "🫒",
      "🧄",
      "🧅",
      "🥔",
      "🍠",
      "🥐",
      "🍞",
      "🥖",
      "🥨",
      "🧀",
      "🥚",
      "🍳",
      "🧈",
      "🥞",
      "🧇",
      "🥓",
      "🥩",
      "🍗",
      "🍖",
      "🦴",
      "🌭",
      "🍔",
    ],
    "Travel & Places": [
      "🚗",
      "",
      "🚙",
      "🚌",
      "🚎",
      "🏎️",
      "🚓",
      "🚑",
      "🚒",
      "🚐",
      "🛻",
      "🚚",
      "🚛",
      "🚜",
      "🏍️",
      "🛵",
      "🚲",
      "�",
      "🛹",
      "🚁",
      "🚟",
      "🚠",
      "🚡",
      "⛴️",
      "🚤",
      "🛥️",
      "🛩️",
      "✈️",
      "🚀",
      "🛸",
      "🏠",
      "🏡",
    ],
    Activities: [
      "⚽",
      "🏀",
      "🏈",
      "⚾",
      "🥎",
      "🎾",
      "🏐",
      "🏉",
      "🎱",
      "🪀",
      "🏓",
      "🏸",
      "🏒",
      "🏑",
      "🥍",
      "🏏",
      "⛳",
      "🪁",
      "🏹",
      "🎣",
      "🤿",
      "🥊",
      "🥋",
      "🎽",
      "🛹",
      "🛷",
      "⛸️",
      "🥌",
      "🎿",
      "⛷️",
      "🏂",
      "🪂",
    ],
    Objects: [
      "📱",
      "📲",
      "💻",
      "⌨️",
      "🖥️",
      "🖨️",
      "🖱️",
      "🖲️",
      "🕹️",
      "💽",
      "💾",
      "💿",
      "📀",
      "📼",
      "📷",
      "📸",
      "📹",
      "🎥",
      "📽️",
      "🎞️",
      "📞",
      "☎️",
      "📟",
      "📠",
      "📺",
      "📻",
      "🎙️",
      "🎚️",
      "🎛️",
      "⏰",
      "⏲️",
      "⏱️",
    ],
    Symbols: [
      "❤️",
      "🧡",
      "💛",
      "💚",
      "💙",
      "💜",
      "🖤",
      "🤍",
      "🤎",
      "💔",
      "❣️",
      "💕",
      "💞",
      "💓",
      "💗",
      "💖",
      "✨",
      "💫",
      "💥",
      "💢",
      "💦",
      "💨",
      "🕳️",
      "💬",
      "💭",
      "🗯️",
      "💤",
      "👁️‍🗨️",
      "🔥",
      "💯",
      "♨️",
      "💈",
    ],
    Flags: [
      "🏁",
      "🚩",
      "🎌",
      "🏴",
      "🏳️",
      "🏳️‍🌈",
      "🏳️‍⚧️",
      "🏴‍☠️",
      "🇦🇫",
      "🇦🇱",
      "🇩🇿",
      "🇦🇸",
      "🇦🇩",
      "🇦🇴",
      "🇦🇮",
      "🇦🇶",
    ],
  };

  renderCategories();
  updateStats();
}

// Render all categories with optional search filter
function renderCategories(searchTerm = "") {
  const container = document.getElementById("categoriesContainer");
  container.innerHTML = "";

  let hasResults = false;

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

    // Create category element
    const categoryDiv = document.createElement("div");
    categoryDiv.className = "category";
    categoryDiv.innerHTML = `
            <div class="category-header" onclick="toggleCategory('${categoryName}')">
                <h2>${categoryName}</h2>
                <div class="category-info">
                    <span class="emoji-count">${
                      filteredEmojis.length
                    } symbols</span>
                    <button class="copy-all-btn" onclick="copyAllEmojis(event, '${categoryName}')">
                        Copy All
                    </button>
                    <span class="toggle-icon">▼</span>
                </div>
            </div>
            <div class="emoji-grid" id="grid-${categoryName}">
                ${filteredEmojis
                  .map((emoji) => {
                    const punycode = emojiToPunycode(emoji);
                    return `<div class="emoji-item" onclick="copyEmoji('${emoji}', this)" title="Click to copy: ${emoji} (${punycode})">
                        <span class="emoji-character">${emoji}</span>
                        <span class="emoji-punycode${
                          showPunycode ? " show" : ""
                        }">${punycode}</span>
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
  const totalCategories = Object.keys(emojiData).length;

  document.getElementById("totalEmojis").textContent =
    totalEmojis.toLocaleString();
  document.getElementById("totalCategories").textContent = totalCategories;
  document.getElementById("copiedCount").textContent = copiedCount;
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
  if (showPunycode) {
    formatOptions.classList.add("enabled");
  } else {
    formatOptions.classList.remove("enabled");
  }
}

// Update punycode format and refresh display
function updatePunycodeFormat() {
  const selectedFormat = document.querySelector(
    'input[name="punycodeFormat"]:checked'
  ).value;
  punycodeFormat = selectedFormat;

  if (showPunycode) {
    // Re-render to update punycode display
    const searchTerm = document.getElementById("searchInput").value.trim();
    renderCategories(searchTerm);
  }
}

// Copy emoji with optional punycode
async function copyEmoji(emoji, element, copyPunycode = false) {
  try {
    let textToCopy = emoji;

    // If Ctrl/Cmd is held while clicking, copy punycode instead
    if (event && (event.ctrlKey || event.metaKey)) {
      // Check if we should append to clipboard
      if (event.ctrlKey) {
        try {
          const currentClipboard = await navigator.clipboard.readText();
          textToCopy = currentClipboard + "\n" + emoji;
        } catch (err) {
          // Fallback if can't read clipboard
          textToCopy = emoji;
        }
        // Update counter
        copiedCount++;
      } else {
        // Cmd key - copy punycode
        textToCopy = emojiToPunycode(emoji);
        copyPunycode = true;
        copiedCount = 1;
      }
    } else {
      copiedCount = 1;
    }

    await navigator.clipboard.writeText(textToCopy);

    if (copyPunycode) {
      showToast(`Copied punycode: ${emojiToPunycode(emoji)}`);
    } else if (event && event.ctrlKey) {
      showToast(`Appended: ${emoji}`);
    } else {
      showToast(`Copied: ${emoji}`);
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
async function copyAllEmojis(event, categoryName) {
  event.stopPropagation(); // Prevent category toggle

  const emojis = emojiData[categoryName];
  let emojiString = emojis.join("\n");

  try {
    // If Ctrl is held, append to clipboard
    if (event.ctrlKey) {
      try {
        const currentClipboard = await navigator.clipboard.readText();
        emojiString = currentClipboard + "\n" + emojiString;
      } catch (err) {
        // Fallback if can't read clipboard - just copy normally
        console.warn("Could not read clipboard for append:", err);
      }
      copiedCount += emojis.length;
    } else {
      copiedCount = emojis.length;
    }

    await navigator.clipboard.writeText(emojiString);

    if (event.ctrlKey) {
      showToast(`Appended ${emojis.length} emojis from ${categoryName}!`);
    } else {
      showToast(`Copied ${emojis.length} emojis from ${categoryName}!`);
    }

    // Update counter
    document.getElementById("copiedCount").textContent = copiedCount;
  } catch (err) {
    console.error("Failed to copy: ", err);
    showToast("Failed to copy emojis", "error");
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

  // Punycode toggle
  document
    .getElementById("showPunycode")
    .addEventListener("change", togglePunycode);

  // Format option changes
  document.querySelectorAll('input[name="punycodeFormat"]').forEach((radio) => {
    radio.addEventListener("change", updatePunycodeFormat);
  });

  // Initialize the application
  loadEmojiData();
});

// Handle search input with debouncing for better performance
// (This functionality is now integrated into the main DOMContentLoaded event listener above)

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
});

// Export functions for global access
window.toggleCategory = toggleCategory;
window.copyEmoji = copyEmoji;
window.copyAllEmojis = copyAllEmojis;
window.togglePunycode = togglePunycode;
