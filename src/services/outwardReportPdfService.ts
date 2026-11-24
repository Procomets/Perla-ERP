import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { OutwardEntry } from '../types/outward';
import { formatDate } from '../utils/formatters';

export interface OutwardReportPdfParams {
  outwards: OutwardEntry[];
  customerName?: string;
  subcontractorName?: string;
  transporterName?: string;
  startDate?: string;
  endDate?: string;
  processCategory?: string;
  status?: string;
}

export class OutwardReportPdfService {
  /**
   * Generates a jsPDF landscape document representing the comprehensive Outward dispatch report
   * including style, contractor, colour-wise dispatch details, and transport information.
   */
  static generateOutwardReportPdfDoc(params: OutwardReportPdfParams): jsPDF {
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
    doc.text('OUTWARD DISPATCH CONSOLIDATED REPORT (WITH COLOURS)', pageWidth / 2, currentY + 14, { align: 'center' });

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

    // Second line of filter box: Process, Status, Logistics / Transporter
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

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('Transporter:', margin + 160, currentY + 9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(params.transporterName || 'All Logistics', margin + 180, currentY + 9.5);

    // Compute Summary Stats
    let totalOrdered = 0;
    let totalInward = 0;
    let totalPrevDisp = 0;
    let totalPiecesDispatched = 0;
    let totalKgDispatched = 0;
    let totalRemaining = 0;

    params.outwards.forEach((outw) => {
      const lines = outw.lines || [];
      if (lines.length > 0) {
        lines.forEach((l) => {
          totalOrdered += Number(l.orderedQtySnapshot) || 0;
          totalInward += Number(l.cumulativeInwardQtySnapshot) || 0;
          totalPrevDisp += Number(l.previouslyDispatchedQtySnapshot) || 0;
          const qty = Number(l.dispatchQty) || 0;
          if (l.unit === 'kg') {
            totalKgDispatched += qty;
          } else {
            totalPiecesDispatched += qty;
          }
          totalRemaining += Number(l.remainingAfterDispatchSnapshot) || 0;
        });
      } else {
        totalPiecesDispatched += outw.totalQtyByUnit?.piece || 0;
        totalKgDispatched += outw.totalQtyByUnit?.kg || 0;
      }
    });

    currentY += 15;

    // --- 3. Build Table Rows ---
    const tableRows: any[] = [];

    params.outwards.forEach((outw, outwIdx) => {
      const lines = outw.lines && outw.lines.length > 0 ? outw.lines : [null];

      lines.forEach((line, lIdx) => {
        const isFirst = lIdx === 0;

        tableRows.push([
          isFirst ? `${outwIdx + 1}` : '',
          isFirst ? `${outw.outwardNo}\n${formatDate(outw.outwardDate)}` : '',
          isFirst ? `${outw.ourDcNo || '—'}` : '',
          isFirst
            ? `${outw.customerCompanyNameSnapshot || outw.customerName || '—'}\n${
                outw.subcontractorNameSnapshot ? `[${outw.subcontractorNameSnapshot}]` : ''
              }`
            : '',
          isFirst ? `${outw.styleNoSnapshot || outw.styleNo || '—'}\nPO: ${outw.poNumberSnapshot || outw.poNumber || '—'}` : '',
          line ? line.colourNameSnapshot || line.colour || '—' : '—',
          line ? line.washTypeSnapshot || line.processType || line.process || 'Wash' : '—',
          line ? (Number(line.orderedQtySnapshot) || 0).toLocaleString() : '—',
          line ? (Number(line.cumulativeInwardQtySnapshot) || 0).toLocaleString() : '—',
          line ? (Number(line.previouslyDispatchedQtySnapshot) || 0).toLocaleString() : '—',
          line ? (Number(line.dispatchQty) || 0).toLocaleString() : '0',
          line ? (Number(line.remainingAfterDispatchSnapshot) || 0).toLocaleString() : '0',
          line ? (line.unit === 'kg' ? 'KG' : 'PCS') : 'PCS',
          isFirst ? `${outw.vehicleNumber || '—'}\n${outw.driverName || '—'}` : '',
          isFirst ? (outw.status || 'posted').toUpperCase() : ''
        ]);
      });
    });

    const dispatchedTotalText =
      totalKgDispatched > 0
        ? `${totalPiecesDispatched.toLocaleString()}\n(${totalKgDispatched.toLocaleString()} kg)`
        : totalPiecesDispatched.toLocaleString();

    runAutoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin, bottom: 12 },
      head: [
        [
          'S.No',
          'Outward # / Date',
          'Our DC #',
          'Customer / Contractor',
          'Style / PO #',
          'Colour',
          'Process',
          'Ordered',
          'Inward',
          'Prev Disp',
          'Dispatched',
          'Remaining',
          'Unit',
          'Vehicle / Driver',
          'Status'
        ]
      ],
      body: tableRows,
      foot: [
        [
          {
            content: `Total (${params.outwards.length} Outwards):`,
            colSpan: 7,
            styles: { halign: 'right', fontStyle: 'bold' }
          },
          {
            content: totalOrdered > 0 ? totalOrdered.toLocaleString() : '—',
            styles: { halign: 'right', fontStyle: 'bold' }
          },
          {
            content: totalInward > 0 ? totalInward.toLocaleString() : '—',
            styles: { halign: 'right', fontStyle: 'bold' }
          },
          {
            content: totalPrevDisp > 0 ? totalPrevDisp.toLocaleString() : '—',
            styles: { halign: 'right', fontStyle: 'bold' }
          },
          {
            content: dispatchedTotalText,
            styles: { halign: 'right', fontStyle: 'bold', textColor: [31, 78, 121] }
          },
          {
            content: totalRemaining.toLocaleString(),
            styles: { halign: 'right', fontStyle: 'bold' }
          },
          {
            content: totalKgDispatched > 0 ? 'PCS / KG' : 'PCS',
            styles: { halign: 'center', fontStyle: 'bold' }
          },
          { content: '' },
          { content: '' }
        ]
      ],
      theme: 'grid',
      headStyles: {
        fillColor: [31, 78, 121], // #1F4E79
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        lineWidth: 0.25,
        lineColor: [255, 255, 255]
      },
      footStyles: {
        fillColor: [241, 245, 249], // light slate-100
        textColor: [30, 41, 59],    // dark slate
        fontSize: 7.5,
        fontStyle: 'bold',
        valign: 'middle',
        lineWidth: 0.25,
        lineColor: [203, 213, 225]
      },
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
        valign: 'middle',
        overflow: 'linebreak',
        textColor: [30, 41, 59],
        lineWidth: 0.2,
        lineColor: [203, 213, 225]
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },   // S.No
        1: { cellWidth: 22, halign: 'center' },  // Outward No & Date
        2: { cellWidth: 20, halign: 'center' },  // Our DC No
        3: { cellWidth: 34, halign: 'left' },    // Customer
        4: { cellWidth: 28, halign: 'left' },    // Style / PO #
        5: { cellWidth: 22, halign: 'left', fontStyle: 'bold' }, // Colour
        6: { cellWidth: 16, halign: 'left' },    // Process
        7: { cellWidth: 14, halign: 'right' },   // Ordered
        8: { cellWidth: 14, halign: 'right' },   // Inward
        9: { cellWidth: 15, halign: 'right' },   // Prev Disp
        10: { cellWidth: 18, halign: 'right', fontStyle: 'bold', textColor: [31, 78, 121] }, // Dispatched
        11: { cellWidth: 16, halign: 'right' },  // Remaining
        12: { cellWidth: 11, halign: 'center' }, // Unit
        13: { cellWidth: 23, halign: 'left' },   // Vehicle
        14: { cellWidth: 16, halign: 'center' }  // Status
      },
      didDrawPage: (data: any) => {
        // Page footer: page number alone
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `${data.pageNumber}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 5,
          { align: 'center' }
        );
      }
    });

    return doc;
  }

  /**
   * Directly downloads the generated Outward report PDF
   */
  static downloadPdf(params: OutwardReportPdfParams): void {
    const doc = this.generateOutwardReportPdfDoc(params);
    const fileName = `Outward_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  }

  /**
   * Opens the PDF in a new browser tab for print preview
   */
  static openPdfPreview(params: OutwardReportPdfParams): void {
    const doc = this.generateOutwardReportPdfDoc(params);
    const blobUrl = doc.output('bloburl');
    window.open(blobUrl, '_blank');
  }
}

