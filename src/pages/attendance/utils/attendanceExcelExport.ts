import ExcelJS from 'exceljs';
import { EmployeeMaster } from '../../../types/employee';
import { AttendanceRecord } from '../../../types/attendance';

export interface ExportAttendanceExcelParams {
  employees?: EmployeeMaster[];
  monthlyEmployees?: EmployeeMaster[];
  labourEmployees?: EmployeeMaster[];
  attendanceRecords: AttendanceRecord[];
  currentYear: number;
  currentMonth: number; // 0-indexed (0 = Jan, 11 = Dec)
  tabName?: string;
}

// Color Constants (ARGB format: AARRGGBB)
const BRAND_HEADER_BG = 'FF0F172A'; // Slate-900
const BRAND_HEADER_TEXT = 'FFFFFFFF'; // White
const TH_DEFAULT_BG = 'FFF1F5F9'; // Slate-100
const TH_DEFAULT_TEXT = 'FF334155'; // Slate-700
const GRID_BORDER_COLOR = 'FFE2E8F0'; // Slate-200

// Status Colors (Matching UI exactly)
const COLOR_PRESENT_BG = 'FFE8F5E9'; // Pastel Green
const COLOR_PRESENT_TEXT = 'FF2E7D32'; // Deep Green

const COLOR_ABSENT_BG = 'FFFFEBEE'; // Pastel Red
const COLOR_ABSENT_TEXT = 'FFC62828'; // Deep Red

const COLOR_PN_BG = 'FFE3F2FD'; // Pastel Blue (Labour Double Duty)
const COLOR_PN_TEXT = 'FF1565C0'; // Deep Blue

const COLOR_N_BG = 'FFEDE7F6'; // Pastel Purple (Monthly Night Shift)
const COLOR_N_TEXT = 'FF4527A0'; // Deep Purple

const COLOR_SUNDAY_COL_BG = 'FFFFF3E0'; // Warm peach column for Sunday
const COLOR_SUNDAY_HEADER_BG = 'FFFFEBEE'; // Soft pink/red header for Sunday
const COLOR_SUNDAY_TEXT = 'FFC62828'; // Red header text

const COLOR_TODAY_BG = 'FFE0F7FA'; // Soft cyan for Today
const COLOR_TODAY_TEXT = 'FF00838F'; // Teal text

const BORDER_STYLE: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: GRID_BORDER_COLOR } },
  left: { style: 'thin', color: { argb: GRID_BORDER_COLOR } },
  bottom: { style: 'thin', color: { argb: GRID_BORDER_COLOR } },
  right: { style: 'thin', color: { argb: GRID_BORDER_COLOR } }
};

interface PopulateWorksheetParams {
  ws: ExcelJS.Worksheet;
  categoryTitle: string;
  employees: EmployeeMaster[];
  attendanceRecords: AttendanceRecord[];
  currentYear: number;
  currentMonth: number;
  monthYearStr: string;
  daysInMonth: number;
  daysArray: number[];
  totalWorkingDays: number;
  isCurrentMonth: boolean;
  today: Date;
}

const populateAttendanceSheet = ({
  ws,
  categoryTitle,
  employees,
  attendanceRecords,
  currentYear,
  currentMonth,
  monthYearStr,
  daysInMonth,
  daysArray,
  totalWorkingDays,
  isCurrentMonth,
  today
}: PopulateWorksheetParams) => {
  // Configure Column Widths
  ws.getColumn(1).width = 7; // S.No
  ws.getColumn(2).width = 28; // Employee Name & ID
  for (let i = 0; i < daysInMonth; i++) {
    ws.getColumn(3 + i).width = 4.8; // Days
  }
  ws.getColumn(3 + daysInMonth).width = 18; // Working / Present

  // 1. Company Banner (Row 1)
  const totalCols = 3 + daysInMonth;
  ws.mergeCells(1, 1, 1, totalCols);
  const companyCell = ws.getCell(1, 1);
  companyCell.value = 'PERLA TEXTILES PROCESSOR';
  companyCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_HEADER_BG } };
  companyCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: BRAND_HEADER_TEXT } };
  companyCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 30;

  // 2. Subtitle / Register Info (Row 2)
  ws.mergeCells(2, 1, 2, totalCols);
  const subCell = ws.getCell(2, 1);
  subCell.value = `Workforce Attendance Register • ${categoryTitle} • ${monthYearStr} • (Total Working Days: ${totalWorkingDays})`;
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; // Slate-800
  subCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FFCBD5E1' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 22;

  // 3. Table Column Headers (Row 3)
  const headerRow = ws.getRow(3);
  headerRow.height = 26;

  headerRow.getCell(1).value = 'S.No';
  headerRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TH_DEFAULT_BG } };
  headerRow.getCell(1).font = { name: 'Arial', size: 9.5, bold: true, color: { argb: TH_DEFAULT_TEXT } };
  headerRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.getCell(1).border = BORDER_STYLE;

  headerRow.getCell(2).value = 'Employee Details';
  headerRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TH_DEFAULT_BG } };
  headerRow.getCell(2).font = { name: 'Arial', size: 9.5, bold: true, color: { argb: TH_DEFAULT_TEXT } };
  headerRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
  headerRow.getCell(2).border = BORDER_STYLE;

  for (let i = 0; i < daysInMonth; i++) {
    const day = daysArray[i];
    const d = new Date(currentYear, currentMonth, day);
    const isSun = d.getDay() === 0;
    const isTod = isCurrentMonth && today.getDate() === day;

    let thBg = TH_DEFAULT_BG;
    let thColor = TH_DEFAULT_TEXT;

    if (isTod) {
      thBg = COLOR_TODAY_BG;
      thColor = COLOR_TODAY_TEXT;
    } else if (isSun) {
      thBg = COLOR_SUNDAY_HEADER_BG;
      thColor = COLOR_SUNDAY_TEXT;
    }

    const cell = headerRow.getCell(3 + i);
    cell.value = day;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: thBg } };
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: thColor } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDER_STYLE;
  }

  const lastHeaderCell = headerRow.getCell(3 + daysInMonth);
  lastHeaderCell.value = 'Working / Present';
  lastHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TH_DEFAULT_BG } };
  lastHeaderCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: TH_DEFAULT_TEXT } };
  lastHeaderCell.alignment = { horizontal: 'center', vertical: 'middle' };
  lastHeaderCell.border = BORDER_STYLE;

  // 4. Employee Data Rows (Starting Row 4)
  let currentRowNum = 4;

  for (let idx = 0; idx < employees.length; idx++) {
    const emp = employees[idx];
    const row = ws.getRow(currentRowNum);
    row.height = 24;

    // S.No
    const snoCell = row.getCell(1);
    snoCell.value = idx + 1;
    snoCell.alignment = { horizontal: 'center', vertical: 'middle' };
    snoCell.font = { name: 'Arial', size: 9, color: { argb: 'FF64748B' } };
    snoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    snoCell.border = BORDER_STYLE;

    // Employee Name & Code
    const empCell = row.getCell(2);
    empCell.value = `${emp.fullName} (${emp.employeeId})${emp.department ? ` - ${emp.department}` : ''}`;
    empCell.alignment = { horizontal: 'left', vertical: 'middle' };
    empCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };
    empCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    empCell.border = BORDER_STYLE;

    let presentCount = 0;

    // Days 1..daysInMonth
    for (let dayIdx = 0; dayIdx < daysInMonth; dayIdx++) {
      const day = daysArray[dayIdx];
      const d = new Date(currentYear, currentMonth, day);
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const record = attendanceRecords.find((r) => r.employeeId === emp.employeeId && r.date === dateStr);

      const isSun = d.getDay() === 0;
      const isTod = isCurrentMonth && today.getDate() === day;

      let cellBg = 'FFFFFFFF';
      let cellTextColor = 'FF94A3B8';
      let text = '-';
      let isBold = false;

      if (record?.status === 'Present') {
        presentCount += 1;
        cellBg = COLOR_PRESENT_BG;
        cellTextColor = COLOR_PRESENT_TEXT;
        text = 'P';
        isBold = true;
      } else if (record?.status === 'Absent') {
        cellBg = COLOR_ABSENT_BG;
        cellTextColor = COLOR_ABSENT_TEXT;
        text = 'AB';
        isBold = true;
      } else if (record?.status === 'P/N') {
        presentCount += 2;
        cellBg = COLOR_PN_BG;
        cellTextColor = COLOR_PN_TEXT;
        text = 'P/N';
        isBold = true;
      } else if (record?.status === 'N') {
        presentCount += 1;
        cellBg = COLOR_N_BG;
        cellTextColor = COLOR_N_TEXT;
        text = 'N';
        isBold = true;
      } else if (isTod) {
        cellBg = COLOR_TODAY_BG;
        cellTextColor = COLOR_TODAY_TEXT;
      } else if (isSun) {
        cellBg = COLOR_SUNDAY_COL_BG;
        cellTextColor = 'FF8D6E63';
      }

      const dayCell = row.getCell(3 + dayIdx);
      dayCell.value = text;
      dayCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cellBg } };
      dayCell.font = { name: 'Arial', size: 9, bold: isBold, color: { argb: cellTextColor } };
      dayCell.alignment = { horizontal: 'center', vertical: 'middle' };
      dayCell.border = BORDER_STYLE;
    }

    // Working / Present Count
    const countCell = row.getCell(3 + daysInMonth);
    countCell.value = `${totalWorkingDays} / ${presentCount}`;
    countCell.alignment = { horizontal: 'center', vertical: 'middle' };
    countCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF16A34A' } };
    countCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    countCell.border = BORDER_STYLE;

    currentRowNum++;
  }

  // If no employees
  if (employees.length === 0) {
    ws.mergeCells(currentRowNum, 1, currentRowNum, totalCols);
    const emptyCell = ws.getCell(currentRowNum, 1);
    emptyCell.value = `No active ${categoryTitle.toLowerCase()} found matching the criteria.`;
    emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
    emptyCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF94A3B8' } };
    emptyCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    emptyCell.border = BORDER_STYLE;
    ws.getRow(currentRowNum).height = 30;
    currentRowNum++;
  }
};

export const exportAttendanceToExcel = async (params: ExportAttendanceExcelParams) => {
  const { currentYear, currentMonth, attendanceRecords } = params;

  // Resolve employee lists for both Monthly Salary and Labour Attendance
  let monthlyList: EmployeeMaster[] = [];
  let labourList: EmployeeMaster[] = [];

  if (params.monthlyEmployees !== undefined || params.labourEmployees !== undefined) {
    monthlyList = params.monthlyEmployees || [];
    labourList = params.labourEmployees || [];
  } else if (params.employees) {
    monthlyList = params.employees.filter((e) => e.employeeType === 'Monthly Salary');
    labourList = params.employees.filter((e) => e.employeeType === 'Labour');
    // If filtering by type yielded none (e.g. all employees passed without employeeType), fallback to tabName
    if (monthlyList.length === 0 && labourList.length === 0) {
      if (params.tabName === 'Labour Workers' || params.tabName === 'Labour Attendance') {
        labourList = params.employees;
      } else {
        monthlyList = params.employees;
      }
    }
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthName = monthNames[currentMonth];
  const monthYearStr = `${monthName} ${currentYear}`;

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Compute sundays and working days
  let sundaysCount = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(currentYear, currentMonth, day);
    if (d.getDay() === 0) sundaysCount++;
  }
  const totalWorkingDays = daysInMonth - sundaysCount;

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === currentYear && today.getMonth() === currentMonth;

  // Initialize Workbook
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Perla Textiles ERP';
  wb.created = new Date();

  // 1. First Page / Tab: Monthly Salary
  const wsMonthly = wb.addWorksheet('Monthly Salary', {
    views: [{ showGridLines: true }]
  });
  populateAttendanceSheet({
    ws: wsMonthly,
    categoryTitle: 'Monthly Salary Employees',
    employees: monthlyList,
    attendanceRecords,
    currentYear,
    currentMonth,
    monthYearStr,
    daysInMonth,
    daysArray,
    totalWorkingDays,
    isCurrentMonth,
    today
  });

  // 2. Second Page / Tab: Labour Attendance
  const wsLabour = wb.addWorksheet('Labour Attendance', {
    views: [{ showGridLines: true }]
  });
  populateAttendanceSheet({
    ws: wsLabour,
    categoryTitle: 'Labour Attendance',
    employees: labourList,
    attendanceRecords,
    currentYear,
    currentMonth,
    monthYearStr,
    daysInMonth,
    daysArray,
    totalWorkingDays,
    isCurrentMonth,
    today
  });

  // 3. Write Buffer & Trigger Download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Attendance_Register_${monthName}_${currentYear}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
