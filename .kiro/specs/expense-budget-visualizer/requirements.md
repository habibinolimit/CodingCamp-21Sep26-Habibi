# Requirements Document

## Introduction

The Expense & Budget Visualizer is a standalone client-side web application that allows users to track personal spending by adding expense transactions, viewing a categorized transaction list, monitoring a running total balance, and seeing a live pie chart of spending distribution by category. All data persists in the browser's LocalStorage with no backend server required. The app is built with HTML, CSS, and Vanilla JavaScript and must run in modern browsers.

## Glossary

- **App**: The Expense & Budget Visualizer web application running in the browser.
- **Transaction**: A single expense record consisting of an item name, a monetary amount, and a category.
- **Category**: One of the three predefined spending groups — Food, Transport, or Fun.
- **Transaction_List**: The scrollable on-screen list that displays all stored Transactions.
- **Balance_Display**: The numeric total shown at the top of the App, representing the sum of all Transaction amounts.
- **Input_Form**: The HTML form containing the Item Name field, Amount field, and Category selector.
- **Validator**: The client-side validation logic that checks Input_Form completeness before submission.
- **LocalStorage**: The browser's built-in key-value storage API used for client-side data persistence.
- **Chart**: The pie chart component (rendered via Chart.js) that visualises spending distribution by Category.
- **Chart_Engine**: The Chart.js library instance responsible for rendering and updating the Chart.

---

## Requirements

### Requirement 1: Transaction Input Form

**User Story:** As a user, I want to fill in an expense form with a name, amount, and category, so that I can record a new spending transaction quickly.

#### Acceptance Criteria

1. THE Input_Form SHALL render an Item Name text field (maximum 100 characters), an Amount numeric field, and a Category selector containing the options Food, Transport, and Fun.
2. WHEN the user submits the Input_Form with all fields filled and a valid positive numeric Amount greater than 0 and not exceeding 999,999,999.99, THE App SHALL add a new Transaction to the Transaction_List.
3. WHEN the user submits the Input_Form with all fields filled and a valid positive numeric Amount, THE App SHALL clear all Input_Form fields and reset the Category selector to its default placeholder state (no option selected) after the Transaction is added.
4. IF the user submits the Input_Form with the Item Name field empty, THEN THE Validator SHALL display an inline error message adjacent to the Item Name field indicating that the Item Name field is required.
5. IF the user submits the Input_Form with the Amount field empty, THEN THE Validator SHALL display an inline error message adjacent to the Amount field indicating that the Amount field is required.
6. IF the user submits the Input_Form with an Amount value that is zero, negative, non-numeric, or exceeds 999,999,999.99, THEN THE Validator SHALL display an inline error message adjacent to the Amount field indicating that the Amount must be a positive number no greater than 999,999,999.99.
7. IF the user submits the Input_Form without selecting a Category, THEN THE Validator SHALL display an inline error message adjacent to the Category selector indicating that a Category must be selected.
8. WHILE the Validator displays an error message, THE Input_Form SHALL prevent the Transaction from being added to the Transaction_List.

---

### Requirement 2: Transaction List

**User Story:** As a user, I want to see a scrollable list of all my recorded expenses, so that I can review my spending history at any time.

#### Acceptance Criteria

1. THE Transaction_List SHALL display each Transaction with its Item Name, Amount, and Category rendered in full without truncation.
2. WHILE the number of Transactions exceeds the visible height of the Transaction_List container, THE Transaction_List SHALL scroll vertically to allow the user to view all Transactions.
3. THE Transaction_List SHALL display Transactions in the order they were added, with the most recently added Transaction appearing at the top of the list.
4. WHEN the user clicks the delete control on a Transaction, THE App SHALL immediately remove that Transaction from the Transaction_List without displaying a confirmation prompt.
5. WHEN the Transaction_List contains no Transactions, THE App SHALL display an empty-state message inside the Transaction_List area indicating that no expenses have been recorded.
6. WHEN the user deletes the last remaining Transaction, THE App SHALL immediately display the empty-state message in the Transaction_List area.

---

### Requirement 3: Total Balance Display

**User Story:** As a user, I want to see my total spending amount at the top of the page, so that I always know how much I have spent in total.

#### Acceptance Criteria

1. THE Balance_Display SHALL show the sum of all Transaction amounts formatted with a currency symbol prefix, exactly two decimal places, and a thousands separator for values of 1,000 or greater (e.g., $1,234.56).
2. WHEN a new Transaction is added, THE Balance_Display SHALL update to reflect the new total within 100 milliseconds.
3. WHEN a Transaction is deleted, THE Balance_Display SHALL update to reflect the new total within 100 milliseconds.
4. WHEN the Transaction_List contains no Transactions, THE Balance_Display SHALL display $0.00 using the same format defined in criterion 1.

---

### Requirement 4: Category Pie Chart

**User Story:** As a user, I want to see a pie chart of my spending by category, so that I can understand where my money is going at a glance.

#### Acceptance Criteria

1. THE Chart SHALL display a pie chart with one segment per Category that has at least one Transaction, where each segment size is proportional to the sum of Transaction amounts for that Category relative to the total sum of all Transaction amounts.
2. WHEN a new Transaction is added, THE Chart_Engine SHALL update the Chart to reflect the new spending distribution, recalculating each segment as the sum of Transaction amounts for its Category, within 100 milliseconds.
3. WHEN a Transaction is deleted, THE Chart_Engine SHALL update the Chart to reflect the revised spending distribution, recalculating each segment as the sum of Transaction amounts for its Category, within 100 milliseconds.
4. THE Chart SHALL render each Category segment in a unique colour such that no two segments share the same colour.
5. THE Chart SHALL display a legend identifying each Category by name and its associated colour.
6. WHEN the Transaction_List contains no Transactions, THE Chart_Engine SHALL display a placeholder state containing a message indicating that no spending data is available, instead of rendering a pie chart.

---

### Requirement 5: Data Persistence

**User Story:** As a user, I want my expense data to be saved between browser sessions, so that I do not lose my transaction history when I close and reopen the app.

#### Acceptance Criteria

1. WHEN a new Transaction is added, THE App SHALL write the complete updated Transaction array to LocalStorage under a fixed key before the next user interaction is processed.
2. WHEN a Transaction is deleted, THE App SHALL write the complete updated Transaction array to LocalStorage under a fixed key before the next user interaction is processed.
3. WHEN the App loads in the browser, THE App SHALL read all Transaction data from LocalStorage and populate the Transaction_List, Balance_Display, and Chart with the stored data before accepting user input.
4. IF LocalStorage contains no Transaction data on App load, THEN THE App SHALL initialise with an empty Transaction_List, a $0.00 Balance_Display, and the Chart placeholder state.
5. IF a LocalStorage write operation fails, THEN THE App SHALL display a non-blocking notification banner at the top of the viewport indicating that the transaction could not be saved, and the notification SHALL dismiss automatically after 5 seconds.
6. IF a LocalStorage read operation fails on App load, THEN THE App SHALL display a non-blocking notification banner indicating that saved data could not be loaded and THE App SHALL initialise in the empty state as defined in criterion 4.

---

### Requirement 6: Technical Constraints

**User Story:** As a developer, I want the app to be built with a constrained, minimal stack, so that it runs as a standalone file without any build tools or server.

#### Acceptance Criteria

1. THE App SHALL be implemented using only HTML, CSS, and Vanilla JavaScript with no frontend framework dependencies beyond Chart.js loaded from a CDN.
2. THE App SHALL load and operate correctly in the current stable release of Chrome, Firefox, Edge, and Safari without requiring any polyfills.
3. THE App SHALL consist of a single HTML entry file referencing exactly one CSS file located in a `css/` directory and exactly one JavaScript file located in a `js/` directory, with no additional script or stylesheet files.
4. THE App SHALL reach an interactive state (DOM loaded, LocalStorage data hydrated, Chart rendered) within 3 seconds when opened directly from the local file system on a standard broadband connection.
5. WHERE Chart.js is loaded from a CDN, THE App SHALL reference Chart.js using a URL that includes the full semver version string (e.g., `https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js`) to ensure reproducible behaviour across sessions.

---

### Requirement 7: Visual Design and Usability

**User Story:** As a user, I want a clean, minimal interface with clear visual hierarchy, so that I can use the app without confusion or visual clutter.

#### Acceptance Criteria

1. THE App SHALL apply a consistent typographic scale with a minimum body font size of 14px and heading sizes at least 4px larger than body text for visual hierarchy.
2. THE App SHALL present the Balance_Display, Input_Form, Transaction_List, and Chart as visually distinct sections separated by at least 16px of whitespace or a visible divider.
3. THE App SHALL render all text and interactive controls with a colour contrast ratio of at least 4.5:1 against their background to meet WCAG 2.1 AA requirements.
4. WHEN the viewport width is below 600px, THE App SHALL reflow its layout so that the Balance_Display, Input_Form, Transaction_List, and Chart stack vertically in a single column and no horizontal scrollbar appears.
5. THE App SHALL provide visual feedback within 100 milliseconds when the user hovers over or focuses an interactive control, such as a colour or border change on buttons and form fields.
