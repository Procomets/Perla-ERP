# Perla ERP Table Standards: Search, Column Filters & 3-State Sorting

All data tables and ledger views in Perla ERP must adhere to the standard table controls pattern.

### 1. Integrated Search & Column Selector
- Combine a column selector dropdown with the search input:
  - Option `ALL`: searches across all relevant columns.
  - Specific column options (e.g., `Order No`, `Date`, `Vendor`, `Item`, `Status`).
  - Search input includes a clear (`X`) button when a query is entered.

### 2. Inline Column Filters
- Provide a `Column Filters` toggle button with a gray circle badge (`bg-slate-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold`) indicating the number of active column filters.
- When toggled ON, render an additional header row (`sticky top-[41px] z-20`) containing lightweight `<input>` filter elements under each column header.
- Text columns align left, numeric/currency/quantity columns align right, badges/status/vehicle align center.
- Provide a quick "Clear" button in the Actions column of the filter row when any column filter is active.

### 3. 3-State Column Sorting (With Normal Form)
- Clicking a column header must cycle through 3 states:
  1. **Click 1**: Sort in primary direction (`desc` for dates, weights, quantities, amounts; `asc` for text/codes).
  2. **Click 2**: Sort in opposite direction (`asc` or `desc`).
  3. **Click 3**: **Normal Form** (`normal` / reset to default unsorted arrival order).
- Column headers must show:
  - `ChevronUp` (stroke 2.5) when sorted ascending.
  - `ChevronDown` (stroke 2.5) when sorted descending.
  - Subtle `ArrowUpDown` icon (stroke 2, opacity 60%) when in normal/idle form.

### 4. Persistent Header & In-Table Empty State
- **Never hide the table structure when 0 rows match**:
  - The table header and column filter row must ALWAYS remain visible.
  - Inside `<tbody>`, if the filtered list is empty, render a single row spanning all columns (`colSpan={columns.length}`) with an empty-state illustration, explanatory text, and a **"Reset All Filters"** button.

### 5. Sticky Table Headers
- Table container must have `max-h-[620px] overflow-auto relative border border-slate-200 rounded-xl`.
- `<thead>` must have `sticky top-0 z-20 shadow-[0_1px_3px_rgba(0,0,0,0.06)]`.
- Every `<th>` must have `sticky top-0 z-20 bg-...` with an opaque background matching the tab theme and `border-b-2`.

### 6. Standard Reusable Hook
- Reusable hook available at `src/hooks/useTableControls.tsx` for state management, 3-state sorting, and multi-column filtering.

### 7. No Page Limits (All Data in One Stretch)
- Never arbitrarily paginate or slice table data with 10-per-page or 15-per-page limits.
- Load and render all records in one stretch so users can scroll smoothly through the entire dataset without clicking Next/Previous.
- Replace pagination navigation controls with an informative summary footer:
  `Showing all {count} records in one stretch (filtered from {total} total)`.
- Combined with sticky table headers (`sticky top-0 z-20`) and inline filter row (`sticky top-[41px] z-20`), users can scroll freely through hundreds or thousands of rows while the column titles and filter controls remain pinned to the top.
