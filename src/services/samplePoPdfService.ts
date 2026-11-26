import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SamplePoInward, SamplePoOutward } from '../types/samplePo';

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

    // Build Table Rows with rowSpan per PO across all inward items
    const tableRows: any[] = [];
    pos.forEach((po, poIdx) => {
      const items = po.items && po.items.length > 0 ? po.items : [null];
      const span = items.length;
      const effectiveStatus =
        (po.status || '').toLowerCase() === 'cancelled'
          ? 'CANCELLED'
          : (po.dispatchStatus || 'Pending').toUpperCase();

      items.forEach((it, itemIdx) => {
        const isFirst = itemIdx === 0;
        const qty = it ? Number(it.quantity || 0) : Number(po.totalQuantity || 0);
        const disp = it ? Number(it.dispatchedQuantity || 0) : Number(po.totalDispatchedQuantity || 0);
        const unit = it?.unit || 'PCS';

        const itemCells = [
          it?.customerDcNumber || po.customerDcNumber || '—',
          formatDisplayDate(it?.customerDcDate || po.customerDcDate),
          it?.itemName || '—',
          it?.styleNo || '—',
          it?.washType || '—',
          `${qty.toLocaleString()} ${unit}`,
          `${disp.toLocaleString()} ${unit}`
        ];

        if (isFirst) {
          tableRows.push([
            { content: String(poIdx + 1), rowSpan: span, styles: { halign: 'center', valign: 'middle' } },
            { content: po.entryNumber || '—', rowSpan: span, styles: { valign: 'middle', fontStyle: 'bold' } },
            itemCells[0],
            itemCells[1],
            { content: po.vendorName || '—', rowSpan: span, styles: { valign: 'middle', fontStyle: 'bold' } },
            itemCells[2],
            itemCells[3],
            itemCells[4],
            itemCells[5],
            itemCells[6],
            { content: effectiveStatus, rowSpan: span, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold' } }
          ]);
        } else {
          tableRows.push(itemCells);
        }
      });
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
          'Item Name',
          'Style No',
          'Wash / Process',
          'Inward Qty',
          'Dispatched',
          'Status'
        ]
      ],
      body: tableRows,
      foot: [
        [
          {
            content: `TOTAL (${pos.length} SAMPLE POS)`,
            colSpan: 8,
            styles: { halign: 'right', fontStyle: 'bold' }
          },
          { content: `${totalQty.toLocaleString()} PCS`, styles: { halign: 'right', fontStyle: 'bold' } },
          { content: `${totalDispatched.toLocaleString()} PCS`, styles: { halign: 'right', fontStyle: 'bold' } },
          { content: '—', styles: { halign: 'center' } }
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
        1: { halign: 'left', cellWidth: 30 },
        2: { halign: 'left', cellWidth: 24 },
        3: { halign: 'left', cellWidth: 22 },
        4: { halign: 'left', cellWidth: 42 },
        5: { halign: 'left', cellWidth: 34 },
        6: { halign: 'left', cellWidth: 22 },
        7: { halign: 'left', cellWidth: 32 },
        8: { halign: 'right', cellWidth: 20 },
        9: { halign: 'right', cellWidth: 20 },
        10: { halign: 'center', cellWidth: 21 }
      }
    });

    const today = new Date().toISOString().split('T')[0];
    doc.save(`Perla_Sample_POs_Report_${today}.pdf`);
  }

  /**
   * Generates and downloads a Consolidated Landscape PDF Report from exact filtered split-row lines
   * Column order: #, PO No, Company Name, DC Date, DC No., Style No., Item, Wash Process, Inward, Dispatch, Balance, Status
   */
  static downloadSamplePoFilteredReportPdf(
    lines: Array<{
      poId: string;
      entryNumber: string;
      vendorName: string;
      customerDcDate: string;
      customerDcNumber: string;
      styleNo: string;
      itemName: string;
      washType: string;
      quantity: number;
      dispatchedQuantity: number;
      balanceQuantity: number;
      unit: string;
      status: string;
    }>,
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
    doc.text('SAMPLE PURCHASE ORDERS DETAILED REPORT', pageWidth / 2, currentY + 12, {
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
    const uniquePoCount = new Set(lines.map((l) => l.poId)).size;
    const totalInward = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);
    const totalDispatched = lines.reduce((sum, l) => sum + (Number(l.dispatchedQuantity) || 0), 0);
    const totalBalance = lines.reduce((sum, l) => sum + (Number(l.balanceQuantity) || 0), 0);

    doc.text(`Date Range: ${fromStr} to ${toStr}`, margin + 4, currentY + 4.5);
    doc.text(`Orders: ${uniquePoCount} POs (${lines.length} Lines)`, pageWidth / 2 - 25, currentY + 4.5);
    doc.text(`Total Inward: ${totalInward.toLocaleString()} PCS`, pageWidth - margin - 45, currentY + 4.5);

    currentY += 10;

    // Build Table Rows with dynamic rowSpan for consecutive rows of same PO
    const tableRows: any[] = [];
    let poCounter = 0;
    let i = 0;
    while (i < lines.length) {
      const currentPoId = lines[i].poId;
      let j = i + 1;
      while (j < lines.length && lines[j].poId === currentPoId) {
        j++;
      }
      const span = j - i;
      poCounter++;

      for (let k = i; k < j; k++) {
        const r = lines[k];
        const isFirst = k === i;
        const unit = r.unit || 'PCS';

        const itemCells = [
          formatDisplayDate(r.customerDcDate),
          r.customerDcNumber ? `DC #${r.customerDcNumber}` : '—',
          r.styleNo || '—',
          r.itemName || '—',
          r.washType || '—',
          `${(r.quantity || 0).toLocaleString()} ${unit}`,
          `${(r.dispatchedQuantity || 0).toLocaleString()} ${unit}`,
          `${(r.balanceQuantity || 0).toLocaleString()} ${unit}`
        ];

        if (isFirst) {
          tableRows.push([
            { content: String(poCounter), rowSpan: span, styles: { halign: 'center', valign: 'middle' } },
            { content: r.entryNumber || '—', rowSpan: span, styles: { valign: 'middle', fontStyle: 'bold' } },
            { content: r.vendorName || '—', rowSpan: span, styles: { valign: 'middle', fontStyle: 'bold' } },
            ...itemCells,
            { content: (r.status || 'Pending').toUpperCase(), rowSpan: span, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold' } }
          ]);
        } else {
          tableRows.push(itemCells);
        }
      }
      i = j;
    }

    runAutoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [
        [
          '#',
          'PO No',
          'Company Name',
          'DC Date',
          'DC No.',
          'Style No.',
          'Item',
          'Wash Process',
          'Inward',
          'Dispatch',
          'Balance',
          'Status'
        ]
      ],
      body: tableRows,
      foot: [
        [
          {
            content: `TOTAL (${lines.length} LINES)`,
            colSpan: 8,
            styles: { halign: 'right', fontStyle: 'bold' }
          },
          { content: `${totalInward.toLocaleString()} PCS`, styles: { halign: 'right', fontStyle: 'bold' } },
          { content: `${totalDispatched.toLocaleString()} PCS`, styles: { halign: 'right', fontStyle: 'bold' } },
          { content: `${totalBalance.toLocaleString()} PCS`, styles: { halign: 'right', fontStyle: 'bold' } },
          { content: '—', styles: { halign: 'center' } }
        ]
      ],
      theme: 'grid',
      headStyles: {
        fillColor: [31, 78, 121],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
        halign: 'left',
        valign: 'middle'
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [40, 40, 40],
        cellPadding: 2,
        valign: 'middle'
      },
      footStyles: {
        fillColor: [238, 245, 251],
        textColor: [31, 78, 121],
        fontStyle: 'bold',
        fontSize: 8
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 9 },
        1: { halign: 'left', cellWidth: 28 },
        2: { halign: 'left', cellWidth: 38 },
        3: { halign: 'left', cellWidth: 22 },
        4: { halign: 'left', cellWidth: 20 },
        5: { halign: 'left', cellWidth: 18 },
        6: { halign: 'left', cellWidth: 28 },
        7: { halign: 'left', cellWidth: 30 },
        8: { halign: 'right', cellWidth: 20 },
        9: { halign: 'right', cellWidth: 20 },
        10: { halign: 'right', cellWidth: 20 },
        11: { halign: 'center', cellWidth: 24 }
      }
    });

    const today = new Date().toISOString().split('T')[0];
    doc.save(`Perla_Sample_POs_Report_${today}.pdf`);
  }

  /**
   * Generates and downloads a clean Single Sample Outward Challan PDF document
   */
  static downloadSingleSampleOutwardPdf(outward: SamplePoOutward): void {
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
    doc.setTextColor(31, 78, 121);
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

    currentY += 15;
    doc.setDrawColor(31, 78, 121);
    doc.setLineWidth(0.6);
    doc.line(margin, currentY, pageWidth - margin, currentY);

    // Document Title Banner
    currentY += 5;
    doc.setFillColor(238, 245, 251);
    doc.roundedRect(margin, currentY, pageWidth - margin * 2, 7.5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(31, 78, 121);
    doc.text('SAMPLE OUTWARD / DISPATCH CHALLAN', pageWidth / 2, currentY + 5.2, {
      align: 'center'
    });

    currentY += 11;

    // --- 2. Two-Column Metadata Box ---
    const colWidth = (pageWidth - margin * 2) / 2;
    const boxHeight = 32;

    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(250, 252, 255);
    doc.roundedRect(margin, currentY, pageWidth - margin * 2, boxHeight, 1.5, 1.5, 'FD');

    const leftX = margin + 4;
    let textY = currentY + 5.5;

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(70, 70, 70);
    doc.text('Outward Entry No:', leftX, textY);
    doc.setTextColor(31, 78, 121);
    doc.text(outward.entryNumber || '—', leftX + 36, textY);

    textY += 6;
    doc.setTextColor(70, 70, 70);
    doc.text('Outward DC No:', leftX, textY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(outward.outwardDcNumber || '—', leftX + 36, textY);

    textY += 6;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(70, 70, 70);
    doc.text('Outward DC Date:', leftX, textY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(formatDisplayDate(outward.outwardDcDate), leftX + 36, textY);

    textY += 6;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(70, 70, 70);
    doc.text('Linked Sample PO:', leftX, textY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 78, 121);
    doc.text(outward.inwardEntryNumber || '—', leftX + 36, textY);

    const rightX = margin + colWidth + 4;
    textY = currentY + 5.5;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(70, 70, 70);
    doc.text('Company Name:', rightX, textY);
    doc.setTextColor(0, 0, 0);
    const vendorLines = doc.splitTextToSize(outward.vendorName || '—', colWidth - 36);
    doc.text(vendorLines[0] || '—', rightX + 30, textY);

    textY += 6;
    doc.setTextColor(70, 70, 70);
    doc.text('GSTIN:', rightX, textY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(outward.vendorGst || 'N/A', rightX + 30, textY);

    textY += 6;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(70, 70, 70);
    doc.text('Customer DC:', rightX, textY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(
      `${outward.customerDcNumber || '—'} (${formatDisplayDate(outward.customerDcDate)})`,
      rightX + 30,
      textY
    );

    textY += 6;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(70, 70, 70);
    doc.text('Created By:', rightX, textY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(outward.createdByName || 'Staff', rightX + 30, textY);

    currentY += boxHeight + 6;

    // --- 3. Dispatched Line Items Table ---
    const tableRows = (outward.items || []).map((it, idx) => [
      String(idx + 1),
      it.customerDcNumber || outward.customerDcNumber || '—',
      formatDisplayDate(it.customerDcDate || outward.customerDcDate),
      it.styleNo || '—',
      it.itemName || '—',
      it.washType || '—',
      `${it.quantity} ${it.unit || 'PCS'}`
    ]);

    const totalQty = (outward.items || []).reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);

    runAutoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [['#', 'Customer DC', 'DC Date', 'Style No', 'Item', 'Wash Process', 'Dispatched Qty']],
      body: tableRows,
      foot: [
        [
          { content: 'TOTAL DISPATCHED QUANTITY', colSpan: 6, styles: { halign: 'right', fontStyle: 'bold' } },
          { content: `${totalQty} PCS`, styles: { halign: 'right', fontStyle: 'bold' } }
        ]
      ],
      theme: 'grid',
      headStyles: {
        fillColor: [31, 78, 121],
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
        fillColor: [238, 245, 251],
        textColor: [31, 78, 121],
        fontStyle: 'bold',
        fontSize: 8.5
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'left', cellWidth: 26 },
        2: { halign: 'left', cellWidth: 24 },
        3: { halign: 'left', cellWidth: 24 },
        4: { halign: 'left', cellWidth: 38 },
        5: { halign: 'left', cellWidth: 38 },
        6: { halign: 'right', cellWidth: 26 }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY || currentY + 40;
    currentY = finalY + 6;

    if (outward.remarks) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(70, 70, 70);
      doc.text('Remarks:', margin, currentY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 30, 30);
      doc.text(outward.remarks, margin + 20, currentY);
      currentY += 8;
    }

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
    doc.text('Receiver Signature', sig3X + sigWidth / 2, currentY + 4, { align: 'center' });

    doc.save(`Sample_Outward_${outward.entryNumber || 'Document'}.pdf`);
  }

  /**
   * Generates and downloads a Consolidated Landscape PDF Report from exact filtered Sample Outward split-row lines
   */
  static downloadSampleOutwardFilteredReportPdf(
    lines: Array<{
      outwardId: string;
      entryNumber: string;
      outwardDcDate: string;
      outwardDcNumber: string;
      inwardEntryNumber: string;
      vendorName: string;
      customerDcDate: string;
      customerDcNumber: string;
      styleNo: string;
      itemName: string;
      washType: string;
      quantity: number;
      unit: string;
      status: string;
    }>,
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

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(31, 78, 121);
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
    doc.text('SAMPLE OUTWARD DISPATCHES DETAILED REPORT', pageWidth / 2, currentY + 12, {
      align: 'center'
    });

    currentY += 15;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, currentY, pageWidth - margin * 2, 7, 1, 1, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(70, 70, 70);

    const fromStr = dateFrom ? formatDisplayDate(dateFrom) : 'All Dates';
    const toStr = dateTo ? formatDisplayDate(dateTo) : 'Current';
    const uniqueOutwardCount = new Set(lines.map((l) => l.outwardId)).size;
    const totalDispatched = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);

    doc.text(`Date Range: ${fromStr} to ${toStr}`, margin + 4, currentY + 4.5);
    doc.text(`Dispatches: ${uniqueOutwardCount} (${lines.length} Lines)`, pageWidth / 2 - 25, currentY + 4.5);
    doc.text(`Total Dispatched: ${totalDispatched.toLocaleString()} PCS`, pageWidth - margin - 48, currentY + 4.5);

    currentY += 10;

    // Build Table Rows with dynamic rowSpan per Outward
    const tableRows: any[] = [];
    let outwardCounter = 0;
    let i = 0;
    while (i < lines.length) {
      const currentOutwardId = lines[i].outwardId;
      let j = i + 1;
      while (j < lines.length && lines[j].outwardId === currentOutwardId) {
        j++;
      }
      const span = j - i;
      outwardCounter++;

      for (let k = i; k < j; k++) {
        const r = lines[k];
        const isFirst = k === i;
        const unit = r.unit || 'PCS';

        const itemCells = [
          formatDisplayDate(r.customerDcDate),
          r.customerDcNumber ? `DC #${r.customerDcNumber}` : '—',
          r.styleNo || '—',
          r.itemName || '—',
          r.washType || '—',
          `${(r.quantity || 0).toLocaleString()} ${unit}`
        ];

        if (isFirst) {
          tableRows.push([
            { content: String(outwardCounter), rowSpan: span, styles: { halign: 'center', valign: 'middle' } },
            { content: r.entryNumber || '—', rowSpan: span, styles: { valign: 'middle', fontStyle: 'bold' } },
            { content: formatDisplayDate(r.outwardDcDate), rowSpan: span, styles: { valign: 'middle' } },
            { content: r.outwardDcNumber ? `DC #${r.outwardDcNumber}` : '—', rowSpan: span, styles: { valign: 'middle', fontStyle: 'bold' } },
            { content: r.inwardEntryNumber || '—', rowSpan: span, styles: { valign: 'middle' } },
            { content: r.vendorName || '—', rowSpan: span, styles: { valign: 'middle', fontStyle: 'bold' } },
            ...itemCells,
            { content: (r.status || 'Active').toUpperCase(), rowSpan: span, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold' } }
          ]);
        } else {
          tableRows.push(itemCells);
        }
      }
      i = j;
    }

    runAutoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [
        [
          '#',
          'Outward No',
          'Outward Date',
          'Outward DC',
          'Inward PO No',
          'Company Name',
          'Cust DC Date',
          'Cust DC No.',
          'Style No.',
          'Item',
          'Wash Process',
          'Dispatch Qty',
          'Status'
        ]
      ],
      body: tableRows,
      foot: [
        [
          {
            content: `TOTAL (${lines.length} LINES)`,
            colSpan: 11,
            styles: { halign: 'right', fontStyle: 'bold' }
          },
          { content: `${totalDispatched.toLocaleString()} PCS`, styles: { halign: 'right', fontStyle: 'bold' } },
          { content: '—', styles: { halign: 'center' } }
        ]
      ],
      theme: 'grid',
      headStyles: {
        fillColor: [31, 78, 121],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
        halign: 'left',
        valign: 'middle'
      },
      bodyStyles: {
        fontSize: 7,
        textColor: [40, 40, 40],
        cellPadding: 1.8,
        valign: 'middle'
      },
      footStyles: {
        fillColor: [238, 245, 251],
        textColor: [31, 78, 121],
        fontStyle: 'bold',
        fontSize: 8
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        1: { halign: 'left', cellWidth: 26 },
        2: { halign: 'left', cellWidth: 19 },
        3: { halign: 'left', cellWidth: 18 },
        4: { halign: 'left', cellWidth: 26 },
        5: { halign: 'left', cellWidth: 34 },
        6: { halign: 'left', cellWidth: 19 },
        7: { halign: 'left', cellWidth: 18 },
        8: { halign: 'left', cellWidth: 16 },
        9: { halign: 'left', cellWidth: 24 },
        10: { halign: 'left', cellWidth: 28 },
        11: { halign: 'right', cellWidth: 20 },
        12: { halign: 'center', cellWidth: 21 }
      }
    });

    const today = new Date().toISOString().split('T')[0];
    doc.save(`Perla_Sample_Outwards_Report_${today}.pdf`);
  }
}
