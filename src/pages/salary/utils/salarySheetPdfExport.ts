import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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

export const exportMonthlySalaryToPdf = async (
  employees: EmployeeMaster[],
  attendanceRecords: AttendanceRecord[],
  currentYear: number,
  currentMonth: number,
  editableRows: Record<string, Partial<SalaryRecord>>
) => {
  const doc = new jsPDF('l', 'pt', 'a4');
  const monthName = getMonthName(currentMonth);
  const title = `Salary Sheet For The Month Of ${monthName} ${currentYear}`;
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text('PERLA TEXTILES PROCESSOR', pageWidth / 2, 35, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105); // Slate-600
  doc.text(title, pageWidth / 2, 52, { align: 'center' });

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const sundaysCount = getSundaysCount(currentYear, currentMonth);
  const noOfDays = daysInMonth - sundaysCount;

  const tableData: any[][] = [];
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

  employees.forEach((emp, index) => {
    const rowState = editableRows[emp.employeeId] || {};
    const salary = (parseFloat(String(emp.monthlyIncome || 0)) || 0) + (rowState.hike || 0);
    const perDayPay = noOfDays > 0 ? salary / noOfDays : 0;

    const empAtt = attendanceRecords.filter(r => r.employeeId === emp.employeeId);
    const noOfPresent = empAtt.filter(r => r.status === 'Present' || r.status === 'N').length;
    const noOfLeave = Math.max(0, noOfDays - noOfPresent);
    const paidLeave = Math.min(noOfLeave, 2);
    const paidDays = Math.min(noOfDays, noOfPresent + paidLeave);

    const grossSalary = paidDays === noOfDays ? salary : perDayPay * paidDays;
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

    tableData.push([
      index + 1,
      emp.fullName,
      emp.designation || '',
      rowState.hike || 0,
      Math.round(salary),
      noOfDays,
      Math.round(perDayPay),
      noOfPresent,
      Math.round(grossSalary),
      Math.round(basic),
      Math.round(hra),
      Math.round(sa),
      Math.round(ma),
      Math.round(ca),
      Math.round(pf),
      Math.round(esi),
      Math.round(advance),
      noOfLeave,
      Math.round(lop),
      Math.round(netSalary),
      emp.accountNumber || '',
      emp.ifscCode || '',
      rowState.remark || ''
    ]);
  });

  // Totals Row
  tableData.push([
    { content: 'TOTAL', colSpan: 4, styles: { halign: 'center', fontStyle: 'bold', fillColor: [0, 32, 96] } },
    { content: Math.round(totalSalary), styles: { fontStyle: 'bold', fillColor: [0, 32, 96] } },
    { content: '', styles: { fillColor: [0, 32, 96] } },
    { content: '', styles: { fillColor: [0, 32, 96] } },
    { content: '', styles: { fillColor: [0, 32, 96] } },
    { content: Math.round(totalGross), styles: { fontStyle: 'bold', fillColor: [0, 32, 96] } },
    { content: Math.round(totalBasic), styles: { fontStyle: 'bold', fillColor: [0, 32, 96] } },
    { content: Math.round(totalHRA), styles: { fontStyle: 'bold', fillColor: [0, 32, 96] } },
    { content: Math.round(totalSA), styles: { fontStyle: 'bold', fillColor: [0, 32, 96] } },
    { content: Math.round(totalMA), styles: { fontStyle: 'bold', fillColor: [0, 32, 96] } },
    { content: Math.round(totalCA), styles: { fontStyle: 'bold', fillColor: [0, 32, 96] } },
    { content: Math.round(totalPF), styles: { fontStyle: 'bold', fillColor: [0, 32, 96] } },
    { content: Math.round(totalESI), styles: { fontStyle: 'bold', fillColor: [0, 32, 96] } },
    { content: Math.round(totalAdvance), styles: { fontStyle: 'bold', fillColor: [0, 32, 96] } },
    { content: '', styles: { fillColor: [0, 32, 96] } },
    { content: Math.round(totalLOP), styles: { fontStyle: 'bold', fillColor: [0, 32, 96] } },
    { content: Math.round(totalNet), styles: { fontStyle: 'bold', fillColor: [0, 32, 96] } },
    { content: '', colSpan: 3, styles: { fillColor: [0, 32, 96] } }
  ]);

  autoTable(doc, {
    startY: 65,
    head: [[
      'S#', 'Name', 'Designation', 'Hike', 'Salary', 'Days', 'Rate', 'Pres',
      'Gross', 'Basic', 'HRA', 'SA', 'MA', 'CA', 'PF', 'ESI', 'Adv', 'Lev',
      'LOP', 'Net Pay', 'A/c No', 'IFSC', 'Remark'
    ]],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 6.5,
      cellPadding: 2.5,
      valign: 'middle'
    },
    headStyles: {
      fillColor: [0, 32, 96],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 16 },
      1: { halign: 'left', cellWidth: 70 },
      2: { halign: 'left', cellWidth: 50 },
      4: { halign: 'right', fontStyle: 'bold' },
      8: { halign: 'right', fontStyle: 'bold' },
      19: { halign: 'right', fontStyle: 'bold', textColor: [0, 32, 96] }
    }
  });

  doc.save(`Salary_Sheet_${monthName}_${currentYear}.pdf`);
};

export const exportFifteenDaysSalaryToPdf = async (
  employees: EmployeeMaster[],
  attendanceRecords: AttendanceRecord[],
  currentYear: number,
  currentMonth: number,
  period: Period,
  editableRows: Record<string, { previousHolding: number; holdingAmount: number }>,
  commissionRate: number
) => {
  const doc = new jsPDF('l', 'pt', 'a4');
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const startDay = period === 'first15' ? 1 : 16;
  const endDay = period === 'first15' ? 15 : daysInMonth;

  const dates: number[] = [];
  for (let d = startDay; d <= endDay; d++) dates.push(d);

  const startDateStr = formatDateDDMMYYYY(currentYear, currentMonth, startDay);
  const endDateStr = formatDateDDMMYYYY(currentYear, currentMonth, endDay);
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('PERLA TEXTILES PROCESSOR', pageWidth / 2, 35, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`LABOUR WAGES: ${startDateStr} To ${endDateStr}`, pageWidth / 2, 52, { align: 'center' });

  const headers = ['S#', 'Name'];
  dates.forEach(d => headers.push(String(d)));
  headers.push('Wages', 'Days', 'Net Amt', 'Holding', 'Payable');

  const tableData: any[][] = [];
  let totalNetAmount = 0;
  let totalPayableAmount = 0;
  let totalOverallPresent = 0;
  const dailyPresentCount = new Array(dates.length).fill(0);

  employees.forEach((emp, index) => {
    const rowState = editableRows[emp.employeeId] || { previousHolding: 0, holdingAmount: 0 };
    const wagesPer = parseFloat(String(emp.dailyWages || 0)) || 0;
    let presentCount = 0;

    const row: any[] = [index + 1, emp.fullName];

    dates.forEach((day, dIndex) => {
      const dateStr = formatDateYYYYMMDD(currentYear, currentMonth, day);
      const isSun = isSunday(currentYear, currentMonth, day);
      const attRecord = attendanceRecords.find(r => r.employeeId === emp.employeeId && r.date === dateStr);

      let cellValue = '-';
      if (attRecord?.status === 'Present') {
        cellValue = 'P';
        presentCount += 1;
        dailyPresentCount[dIndex] += 1;
      } else if (attRecord?.status === 'P/N') {
        cellValue = 'P/N';
        presentCount += 2;
        dailyPresentCount[dIndex] += 2;
      } else if (isSun) {
        cellValue = 'Sun';
      } else if (attRecord?.status === 'Absent') {
        cellValue = 'A';
      }
      row.push(cellValue);
    });

    const netAmount = wagesPer * presentCount;
    const payableAmount = netAmount + (rowState.previousHolding || 0) - (rowState.holdingAmount || 0);

    totalNetAmount += netAmount;
    totalPayableAmount += payableAmount;
    totalOverallPresent += presentCount;

    row.push(wagesPer, presentCount, netAmount.toFixed(0), rowState.holdingAmount || 0, payableAmount.toFixed(0));
    tableData.push(row);
  });

  // Footer: Daily present row
  const countRow: any[] = [
    { content: 'NO.OF.P', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold', fillColor: [0, 32, 96], textColor: [255, 255, 255] } }
  ];
  dates.forEach((_, i) => {
    countRow.push({ content: dailyPresentCount[i] || '', styles: { halign: 'center', fontStyle: 'bold', fillColor: [0, 32, 96], textColor: [255, 255, 255] } });
  });
  countRow.push(
    { content: '', styles: { fillColor: [0, 32, 96] } },
    { content: totalOverallPresent, styles: { halign: 'center', fontStyle: 'bold', fillColor: [0, 32, 96], textColor: [255, 255, 255] } },
    { content: totalNetAmount.toFixed(0), styles: { halign: 'right', fontStyle: 'bold', fillColor: [254, 240, 138], textColor: [0, 0, 0] } },
    { content: 'TOTAL', styles: { halign: 'center', fontStyle: 'bold', fillColor: [0, 32, 96], textColor: [255, 255, 255] } },
    { content: totalPayableAmount.toFixed(0), styles: { halign: 'right', fontStyle: 'bold', fillColor: [0, 32, 96], textColor: [255, 255, 255] } }
  );
  tableData.push(countRow);

  autoTable(doc, {
    startY: 65,
    head: [headers],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 2.5,
      valign: 'middle'
    },
    headStyles: {
      fillColor: [0, 32, 96],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    }
  });

  const lastY = (doc as any).lastAutoTable?.finalY || 400;
  const commAmount = totalOverallPresent * commissionRate;
  const grandPayable = totalPayableAmount + commAmount;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`Commission (@ Rs. ${commissionRate}/day): Rs. ${commAmount.toFixed(2)}`, pageWidth - 40, lastY + 20, { align: 'right' });
  doc.text(`TOTAL PAYABLE: Rs. ${grandPayable.toFixed(2)}`, pageWidth - 40, lastY + 36, { align: 'right' });

  const periodLabel = period === 'first15' ? '1_to_15' : '16_to_end';
  doc.save(`Labour_Wages_${periodLabel}_${getMonthName(currentMonth)}_${currentYear}.pdf`);
};
