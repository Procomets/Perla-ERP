import ExcelJS from 'exceljs';
import type { EmployeeMaster } from '../../../types/employee';
import type { AttendanceRecord } from '../../../types/attendance';
import type { SalaryRecord, Period } from '../types/salarySheet';
import {
  getDaysInMonth,
  isSunday,
  getSundaysCount,
  formatDateDDMMYY,
  formatDateDDMMYYYY,
  formatDateYYYYMMDD,
  getMonthName
} from './salaryDateUtils';

const DARK_BLUE = 'FF002060';
const WHITE = 'FFFFFFFF';
const BLACK = 'FF000000';
const LIGHT_GREEN = 'FFC5E0B4';
const PEACH_COLOR = 'FFF4B084';
const YELLOW_COLOR = 'FFFFFF00';
const SUNDAY_GREEN = 'FF92D050';

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_BLUE } };
const SUB_HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF001A4D' } };
const GREEN_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GREEN } };
const PEACH_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PEACH_COLOR } };
const YELLOW_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW_COLOR } };
const SUNDAY_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUNDAY_GREEN } };

const BOLD_WHITE: Partial<ExcelJS.Font> = { bold: true, color: { argb: WHITE }, size: 9, name: 'Arial' };
const BOLD_BLACK: Partial<ExcelJS.Font> = { bold: true, color: { argb: BLACK }, size: 9.5, name: 'Arial' };
const NORMAL_BLACK: Partial<ExcelJS.Font> = { size: 9, color: { argb: BLACK }, name: 'Arial' };

const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
};

export const exportMonthlySalaryToExcel = async (
  employees: EmployeeMaster[],
  attendanceRecords: AttendanceRecord[],
  currentYear: number,
  currentMonth: number,
  editableRows: Record<string, Partial<SalaryRecord>>
) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Monthly Salary', { views: [{ showGridLines: true }] });

  const monthName = getMonthName(currentMonth);
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const sundaysCount = getSundaysCount(currentYear, currentMonth);
  const noOfDays = daysInMonth - sundaysCount;

  // Title Rows
  ws.mergeCells(1, 1, 1, 25);
  const title1 = ws.getCell(1, 1);
  title1.value = 'PERLA TEXTILES PROCESSOR';
  title1.fill = HEADER_FILL;
  title1.font = { ...BOLD_WHITE, size: 14 };
  title1.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 30;

  ws.mergeCells(2, 1, 2, 25);
  const title2 = ws.getCell(2, 1);
  title2.value = `Salary Sheet For The Month Of ${monthName} ${currentYear}`;
  title2.fill = HEADER_FILL;
  title2.font = { ...BOLD_WHITE, size: 11 };
  title2.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 24;

  // Headers
  const headers = [
    'S NO', 'Name', 'Designation', 'DOJ', 'Hike', 'Salary', 'No Of\nDays', 'Per day\nPay', 'No Of\nPresent',
    'Gross\nSalary', 'Basic\n50%', 'HRA\n20%', 'SA\n20%', 'MA\n4%', 'CA\n6%', 'PF', 'ESI', 'Salary\nAdvance',
    'No Of\nLeave', 'LOP', 'Net\nSalary', 'A/c No', 'IFSC Code', 'Branch', 'Remark'
  ];
  const headerRow = ws.getRow(3);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.fill = (h === 'Salary' || h === 'Gross\nSalary' || h === 'Net\nSalary') ? SUB_HEADER_FILL : HEADER_FILL;
    cell.font = BOLD_WHITE;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = BORDER;
  });
  headerRow.height = 30;

  // Column widths
  ws.getColumn(1).width = 6;
  ws.getColumn(2).width = 24;
  ws.getColumn(3).width = 16;
  ws.getColumn(4).width = 13;
  for (let i = 5; i <= 21; i++) ws.getColumn(i).width = 11;
  ws.getColumn(22).width = 18;
  ws.getColumn(23).width = 14;
  ws.getColumn(24).width = 16;
  ws.getColumn(25).width = 20;

  let rowNum = 4;
  let totalSalary = 0;
  let totalGross = 0;
  let totalBasic = 0;
  let totalHRA = 0;
  let totalSA = 0;
  let totalMA = 0;
  let totalCA = 0;
  let totalPF = 0;
  let totalESI = 0;
  let totalAdvance = 0;
  let totalLOP = 0;
  let totalNet = 0;

  for (let index = 0; index < employees.length; index++) {
    const emp = employees[index];
    const rowState = editableRows[emp.employeeId] || {};
    const salary = (parseFloat(String(emp.monthlyIncome || 0)) || 0) + (rowState.hike || 0);
    const perDayPay = noOfDays > 0 ? salary / noOfDays : 0;

    const empAtt = attendanceRecords.filter(r => r.employeeId === emp.employeeId);
    const noOfPresent = empAtt.filter(r => r.status === 'Present' || r.status === 'N').length;
    const noOfLeave = Math.max(0, noOfDays - noOfPresent);
    const paidLeave = Math.min(noOfLeave, 2);
    const paidDays = Math.min(noOfDays, noOfPresent + paidLeave);

    const grossSalary = paidDays === noOfDays ? salary : (perDayPay * paidDays);
    const basic = grossSalary * 0.5;
    const hra = grossSalary * 0.2;
    const sa = grossSalary * 0.2;
    const ma = grossSalary * 0.04;
    const ca = grossSalary * 0.06;

    const pf = rowState.pf || 0;
    const esi = rowState.esi || 0;
    const advance = rowState.salaryAdvance || 0;
    const lop = rowState.lop || 0;

    const netSalary = grossSalary - pf - esi - advance - lop;

    totalSalary += salary;
    totalGross += grossSalary;
    totalBasic += basic;
    totalHRA += hra;
    totalSA += sa;
    totalMA += ma;
    totalCA += ca;
    totalPF += pf;
    totalESI += esi;
    totalAdvance += advance;
    totalLOP += lop;
    totalNet += netSalary;

    const row = ws.getRow(rowNum);
    row.height = 22;

    row.getCell(1).value = index + 1;
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(2).value = `${emp.fullName} (${emp.employeeId})`;
    row.getCell(3).value = emp.designation || '';
    row.getCell(4).value = emp.dateOfJoining || '';
    row.getCell(5).value = rowState.hike || 0;

    row.getCell(6).value = Math.round(salary);
    row.getCell(6).fill = GREEN_FILL;
    row.getCell(6).font = BOLD_BLACK;
    row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };

    row.getCell(7).value = noOfDays;
    row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(8).value = Math.round(perDayPay);
    row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(9).value = noOfPresent;
    row.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' };

    row.getCell(10).value = Math.round(grossSalary);
    row.getCell(10).fill = GREEN_FILL;
    row.getCell(10).font = BOLD_BLACK;
    row.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' };

    row.getCell(11).value = Math.round(basic);
    row.getCell(12).value = Math.round(hra);
    row.getCell(13).value = Math.round(sa);
    row.getCell(14).value = Math.round(ma);
    row.getCell(15).value = Math.round(ca);
    row.getCell(16).value = Math.round(pf);
    row.getCell(17).value = Math.round(esi);
    row.getCell(18).value = Math.round(advance);
    row.getCell(19).value = noOfLeave;
    row.getCell(19).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(20).value = Math.round(lop);

    row.getCell(21).value = Math.round(netSalary);
    row.getCell(21).fill = PEACH_FILL;
    row.getCell(21).font = BOLD_BLACK;
    row.getCell(21).alignment = { horizontal: 'right', vertical: 'middle' };

    row.getCell(22).value = emp.accountNumber || '';
    row.getCell(23).value = emp.ifscCode || '';
    row.getCell(24).value = emp.bankBranch || '';
    row.getCell(25).value = rowState.remark || '';

    for (let c = 1; c <= 25; c++) {
      const cell = row.getCell(c);
      cell.border = BORDER;
      if (!cell.font) cell.font = NORMAL_BLACK;
      if (!cell.alignment) {
        if ([5, 6, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 21].includes(c)) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else if ([1, 7, 9, 19].includes(c)) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      }
    }
    rowNum++;
  }

  // TOTALS ROW
  const totalRow = ws.getRow(rowNum);
  totalRow.height = 24;
  ws.mergeCells(rowNum, 1, rowNum, 5);
  const totalLabel = totalRow.getCell(1);
  totalLabel.value = 'TOTAL';
  totalLabel.font = BOLD_WHITE;
  totalLabel.fill = HEADER_FILL;
  totalLabel.alignment = { horizontal: 'center', vertical: 'middle' };

  totalRow.getCell(6).value = Math.round(totalSalary);
  totalRow.getCell(10).value = Math.round(totalGross);
  totalRow.getCell(11).value = Math.round(totalBasic);
  totalRow.getCell(12).value = Math.round(totalHRA);
  totalRow.getCell(13).value = Math.round(totalSA);
  totalRow.getCell(14).value = Math.round(totalMA);
  totalRow.getCell(15).value = Math.round(totalCA);
  totalRow.getCell(16).value = Math.round(totalPF);
  totalRow.getCell(17).value = Math.round(totalESI);
  totalRow.getCell(18).value = Math.round(totalAdvance);
  totalRow.getCell(20).value = Math.round(totalLOP);
  totalRow.getCell(21).value = Math.round(totalNet);

  for (let c = 1; c <= 25; c++) {
    const cell = totalRow.getCell(c);
    cell.fill = HEADER_FILL;
    cell.font = BOLD_WHITE;
    cell.border = BORDER;
    if ([6, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 21].includes(c)) {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    }
  }

  // Download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Salary_Sheet_${monthName}_${currentYear}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const exportFifteenDaysSalaryToExcel = async (
  employees: EmployeeMaster[],
  attendanceRecords: AttendanceRecord[],
  currentYear: number,
  currentMonth: number,
  period: Period,
  editableRows: Record<string, { previousHolding: number; holdingAmount: number }>,
  commissionRate: number
) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('15 Days Wages', { views: [{ showGridLines: true }] });

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const startDay = period === 'first15' ? 1 : 16;
  const endDay = period === 'first15' ? 15 : daysInMonth;

  const dates: number[] = [];
  for (let d = startDay; d <= endDay; d++) dates.push(d);

  const startDateStr = formatDateDDMMYYYY(currentYear, currentMonth, startDay);
  const endDateStr = formatDateDDMMYYYY(currentYear, currentMonth, endDay);
  const totalCols = dates.length + 7;

  // Title Row
  ws.mergeCells(1, 1, 1, totalCols);
  const title1 = ws.getCell(1, 1);
  title1.value = 'PERLA TEXTILES PROCESSOR';
  title1.fill = HEADER_FILL;
  title1.font = { ...BOLD_WHITE, size: 14 };
  title1.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 30;

  ws.mergeCells(2, 1, 2, totalCols);
  const title2 = ws.getCell(2, 1);
  title2.value = `LABOUR WAGES ${startDateStr} To ${endDateStr}`;
  title2.fill = HEADER_FILL;
  title2.font = { ...BOLD_WHITE, size: 11 };
  title2.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 24;

  // Headers
  const headerRow = ws.getRow(3);
  headerRow.height = 28;
  headerRow.getCell(1).value = 'S.NO.';
  headerRow.getCell(2).value = 'NAME';

  dates.forEach((d, i) => {
    headerRow.getCell(3 + i).value = formatDateDDMMYY(currentYear, currentMonth, d);
  });

  headerRow.getCell(3 + dates.length).value = 'WAGES\nPER';
  headerRow.getCell(4 + dates.length).value = 'WORKING\nDAYS';
  headerRow.getCell(5 + dates.length).value = 'NET\nAMOUNT';
  headerRow.getCell(6 + dates.length).value = 'HOLDING\nAMOUNT';
  headerRow.getCell(7 + dates.length).value = 'PAYABLE\nAMOUNT';

  for (let c = 1; c <= totalCols; c++) {
    const cell = headerRow.getCell(c);
    cell.fill = HEADER_FILL;
    cell.font = BOLD_WHITE;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = BORDER;
  }

  // Column widths
  ws.getColumn(1).width = 6;
  ws.getColumn(2).width = 24;
  dates.forEach((_, i) => {
    ws.getColumn(3 + i).width = 9.5;
  });
  ws.getColumn(3 + dates.length).width = 12;
  ws.getColumn(4 + dates.length).width = 11;
  ws.getColumn(5 + dates.length).width = 14;
  ws.getColumn(6 + dates.length).width = 12;
  ws.getColumn(7 + dates.length).width = 15;

  let rowNum = 4;
  let totalNetAmount = 0;
  let totalPayableAmount = 0;
  let totalOverallPresent = 0;
  const dailyPresentCount = new Array(dates.length).fill(0);

  employees.forEach((emp, index) => {
    const rowState = editableRows[emp.employeeId] || { previousHolding: 0, holdingAmount: 0 };
    const wagesPer = parseFloat(String(emp.dailyWages || 0)) || 0;
    let presentCount = 0;

    const row = ws.getRow(rowNum);
    row.height = 22;

    row.getCell(1).value = index + 1;
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(1).border = BORDER;

    row.getCell(2).value = emp.fullName;
    row.getCell(2).fill = PEACH_FILL;
    row.getCell(2).font = BOLD_BLACK;
    row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(2).border = BORDER;

    dates.forEach((day, dIndex) => {
      const dateStr = formatDateYYYYMMDD(currentYear, currentMonth, day);
      const isSun = isSunday(currentYear, currentMonth, day);
      const attRecord = attendanceRecords.find(r => r.employeeId === emp.employeeId && r.date === dateStr);

      let cellValue = '';
      let cellFill = null;

      if (attRecord?.status === 'Present') {
        cellValue = 'P';
        presentCount += 1;
        dailyPresentCount[dIndex] += 1;
      } else if (attRecord?.status === 'P/N') {
        cellValue = 'P/N';
        presentCount += 2;
        dailyPresentCount[dIndex] += 2;
      } else if (isSun) {
        cellValue = 'Sunday';
        cellFill = SUNDAY_FILL;
      } else if (attRecord?.status === 'Absent') {
        cellValue = 'A';
      }

      const cell = row.getCell(3 + dIndex);
      cell.value = cellValue;
      if (cellFill) cell.fill = cellFill;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.font = cellValue === 'Sunday' ? BOLD_BLACK : NORMAL_BLACK;
      cell.border = BORDER;
    });

    const netAmount = wagesPer * presentCount;
    const payableAmount = netAmount + (rowState.previousHolding || 0) - (rowState.holdingAmount || 0);

    totalNetAmount += netAmount;
    totalPayableAmount += payableAmount;
    totalOverallPresent += presentCount;

    // Wages per
    const wagesCell = row.getCell(3 + dates.length);
    wagesCell.value = wagesPer;
    wagesCell.alignment = { horizontal: 'right', vertical: 'middle' };
    wagesCell.border = BORDER;

    // Working days
    const workingDaysCell = row.getCell(4 + dates.length);
    workingDaysCell.value = presentCount;
    workingDaysCell.alignment = { horizontal: 'center', vertical: 'middle' };
    workingDaysCell.border = BORDER;

    // Net Amount
    const netCell = row.getCell(5 + dates.length);
    netCell.value = netAmount;
    netCell.fill = YELLOW_FILL;
    netCell.font = BOLD_BLACK;
    netCell.alignment = { horizontal: 'right', vertical: 'middle' };
    netCell.border = BORDER;

    // Holding Amount
    const holdingCell = row.getCell(6 + dates.length);
    holdingCell.value = rowState.holdingAmount || 0;
    holdingCell.alignment = { horizontal: 'right', vertical: 'middle' };
    holdingCell.border = BORDER;

    // Payable Amount
    const payableCell = row.getCell(7 + dates.length);
    payableCell.value = payableAmount;
    payableCell.fill = PEACH_FILL;
    payableCell.font = BOLD_BLACK;
    payableCell.alignment = { horizontal: 'right', vertical: 'middle' };
    payableCell.border = BORDER;

    rowNum++;
  });

  // Footer Row 1: NO.OF.P
  const footer1 = ws.getRow(rowNum);
  footer1.height = 24;
  ws.mergeCells(rowNum, 1, rowNum, 2);
  footer1.getCell(1).value = 'NO.OF.P';
  footer1.getCell(1).fill = HEADER_FILL;
  footer1.getCell(1).font = BOLD_WHITE;
  footer1.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

  dates.forEach((_, i) => {
    const cell = footer1.getCell(3 + i);
    cell.value = dailyPresentCount[i] > 0 ? dailyPresentCount[i] : '';
    cell.fill = HEADER_FILL;
    cell.font = BOLD_WHITE;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDER;
  });

  footer1.getCell(3 + dates.length).value = '';
  footer1.getCell(3 + dates.length).fill = HEADER_FILL;
  footer1.getCell(3 + dates.length).border = BORDER;

  const totalPresentCell = footer1.getCell(4 + dates.length);
  totalPresentCell.value = totalOverallPresent;
  totalPresentCell.fill = HEADER_FILL;
  totalPresentCell.font = BOLD_WHITE;
  totalPresentCell.alignment = { horizontal: 'center', vertical: 'middle' };
  totalPresentCell.border = BORDER;

  const totalNetCell = footer1.getCell(5 + dates.length);
  totalNetCell.value = totalNetAmount;
  totalNetCell.fill = YELLOW_FILL;
  totalNetCell.font = BOLD_BLACK;
  totalNetCell.alignment = { horizontal: 'right', vertical: 'middle' };
  totalNetCell.border = BORDER;

  const totalPayableLabel = footer1.getCell(6 + dates.length);
  totalPayableLabel.value = 'TOTAL';
  totalPayableLabel.fill = HEADER_FILL;
  totalPayableLabel.font = BOLD_WHITE;
  totalPayableLabel.alignment = { horizontal: 'center', vertical: 'middle' };
  totalPayableLabel.border = BORDER;

  const totalPayableVal = footer1.getCell(7 + dates.length);
  totalPayableVal.value = totalPayableAmount;
  totalPayableVal.fill = HEADER_FILL;
  totalPayableVal.font = BOLD_WHITE;
  totalPayableVal.alignment = { horizontal: 'right', vertical: 'middle' };
  totalPayableVal.border = BORDER;

  rowNum++;

  // Footer Row 2: Commission
  const footer2 = ws.getRow(rowNum);
  footer2.height = 22;
  ws.mergeCells(rowNum, 1, rowNum, 6 + dates.length);
  const commLabel = footer2.getCell(1);
  commLabel.value = `Commission (@ ₹${commissionRate}/day)`;
  commLabel.font = BOLD_BLACK;
  commLabel.alignment = { horizontal: 'right', vertical: 'middle' };

  const commVal = footer2.getCell(7 + dates.length);
  commVal.value = totalOverallPresent * commissionRate;
  commVal.font = BOLD_BLACK;
  commVal.alignment = { horizontal: 'right', vertical: 'middle' };
  commVal.border = BORDER;

  rowNum++;

  // Footer Row 3: Total Payable + Commission
  const footer3 = ws.getRow(rowNum);
  footer3.height = 26;
  ws.mergeCells(rowNum, 1, rowNum, 6 + dates.length);
  const grandLabel = footer3.getCell(1);
  grandLabel.value = 'TOTAL PAYABLE';
  grandLabel.font = { ...BOLD_BLACK, size: 11 };
  grandLabel.alignment = { horizontal: 'right', vertical: 'middle' };

  const grandVal = footer3.getCell(7 + dates.length);
  grandVal.value = totalPayableAmount + (totalOverallPresent * commissionRate);
  grandVal.fill = PEACH_FILL;
  grandVal.font = { ...BOLD_BLACK, size: 11 };
  grandVal.alignment = { horizontal: 'right', vertical: 'middle' };
  grandVal.border = BORDER;

  // Download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const periodLabel = period === 'first15' ? '1_to_15' : '16_to_end';
  a.download = `Labour_Wages_${periodLabel}_${getMonthName(currentMonth)}_${currentYear}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
