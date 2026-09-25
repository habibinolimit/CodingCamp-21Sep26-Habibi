# Design Document

## Expense & Budget Visualizer

---

## Overview

The Expense & Budget Visualizer is a self-contained, client-side web application that runs directly from the local file system. There is no server, no build step, and no framework — just a single HTML entry file, one CSS file, and one JavaScript file. Chart.js is loaded from a pinned CDN URL.

The application gives users a simple workflow:

1. Fill in the Input Form (item name, amount, category).
2. See the new transaction appear at the top of the Transaction List.
3. Watch the Balance Display and Pie Chart update immediately.
4. Return later — all data is persisted in `localStorage` and rehydrated on load.

The entire application state lives in one in-memory array of transaction objects. Every mutation (add or delete) writes the full array to `localStorage` and then re-renders all dependent UI regions synchronously.

---

## Architecture

The application follows a **unidirectional data-flow** pattern without a framework:

```
User Action
    │
    ▼
Event Handler (js/app.js)
    │
    ├─► State Mutation  ──►  localStorage.setItem()
    │
    └─► Render Pass
          ├── renderTransactionList()
          ├── renderBalanceDisplay()
          └── renderChart()
```

All rendering functions are pure with respect to the global state array: given the same `transactions` array they always produce the same DOM output. This makes the logic easy to test in isolation.

**File layout (required by Requirement 6.3):**

```
index.html          ← single HTML entry point
css/
  style.css         ← all styles
js/
  app.js            ← all JavaScript
```

No additional files may exist. Chart.js is referenced inline in `index.html` via a CDN `<script>` tag.

---

## Components and Interfaces

### 1. State Module

A single module-level array holds all transactions during a session:

```js
/** @type {Transaction[]} */
let transactions = [];
```

All functions that read or write state receive/return this array explicitly to keep logic testable.

**Public API (module-internal functions):**

| Function | Signature | Description |
|---|---|---|
| `addTransaction` | `(transactions, item) → Transaction[]` | Returns new array with item appended |
| `deleteTransaction` | `(transactions, id) → Transaction[]` | Returns new array without the item matching `id` |
| `computeBalance` | `(transactions) → number` | Returns sum of all amounts |
| `computeChartData` | `(transactions) → CategoryTotals` | Returns per-category sums |
| `formatCurrency` | `(amount) → string` | Returns `"$1,234.56"` formatted string |

### 2. Validator

The validator runs before any state mutation. It is a pure function that returns a `ValidationResult` object.

```js
/**
 * @param {object} formData
 * @returns {ValidationResult}
 */
function validateForm(formData) { … }
```

Validation rules (from Requirements 1.4–1.8):
- `itemName`: must be a non-empty string after trimming; max 100 characters
- `amount`: must be a numeric value `> 0` and `<= 999,999,999.99`; non-numeric input is invalid
- `category`: must be one of `"Food"`, `"Transport"`, `"Fun"`

The validator returns an object `{ valid: boolean, errors: { itemName?, amount?, category? } }`. Each error value is the human-readable message string to display inline.

### 3. Input Form Component

Owns the `<form>` element. Listens for `submit`. On submit:
1. Reads field values.
2. Calls `validateForm`.
3. If invalid: renders inline error messages, stops.
4. If valid: calls `addTransaction`, persists, renders all UI, resets form.

**Form reset** after valid submission clears all three fields and resets the Category `<select>` to its placeholder `<option value="">` (Requirement 1.3).

**Inline error display**: each field has a sibling `<span class="error-msg" aria-live="polite">` element. Errors are written into `textContent`; the element is hidden via `display: none` when empty. This satisfies Requirement 1.4–1.7 and keeps the markup accessible.

### 4. Transaction List Component

Renders the `<ul id="transaction-list">` element.

- **Empty state**: when `transactions.length === 0`, renders a single `<li class="empty-state">No expenses recorded yet.</li>` (Requirements 2.5, 2.6).
- **Item order**: renders newest-first by iterating the array in reverse (Requirements 2.3). The array itself is append-only; display order is handled at render time.
- **Delete button**: each `<li>` contains `<button class="btn-delete" data-id="…">×</button>`. A delegated event listener on the `<ul>` handles clicks, reads `data-id`, calls `deleteTransaction`, persists, re-renders (Requirement 2.4).

### 5. Balance Display Component

Updates the `<span id="balance">` element:

```js
function renderBalanceDisplay(transactions) {
  const total = computeBalance(transactions);
  document.getElementById('balance').textContent = formatCurrency(total);
}
```

Always called synchronously on every add/delete, guaranteeing the ≤100 ms requirement (Requirements 3.1–3.4).

### 6. Chart Component

Wraps a Chart.js `Pie` chart rendered in `<canvas id="chart">`.

**Chart.js version**: `4.4.0` loaded from `https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js` (Requirement 6.5).

On first render, a `Chart` instance is created and stored in a module variable `let chartInstance = null`. On subsequent updates `chartInstance.data` is mutated and `chartInstance.update()` is called — avoiding the cost of destroying and recreating the chart.

**Placeholder state** (Requirement 4.6): when there are no transactions, `chartInstance.destroy()` is called (if it existed), the canvas is hidden, and a `<div id="chart-placeholder">` is made visible.

**Color map** (Requirement 4.4): colors are assigned statically per category, guaranteeing uniqueness:

| Category | Color |
|---|---|
| Food | `#FF6384` |
| Transport | `#36A2EB` |
| Fun | `#FFCE56` |

### 7. Persistence Module

```js
const STORAGE_KEY = 'expense_visualizer_transactions';

function saveToStorage(transactions) { … }   // JSON.stringify + setItem
function loadFromStorage() { … }             // getItem + JSON.parse
```

Both functions wrap their operations in `try/catch`. On failure they call `showNotificationBanner(message)` (Requirements 5.5, 5.6).

**Hydration on load** (Requirement 5.3): `DOMContentLoaded` calls `loadFromStorage()`, assigns the result to `transactions`, then calls all three render functions before attaching event listeners.

### 8. Notification Banner Component

A `<div id="notification-banner" role="alert" aria-live="assertive">` element positioned fixed at the top of the viewport. It starts `display: none`.

```js
function showNotificationBanner(message, durationMs = 5000) {
  // set textContent, remove display:none, set timeout to hide
}
```

Auto-dismisses after 5 seconds (Requirement 5.5, 5.6). Non-blocking — does not use `window.alert`.

---

## Data Models

### Transaction

```js
/**
 * @typedef {Object} Transaction
 * @property {string} id         - Unique identifier (crypto.randomUUID() or Date.now().toString())
 * @property {string} itemName   - Display name, 1–100 characters
 * @property {number} amount     - Positive number, > 0, <= 999,999,999.99
 * @property {Category} category - One of the three predefined categories
 * @property {number} createdAt  - Unix timestamp (ms) of when the transaction was added
 */
```

### Category

```js
/** @typedef {"Food" | "Transport" | "Fun"} Category */
const CATEGORIES = ["Food", "Transport", "Fun"];
```

### ValidationResult

```js
/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid
 * @property {{ itemName?: string, amount?: string, category?: string }} errors
 */
```

### CategoryTotals

```js
/**
 * @typedef {Object} CategoryTotals
 * @property {number} Food
 * @property {number} Transport
 * @property {number} Fun
 */
```

### LocalStorage Schema

The entire `Transaction[]` array is stored as a single JSON string under the key `"expense_visualizer_transactions"`. There is no versioning scheme; if the key is absent or the value fails `JSON.parse`, the app initialises in the empty state.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

---

### Property 1: Valid input always adds exactly one transaction

*For any* valid transaction input (non-empty item name ≤ 100 chars, amount in (0, 999,999,999.99], any of the three categories), calling `addTransaction(transactions, newItem)` should return an array whose length is exactly `transactions.length + 1` and whose last element contains the same `itemName`, `amount`, and `category` as the input.

**Validates: Requirements 1.2**

---

### Property 2: Invalid amounts are always rejected by the validator

*For any* amount value that is zero, negative, non-numeric, or greater than 999,999,999.99, `validateForm({ itemName: "X", amount: invalidAmount, category: "Food" })` should return `{ valid: false }` with a non-empty `errors.amount` string.

**Validates: Requirements 1.6**

---

### Property 3: Invalid form input never adds a transaction

*For any* form submission where at least one field is invalid (empty item name, invalid amount, or missing category), the transaction array should be unchanged after the attempted submission — the invalid submission must not produce a side effect on the list.

**Validates: Requirements 1.8**

---

### Property 4: Every transaction is fully represented in the rendered list

*For any* non-empty transaction array, `renderTransactionList(transactions)` should produce markup where each transaction's `itemName`, formatted `amount`, and `category` appear in the rendered output without truncation.

**Validates: Requirements 2.1**

---

### Property 5: Transactions are always displayed newest-first

*For any* sequence of transactions added in a known order, the rendered list should present them in reverse insertion order (most recently added at the top).

**Validates: Requirements 2.3**

---

### Property 6: Delete removes exactly the targeted transaction

*For any* non-empty transaction array and any valid transaction `id` in that array, `deleteTransaction(transactions, id)` should return an array that does not contain the deleted transaction and still contains all other transactions unchanged (count decreases by exactly 1).

**Validates: Requirements 2.4**

---

### Property 7: Balance is always the correctly formatted sum

*For any* array of transactions with valid amounts, `formatCurrency(computeBalance(transactions))` should equal the string representation of the exact arithmetic sum of all `amount` values, formatted with a `$` prefix, exactly two decimal places, and thousands separators for values ≥ 1,000.

**Validates: Requirements 3.1**

---

### Property 8: Chart data reflects exact per-category sums

*For any* non-empty transaction array, `computeChartData(transactions)` should return a `CategoryTotals` object where each category's value equals the exact arithmetic sum of `amount` across all transactions belonging to that category, and no category with zero transactions appears with a non-zero value.

**Validates: Requirements 4.1**

---

### Property 9: Category colors are always unique

*For any* non-empty subset of categories present in the chart data, the color values assigned to each category in the color map are all distinct — no two categories share the same color string.

**Validates: Requirements 4.4**

---

### Property 10: LocalStorage persistence is a lossless round-trip

*For any* array of valid transactions, serializing the array with `saveToStorage(transactions)` and then reading it back with `loadFromStorage()` should produce an array that is deeply equal to the original — same length, same `id`, `itemName`, `amount`, `category`, and `createdAt` values for every element.

**Validates: Requirements 5.1, 5.2, 5.3**

---

## Error Handling

### Validation Errors (form submission)

- **Trigger**: any field fails `validateForm`.
- **Behavior**: inline error `<span>` next to the offending field is populated; form submission is blocked; no state mutation occurs.
- **Recovery**: user corrects the field and resubmits; error spans are cleared on the next valid submission.
- **Implementation note**: error spans use `aria-live="polite"` so screen readers announce them without interrupting ongoing speech.

### LocalStorage Write Failure

- **Trigger**: `localStorage.setItem()` throws (e.g., storage quota exceeded, private-browsing restriction).
- **Behavior**: the in-memory `transactions` array has already been updated and the UI has re-rendered (the transaction is visible). A non-blocking notification banner appears at the top of the viewport with the message `"Transaction could not be saved. Changes may be lost when you close the tab."`.
- **Recovery**: the banner auto-dismisses after 5 seconds. No data is rolled back in memory; the user can continue using the app.
- **Implementation**: `try { localStorage.setItem(…) } catch { showNotificationBanner(…) }`

### LocalStorage Read Failure on Load

- **Trigger**: `localStorage.getItem()` throws, or `JSON.parse` throws on a corrupted value.
- **Behavior**: `transactions` initialises as `[]`; all three UI regions render in their empty states. A non-blocking notification banner appears with the message `"Saved data could not be loaded. Starting with an empty list."`.
- **Recovery**: banner auto-dismisses after 5 seconds. User can start adding transactions normally.

### Chart.js CDN Load Failure

- **Trigger**: CDN is unreachable (offline, DNS failure).
- **Behavior**: the Chart canvas area renders nothing (no runtime error because Chart.js is guarded). A static `<noscript>`-equivalent message or `onerror` handler on the `<script>` tag informs the user that the chart is unavailable.
- **Scope**: out-of-scope for unit tests; covered by manual testing.

---

## Testing Strategy

### Overview

The app has no build pipeline, so tests run via a lightweight test harness — [Jest](https://jestjs.io/) configured with `jsdom` (for DOM APIs) and [fast-check](https://fast-check.dev/) for property-based testing. Tests import the pure functions exported from `js/app.js` (functions are exported via `module.exports` when running under Node/Jest and attached to `window` in the browser).

**Dual Testing Approach:**
- **Unit / example tests** — verify concrete scenarios, edge cases, and error conditions.
- **Property-based tests** — verify the universal properties defined above across hundreds of randomly generated inputs. Each property-based test runs a minimum of **100 iterations**.

### Property-Based Tests

Each PBT is tagged with a comment referencing the design property:

```js
// Feature: expense-budget-visualizer, Property 1: Valid input always adds exactly one transaction
```

| Property | Test Target | Generator |
|---|---|---|
| P1 — valid input adds exactly one transaction | `addTransaction` | `fc.record({ itemName: fc.string({minLength:1,maxLength:100}), amount: fc.float({min:0.01,max:999999999.99}), category: fc.constantFrom(...CATEGORIES) })` |
| P2 — invalid amounts always rejected | `validateForm` | `fc.oneof(fc.constant(0), fc.float({max:-0.01}), fc.float({min:1000000000}), fc.string().filter(s => isNaN(parseFloat(s))))` |
| P3 — invalid input never adds transaction | `validateForm` + `addTransaction` | Arbitrary invalid form data tuples |
| P4 — every transaction fully rendered | `renderTransactionList` (DOM) | `fc.array(arbitraryTransaction(), {minLength:1})` |
| P5 — transactions displayed newest-first | Rendered list order | `fc.array(arbitraryTransaction(), {minLength:2})` |
| P6 — delete removes exactly targeted transaction | `deleteTransaction` | `fc.array(arbitraryTransaction(), {minLength:1})` + random valid index |
| P7 — balance is correctly formatted sum | `computeBalance` + `formatCurrency` | `fc.array(fc.float({min:0.01,max:999999999.99}), {minLength:0})` |
| P8 — chart data reflects per-category sums | `computeChartData` | `fc.array(arbitraryTransaction(), {minLength:1})` |
| P9 — category colors are distinct | Color map | `fc.subarray(CATEGORIES, {minLength:1})` |
| P10 — LocalStorage round-trip | `saveToStorage` + `loadFromStorage` (mocked) | `fc.array(arbitraryTransaction(), {minLength:0})` |

### Example / Unit Tests

- Input form renders with correct field attributes (1.1)
- Submitting with empty item name shows name error (1.4)
- Submitting with empty amount shows amount error (1.5)
- Submitting with no category selected shows category error (1.7)
- Transaction list shows empty-state when list is empty (2.5, 5.4)
- Deleting the last transaction shows empty-state (2.6)
- Balance shows `$0.00` with empty list (3.4)
- Chart shows placeholder when list is empty (4.6)
- `loadFromStorage` returns `[]` when key absent (5.4)
- `showNotificationBanner` appears and dismisses on mocked write failure (5.5)
- `showNotificationBanner` appears and app is in empty state on mocked read failure (5.6)
- Chart legend is configured with all present category names (4.5)

### Integration Tests

- Adding a transaction updates Balance and Chart within 100 ms (3.2, 4.2)
- Deleting a transaction updates Balance and Chart within 100 ms (3.3, 4.3)
- App hydrates correctly from `localStorage` on `DOMContentLoaded` (5.3)

### Accessibility and Visual Tests

- WCAG 2.1 AA color contrast — automated with [axe-core](https://github.com/dequelabs/axe-core) (7.3)
- Responsive layout at 599 px viewport — browser DevTools / visual regression (7.4)
- Hover/focus CSS rules present in stylesheet — static CSS review (7.5)
- Font size ≥ 14 px body, heading ≥ 18 px — static CSS review (7.1)

### Test Configuration

```js
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFiles: ['./tests/setup.js'],
};
```

Each property-based test uses `fc.assert(fc.property(…), { numRuns: 100 })`.
