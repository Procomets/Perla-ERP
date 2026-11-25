import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SamplePoInward } from '../types/samplePo';

function formatDisplayDate(dateStr?: string): string {
  if (!dateStr || dateStr === '-') return '—';
  try {
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const d = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }
  } catch {}
  return dateStr;
}

export class SamplePoPdfService {
  /**
   * Generates and downloads a clean, professional Single Sample PO PDF document
   */
  static downloadSingleSamplePoPdf(po: SamplePoInward): void {
    const jsPdfConstructor: any = (jsPDF as any).default || jsPDF;
    const doc = new jsPdfConstructor({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const runAutoTable = (autoTable as any).default || autoTable;
    const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
    const margin = 12;
    let currentY = margin;

    // --- 1. Company Letterhead Header ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(31, 78, 121); // #1F4E79
    doc.text('PERLA TEXTILES PROCESSOR', pageWidth / 2, currentY + 3, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(80, 80, 80);
    doc.text(
      'NO. 107, Industrial Estate, Thirumudivakkam, SIDCO, Chennai - 600 044.',
      pageWidth / 2,
      currentY + 8,
      { align: 'center' }
    );
    doc.text(
      'Phone: +91 44 2478 0000 | Email: info@perlatextiles.com | GSTIN: 33AAAAA0000A1Z5',
      pageWidth / 2,
      currentY + 12.5,
      { align: 'center' }
    );

    // Decorative Line
    currentY += 15;
    doc.setDrawColor(31, 78, 121);
    doc.setLineWidth(0.6);
    doc.line(margin, currentY, pageWidth - margin, currentY);

    // Document Title Banner
    currentY += 5;
    doc.setFillColor(238, 245, 251); // #EEF5FB
    doc.roundedRect(margin, currentY, pageWidth - margin * 2, 7.5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(31, 78, 121);
    doc.text('SAMPLE PURCHASE ORDER / INWARD CHALLAN', pageWidth / 2, currentY + 5.2, {
      align: 'center'
    });

    currentY += 11;

    // --- 2. Two-Column Metadata Box ---
    const colWidth = (pageWidth - margin * 2) / 2;
    const boxHeight = 32;

    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setFillColor(250, 252, 255);
    doc.roundedRect(margin, currentY, pageWidth - margin * 2, boxHeight, 1.5, 1.5, 'FD');

    // Left Column: Entry & Challan Info
    const leftX = margin + 4;
    let textY = currentY + 5.5;

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(70, 70, 70);
    doc.text('Sample PO Entry No:', leftX, textY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 78, 121);
    doc.text(po.entryNumber || '—', leftX + 38, textY);

    textY += 6;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(70, 70, 70);
    doc.text('Customer DC No:', leftX, textY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(po.customerDcNumber || '—', leftX + 38, textY);

    textY += 6;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(70, 70, 70);
    doc.text('Customer DC Date:', leftX, textY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(formatDisplayDate(po.customerDcDate), leftX + 38, textY);

    textY += 6;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(70, 70, 70);
    doc.text('Dispatch Status:', leftX, textY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(
      (po.dispatchStatus || '').toLowerCase() === 'completed'
        ? 16
        : (po.dispatchStatus || '').toLowerCase() === 'partial'
        ? 180
        : 100,
      (po.dispatchStatus || '').toLowerCase() === 'completed' ? 120 : 80,
      20
    );
    doc.text((po.dispatchStatus || 'Pending').toUpperCase(), leftX + 38, textY);

    // Right Column: Customer / Vendor Info
    const rightX = margin + colWidth + 4;
    textY = currentY + 5.5;

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(70, 70, 70);
    doc.text('Customer / Vendor:', rightX, textY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    const vendorLines = doc.splitTextToSize(po.vendorName || '—', colWidth - 40);
    doc.text(vendorLines[0] || '—', rightX + 34, textY);

    textY += 6;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(70, 70, 70);
    doc.text('GSTIN:', rightX, textY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(po.vendorGst || 'N/A', rightX + 34, textY);

    textY += 6;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(70, 70, 70);
    doc.text('Address:', rightX, textY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    const addr = po.vendorAddress || 'Chennai';
    const splitAddr = doc.splitTextToSize(addr, colWidth - 38);
    doc.text(splitAddr[0] || '—', rightX + 34, textY);

    textY += 6;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(70, 70, 70);
    doc.text('Created On:', rightX, textY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(`${formatDisplayDate(po.createdAt)} (by ${po.createdByName || 'Admin'})`, rightX + 34, textY);

    currentY += boxHeight + 6;

    // --- 3. Items Table ---
    const tableRows = (po.items || []).map((it, idx) => {
      const dispatched = Number(it.dispatchedQuantity || 0);
      const balance = Math.max(0, Number(it.quantity || 0) - dispatched);
      return [
        String(idx + 1),
        it.customerDcNumber || po.customerDcNumber || '—',
        formatDisplayDate(it.customerDcDate || po.customerDcDate),
        it.itemName || '—',
        it.styleNo || '—',
        it.washType || '—',
        `${it.quantity} ${it.unit || 'PCS'}`,
        `${dispatched} ${it.unit || 'PCS'}`,
        `${balance} ${it.unit || 'PCS'}`
      ];
    });

    const totalQty = (po.items || []).reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
    const totalDispatched = (po.items || []).reduce(
      (sum, it) => sum + (Number(it.dispatchedQuantity) || 0),
      0
    );
    const totalBalance = Math.max(0, totalQty - totalDispatched);

    runAutoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [
        [
          '#',
          'Customer DC',
          'DC Date',
          'Item Description',
          'Style No',
          'Wash / Process',
          'Inward Qty',
          'Dispatched',
          'Balance Qty'
        ]
      ],
      body: tableRows,
      foot: [
        [
          { content: 'TOTAL QUANTITY', colSpan: 6, styles: { halign: 'right', fontStyle: 'bold' } },
          { content: `${totalQty} PCS`, styles: { halign: 'right', fontStyle: 'bold' } },
          { content: `${totalDispatched} PCS`, styles: { halign: 'right', fontStyle: 'bold' } },
          { content: `${totalBalance} PCS`, styles: { halign: 'right', fontStyle: 'bold' } }
        ]
      ],
      theme: 'grid',
      headStyles: {
        fillColor: [31, 78, 121], // #1F4E79
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'left',
        valign: 'middle'
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [40, 40, 40],
        cellPadding: 2.5
      },
      footStyles: {
        fillColor: [238, 245, 251], // #EEF5FB
        textColor: [31, 78, 121],
        fontStyle: 'bold',
        fontSize: 8.5
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'left', cellWidth: 22 },
        2: { halign: 'left', cellWidth: 22 },
        3: { halign: 'left', cellWidth: 32 },
        4: { halign: 'left', cellWidth: 20 },
        5: { halign: 'left', cellWidth: 28 },
        6: { halign: 'right', cellWidth: 18 },
        7: { halign: 'right', cellWidth: 18 },
        8: { halign: 'right', cellWidth: 18 }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY || currentY + 40;
    currentY = finalY + 6;

    // --- 4. Remarks (if any) ---
    if (po.remarks) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(70, 70, 70);
      doc.text('Remarks / Instructions:', margin, currentY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 30, 30);
      doc.text(po.remarks, margin + 35, currentY);
      currentY += 8;
    }

    // --- 5. Signatures Footer ---
    currentY = Math.max(currentY + 12, 250);

    const sigWidth = 48;
    const sig1X = margin + 5;
    const sig2X = pageWidth / 2 - sigWidth / 2;
    const sig3X = pageWidth - margin - sigWidth - 5;

    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);

    doc.line(sig1X, currentY, sig1X + sigWidth, currentY);
    doc.line(sig2X, currentY, sig2X + sigWidth, currentY);
    doc.line(sig3X, currentY, sig3X + sigWidth, currentY);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 80, 80);
    doc.text('Prepared By', sig1X + sigWidth / 2, currentY + 4, { align: 'center' });
    doc.text('Checked & Verified By', sig2X + sigWidth / 2, currentY + 4, { align: 'center' });
    doc.text('Authorized Signatory', sig3X + sigWidth / 2, currentY + 4, { align: 'center' });

    // Save PDF
    const filename = `Sample_PO_${po.entryNumber || 'Document'}.pdf`;
    doc.save(filename);
  }

  /**
   * Generates and downloads a Consolidated Landscape PDF Report of the entire Sample PO Table
   */
  static downloadSamplePoTableReportPdf(
    pos: SamplePoInward[],
    dateFrom?: string,
    dateTo?: string
  ): void {
    const jsPdfConstructor: any = (jsPDF as any).default || jsPDF;
    const doc = new jsPdfConstructor({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const runAutoTable = (autoTable as any).default || autoTable;
    const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
    const margin = 10;
    let currentY = margin;

    // --- Letterhead Header ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(31, 78, 121); // #1F4E79
    doc.text('PERLA TEXTILES PROCESSOR', pageWidth / 2, currentY + 2, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(
      'NO. 107, Industrial Estate, Thirumudivakkam, SIDCO, Chennai - 600 044.',
      pageWidth / 2,
      currentY + 6.5,
      { align: 'center' }
    );

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(0, 0, 0);
    doc.text('SAMPLE PURCHASE ORDERS CONSOLIDATED REPORT', pageWidth / 2, currentY + 12, {
      align: 'center'
    });

    currentY += 15;

    // Filter Information Banner
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, currentY, pageWidth - margin * 2, 7, 1, 1, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(70, 70, 70);

    const fromStr = dateFrom ? formatDisplayDate(dateFrom) : 'All Dates';
    const toStr = dateTo ? formatDisplayDate(dateTo) : 'Current';
    const dateRangeText = `Date Range: ${fromStr} to ${toStr}`;
    const totalRecordsText = `Total Records: ${pos.length}`;
    const totalQty = pos.reduce((sum, p) => sum + (p.totalQuantity || 0), 0);
    const totalQtyText = `Total Quantity: ${totalQty.toLocaleString()} PCS`;

    doc.text(dateRangeText, margin + 4, currentY + 4.5);
    doc.text(totalRecordsText, pageWidth / 2 - 20, currentY + 4.5);
    doc.text(totalQtyText, pageWidth - margin - 40, currentY + 4.5);

    currentY += 10;

    // Build Table Rows
    const tableRows = pos.map((po, idx) => {
      const firstItem = po.items && po.items[0];
      const itemsCount = po.items?.length || 0;
      const itemsDesc = firstItem
        ? `${firstItem.itemName} (${firstItem.styleNo || '—'})${itemsCount > 1 ? ` +${itemsCount - 1} more` : ''}`
        : '—';
      const washDesc = firstItem?.washType || '—';

      return [
        String(idx + 1),
        po.entryNumber || '—',
        po.customerDcNumber || '—',
        formatDisplayDate(po.customerDcDate),
        po.vendorName || '—',
        itemsDesc,
        washDesc,
        `${(po.totalQuantity || 0).toLocaleString()} PCS`,
        `${(po.totalDispatchedQuantity || 0).toLocaleString()} PCS`,
        (po.dispatchStatus || 'Pending').toUpperCase(),
        (po.status || 'Active').toUpperCase()
      ];
    });

    const totalDispatched = pos.reduce((sum, p) => sum + (p.totalDispatchedQuantity || 0), 0);

    runAutoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [
        [
          '#',
          'Entry No',
          'Customer DC No',
          'Customer DC Date',
          'Customer / Vendor',
          'Items & Styles',
          'Wash / Process',
          'Total Qty',
          'Dispatched',
          'Dispatch Status',
          'Status'
        ]
      ],
      body: tableRows,
      foot: [
        [
          {
            content: `TOTAL (${pos.length} SAMPLE POS)`,
            colSpan: 7,
            styles: { halign: 'right', fontStyle: 'bold' }
          },
          { content: `${totalQty.toLocaleString()} PCS`, styles: { halign: 'right', fontStyle: 'bold' } },
          { content: `${totalDispatched.toLocaleString()} PCS`, styles: { halign: 'right', fontStyle: 'bold' } },
          { content: '—', colSpan: 2, styles: { halign: 'center' } }
        ]
      ],
      theme: 'grid',
      headStyles: {
        fillColor: [31, 78, 121], // #1F4E79
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'left',
        valign: 'middle'
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [40, 40, 40],
        cellPadding: 2
      },
      footStyles: {
        fillColor: [238, 245, 251], // #EEF5FB
        textColor: [31, 78, 121],
        fontStyle: 'bold',
        fontSize: 8
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'left', cellWidth: 32 },
        2: { halign: 'left', cellWidth: 26 },
        3: { halign: 'left', cellWidth: 24 },
        4: { halign: 'left', cellWidth: 46 },
        5: { halign: 'left', cellWidth: 44 },
        6: { halign: 'left', cellWidth: 32 },
        7: { halign: 'right', cellWidth: 20 },
        8: { halign: 'right', cellWidth: 20 },
        9: { halign: 'center', cellWidth: 20 },
        10: { halign: 'center', cellWidth: 16 }
      }
    });

    const today = new Date().toISOString().split('T')[0];
    doc.save(`Perla_Sample_POs_Report_${today}.pdf`);
  }
}
