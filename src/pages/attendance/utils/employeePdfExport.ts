import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EmployeeMaster } from '../../../types/employee';

export interface MonthlyStatsItem {
  monthName: string;
  totalDays: number;
  workingDays: number;
  presentDays: number;
  pnDays: number;
  absentDays: number;
}

export interface EmployeePdfExportParams {
  employee: EmployeeMaster;
  selectedYear: string | number;
  monthlyStats: MonthlyStatsItem[];
  totals: {
    totalWorking: number;
    totalPresent: number;
    totalAbsent: number;
    percent: number;
  };
}

export const exportEmployeeReportToPdf = async (params: EmployeePdfExportParams) => {
  const { employee, selectedYear, monthlyStats, totals } = params;

  // Create A4 portrait PDF (pt units: 595.28 x 841.89 pt)
  const doc = new jsPDF('p', 'pt', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;
  let currentY = 40;

  // Format Salary / Wages into clean legible notation
  const formatSalary = (emp: EmployeeMaster): string => {
    if (emp.dailyWages && emp.dailyWages.trim() && emp.dailyWages !== '0' && emp.dailyWages !== '0000') {
      const num = Number(emp.dailyWages.replace(/,/g, ''));
      const val = !isNaN(num) ? num.toLocaleString('en-IN') : emp.dailyWages;
      return `INR ${val} / Day`;
    }
    if (emp.monthlyIncome && emp.monthlyIncome.trim() && emp.monthlyIncome !== '0') {
      const num = Number(emp.monthlyIncome.replace(/,/g, ''));
      const val = !isNaN(num) ? num.toLocaleString('en-IN') : emp.monthlyIncome;
      return `INR ${val} / Month`;
    }
    return '-';
  };

  // Header: Minimal Typographic Header (No background fill)
  doc.setTextColor(15, 23, 42); // slate-900
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('PERLA TEXTILES PROCESSOR', marginX, currentY + 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text('Textile Processing & Fabric Finishing Division • Workforce Muster Roll', marginX, currentY + 28);

  // Top-Right Header Metadata
  const dateFormatted = new Date().toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`ANNUAL REPORT ${selectedYear}`, pageWidth - marginX, currentY + 14, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`Generated: ${dateFormatted}`, pageWidth - marginX, currentY + 28, { align: 'right' });

  // Minimal divider line
  currentY += 38;
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.8);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);
  currentY += 22;

  // Section 1: Employee Basic Information
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Employee Master Details', marginX, currentY);
  currentY += 14;

  let statePin = '';
  if (employee.state && employee.pincode) statePin = `${employee.state} - ${employee.pincode}`;
  else if (employee.state) statePin = employee.state;
  else if (employee.pincode) statePin = employee.pincode;

  const employeeFields: [string, string][] = [
    ['Full Name', employee.fullName || '-'],
    ['Employee ID', employee.employeeId || '-'],
    ['Employee Type', employee.employeeType || '-'],
    ['Employment Status', employee.employmentStatus || 'Active'],
    ['Department', employee.department || '-'],
    ['Designation', employee.designation || '-'],
    ['Date of Joining', employee.dateOfJoining || '-'],
    ['Shift Schedule', employee.shift || '-'],
    ['Contact Mobile', employee.mobileNumber || '-'],
    ['Alternate Mobile', employee.alternateMobile || '-'],
    ['Email Address', employee.email || '-'],
    ['Blood Group', employee.bloodGroup || '-'],
    ['Aadhar Number', employee.aadharNumber || '-'],
    ['PAN Number', employee.panNumber || '-'],
    ['Emergency Contact', employee.emergencyContactName ? `${employee.emergencyContactName} (${employee.emergencyContactNumber || '-'})` : '-'],
    ['Work Location', employee.workLocation || '-'],
    ['Reporting Manager', employee.reportingManager || '-'],
    ['Wages / Salary', formatSalary(employee)],
    ['Bank Branch', employee.bankBranch || '-'],
    ['Bank Account No.', employee.accountNumber || '-'],
    ['IFSC Code', employee.ifscCode || '-'],
    ['Address', employee.address ? (statePin ? `${employee.address}, ${statePin}` : employee.address) : '-']
  ];

  // Render Employee details in a structured 2-column key-value grid
  const col1X = marginX;
  const col2X = marginX + 260;
  doc.setFontSize(8.5);

  for (let i = 0; i < employeeFields.length; i += 2) {
    const item1 = employeeFields[i];
    const item2 = employeeFields[i + 1];

    // Col 1
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(`${item1[0]}:`, col1X, currentY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(doc.splitTextToSize(item1[1], 160), col1X + 90, currentY);

    // Col 2
    if (item2) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text(`${item2[0]}:`, col2X, currentY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      doc.text(doc.splitTextToSize(item2[1], 160), col2X + 90, currentY);
    }

    currentY += 14;
  }

  currentY += 10;

  // Section 2: Annual Summary Metrics (KPI Cards)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('2. Annual Attendance Summary', marginX, currentY);
  currentY += 12;

  const cardWidth = (pageWidth - marginX * 2 - 24) / 4;
  const cardHeight = 44;

  const kpis = [
    { label: 'TOTAL WORKING', val: String(totals.totalWorking), color: [30, 41, 59] },
    { label: 'DAYS PRESENT', val: String(totals.totalPresent), color: [22, 163, 74] }, // green
    { label: 'DAYS ABSENT', val: String(totals.totalAbsent), color: [225, 29, 72] }, // rose
    { label: 'ATTENDANCE RATE', val: `${totals.percent}%`, color: [2, 132, 199] } // sky
  ];

  kpis.forEach((kpi, idx) => {
    const cardX = marginX + idx * (cardWidth + 8);
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 4, 4, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, cardX + cardWidth / 2, currentY + 14, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.val, cardX + cardWidth / 2, currentY + 34, { align: 'center' });
  });

  currentY += cardHeight + 16;

  // Section 3: Month-by-Month Attendance Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`3. Month-by-Month Muster Breakdown (${selectedYear})`, marginX, currentY);
  currentY += 10;

  const isLabour = employee.employeeType === 'Labour';

  const tableHeaders = isLabour
    ? [['Month', 'Calendar Days', 'Working Days', 'Present (P)', 'Double (P/N)', 'Absent (AB)', 'Rate %']]
    : [['Month', 'Calendar Days', 'Working Days', 'Present (P)', 'Night (N)', 'Absent (AB)', 'Rate %']];

  const tableRows = monthlyStats.map((stat) => {
    const effectivePresent = stat.presentDays + (isLabour ? stat.pnDays * 2 : 0);
    const rate = stat.workingDays > 0 ? `${Math.round((effectivePresent / stat.workingDays) * 100)}%` : '0%';

    return [
      stat.monthName,
      String(stat.totalDays),
      String(stat.workingDays),
      String(stat.presentDays),
      String(stat.pnDays),
      String(stat.absentDays),
      rate
    ];
  });

  // Append Total Row
  const totalEffectivePresent = totals.totalPresent;
  const totalRate = totals.totalWorking > 0 ? `${totals.percent}%` : '0%';
  tableRows.push([
    'FULL YEAR TOTAL',
    '-',
    String(totals.totalWorking),
    String(totals.totalPresent),
    '-',
    String(totals.totalAbsent),
    totalRate
  ]);

  autoTable(doc, {
    startY: currentY,
    head: tableHeaders,
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 4.5,
      textColor: [51, 65, 85],
      lineColor: [226, 232, 240],
      lineWidth: 0.5
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold' },
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'center', textColor: [22, 163, 74], fontStyle: 'bold' },
      4: { halign: 'center', textColor: [2, 132, 199] },
      5: { halign: 'center', textColor: [225, 29, 72], fontStyle: 'bold' },
      6: { halign: 'center', fontStyle: 'bold' }
    },
    didParseCell: (data) => {
      // Bold and highlight total row
      if (data.row.index === tableRows.length - 1) {
        data.cell.styles.fillColor = [241, 245, 249]; // slate-100
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = [15, 23, 42];
      }
    }
  });

  const lastTableY = (doc as any).lastAutoTable.finalY + 30;

  // Signatures & Verification
  if (lastTableY < 780) {
    const sigY = lastTableY + 20;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.8);

    // Signature 1
    doc.line(marginX, sigY, marginX + 130, sigY);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Prepared By (Staff)', marginX + 65, sigY + 12, { align: 'center' });

    // Signature 2
    doc.line(pageWidth / 2 - 65, sigY, pageWidth / 2 + 65, sigY);
    doc.text('Employee Signature', pageWidth / 2, sigY + 12, { align: 'center' });

    // Signature 3
    doc.line(pageWidth - marginX - 130, sigY, pageWidth - marginX, sigY);
    doc.text('Authorized Signatory / HR', pageWidth - marginX - 65, sigY + 12, { align: 'center' });
  }

  // Trigger browser download
  const safeName = (employee.fullName || 'Employee').replace(/\s+/g, '_');
  const fileName = `Attendance_Report_${safeName}_${selectedYear}.pdf`;
  doc.save(fileName);
};
