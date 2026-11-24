import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PurchaseOrder } from '../types/po';
import { formatDate, formatCurrency } from '../utils/formatters';

export interface POReportPdfParams {
  pos: PurchaseOrder[];
  customerName?: string;
  startDate?: string;
  endDate?: string;
  processCategory?: string;
  status?: string;
}

export class POReportPdfService {
  /**
   * Generates a jsPDF landscape document representing the comprehensive PO report
   * including style, item description, and colour-wise details.
   */
  static generatePoReportPdfDoc(params: POReportPdfParams): jsPDF {
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
      'NO. 107, Industrial Estate, Thirumudivakkam, SIDCO, Chennai - 600 044.',
      pageWidth / 2,
      currentY + 8,
      { align: 'center' }
    );

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text('PURCHASE ORDER CONSOLIDATED REPORT', pageWidth / 2, currentY + 14, { align: 'center' });

    currentY += 18;

    // --- 2. Filter Information Box ---
    doc.setFontSize(8);
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(margin, currentY, pageWidth - margin * 2, 12, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('Customer:', margin + 4, currentY + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(params.customerName || 'All Customers', margin + 20, currentY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('Date Range:', margin + 90, currentY + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    const dateRangeText =
      params.startDate || params.endDate
        ? `${params.startDate ? formatDate(params.startDate) : 'Start'} to ${
            params.endDate ? formatDate(params.endDate) : 'Present'
          }`
        : 'All Available Dates';
    doc.text(dateRangeText, margin + 110, currentY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('Generated On:', pageWidth - margin - 50, currentY + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(formatDate(new Date().toISOString()), pageWidth - margin - 25, currentY + 4.5);

    // Second line of filter box: Process & Status + Metrics
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('Process:', margin + 4, currentY + 9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(params.processCategory ? params.processCategory.toUpperCase() : 'ALL', margin + 20, currentY + 9.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('Status:', margin + 90, currentY + 9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(params.status ? params.status.toUpperCase() : 'ALL', margin + 110, currentY + 9.5);

    // Compute Summary Stats for table grand total
    let totalQty = 0;
    let totalAmount = 0;

    params.pos.forEach((po) => {
      const lines = po.colourLines || po.lines || [];
      if (lines.length > 0) {
        lines.forEach((l) => {
          totalQty += Number(l.quantity) || 0;
          totalAmount += Number(l.amount ?? l.lineAmount ?? (l.quantity * l.rate)) || 0;
        });
      } else {
        totalQty += Number(po.totalQuantity) || 0;
        totalAmount += Number(po.totalAmount) || 0;
      }
    });

    currentY += 15;

    // --- 3. Build Table Data ---
    // Columns:
    // 0: PO No
    // 1: Date
    // 2: Customer
    // 3: Cust PO / Date
    // 4: Style No
    // 5: Item Description
    // 6: Process
    // 7: Colour Name
    // 8: Wash / Treatment
    // 9: Qty
    // 10: Unit
    // 11: Rate (₹)
    // 12: Amount (₹)
    // 13: Status

    const tableHead = [
      [
        'PO Number',
        'Order Date',
        'Customer Name',
        'Cust PO No',
        'Style No',
        'Item Description',
        'Process',
        'Colour Name',
        'Wash / Process',
        'Qty',
        'Unit',
        'Rate',
        'Amount',
        'Status'
      ]
    ];

    const tableBody: any[] = [];

    params.pos.forEach((po) => {
      const lines = po.colourLines || po.lines || [];
      const poNum = po.poNumber || 'PO/PENDING';
      const poDate = formatDate(po.orderDate);
      const custName = po.customerCompanyNameSnapshot || po.customerName || '-';
      const custPo = po.customerPoNumber ? `${po.customerPoNumber}${po.customerPoDate ? ` (${formatDate(po.customerPoDate)})` : ''}` : '-';
      const styleNo = po.styleNo || po.styleNumber || '-';
      const itemName = po.itemName || '-';
      const processCategory = po.processCategory ? po.processCategory.toUpperCase() : '-';
      const statusText = (po.status || 'DRAFT').toUpperCase();

      if (lines.length === 0) {
        tableBody.push([
          poNum,
          poDate,
          custName,
          custPo,
          styleNo,
          itemName,
          processCategory,
          '-',
          '-',
          (po.totalQuantity || 0).toLocaleString('en-IN'),
          'PCS',
          '-',
          (po.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
          statusText
        ]);
      } else {
        lines.forEach((line, idx) => {
          const lineQty = Number(line.quantity) || 0;
          const lineRate = Number(line.rate) || 0;
          const lineAmt = Number(line.amount ?? line.lineAmount ?? (lineQty * lineRate)) || 0;

          tableBody.push([
            idx === 0 ? poNum : '',
            idx === 0 ? poDate : '',
            idx === 0 ? custName : '',
            idx === 0 ? custPo : '',
            idx === 0 ? styleNo : '',
            idx === 0 ? itemName : '',
            idx === 0 ? processCategory : '',
            line.colourName || '-',
            line.processType || '-',
            lineQty.toLocaleString('en-IN'),
            (line.unit || 'PCS').toUpperCase(),
            lineRate > 0 ? lineRate.toFixed(2) : '-',
            lineAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
            idx === 0 ? statusText : ''
          ]);
        });
      }
    });

    // Grand Total Row
    tableBody.push([
      { content: 'GRAND TOTAL', colSpan: 9, styles: { halign: 'right', fontStyle: 'bold', fillColor: [241, 245, 249] } },
      { content: totalQty.toLocaleString('en-IN'), styles: { halign: 'right', fontStyle: 'bold', fillColor: [241, 245, 249] } },
      { content: 'PCS', styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249] } },
      { content: '', styles: { fillColor: [241, 245, 249] } },
      { content: totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }), styles: { halign: 'right', fontStyle: 'bold', fillColor: [241, 245, 249] } },
      { content: '', styles: { fillColor: [241, 245, 249] } }
    ]);

    // --- 4. Render Table ---
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
        0: { cellWidth: 24, fontStyle: 'bold' }, // PO No
        1: { cellWidth: 18, halign: 'center' }, // Order Date
        2: { cellWidth: 32 }, // Customer
        3: { cellWidth: 22 }, // Cust PO
        4: { cellWidth: 22, fontStyle: 'bold' }, // Style No
        5: { cellWidth: 26 }, // Item Description
        6: { cellWidth: 16, halign: 'center' }, // Process
        7: { cellWidth: 22 }, // Colour Name
        8: { cellWidth: 24 }, // Wash / Process
        9: { cellWidth: 14, halign: 'right', fontStyle: 'bold' }, // Qty
        10: { cellWidth: 12, halign: 'center' }, // Unit
        11: { cellWidth: 14, halign: 'right' }, // Rate
        12: { cellWidth: 18, halign: 'right', fontStyle: 'bold' }, // Amount
        13: { cellWidth: 16, halign: 'center' } // Status
      },
      didDrawPage: (data: any) => {
        // Page footer - only page number (1, 2, 3...)
        const str = `${data.pageNumber}`;
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(str, pageWidth / 2, doc.internal.pageSize.getHeight() - 5, { align: 'center' });
      }
    });

    return doc;
  }

  /**
   * Downloads the generated PO Report as PDF
   */
  static downloadPoReportPdf(params: POReportPdfParams): void {
    const doc = this.generatePoReportPdfDoc(params);
    const safeCust = (params.customerName || 'All_Customers').replace(/[^a-zA-Z0-9]/g, '_');
    const safeDate = new Date().toISOString().split('T')[0];
    doc.save(`PO_Report_${safeCust}_${safeDate}.pdf`);
  }

  /**
   * Opens the PDF in a new browser tab for preview or direct printing
   */
  static openPoReportPdf(params: POReportPdfParams): void {
    const doc = this.generatePoReportPdfDoc(params);
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }
}
