import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { InwardEntry } from '../types/inward';
import { formatDate } from '../utils/formatters';

export interface InwardReportPdfParams {
  inwards: InwardEntry[];
  customerName?: string;
  subcontractorName?: string;
  startDate?: string;
  endDate?: string;
  processCategory?: string;
  status?: string;
}

export class InwardReportPdfService {
  /**
   * Generates a jsPDF landscape document representing the comprehensive Inward report
   * including style, contractor, and colour-wise inward details.
   */
  static generateInwardReportPdfDoc(params: InwardReportPdfParams): jsPDF {
    const jsPdfConstructor: any = (jsPDF as any).default || jsPDF;
    const doc = new jsPdfConstructor({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const runAutoTable = (autoTable as any).default || autoTable;

    const pageWidth = doc.internal.pageSize.getWidth(); // 297mm for A4 landscape
    const margin = 10;
    let currentY = margin;

    // --- 1. Company Letterhead Header ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(31, 78, 121); // #1F4E79
    doc.text('PERLA TEXTILES PROCESSOR', pageWidth / 2, currentY + 3, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(
      'Factory: No. 48/2, SIDCO Industrial Estate, Thirumudivakkam, Chennai - 600044, Tamil Nadu.',
      pageWidth / 2,
      currentY + 8,
      { align: 'center' }
    );

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text('MATERIAL INWARD CONSOLIDATED REPORT (WITH COLOURS)', pageWidth / 2, currentY + 14, { align: 'center' });

    currentY += 18;

    // --- 2. Filter Information Box ---
    doc.setFontSize(8);
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(margin, currentY, pageWidth - margin * 2, 12, 1.5, 1.5, 'FD');

    // First line of filter box: Customer, Contractor, Date Range, Generated On
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('Customer:', margin + 4, currentY + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(params.customerName || 'All Customers', margin + 22, currentY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('Contractor:', margin + 85, currentY + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(params.subcontractorName || 'All Contractors', margin + 104, currentY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('Date Range:', margin + 160, currentY + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    const dateRangeText =
      params.startDate || params.endDate
        ? `${params.startDate ? formatDate(params.startDate) : 'Start'} to ${
            params.endDate ? formatDate(params.endDate) : 'Present'
          }`
        : 'All Available Dates';
    doc.text(dateRangeText, margin + 180, currentY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('Generated On:', pageWidth - margin - 48, currentY + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(formatDate(new Date().toISOString()), pageWidth - margin - 24, currentY + 4.5);

    // Second line of filter box: Process, Status, Total Receipts, Total Qty
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('Process:', margin + 4, currentY + 9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(params.processCategory ? params.processCategory.toUpperCase() : 'ALL', margin + 22, currentY + 9.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('Status:', margin + 85, currentY + 9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(params.status ? params.status.toUpperCase() : 'ALL', margin + 104, currentY + 9.5);

    // Compute Summary Stats for table grand total
    let totalInwardQty = 0;
    let totalPoOrderedQty = 0;

    params.inwards.forEach((inward) => {
      const lines = inward.lines || [];
      if (lines.length > 0) {
        lines.forEach((l) => {
          totalInwardQty += Number(l.receivedQty) || 0;
          totalPoOrderedQty += Number(l.orderedQtySnapshot) || 0;
        });
      } else {
        totalInwardQty += Number(inward.totalQuantity) || 0;
      }
    });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('Total Inwards:', margin + 160, currentY + 9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(31, 78, 121);
    doc.text(String(params.inwards.length), margin + 185, currentY + 9.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('Total Received Qty:', pageWidth - margin - 48, currentY + 9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(4, 120, 87); // Emerald
    doc.text(totalInwardQty.toLocaleString('en-IN'), pageWidth - margin - 16, currentY + 9.5);

    currentY += 15;

    // --- 3. Build Table Data ---
    const tableHead = [
      [
        'Inward No',
        'Inward Date',
        'Customer DC No',
        'Customer Name',
        'Subcontractor Unit',
        'Style No / PO No',
        'Colour Name',
        'Wash / Process',
        'PO Qty',
        'Inward Qty',
        'Unit',
        'Balance',
        'Status'
      ]
    ];

    const tableBody: any[] = [];

    params.inwards.forEach((inward) => {
      const lines = inward.lines || [];
      const inwardNo = inward.inwardNo || 'INW/PENDING';
      const inwardDate = formatDate(inward.inwardDate);
      const custDc = inward.customerDcNo ? `${inward.customerDcNo}${inward.customerDate ? ` (${formatDate(inward.customerDate)})` : ''}` : '-';
      const custName = inward.customerCompanyNameSnapshot || inward.customerName || '-';
      const subName = inward.subcontractorNameSnapshot || inward.subContractorName || '-';
      const stylePo = `${inward.styleNoSnapshot || inward.styleNo || '-'}\nPO: ${inward.poNumberSnapshot || inward.poNumber || '-'}`;
      const statusText = (inward.status || 'DRAFT').toUpperCase();

      if (lines.length === 0) {
        tableBody.push([
          inwardNo,
          inwardDate,
          custDc,
          custName,
          subName,
          stylePo,
          '-',
          '-',
          '-',
          (inward.totalQuantity || 0).toLocaleString('en-IN'),
          inward.totalQtyByUnit?.kg ? 'KG' : 'PCS',
          '-',
          statusText
        ]);
      } else {
        lines.forEach((line, idx) => {
          const lineInwQty = Number(line.receivedQty) || 0;
          const lineOrderedQty = Number(line.orderedQtySnapshot) || 0;
          const lineBalQty = Number(line.balanceAfterReceiptSnapshot) || 0;

          tableBody.push([
            idx === 0 ? inwardNo : '',
            idx === 0 ? inwardDate : '',
            idx === 0 ? custDc : '',
            idx === 0 ? custName : '',
            idx === 0 ? subName : '',
            idx === 0 ? stylePo : '',
            line.colourNameSnapshot || line.colour || '-',
            line.washTypeSnapshot || line.processType || '-',
            lineOrderedQty > 0 ? lineOrderedQty.toLocaleString('en-IN') : '-',
            lineInwQty.toLocaleString('en-IN'),
            (line.unit || 'piece').toUpperCase(),
            lineBalQty > 0 ? lineBalQty.toLocaleString('en-IN') : '0',
            idx === 0 ? statusText : ''
          ]);
        });
      }
    });

    // --- 4. Render AutoTable ---
    runAutoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin, bottom: 12 },
      head: tableHead,
      body: tableBody,
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
        textColor: [30, 41, 59],
        lineColor: [203, 213, 225],
        lineWidth: 0.15
      },
      headStyles: {
        fillColor: [31, 78, 121], // #1F4E79
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
        halign: 'left'
      },
      columnStyles: {
        0: { cellWidth: 24, fontStyle: 'bold' }, // Inward No
        1: { cellWidth: 18, halign: 'center' }, // Inward Date
        2: { cellWidth: 26 }, // Customer DC No
        3: { cellWidth: 32 }, // Customer Name
        4: { cellWidth: 26 }, // Subcontractor
        5: { cellWidth: 30, fontStyle: 'bold' }, // Style No / PO No
        6: { cellWidth: 24 }, // Colour Name
        7: { cellWidth: 22 }, // Wash / Process
        8: { cellWidth: 15, halign: 'right' }, // PO Qty
        9: { cellWidth: 16, halign: 'right', fontStyle: 'bold', textColor: [4, 120, 87] }, // Inward Qty
        10: { cellWidth: 12, halign: 'center' }, // Unit
        11: { cellWidth: 15, halign: 'right' }, // Balance Qty
        12: { cellWidth: 16, halign: 'center' } // Status
      },
      didDrawPage: (data: any) => {
        // Page footer - page number
        const str = `${data.pageNumber}`;
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(str, pageWidth / 2, doc.internal.pageSize.getHeight() - 5, { align: 'center' });
      }
    });

    return doc;
  }

  /**
   * Downloads the generated Inward Report as PDF
   */
  static downloadInwardReportPdf(params: InwardReportPdfParams): void {
    const doc = this.generateInwardReportPdfDoc(params);
    const safeCust = (params.customerName || 'All_Customers').replace(/[^a-zA-Z0-9]/g, '_');
    const safeDate = new Date().toISOString().split('T')[0];
    doc.save(`Inward_Report_${safeCust}_${safeDate}.pdf`);
  }

  /**
   * Opens the PDF in a new browser tab for preview or direct printing
   */
  static openInwardReportPdf(params: InwardReportPdfParams): void {
    const doc = this.generateInwardReportPdfDoc(params);
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }
}
