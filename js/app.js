// Expense & Budget Visualizer â€” application logic
// ---------------------------------------------------------------------------
// Data Model Typedefs
// ---------------------------------------------------------------------------
/** @typedef {"Food" | "Transport" | "Fun" | string} Category */
/**
 * @typedef {Object} Transaction
 * @property {string}   id
 * @property {string}   itemName
 * @property {number}   amount
 * @property {Category} category
 * @property {number}   createdAt
 */
/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid
 * @property {{ itemName?: string, amount?: string, category?: string }} errors
 */
/**
 * @typedef {Object} CategoryTotals
 * @property {number} [category]
 */
/**
 * @typedef {Object} MonthlySummary
 * @property {string}         month       "YYYY-MM"
 * @property {number}         total
 * @property {number}         count
 * @property {CategoryTotals} byCategory
 */

// ---------------------------------------------------------------------------
// Constants and State
// ---------------------------------------------------------------------------
const DEFAULT_CATEGORIES = ["Food", "Transport", "Fun"];
let CATEGORIES = ["Food", "Transport", "Fun"];
const STORAGE_KEY = 'expense_visualizer_transactions';
const CUSTOM_CATEGORIES_KEY = 'expense_visualizer_custom_categories';
const THEME_KEY = 'expense_visualizer_theme';
const CATEGORY_COLORS = { Food: '#FF6384', Transport: '#36A2EB', Fun: '#FFCE56' };
const EXTRA_COLORS = ['#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF', '#E7E9ED', '#7CFC00'];

let transactions = [];
let chartInstance = null;

// ---------------------------------------------------------------------------
// Pure State Functions (Tasks 2.2 â€“ 2.6)
// ---------------------------------------------------------------------------

/**
 * Returns a new array with the new transaction appended.
 * @param {Transaction[]} transactions
 * @param {{ itemName: string, amount: number, category: Category }} item
 * @returns {Transaction[]}
 */
function addTransaction(transactions, item) {
  const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : Date.now().toString();
  return [
    ...transactions,
    {
      id,
      itemName: item.itemName,
      amount: item.amount,
      category: item.category,
      createdAt: Date.now(),
    },
  ];
}

/**
 * Returns a new array without the transaction matching the given id.
 * @param {Transaction[]} transactions
 * @param {string} id
 * @returns {Transaction[]}
 */
function deleteTransaction(transactions, id) {
  return transactions.filter(t => t.id !== id);
}

/**
 * Returns the arithmetic sum of all transaction amounts (0 for empty array).
 * @param {Transaction[]} transactions
 * @returns {number}
 */
function computeBalance(transactions) {
  return transactions.reduce((sum, t) => sum + t.amount, 0);
}

/**
 * Formats a number as a USD currency string (e.g. "$1,234.56").
 * @param {number} amount
 * @returns {string}
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Returns per-category sums for all transactions, using current CATEGORIES.
 * @param {Transaction[]} transactions
 * @returns {CategoryTotals}
 */
function computeChartData(transactions) {
  // Build totals dynamically from the current CATEGORIES array
  const totals = {};
  for (const cat of CATEGORIES) {
    totals[cat] = 0;
  }
  for (const t of transactions) {
    if (Object.prototype.hasOwnProperty.call(totals, t.category)) {
      totals[t.category] += t.amount;
    } else {
      // Transaction has a category not in current list â€” still track it
      totals[t.category] = (totals[t.category] || 0) + t.amount;
    }
  }
  return totals;
}

// ---------------------------------------------------------------------------
// Validator (Task 4.1)
// ---------------------------------------------------------------------------

/**
 * Validates the expense form data before a transaction is added.
 * @param {{ itemName: any, amount: any, category: any }} formData
 * @returns {ValidationResult}
 */
function validateForm(formData) {
  const errors = {};

  // itemName: non-empty after trim, max 100 chars
  const itemName = typeof formData.itemName === 'string' ? formData.itemName.trim() : '';
  if (itemName.length === 0) {
    errors.itemName = 'Item name is required.';
  } else if (itemName.length > 100) {
    errors.itemName = 'Item name must be 100 characters or fewer.';
  }

  // amount: numeric, > 0, <= 999,999,999.99
  const rawAmount = formData.amount;
  const parsedAmount = typeof rawAmount === 'number' ? rawAmount : parseFloat(rawAmount);
  if (rawAmount === '' || rawAmount === null || rawAmount === undefined) {
    errors.amount = 'Amount is required.';
  } else if (isNaN(parsedAmount) || !isFinite(parsedAmount)) {
    errors.amount = 'Amount must be a positive number no greater than 999,999,999.99.';
  } else if (parsedAmount <= 0) {
    errors.amount = 'Amount must be a positive number no greater than 999,999,999.99.';
  } else if (parsedAmount > 999999999.99) {
    errors.amount = 'Amount must be a positive number no greater than 999,999,999.99.';
  }

  // category: must be one of the current CATEGORIES
  if (!CATEGORIES.includes(formData.category)) {
    errors.category = 'Please select a category.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Persistence Module (Task 3.1)
// ---------------------------------------------------------------------------

/**
 * Serialises and writes the transactions array to localStorage.
 * Calls showNotificationBanner on failure (defined in Task 5.1).
 * @param {Transaction[]} transactions
 */
function saveToStorage(transactions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  } catch (e) {
    showNotificationBanner(
      'Transaction could not be saved. Changes may be lost when you close the tab.'
    );
  }
}

/**
 * Reads and parses the transactions array from localStorage.
 * Returns [] and calls showNotificationBanner on any failure.
 * @returns {Transaction[]}
 */
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    return JSON.parse(raw);
  } catch (e) {
    showNotificationBanner(
      'Saved data could not be loaded. Starting with an empty list.'
    );
    return [];
  }
}

// ---------------------------------------------------------------------------
// Custom Categories Module (Feature 1)
// ---------------------------------------------------------------------------

/**
 * Saves the current CATEGORIES array to localStorage.
 */
function saveCustomCategories() {
  try {
    localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(CATEGORIES));
  } catch (e) {
    // Silent fail â€” non-critical
  }
}

/**
 * Loads saved categories from localStorage, merges with defaults, deduplicates.
 * Mutates the global CATEGORIES array in-place.
 */
function loadCustomCategories() {
  try {
    const raw = localStorage.getItem(CUSTOM_CATEGORIES_KEY);
    if (raw === null) return;
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved)) return;
    // Merge: start from defaults, then add any extras from saved (case-insensitive dedup)
    const merged = [...DEFAULT_CATEGORIES];
    for (const cat of saved) {
      if (
        typeof cat === 'string' &&
        cat.trim().length > 0 &&
        !merged.some(c => c.toLowerCase() === cat.trim().toLowerCase())
      ) {
        merged.push(cat.trim());
      }
    }
    CATEGORIES = merged;
  } catch (e) {
    // Silently keep defaults
  }
}

/**
 * Rebuilds the <select id="category"> options from the current CATEGORIES array.
 * Preserves the previously selected value if it is still valid.
 */
function renderCategoryOptions() {
  const select = document.getElementById('category');
  if (!select) return;

  const previousValue = select.value;

  // Rebuild options
  const options = ['<option value="">Select a category</option>'];
  for (const cat of CATEGORIES) {
    options.push(`<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`);
  }
  select.innerHTML = options.join('');

  // Restore selection if still valid
  if (previousValue && CATEGORIES.includes(previousValue)) {
    select.value = previousValue;
  }
}

/**
 * Handles the "Add" button click for adding a custom category.
 * Validates, adds to CATEGORIES, saves, re-renders options, clears input.
 */
function handleAddCategory() {
  const input = document.getElementById('new-category-input');
  const errorSpan = document.getElementById('new-category-error');
  if (!input) return;

  const value = input.value.trim();

  // Clear previous error
  if (errorSpan) errorSpan.textContent = '';

  // Validate: non-empty
  if (value.length === 0) {
    if (errorSpan) errorSpan.textContent = 'Category name is required.';
    return;
  }

  // Validate: max 30 chars
  if (value.length > 30) {
    if (errorSpan) errorSpan.textContent = 'Category name must be 30 characters or fewer.';
    return;
  }

  // Validate: not already in CATEGORIES (case-insensitive)
  if (CATEGORIES.some(c => c.toLowerCase() === value.toLowerCase())) {
    if (errorSpan) errorSpan.textContent = `Category "${value}" already exists.`;
    return;
  }

  // Add, save, re-render
  CATEGORIES.push(value);
  saveCustomCategories();
  renderCategoryOptions();
  input.value = '';
  showNotificationBanner(`Category "${value}" added.`);
}

// ---------------------------------------------------------------------------
// Notification Banner Component (Task 5.1)
// ---------------------------------------------------------------------------

/** @type {ReturnType<typeof setTimeout> | null} */
let _notificationTimer = null;

/**
 * Displays a non-blocking notification banner for the given duration.
 * Safe to call in Node/test environments â€” guards against missing DOM element.
 * @param {string} message
 * @param {number} [durationMs=5000]
 */
function showNotificationBanner(message, durationMs = 5000) {
  const banner = document.getElementById('notification-banner');
  if (!banner) return;

  banner.textContent = message;
  banner.style.display = 'block';

  // Clear any existing timer so concurrent calls don't race each other
  if (_notificationTimer !== null) {
    clearTimeout(_notificationTimer);
  }

  _notificationTimer = setTimeout(() => {
    banner.style.display = 'none';
    _notificationTimer = null;
  }, durationMs);
}

// ---------------------------------------------------------------------------
// Dark / Light Mode (Feature 2)
// ---------------------------------------------------------------------------

/**
 * Applies the given theme to the document.
 * @param {'light' | 'dark'} theme
 */
function applyTheme(theme) {
  const body = document.body;
  const btn = document.getElementById('theme-toggle');
  const MOON = '\uD83C\uDF19';   // 🌙
  const SUN  = '\u2600\uFE0F';   // ☀️

  if (theme === 'dark') {
    body.classList.add('dark');
    if (btn) {
      btn.textContent = SUN;
      btn.setAttribute('aria-label', 'Switch to light mode');
    }
  } else {
    body.classList.remove('dark');
    if (btn) {
      btn.textContent = MOON;
      btn.setAttribute('aria-label', 'Switch to dark mode');
    }
  }
}

/**
 * Toggles the current theme, saves to localStorage, and applies it.
 */
function handleThemeToggle() {
  const currentTheme = localStorage.getItem(THEME_KEY) || 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  localStorage.setItem(THEME_KEY, newTheme);
  applyTheme(newTheme);
}

// ---------------------------------------------------------------------------
// Input Form Component â€” submit handler (Task 6.2)
// ---------------------------------------------------------------------------

/**
 * Handles the expense form submit event.
 * Validates input, mutates state, persists, and re-renders all UI regions.
 * @param {Event} event
 */
function handleFormSubmit(event) {
  event.preventDefault();

  const itemName = document.getElementById('item-name').value;
  const amount   = document.getElementById('amount').value;
  const category = document.getElementById('category').value;

  const result = validateForm({ itemName, amount, category });

  // Always reset error spans first
  document.getElementById('item-name-error').textContent = '';
  document.getElementById('amount-error').textContent    = '';
  document.getElementById('category-error').textContent  = '';

  if (!result.valid) {
    if (result.errors.itemName) {
      document.getElementById('item-name-error').textContent = result.errors.itemName;
    }
    if (result.errors.amount) {
      document.getElementById('amount-error').textContent = result.errors.amount;
    }
    if (result.errors.category) {
      document.getElementById('category-error').textContent = result.errors.category;
    }
    return; // stop â€” no state mutation
  }

  // Valid submission: update state, persist, re-render, reset form
  transactions = addTransaction(transactions, {
    itemName: itemName.trim(),
    amount:   parseFloat(amount),
    category,
  });
  saveToStorage(transactions);
  renderTransactionList(transactions);
  renderBalanceDisplay(transactions);
  renderChart(transactions);
  renderMonthlySummary(transactions);
  event.target.reset();
}

// ---------------------------------------------------------------------------
// Transaction List Component (Task 7.2)
// ---------------------------------------------------------------------------

/**
 * Re-renders the transaction list, newest-first.
 * Shows an empty-state message when there are no transactions.
 * @param {Transaction[]} transactions
 */
function renderTransactionList(transactions) {
  const ul = document.getElementById('transaction-list');
  if (!ul) return;

  if (transactions.length === 0) {
    ul.innerHTML = '<li class="empty-state">No expenses recorded yet.</li>';
    return;
  }

  // Iterate in reverse so the most recently added item is at the top
  const items = [];
  for (let i = transactions.length - 1; i >= 0; i--) {
    const t = transactions[i];
    items.push(
      `<li class="transaction-item" data-cat="${escapeHtml(t.category)}">
        <span class="transaction-name">${escapeHtml(t.itemName)}</span>
        <span class="transaction-category">${escapeHtml(t.category)}</span>
        <span class="transaction-amount">${formatCurrency(t.amount)}</span>
        <button class="btn-delete" data-id="${escapeHtml(t.id)}" aria-label="Delete ${escapeHtml(t.itemName)}">&#215;</button>
      </li>`
    );
  }
  ul.innerHTML = items.join('');
}

/**
 * Escapes a string for safe insertion into HTML attribute values and text nodes.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// Balance Display Component (Task 8.2)
// ---------------------------------------------------------------------------

/**
 * Updates the balance display element with the formatted total.
 * @param {Transaction[]} transactions
 */
function renderBalanceDisplay(transactions) {
  const el = document.getElementById('balance');
  if (!el) return;
  el.textContent = formatCurrency(computeBalance(transactions));
}

// ---------------------------------------------------------------------------
// Delete Event Listener â€” delegated handler (Task 7.3)
// ---------------------------------------------------------------------------

/**
 * Delegated click handler attached to <ul id="transaction-list">.
 * Detects clicks on .btn-delete buttons, deletes the matching transaction,
 * persists, and re-renders all UI regions.
 * @param {MouseEvent} event
 */
function handleDeleteClick(event) {
  const btn = event.target.closest('.btn-delete');
  if (!btn) return;

  const id = btn.dataset.id;
  transactions = deleteTransaction(transactions, id);
  saveToStorage(transactions);
  renderTransactionList(transactions);
  renderBalanceDisplay(transactions);
  renderChart(transactions);
  renderMonthlySummary(transactions);
}

// ---------------------------------------------------------------------------
// Chart Component (Task 9.1)
// ---------------------------------------------------------------------------

/**
 * Returns the color for a given category.
 * Original 3 categories use CATEGORY_COLORS; extras cycle through EXTRA_COLORS.
 * @param {string} category
 * @param {number} extraIndex  index among categories NOT in CATEGORY_COLORS
 * @returns {string}
 */
function getCategoryColor(category, extraIndex) {
  if (Object.prototype.hasOwnProperty.call(CATEGORY_COLORS, category)) {
    return CATEGORY_COLORS[category];
  }
  return EXTRA_COLORS[extraIndex % EXTRA_COLORS.length];
}

/**
 * Renders or updates the Chart.js Pie chart.
 * Empty state: destroys any existing chart instance, hides the canvas,
 * and reveals the placeholder element.
 * Non-empty state: creates the chart on first call; on subsequent calls
 * mutates the existing instance and calls update() to avoid re-creation cost.
 * @param {Transaction[]} transactions
 */
function renderChart(transactions) {
  // Guard: CDN failed to load Chart.js
  if (typeof Chart === 'undefined') return;

  const canvas = document.getElementById('chart');
  const placeholder = document.getElementById('chart-placeholder');
  if (!canvas) return;

  if (transactions.length === 0) {
    // Empty state: destroy chart instance and show placeholder
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    canvas.style.display = 'none';
    if (placeholder) placeholder.style.display = 'block';
    return;
  }

  // Build data arrays from the dynamic CATEGORIES list
  const totals = computeChartData(transactions);

  // Collect all categories that appear in totals (CATEGORIES + any orphaned)
  const allCats = [...CATEGORIES];
  for (const cat of Object.keys(totals)) {
    if (!allCats.includes(cat)) allCats.push(cat);
  }

  // Filter to only categories with non-zero totals for the chart
  const activeCats = allCats.filter(c => (totals[c] || 0) > 0);

  let extraIndex = 0;
  const labels = activeCats;
  const data = activeCats.map(c => totals[c] || 0);
  const backgroundColors = activeCats.map(c => {
    if (Object.prototype.hasOwnProperty.call(CATEGORY_COLORS, c)) {
      return CATEGORY_COLORS[c];
    }
    return EXTRA_COLORS[extraIndex++ % EXTRA_COLORS.length];
  });

  if (chartInstance) {
    // Update existing instance in-place
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = data;
    chartInstance.data.datasets[0].backgroundColor = backgroundColors;
    chartInstance.update();
  } else {
    // First render: show canvas, hide placeholder, create chart
    canvas.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
    chartInstance = new Chart(canvas, {
      type: 'pie',
      data: {
        labels,
        datasets: [{ data, backgroundColor: backgroundColors }],
      },
      options: {
        plugins: {
          legend: { display: true },
        },
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Monthly Summary Component (Feature 3)
// ---------------------------------------------------------------------------

/**
 * Groups transactions by "YYYY-MM" and returns summary objects sorted newest-first.
 * @param {Transaction[]} transactions
 * @returns {MonthlySummary[]}
 */
function computeMonthlySummary(transactions) {
  /** @type {Map<string, MonthlySummary>} */
  const map = new Map();

  for (const t of transactions) {
    const date = new Date(t.createdAt);
    const year  = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const key   = `${year}-${month}`;

    if (!map.has(key)) {
      map.set(key, { month: key, total: 0, count: 0, byCategory: {} });
    }

    const entry = map.get(key);
    entry.total += t.amount;
    entry.count += 1;
    entry.byCategory[t.category] = (entry.byCategory[t.category] || 0) + t.amount;
  }

  // Sort newest-first
  return Array.from(map.values()).sort((a, b) => b.month.localeCompare(a.month));
}

/**
 * Renders the monthly summary section.
 * @param {Transaction[]} transactions
 */
function renderMonthlySummary(transactions) {
  const container = document.getElementById('monthly-summary');
  if (!container) return;

  const summaries = computeMonthlySummary(transactions);

  if (summaries.length === 0) {
    container.innerHTML = '<p class="empty-state">No monthly data available.</p>';
    return;
  }

  const blocks = summaries.map(s => {
    // Format "YYYY-MM" as "January 2025"
    const [year, month] = s.month.split('-');
    const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(
      new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1)
    );
    const title = `${monthLabel} ${year}`;

    // Category breakdown â€” only categories with spending
    const catItems = Object.entries(s.byCategory)
      .filter(([, v]) => v > 0)
      .map(([cat, total]) => `<li>${escapeHtml(cat)}: ${formatCurrency(total)}</li>`)
      .join('');

    return `<div class="month-block">
  <h3 class="month-title">${escapeHtml(title)}</h3>
  <p>Total: <strong>${formatCurrency(s.total)}</strong> (${s.count} transaction${s.count !== 1 ? 's' : ''})</p>
  <ul class="month-categories">${catItems}</ul>
</div>`;
  });

  container.innerHTML = blocks.join('');
}

// ---------------------------------------------------------------------------
// App Initialization â€” DOMContentLoaded bootstrap (Task 10.1)
// ---------------------------------------------------------------------------

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function init() {
    // 1. Load and apply saved theme
    const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
    applyTheme(savedTheme);
    document.getElementById('theme-toggle').addEventListener('click', handleThemeToggle);

    // 2. Load custom categories and render select options
    loadCustomCategories();
    renderCategoryOptions();

    // 3. Attach custom category button listener
    document.getElementById('add-category-btn').addEventListener('click', handleAddCategory);

    // 4. Hydrate state from localStorage
    transactions = loadFromStorage();

    // 5. Render all UI regions with persisted (or empty) state
    renderTransactionList(transactions);
    renderBalanceDisplay(transactions);
    renderChart(transactions);
    renderMonthlySummary(transactions);

    // 6. Attach event listeners for form and delete
    document.getElementById('expense-form').addEventListener('submit', handleFormSubmit);
    document.getElementById('transaction-list').addEventListener('click', handleDeleteClick);
  });
}

// ---------------------------------------------------------------------------
// Single consolidated module export (dual-environment guard)
// ---------------------------------------------------------------------------
if (typeof module !== 'undefined') {
  module.exports = {
    addTransaction,
    deleteTransaction,
    computeBalance,
    formatCurrency,
    computeChartData,
    validateForm,
    saveToStorage,
    loadFromStorage,
    showNotificationBanner,
    handleFormSubmit,
    handleDeleteClick,
    renderTransactionList,
    renderBalanceDisplay,
    renderChart,
    escapeHtml,
    CATEGORY_COLORS,
    saveCustomCategories,
    loadCustomCategories,
    renderCategoryOptions,
    handleAddCategory,
    applyTheme,
    handleThemeToggle,
    computeMonthlySummary,
    renderMonthlySummary,
  };
}


