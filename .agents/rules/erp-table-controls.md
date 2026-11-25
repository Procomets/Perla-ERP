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

### 5. Universal Light Blue Table Headers (`#EEF5FB`)
- All ERP tables must use the universal Light Blue table header palette:
  - **Header Row (`<thead> <tr>`)**:
    `bg-[#EEF5FB] text-[#1F4E79] uppercase tracking-wider font-bold text-[11px] border-b-2 border-slate-300 shadow-[0_1px_3px_rgba(0,0,0,0.06)]`.
  - **Column Header Cells (`<th>`)**:
    - Default state: `sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79] border-r border-b-2 border-slate-300 hover:bg-[#DCE9F5] select-none cursor-pointer`.
    - Actively sorted state: `bg-[#DCE9F5] text-[#1F4E79]`.
    - Rightmost column (`Actions`): `sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79] min-w-[130px] pr-12`.
  - **Inline Column Filter Row (`showColumnFilters`)**:
    - Row: `bg-[#F5F9FD] border-b-2 border-slate-300`.
    - Filter cell (`<th>`): `sticky top-[41px] z-20 bg-[#F5F9FD] border-r border-b-2 border-slate-300 p-1.5`.
    - Filter inputs: `bg-white border border-slate-200 rounded-md h-7 px-2 text-[11px] font-normal focus:ring-1 focus:ring-slate-900`.
  - **Grid Borders**:
    - Tables use full spreadsheet grid styling with explicit `border-r` and `border-b` (`border-collapse border border-slate-300`).
    - Sticky footer (`<tfoot>`): `bg-[#EEF5FB]` with `text-[#1F4E79]`, numerical totals with `bg-blue-100/60 font-mono font-extrabold`.

### 6. Standard Reusable Hook
- Reusable hook available at `src/hooks/useTableControls.tsx` for state management, 3-state sorting, and multi-column filtering.

### 7. No Page Limits (All Data in One Stretch)
- Never arbitrarily paginate or slice table data with 10-per-page or 15-per-page limits.
- Load and render all records in one stretch so users can scroll smoothly through the entire dataset without clicking Next/Previous.
- Replace pagination navigation controls with an informative summary footer:
  `Showing all {count} records in one stretch (filtered from {total} total)`.
- Combined with sticky table headers (`sticky top-0 z-20`) and inline filter row (`sticky top-[41px] z-20`), users can scroll freely through hundreds or thousands of rows while the column titles and filter controls remain pinned to the top.

### 8. Table Maximize & Fullscreen Popup Modal (`TableMaximizeWrapper`)
- **Fullscreen Z-Index Layering (`z-[100]`)**:
  - The maximized modal overlay must use `z-[100]` and render via React Portal (`createPortal(..., document.body)`) so it is firmly above all navigation sidebars (`z-50`) and fixed headers (`z-30`).
  - Any confirmation modal triggered from within the table (such as a delete confirmation dialog) must use `z-[120]` or higher to sit above the maximized modal.
- **Persistent Sticky Top-Right Corner Button**:
  - The maximize/restore button (`TableMaximizeButton`) is automatically rendered by `TableMaximizeWrapper` at `absolute top-2.5 right-2.5 z-30` outside the scrollable container.
  - It stays permanently pinned at the top-right corner of the table regardless of horizontal or vertical scroll.
  - The rightmost column header (`Actions`) must have right padding (`pr-12`) and minimum width (`min-w-[130px]`) so text and action buttons are never obscured.
- **Exact Instant Scroll State Preservation**:
  - The scroll container must have `data-table-scroll="true"`.
  - When toggling between normal and maximized views, `TableMaximizeWrapper` captures `{ top: el.scrollTop, left: el.scrollLeft }` and restores them on the target view via animation frames.
  - Keeps the exact row and column in view before and after maximizing.
- **Clean Distraction-Free Header**:
  - The modal top bar displays only the table title and records count badge. No decorative icons, no subtitles, no keyboard hint text.
  - Multi-way restore: pinned button, top bar "Restore View" button, "✕" close button, and <kbd>Esc</kbd> shortcut. Locks body scroll (`overflow: hidden`).

### 9. Sticky Table Totals Footer (`TableTotalsFooter`)
- Component: `src/components/ui/TableTotalsFooter.tsx` (re-exported from `TableMaximizeWrapper`).
- Pinned to bottom of table viewport: `<TableTotalsFooter cells={[...]} />` (`sticky bottom-0 z-20`).
- Dynamically compute sums using `useMemo` from filtered/sorted records (`sortedData.reduce(...)`).
- Multi-unit quantity support: when both `pieces` and `kg` exist, displays pieces on top and kgs below (`{ pieces: totalPcs, kgs: totalKg, isTotal: true }`).
- Currency support: `{ currency: totalValue, isTotal: true }` with INR formatting.
- Label: `{ colSpan: N, label: "TOTAL (X records)" }`.
- Non-summable columns: `{ align: 'center' }` renders clean `—`.

### 10. Shortcut: TablePro (`/table-pro <module>` or `TablePro: <module>`)
When the user types `TablePro: <module>` or `/table-pro <module>`:
Instantly apply this 4-step standard to the target module table:
1. Wrap table card in `<TableMaximizeWrapper title="..." badge="...">`.
2. Add `data-table-scroll="true"` to scroll container.
3. Add `pr-12` and `min-w-[130px]` to last header cell.
4. Add `<TableTotalsFooter cells={[...]} />` before `</table>`.

### 11. Upgraded ERP Tables Registry
The TablePro maximizing architecture, light blue `#EEF5FB` headers, `data-table-scroll="true"`, and pinned corner button are active on:
1. **Purchase Orders**: `src/pages/purchaseOrders/components/POList.tsx`
2. **Inward Goods Receipts**: `src/pages/inward/components/InwardList.tsx`
3. **Outward Dispatches**: `src/pages/outward/components/OutwardList.tsx`
4. **Statement & Reconciliation Report**: `src/pages/statement/components/StatementReport.tsx`
5. **Reconciliation Audit Ledger**: `src/pages/statement/components/StatementLedgerTable.tsx`
6. **Invoicing - Generation & Eligible Tables**: `src/pages/invoices/components/InvoiceEligibleTable.tsx`
7. **Invoice History (Invoices Module)**: `src/pages/invoices/components/InvoiceHistoryTable.tsx`
8. **Invoice History (Statement Module)**: `src/pages/statement/components/InvoiceHistoryTable.tsx`
9. **Sample PO Page**: `src/pages/sampleProcess/SamplePoPage.tsx`
10. **Chemical & Process Entry**: `src/pages/chemicalEntry/ChemicalEntryPage.tsx`
11. **Vendor Master Directory**: `src/pages/vendors/components/VendorList.tsx`
12. **Chemical & Material Master**: `src/pages/items/ItemMasterPage.tsx`
13. **Employee Master Directory**: `src/pages/employees/EmployeeMasterPage.tsx`
14. **Daily & Monthly Attendance Table**: `src/pages/attendance/components/AttendanceTable.tsx`
15. **Today's Live Attendance View**: `src/pages/attendance/components/TodayAttendanceView.tsx`
16. **Live Employee Monitoring**: `src/pages/attendance/components/EmployeeMonitor.tsx`
17. **15-Days Salary & Wage Calculation**: `src/pages/salary/components/FifteenDaysSalaryTable.tsx`
18. **Monthly Salary & Wage Calculation**: `src/pages/salary/components/MonthlySalaryTable.tsx`
19. **EB Monitoring & Meter Logs**: `src/pages/ebMonitoring/EBMonitoringPage.tsx`
20. **Vehicle & Logistics Master**: `src/pages/transportation/VehicleMasterPage.tsx`
21. **Daily Expense & Trip Monitor**: `src/pages/transportation/DailyExpenseMonitorSection.tsx`
22. **Warehouse Raw Material Purchases (Table 1)**: `src/pages/warehouse/WarehousePage.tsx`
23. **Warehouse Firewood Purchases (Table 2)**: `src/pages/warehouse/WarehousePage.tsx`
24. **Base Reusable UI Table**: `src/components/ui/Table.tsx` (benefits Expenses and all standard UI tables)
25. **Users & Role Management**: `src/pages/users/UsersPage.tsx`
26. **Machine Master Directory**: `src/pages/settings/components/MachineMasterSettings.tsx`
27. **HSN Master Directory**: `src/pages/settings/components/HsnMasterSettings.tsx`
28. **Item Category Directory**: `src/pages/settings/components/ItemCategorySettings.tsx`
29. **Colour Master Directory**: `src/pages/settings/GeneralSettingsPage.tsx`
30. **Wash / Process Master Directory**: `src/pages/settings/GeneralSettingsPage.tsx`
31. **PO Detailed Report**: `src/pages/purchaseOrders/components/POReport.tsx`
32. **Inward Detailed Report**: `src/pages/inward/components/InwardReport.tsx`
33. **Outward Detailed Report**: `src/pages/outward/components/OutwardReport.tsx`

---

### 10. Universal Esc Key Navigation for All Back Buttons
- Every back button across all forms, details, print views, reports, and sub-views is accessible via the keyboard <kbd>Esc</kbd> key.
- Hook: `src/hooks/useEscBack.ts` (`useGlobalEscBack()` enabled globally in `App.tsx` and `useEscBack(onBack)` for local overrides).
- Standard Attributes for all Back Buttons:
  - `data-back-button="true"`
  - `title="... (Esc)"`
- When <kbd>Esc</kbd> is pressed:
  - If an active modal or confirmation popup is open, it closes the modal first.
  - If a table is maximized, it restores the table to normal embedded view first.
  - Otherwise, it blurs any active inputs and automatically triggers the visible Back button.
