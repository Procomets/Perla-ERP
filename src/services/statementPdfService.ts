import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { StatementInwardRow, StatementOutwardRow } from '../types/statement';
import { formatDate } from '../utils/formatters';

export interface StatementPdfParams {
  companyName: string;
  statementDate?: string;
  styleNo?: string;
  poNumber?: string;
  itemName?: string;
  inwards: StatementInwardRow[];
  outwards: StatementOutwardRow[];
  selectedColours?: string[];
}

export class StatementPdfService {
  /**
   * Generates a jsPDF document for the Statement Reconciliation Ledger
   * matching the delivery statement format with side-by-side inward & outward,
   * outward grouped by colour with subtotals for each colour, and grand totals.
   */
  static generateStatementPdfDoc(params: StatementPdfParams): jsPDF {
    const jsPdfConstructor: any = (jsPDF as any).default || jsPDF;
    const doc = new jsPdfConstructor({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const runAutoTable = (autoTable as any).default || autoTable;

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 12;
    const contentWidth = pageWidth - margin * 2; // ~186mm

    // Outer framing / header
    let currentY = margin;

    // --- 1. Company Header ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('PERLA TEXTILES PROCESSOR', pageWidth / 2, currentY + 4, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(70, 70, 70);
    doc.text(
      'NO. 107, Industrial Estate, Thirumudivakkam, SIDCO, Chennai - 600 044.',
      pageWidth / 2,
      currentY + 9,
      { align: 'center' }
    );

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text('DELIVERY RECONCILIATION STATEMENT', pageWidth / 2, currentY + 15, { align: 'center' });

    currentY += 19;

    // --- 2. Customer & Date Info Bar ---
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.rect(margin, currentY, contentWidth, 14);

    // Left info
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(params.companyName.toUpperCase(), margin + 3, currentY + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const subInfoParts: string[] = [];
    if (params.styleNo && params.styleNo !== 'all') {
      subInfoParts.push(`STYLE NO: ${params.styleNo}`);
    }
    if (params.poNumber && params.poNumber !== 'all') {
      subInfoParts.push(`PO NO: ${params.poNumber}`);
    }
    if (params.itemName && params.itemName !== 'all') {
      subInfoParts.push(`ITEM: ${params.itemName}`);
    }
    if (params.selectedColours && params.selectedColours.length > 0) {
      subInfoParts.push(`COLOUR(S): ${params.selectedColours.join(', ')}`);
    }

    if (subInfoParts.length > 0) {
      doc.text(subInfoParts.join('  •  '), margin + 3, currentY + 10.5);
    } else {
      doc.text('All Styles & Purchase Orders Reconciliation', margin + 3, currentY + 10.5);
    }

    // Right info (Date)
    const todayFormatted = params.statementDate
      ? (formatDate(params.statementDate) !== '-' ? formatDate(params.statementDate) : params.statementDate)
      : formatDate(new Date().toISOString());
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(`DATE: ${todayFormatted}`, margin + contentWidth - 3, currentY + 5.5, { align: 'right' });

    currentY += 16;

    // --- 3. Prepare Inward & Outward Data ---
    // Filter out 0 qty entries
    let validInwards = params.inwards.filter((r) => (Number(r.qtyReceived) || 0) > 0);
    let validOutwards = params.outwards.filter((r) => (Number(r.qtyDispatched) || 0) > 0);

    // Filter by selected colours if specified
    if (params.selectedColours && params.selectedColours.length > 0) {
      const allowed = new Set(params.selectedColours.map((c) => c.trim().toLowerCase()));
      validInwards = validInwards.filter((r) => allowed.has((r.colour || '').trim().toLowerCase()));
      validOutwards = validOutwards.filter((r) => allowed.has((r.colour || '').trim().toLowerCase()));
    }

    // Collect unique colours across both Inward and Outward
    const orderedColours: string[] = [];
    const seenColours = new Set<string>();

    validInwards.forEach((r) => {
      const col = (r.colour || 'Standard').toUpperCase();
      if (!seenColours.has(col)) {
        seenColours.add(col);
        orderedColours.push(col);
      }
    });

    validOutwards.forEach((r) => {
      const col = (r.colour || 'Standard').toUpperCase();
      if (!seenColours.has(col)) {
        seenColours.add(col);
        orderedColours.push(col);
      }
    });

    const inwardGroups = new Map<string, StatementInwardRow[]>();
    validInwards.forEach((inw) => {
      const col = (inw.colour || 'Standard').toUpperCase();
      if (!inwardGroups.has(col)) inwardGroups.set(col, []);
      inwardGroups.get(col)!.push(inw);
    });

    const outwardGroups = new Map<string, StatementOutwardRow[]>();
    validOutwards.forEach((out) => {
      const col = (out.colour || 'Standard').toUpperCase();
      if (!outwardGroups.has(col)) outwardGroups.set(col, []);
      outwardGroups.get(col)!.push(out);
    });

    const tableBody: any[] = [];
    const subtotalRowIndices = new Set<number>();
    let grandTotalInward = 0;
    let grandTotalOutward = 0;
    let sNoCounter = 1;

    orderedColours.forEach((colName) => {
      const inwList = inwardGroups.get(colName) || [];
      const outList = outwardGroups.get(colName) || [];
      const count = Math.max(inwList.length, outList.length);

      let groupInwardTotal = 0;
      let groupOutwardTotal = 0;

      for (let i = 0; i < count; i++) {
        const inw = inwList[i];
        const out = outList[i];

        if (inw) {
          const qty = Number(inw.qtyReceived) || 0;
          groupInwardTotal += qty;
          grandTotalInward += qty;
        }

        if (out) {
          const qty = Number(out.qtyDispatched) || 0;
          groupOutwardTotal += qty;
          grandTotalOutward += qty;
        }

        const displayDc = out?.dcNo ? out.dcNo.replace(/^DC-PERLA-/i, '') : '';

        tableBody.push([
          // Inward (6 columns)
          inw ? String(sNoCounter++) : '',
          inw ? formatDate(inw.date) : '',
          inw ? inw.dcNo || inw.inwardNo : '',
          inw ? inw.styleNo || params.styleNo || '' : '',
          inw ? inw.colour : '',
          inw ? (Number(inw.qtyReceived) || 0).toLocaleString('en-IN') : '',

          // Outward (4 columns)
          out ? formatDate(out.date) : '',
          out ? out.colour : '',
          out ? displayDc || out.dcNo : '',
          out ? (Number(out.qtyDispatched) || 0).toLocaleString('en-IN') : ''
        ]);
      }

      // Aligned subtotal row for this colour across BOTH Inward and Outward
      subtotalRowIndices.add(tableBody.length);
      tableBody.push([
        // Inward Subtotal
        '',
        '',
        '',
        '',
        `${colName} TOTAL`,
        groupInwardTotal.toLocaleString('en-IN'),

        // Outward Subtotal
        '',
        `${colName} TOTAL`,
        '',
        groupOutwardTotal.toLocaleString('en-IN')
      ]);
    });

    // Append Final Grand Total Row
    const grandTotalRowIndex = tableBody.length;
    tableBody.push([
      '',
      '',
      '',
      'TOTAL',
      '',
      grandTotalInward.toLocaleString('en-IN'),
      '',
      'TOTAL',
      '',
      grandTotalOutward.toLocaleString('en-IN')
    ]);

    // --- 5. Render AutoTable ---
    runAutoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin, bottom: 15 },
      head: [
        [
          { content: 'INWARD (RECEIPTS FROM CUSTOMER)', colSpan: 6, styles: { halign: 'center', fillColor: [240, 245, 240], textColor: [0, 80, 40] } },
          { content: 'OUTWARD (DISPATCHES TO CUSTOMER)', colSpan: 4, styles: { halign: 'center', fillColor: [240, 245, 255], textColor: [15, 60, 110] } }
        ],
        [
          'S.No',
          'Date',
          'DC.No',
          'Style No',
          'Colour',
          'QTY',
          'OW.Date',
          'COLOUR',
          'OW.Dc',
          'Qty'
        ]
      ],
      body: tableBody,
      theme: 'grid',
      styles: {
        fontSize: 8,
        font: 'helvetica',
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.25,
        cellPadding: 2,
        valign: 'middle'
      },
      headStyles: {
        fillColor: [245, 245, 245],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 8,
        lineColor: [0, 0, 0],
        lineWidth: 0.3,
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: 9, halign: 'center' },      // S.No
        1: { cellWidth: 19, halign: 'center' },     // Inward Date
        2: { cellWidth: 17, halign: 'center' },     // DC No
        3: { cellWidth: 22, halign: 'center' },     // Style No
        4: { cellWidth: 23, halign: 'center' },     // Inward Colour
        5: { cellWidth: 16, halign: 'right' },      // Inward QTY
        6: { cellWidth: 19, halign: 'center' },     // OW Date
        7: { cellWidth: 26, halign: 'center' },     // OW Colour
        8: { cellWidth: 18, halign: 'center' },     // OW DC
        9: { cellWidth: 17, halign: 'right' }       // OW Qty
      },
      didParseCell: (data: any) => {
        const rowIdx = data.row.index;
        const colIdx = data.column.index;

        // Separating border between Inward and Outward (column index 5 is Inward QTY)
        if (colIdx === 5) {
          data.cell.styles.lineWidth = {
            top: 0.25,
            bottom: 0.25,
            left: 0.25,
            right: 0.6 // Thicker line separating inward from outward
          };
        }

        // Subtotal rows for colour breakdown (applied across both Inward and Outward)
        if (subtotalRowIndices.has(rowIdx)) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [242, 244, 248];
          if (colIdx === 4 || colIdx === 5 || colIdx === 7 || colIdx === 9) {
            data.cell.styles.textColor = [0, 0, 0];
            data.cell.styles.fontSize = 8.5;
          }
        }

        // Grand Total row styling
        if (rowIdx === grandTotalRowIndex) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [230, 230, 230];
          data.cell.styles.fontSize = 9;
          data.cell.styles.lineWidth = {
            top: 0.5,
            bottom: 0.5,
            left: 0.25,
            right: 0.25
          };
          if (colIdx === 3 || colIdx === 5 || colIdx === 9) {
            data.cell.styles.textColor = [0, 0, 0];
          }
        }
      }
    });

    return doc;
  }

  /**
   * Generates and downloads the Statement Reconciliation PDF file
   */
  static downloadStatementPdf(params: StatementPdfParams): void {
    const doc = this.generateStatementPdfDoc(params);
    const safeCompany = (params.companyName || 'Statement').replace(/[^a-zA-Z0-9]/g, '_');
    const safeDate = params.statementDate
      ? params.statementDate.replace(/[^a-zA-Z0-9]/g, '_')
      : new Date().toISOString().split('T')[0];
    const safeStyle = params.styleNo && params.styleNo !== 'all' ? `_${params.styleNo.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
    doc.save(`Statement_${safeCompany}${safeStyle}_${safeDate}.pdf`);
  }

  /**
   * Opens the PDF in a new browser tab for preview or direct printing
   */
  static openStatementPdf(params: StatementPdfParams): void {
    const doc = this.generateStatementPdfDoc(params);
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }
}

