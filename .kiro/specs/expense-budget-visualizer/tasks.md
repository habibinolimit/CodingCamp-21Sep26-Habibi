# Implementation Plan: Expense & Budget Visualizer

## Overview

Build a fully self-contained, client-side expense tracker delivered as three files (`index.html`, `css/style.css`, `js/app.js`). Implementation proceeds in dependency order: scaffold → pure data/state functions → persistence → validation → UI components → initialization → styling → final verification. Every pure function is exported via `module.exports` (guarded by `typeof module !== 'undefined'`) so the file runs in a browser without a build step.

---

## Tasks

- [x] 1. Project scaffold and HTML skeleton
  - Create the directory structure: `index.html` at root, `css/style.css`, `js/app.js`
  - Write the full HTML skeleton in `index.html`:
    - `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js">` in `<head>` with an `onerror` handler that reveals a static "Chart unavailable" message
    - `<link rel="stylesheet" href="css/style.css">`
    - `<script src="js/app.js" defer></script>`
    - Semantic landmark regions: `<header>` (Balance Display), `<main>` (Input Form + Transaction List), `<aside>` or `<section>` (Chart)
    - `<div id="notification-banner" role="alert" aria-live="assertive">` (hidden by default)
    - `<canvas id="chart">` and `<div id="chart-placeholder">` (for empty state)
    - Empty `css/style.css` and `js/app.js` stubs so the HTML loads without 404s
  - _Requirements: 6.1, 6.3_

- [x] 2. Data models, state module, and pure computation functions
  - [x] 2.1 Define data model constants and the transactions array in `js/app.js`
    - `/** @typedef {Object} Transaction … */` JSDoc typedefs for `Transaction`, `Category`, `ValidationResult`, `CategoryTotals`
    - `const CATEGORIES = ["Food", "Transport", "Fun"]`
    - `let transactions = []` (module-level mutable state)
    - _Requirements: 1.1, 4.4_

  - [x] 2.2 Implement `addTransaction(transactions, item)`
    - Generates a unique `id` via `crypto.randomUUID()` (fallback: `Date.now().toString()`)
    - Sets `createdAt` to `Date.now()`
    - Returns a new array with the new `Transaction` appended (immutable pattern)
    - _Requirements: 1.2_

  - [x] 2.3 Implement `deleteTransaction(transactions, id)`
    - Returns a new array filtered to exclude the transaction matching `id`
    - _Requirements: 2.4_

  - [x] 2.4 Implement `computeBalance(transactions)`
    - Returns the arithmetic sum of all `amount` values (returns `0` for empty array)
    - _Requirements: 3.1, 3.4_

  - [x] 2.5 Implement `formatCurrency(amount)`
    - Returns a string with `$` prefix, exactly two decimal places, and thousands separators for values ≥ 1,000 (e.g., `"$1,234.56"`)
    - Use `Intl.NumberFormat` or manual formatting
    - _Requirements: 3.1_

  - [x] 2.6 Implement `computeChartData(transactions)`
    - Returns a `CategoryTotals` object `{ Food: number, Transport: number, Fun: number }` with per-category sums
    - Categories with no transactions have value `0`
    - _Requirements: 4.1_

- [x] 3. LocalStorage persistence module
  - [x] 3.1 Implement `saveToStorage(transactions)` and `loadFromStorage()` in `js/app.js`
    - `const STORAGE_KEY = 'expense_visualizer_transactions'`
    - `saveToStorage`: `JSON.stringify` + `localStorage.setItem`; wrap in `try/catch`, call `showNotificationBanner` on failure
    - `loadFromStorage`: `localStorage.getItem` + `JSON.parse`; return `[]` and call `showNotificationBanner` on any failure (missing key, parse error, thrown exception)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 4. Validator
  - [x] 4.1 Implement `validateForm(formData)` in `js/app.js`
    - Rules: `itemName` non-empty after trim, max 100 chars; `amount` numeric > 0 and ≤ 999,999,999.99; `category` one of `CATEGORIES`
    - Returns `{ valid: boolean, errors: { itemName?, amount?, category? } }` with human-readable error strings
    - _Requirements: 1.4, 1.5, 1.6, 1.7, 1.8_

- [x] 5. Notification banner component
  - [x] 5.1 Implement `showNotificationBanner(message, durationMs = 5000)` in `js/app.js`
    - Reads `<div id="notification-banner">`, sets `textContent`, removes `display: none` (or adds a visible class)
    - Sets a `setTimeout` to re-hide after `durationMs` milliseconds
    - Non-blocking — does not use `window.alert`
    - _Requirements: 5.5, 5.6_

- [x] 6. Input Form component
  - [x] 6.1 Add Input Form HTML to `index.html`
    - `<form id="expense-form">` with:
      - `<input type="text" id="item-name" maxlength="100">` + `<span class="error-msg" aria-live="polite" id="item-name-error">`
      - `<input type="number" id="amount" step="0.01">` + `<span class="error-msg" aria-live="polite" id="amount-error">`
      - `<select id="category">` with `<option value="">Select a category</option>` + Food, Transport, Fun options + `<span class="error-msg" aria-live="polite" id="category-error">`
      - `<button type="submit">Add Expense</button>`
    - _Requirements: 1.1_

  - [x] 6.2 Implement the form submit handler in `js/app.js`
    - Reads field values, calls `validateForm`
    - If invalid: populates each `error-msg` span's `textContent`, returns early (no state mutation)
    - If valid: calls `addTransaction`, updates `transactions`, calls `saveToStorage`, calls all three render functions, resets the form (clears fields, resets `<select>` to placeholder option), clears all error spans
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [x] 7. Transaction List component
  - [x] 7.1 Add `<ul id="transaction-list">` to `index.html` within the Transaction List section
    - _Requirements: 2.1, 2.2, 2.5_

  - [x] 7.2 Implement `renderTransactionList(transactions)` in `js/app.js`
    - Empty state: renders `<li class="empty-state">No expenses recorded yet.</li>` when `transactions.length === 0`
    - Non-empty state: iterates array in reverse (newest-first), renders one `<li>` per transaction displaying `itemName`, formatted `amount`, and `category`
    - Each `<li>` includes `<button class="btn-delete" data-id="{id}">×</button>`
    - _Requirements: 2.1, 2.3, 2.5_

  - [x] 7.3 Implement the delete event listener (delegated) in `js/app.js`
    - Attach one `click` listener to `<ul id="transaction-list">`
    - On click, read `event.target.closest('.btn-delete')?.dataset.id`
    - Call `deleteTransaction(transactions, id)`, update `transactions`, call `saveToStorage`, call all three render functions
    - _Requirements: 2.4, 2.6_

- [x] 8. Balance Display component
  - [x] 8.1 Add `<span id="balance">` inside the Balance Display header in `index.html`
    - _Requirements: 3.1, 3.4_

  - [x] 8.2 Implement `renderBalanceDisplay(transactions)` in `js/app.js`
    - Calls `computeBalance(transactions)` then `formatCurrency(total)` and sets `document.getElementById('balance').textContent`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 9. Chart component
  - [x] 9.1 Define `CATEGORY_COLORS` constant and implement `renderChart(transactions)` in `js/app.js`
    - `const CATEGORY_COLORS = { Food: '#FF6384', Transport: '#36A2EB', Fun: '#FFCE56' }`
    - `let chartInstance = null` (module-level)
    - Empty state path: call `chartInstance.destroy()` if it exists, set `chartInstance = null`, hide `<canvas id="chart">`, show `<div id="chart-placeholder">` with message "No spending data available."
    - Non-empty state path: call `computeChartData(transactions)`; if `chartInstance` exists, mutate `chartInstance.data` and call `chartInstance.update()`; otherwise `new Chart(canvas, config)` and store in `chartInstance`; hide placeholder, show canvas
    - Chart config: `type: 'pie'`, datasets use `CATEGORY_COLORS`, `plugins.legend.display: true` with category names as labels
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 10. App initialization
  - [x] 10.1 Implement the `DOMContentLoaded` bootstrap sequence in `js/app.js`
    - Load: `transactions = loadFromStorage()`
    - Render: call `renderTransactionList(transactions)`, `renderBalanceDisplay(transactions)`, `renderChart(transactions)` in sequence
    - Attach event listeners: form `submit` handler (Task 6.2), delete delegated listener on `<ul>` (Task 7.3)
    - All of the above runs inside `document.addEventListener('DOMContentLoaded', …)`
    - _Requirements: 5.3, 5.4, 6.4_

- [x] 11. CSS styling
  - [x] 11.1 Implement base layout and typography in `css/style.css`
    - Body font size ≥ 14px; heading sizes ≥ 18px (at least 4px larger than body)
    - Four visually distinct sections (Balance Display, Input Form, Transaction List, Chart) separated by ≥ 16px whitespace or visible dividers
    - Transaction List: `overflow-y: auto` with a max-height so it scrolls when entries exceed the container
    - _Requirements: 7.1, 7.2_

  - [x] 11.2 Implement color, contrast, and interactive states in `css/style.css`
    - All text/control colors meet WCAG 2.1 AA 4.5:1 contrast ratio against their backgrounds
    - `:hover` and `:focus` styles on all interactive controls (submit button, delete buttons, form fields, select) providing a visible color or border change within 100 ms (CSS transitions ≤ 100 ms)
    - `.error-msg` class: `display: none` by default; shown when `textContent` is non-empty via JS
    - `#notification-banner`: `position: fixed`, top of viewport, `display: none` by default
    - `#chart-placeholder`: visible only when chart is in empty state
    - _Requirements: 7.3, 7.5_

  - [x] 11.3 Implement responsive layout in `css/style.css`
    - `@media (max-width: 599px)`: Balance Display, Input Form, Transaction List, and Chart stack vertically in a single column; no horizontal scrollbar
    - _Requirements: 7.4_

- [x] 12. Final verification
  - Open `index.html` directly in a browser (no server required)
  - Confirm all four sections render: Balance Display shows `$0.00`, Input Form is interactive, Transaction List shows empty-state message, Chart shows placeholder
  - Add a transaction for each category (Food, Transport, Fun) and verify the Transaction List updates newest-first, Balance Display reflects the correct total, and Chart updates with correct segment proportions and legend
  - Delete one transaction and verify the Transaction List, Balance Display, and Chart all update immediately
  - Reload the page and verify all remaining transactions are restored from LocalStorage (Transaction List, Balance, and Chart all reflect the saved state)
  - Verify the app loads to an interactive state within 3 seconds on a standard broadband connection
  - _Requirements: 1.1–1.8, 2.1–2.6, 3.1–3.4, 4.1–4.6, 5.1–5.6, 6.1–6.5_

---

## Notes

- All pure functions (`addTransaction`, `deleteTransaction`, `computeBalance`, `formatCurrency`, `computeChartData`, `validateForm`, `saveToStorage`, `loadFromStorage`) must be guarded for dual-environment export: `if (typeof module !== 'undefined') module.exports = { … }`.
- The 10 correctness properties in `design.md` are documentation only — they describe the behavioral invariants each function must uphold during implementation.
- Chart.js is loaded from CDN and is not available in offline environments — the `onerror` handler on the CDN `<script>` tag guards against this gracefully.
- Implementation order matters: `showNotificationBanner` (Task 5) must exist before `saveToStorage`/`loadFromStorage` (Task 3) call it; wire the dependency manually if needed during development.

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "2.6"] },
    { "id": 3, "tasks": ["3.1", "4.1"] },
    { "id": 4, "tasks": ["5.1"] },
    { "id": 5, "tasks": ["6.1", "7.1", "8.1"] },
    { "id": 6, "tasks": ["6.2", "7.2", "8.2"] },
    { "id": 7, "tasks": ["7.3", "9.1"] },
    { "id": 8, "tasks": ["10.1"] },
    { "id": 9, "tasks": ["11.1"] },
    { "id": 10, "tasks": ["11.2", "11.3"] }
  ]
}
```
