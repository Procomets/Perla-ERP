import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from '../utils/formatters';

export interface StatementReportPdfItem {
  companyName: string;
  poNumber: string;
  styleNo: string;
  itemName: string;
  lines: {
    colourName: string;
    process: string;
    unit: string;
    orderQty: number;
    receivedQty: number;
    dispatchQty: number;
    dispatchBalance: number;
    receiveBalance: number;
    isAllThreeEqual: boolean;
  }[];
  totalOrderQty: number;
  totalReceivedQty: number;
  totalDispatchQty: number;
  totalDispatchBalance: number;
  totalReceiveBalance: number;
  isAllThreeEqual: boolean;
}

export interface StatementReportPdfParams {
  items: StatementReportPdfItem[];
  customerName?: string;
  styleNo?: string;
  poNumber?: string;
  statusFilter?: string;
  startDate?: string;
  endDate?: string;
}

export class StatementReportPdfService {
  static downloadStatementReportPdf(params: StatementReportPdfParams): void {
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

    // 1. Company Letterhead Header
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
    doc.text('STATEMENT RECONCILIATION & ORDER AUDIT REPORT (WITH COLOURS)', pageWidth / 2, currentY + 14, { align: 'center' });

    currentY += 18;

    // 2. Filter Information Box
    doc.setFontSize(8);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, currentY, pageWidth - margin * 2, 12, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('Customer:', margin + 4, currentY + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(params.customerName || 'All Customers', margin + 22, currentY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('Filter Scope:', margin + 95, currentY + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    const scopeParts: string[] = [];
    if (params.styleNo && params.styleNo !== 'all') scopeParts.push(`Style: ${params.styleNo}`);
    if (params.poNumber && params.poNumber !== 'all') scopeParts.push(`PO: ${params.poNumber}`);
    if (params.statusFilter && params.statusFilter !== 'all') scopeParts.push(`Status: ${params.statusFilter}`);
    doc.text(scopeParts.length > 0 ? scopeParts.join(' | ') : 'All Styles & Purchase Orders', margin + 116, currentY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('Generated On:', pageWidth - margin - 48, currentY + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(formatDate(new Date().toISOString()), pageWidth - margin - 24, currentY + 4.5);

    // Filter box second line: Date range & counts
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('Date Range:', margin + 4, currentY + 9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    const dateRangeStr =
      params.startDate || params.endDate
        ? `${params.startDate ? formatDate(params.startDate) : 'Start'} to ${
            params.endDate ? formatDate(params.endDate) : 'Present'
          }`
        : 'All Available Dates';
    doc.text(dateRangeStr, margin + 24, currentY + 9);

    const totalOrders = params.items.length;
    const totalLines = params.items.reduce((sum, it) => sum + it.lines.length, 0);
    const grandOrderQty = params.items.reduce((sum, it) => sum + it.totalOrderQty, 0);
    const grandInwardQty = params.items.reduce((sum, it) => sum + it.totalReceivedQty, 0);
    const grandDispatchQty = params.items.reduce((sum, it) => sum + it.totalDispatchQty, 0);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('Summary:', margin + 95, currentY + 9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(
      `Total Orders: ${totalOrders} | Colour Lines: ${totalLines} | Ordered: ${grandOrderQty} | Inward: ${grandInwardQty} | Dispatched: ${grandDispatchQty}`,
      margin + 112,
      currentY + 9
    );

    currentY += 15;

    // 3. Prepare Table Rows (Hierarchical PO with Subrows for Colours)
    const tableBody: any[] = [];

    params.items.forEach((item, itemIdx) => {
      // Parent PO Summary Row
      const poEqualNote = item.isAllThreeEqual
        ? ` (Reconciled: ${item.totalOrderQty} / ${item.totalReceivedQty} / ${item.totalDispatchQty})`
        : '';

      tableBody.push([
        {
          content: `${itemIdx + 1}. ${item.companyName}`,
          styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [15, 23, 42] }
        },
        {
          content: `PO: ${item.poNumber}\nStyle: ${item.styleNo}`,
          styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [15, 23, 42] }
        },
        {
          content: `${item.lines.length} Colours${poEqualNote}`,
          styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [31, 78, 121] }
        },
        {
          content: `${item.totalOrderQty}`,
          styles: { fontStyle: 'bold', fillColor: [241, 245, 249], halign: 'right', textColor: [15, 23, 42] }
        },
        {
          content: `${item.totalReceivedQty}`,
          styles: { fontStyle: 'bold', fillColor: [241, 245, 249], halign: 'right', textColor: [15, 23, 42] }
        },
        {
          content: `${item.totalDispatchQty}`,
          styles: { fontStyle: 'bold', fillColor: [241, 245, 249], halign: 'right', textColor: [15, 23, 42] }
        },
        {
          content: `${item.totalDispatchBalance}`,
          styles: {
            fontStyle: 'bold',
            fillColor: [241, 245, 249],
            halign: 'right',
            textColor: item.totalDispatchBalance === 0 ? [22, 101, 52] : [180, 83, 9]
          }
        },
        {
          content: `${item.totalReceiveBalance}`,
          styles: {
            fontStyle: 'bold',
            fillColor: [241, 245, 249],
            halign: 'right',
            textColor: item.totalReceiveBalance === 0 ? [22, 101, 52] : [194, 65, 12]
          }
        },
        {
          content: item.isAllThreeEqual ? 'Reconciled' : 'In Progress',
          styles: {
            fontStyle: 'bold',
            fillColor: [241, 245, 249],
            halign: 'center',
            textColor: item.isAllThreeEqual ? [22, 101, 52] : [71, 85, 105]
          }
        }
      ]);

      // Subrows: Each Colour Line under this PO
      item.lines.forEach((line) => {
        const lineEqualNote = line.isAllThreeEqual
          ? `Equal (${line.orderQty} / ${line.receivedQty} / ${line.dispatchQty})`
          : line.dispatchBalance === 0 && line.receiveBalance === 0
          ? 'Completed'
          : line.dispatchBalance > 0
          ? `Pending Dispatch (${line.dispatchBalance})`
          : 'Pending Inward';

        tableBody.push([
          { content: '', styles: { fillColor: [255, 255, 255] } }, // Indented Company
          { content: `— ${line.process}`, styles: { textColor: [100, 116, 139], fontSize: 7.5 } },
          { content: `• ${line.colourName} (${line.unit})`, styles: { fontStyle: 'bold', textColor: [30, 41, 59] } },
          { content: `${line.orderQty}`, styles: { halign: 'right' } },
          { content: `${line.receivedQty}`, styles: { halign: 'right', textColor: [31, 78, 121], fontStyle: 'bold' } },
          { content: `${line.dispatchQty}`, styles: { halign: 'right', textColor: [5, 150, 105], fontStyle: 'bold' } },
          {
            content: `${line.dispatchBalance}`,
            styles: {
              halign: 'right',
              fontStyle: 'bold',
              textColor: line.dispatchBalance === 0 ? [22, 101, 52] : [180, 83, 9]
            }
          },
          {
            content: `${line.receiveBalance}`,
            styles: {
              halign: 'right',
              fontStyle: 'bold',
              textColor: line.receiveBalance === 0 ? [22, 101, 52] : [194, 65, 12]
            }
          },
          {
            content: lineEqualNote,
            styles: {
              halign: 'center',
              fontSize: 7.5,
              textColor: line.isAllThreeEqual ? [22, 101, 52] : [100, 116, 139]
            }
          }
        ]);
      });
    });

    // Grand Totals Summary Row
    const grandDispatchBal = grandInwardQty - grandDispatchQty;
    const grandReceiveBal = grandOrderQty - grandInwardQty;

    tableBody.push([
      { content: 'GRAND TOTALS', colSpan: 3, styles: { fontStyle: 'bold', fillColor: [31, 78, 121], textColor: [255, 255, 255], halign: 'center' } },
      { content: `${grandOrderQty}`, styles: { fontStyle: 'bold', fillColor: [31, 78, 121], textColor: [255, 255, 255], halign: 'right' } },
      { content: `${grandInwardQty}`, styles: { fontStyle: 'bold', fillColor: [31, 78, 121], textColor: [255, 255, 255], halign: 'right' } },
      { content: `${grandDispatchQty}`, styles: { fontStyle: 'bold', fillColor: [31, 78, 121], textColor: [255, 255, 255], halign: 'right' } },
      { content: `${grandDispatchBal}`, styles: { fontStyle: 'bold', fillColor: [31, 78, 121], textColor: [255, 255, 255], halign: 'right' } },
      { content: `${grandReceiveBal}`, styles: { fontStyle: 'bold', fillColor: [31, 78, 121], textColor: [255, 255, 255], halign: 'right' } },
      { content: grandDispatchBal === 0 && grandReceiveBal === 0 ? 'Fully Reconciled' : 'Open Balance', styles: { fontStyle: 'bold', fillColor: [31, 78, 121], textColor: [255, 255, 255], halign: 'center' } }
    ]);

    runAutoTable(doc, {
      startY: currentY,
      head: [
        [
          'Company Name',
          'Style No / PO No',
          'Colours (Lines)',
          'Order Qty',
          'Received Qty (Inward)',
          'Dispatch Qty',
          'Dispatch Balance',
          'Receive Balance',
          'Status'
        ]
      ],
      body: tableBody,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 1.8,
        lineColor: [226, 232, 240],
        lineWidth: 0.15
      },
      headStyles: {
        fillColor: [31, 78, 121],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: 42 },
        1: { cellWidth: 38 },
        2: { cellWidth: 45 },
        3: { cellWidth: 20, halign: 'right' },
        4: { cellWidth: 24, halign: 'right' },
        5: { cellWidth: 22, halign: 'right' },
        6: { cellWidth: 26, halign: 'right' },
        7: { cellWidth: 26, halign: 'right' },
        8: { cellWidth: 34, halign: 'center' }
      },
      margin: { left: margin, right: margin, bottom: margin },
      didDrawPage: (data: any) => {
        // Footer: Page Number & Audit notice
        const str = `Page ${doc.getNumberOfPages()}  •  Perla ERP Statement Audit  •  Confidential`;
        doc.setFontSize(7.5);
        doc.setTextColor(150, 150, 150);
        doc.text(str, pageWidth / 2, doc.internal.pageSize.getHeight() - 5, { align: 'center' });
      }
    });

    const safeName = (params.customerName || 'Statement_Report').replace(/[^a-zA-Z0-9]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    doc.save(`Perla_Statement_Report_${safeName}_${dateStr}.pdf`);
  }
}
