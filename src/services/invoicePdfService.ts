import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Invoice, CompanyInvoiceSettings } from '../types/invoice';
import { formatCurrency, formatDate } from '../utils/formatters';
import { InvoiceSettingsService } from './invoiceSettingsService';

export class InvoicePdfService {
  /**
   * Generates a jsPDF document instance representing the exact official Tax Invoice
   * following the Perla Textiles Processor reference format, using live tax & issuer settings from Firebase.
   */
  static generateInvoicePdfDoc(invoice: Invoice, settings?: CompanyInvoiceSettings): jsPDF {
    const jsPdfConstructor: any = (jsPDF as any).default || jsPDF;
    const doc = new jsPdfConstructor({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const runAutoTable = (autoTable as any).default || autoTable;

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    const contentWidth = pageWidth - margin * 2;

    // Outer enclosing rectangle
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.35);

    // --- 1. Top Title Bar ---
    const startY = margin;
    const titleBarHeight = 7;
    doc.rect(margin, startY, contentWidth, titleBarHeight);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(0, 0, 0);
    doc.text('INVOICE', pageWidth / 2, startY + 5, { align: 'center' });

    // --- 2. Issuer Details (Left) & Invoice Metadata (Right) ---
    const headerBlockY = startY + titleBarHeight;
    const headerBlockHeight = 44;
    const leftColWidth = contentWidth * 0.58;
    const rightColWidth = contentWidth - leftColWidth;

    // Left Issuer Box
    doc.rect(margin, headerBlockY, leftColWidth, headerBlockHeight);

    const companyName = settings?.companyName || invoice.issuerSnapshot?.companyName || 'PERLA TEXTILES PROCESSOR';
    const addressLine1 = settings?.addressLine1 || invoice.issuerSnapshot?.addressLine1 || 'NO.107, INDUSTRIAL ESTATE';
    const addressLine2 = settings?.addressLine2 ?? invoice.issuerSnapshot?.addressLine2 ?? 'THIRUMUDIVAKKAM, SIDCO';
    const city = settings?.city || invoice.issuerSnapshot?.city || 'CHENNAI';
    const pincode = settings?.pincode || invoice.issuerSnapshot?.pincode || '600044';
    const tin = settings?.tin || invoice.issuerSnapshot?.tin || '33916280923';
    const cst = settings?.cst || invoice.issuerSnapshot?.cst || '1299271/02-01-2015';
    const gstin = settings?.gstin || invoice.issuerSnapshot?.gstin || '33AMMPK2032Q1ZU';
    const state = settings?.state || invoice.issuerSnapshot?.state || 'Tamil Nadu';
    const stateCode = settings?.stateCode || invoice.issuerSnapshot?.stateCode || '33';
    const pan = settings?.pan || invoice.issuerSnapshot?.pan || 'AMMPK2032Q';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text(companyName, margin + 2.5, headerBlockY + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(addressLine1, margin + 2.5, headerBlockY + 8.5);
    if (addressLine2) {
      doc.text(addressLine2, margin + 2.5, headerBlockY + 12.5);
    }
    doc.text(`${city}-${pincode}`, margin + 2.5, headerBlockY + 16.5);

    doc.setFont('helvetica', 'bold');
    doc.text(`TIN: ${tin}`, margin + 2.5, headerBlockY + 21);
    doc.text(`CST: ${cst}`, margin + 2.5, headerBlockY + 25.5);
    doc.text(`GST ID : ${gstin}`, margin + 2.5, headerBlockY + 30);

    doc.setFont('helvetica', 'normal');
    doc.text(`STATE- ${state}.  Code No-${stateCode}`, margin + 2.5, headerBlockY + 35);

    // Right Metadata Grid (2 rows x 2 cols)
    const rightBoxX = margin + leftColWidth;
    doc.rect(rightBoxX, headerBlockY, rightColWidth, headerBlockHeight);

    const midRowY = headerBlockY + headerBlockHeight / 2;
    const midColX = rightBoxX + rightColWidth / 2;

    // Horizontal split in right box
    doc.line(rightBoxX, midRowY, rightBoxX + rightColWidth, midRowY);
    // Vertical split in right box
    doc.line(midColX, headerBlockY, midColX, headerBlockY + headerBlockHeight);

    // Row 1, Col 1: Invoice No
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Invoice No.', rightBoxX + 2, headerBlockY + 4.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(invoice.invoiceNo || invoice.invoiceNumber || 'PTP/1182/2025-26', rightBoxX + 2, headerBlockY + 11);

    // Row 1, Col 2: Dated
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Dated', midColX + 2, headerBlockY + 4.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(formatDate(invoice.invoiceDate), midColX + 2, headerBlockY + 11);

    // Row 2, Col 1: W.O Number
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('W.O Number', rightBoxX + 2, midRowY + 4.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(invoice.poNumber || 'PP217', rightBoxX + 2, midRowY + 11);

    // Row 2, Col 2: Style
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Style', midColX + 2, midRowY + 4.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    const displayStyle = invoice.styleNo ? (invoice.styleNo.startsWith('#') ? invoice.styleNo : `#${invoice.styleNo}`) : '#082375221';
    doc.text(displayStyle, midColX + 2, midRowY + 11);

    // --- 3. Buyer Block & Mode/Terms of Payment ---
    const buyerBlockY = headerBlockY + headerBlockHeight;
    const buyerBlockHeight = 35;

    // Left Buyer Box
    doc.rect(margin, buyerBlockY, leftColWidth, buyerBlockHeight);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('BUYER', margin + 2.5, buyerBlockY + 4.5);

    doc.setFontSize(8);
    doc.text(
      (invoice.customerSnapshot?.companyName || 'SREE KUMAR TEXIND CORPORATION').toUpperCase(),
      margin + 2.5,
      buyerBlockY + 9
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    const custAddr = (invoice.customerSnapshot?.address || 'PLOT NO: 5, NUMBAL ROAD, VELAPPANCHAVADI').toUpperCase();
    const splitCustAddr = doc.splitTextToSize(custAddr, leftColWidth - 6);
    doc.text(splitCustAddr, margin + 2.5, buyerBlockY + 13.5);

    const addrLinesCount = splitCustAddr.length;
    const cityY = buyerBlockY + 13.5 + addrLinesCount * 3.5;
    doc.text(
      `${(invoice.customerSnapshot?.city || 'CHENNAI').toUpperCase()} - 600 077`,
      margin + 2.5,
      cityY
    );

    if (invoice.customerSnapshot?.phone) {
      doc.text(`PH-${invoice.customerSnapshot.phone}`, margin + 2.5, cityY + 3.8);
    }

    doc.setFont('helvetica', 'bold');
    doc.text(
      `GST ID : ${invoice.customerSnapshot?.gstin || '33AACFS4987J1ZS'}`,
      margin + 2.5,
      buyerBlockY + buyerBlockHeight - 6
    );

    doc.setFont('helvetica', 'normal');
    doc.text(
      `STATE- ${invoice.customerSnapshot?.state || 'Tamil Nadu'}.  Code No-${invoice.customerSnapshot?.stateCode || '33'}`,
      margin + 2.5,
      buyerBlockY + buyerBlockHeight - 2
    );

    // Right Terms of Payment Box
    doc.rect(rightBoxX, buyerBlockY, rightColWidth, buyerBlockHeight);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('Mode/Terms of Payment', rightBoxX + 2.5, buyerBlockY + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('Against Delivery / 30 Days', rightBoxX + 2.5, buyerBlockY + 11);

    // --- 4. Line Items Grid ---
    const tableStartY = buyerBlockY + buyerBlockHeight;

    let totalQuantity = 0;
    const tableRows = (invoice.lines || []).map((line, index) => {
      totalQuantity += Number(line.qty) || 0;
      const desc = (line.itemNameSnapshot || invoice.styleNo || 'MENS SHIRT').toUpperCase();
      const col = (line.colour || '').toUpperCase();
      const proc = (line.process || 'SOFTNER WASH').toUpperCase();
      const qtyStr = (Number(line.qty) || 0).toFixed(2);
      const ttlWgt = line.billableWeightKg ? Number(line.billableWeightKg).toFixed(2) : '';
      const rateStr = (Number(line.rate) || 0).toFixed(2);
      const amtStr = (Number(line.amount) || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });

      return [
        (index + 1).toString(),
        desc,
        line.hsnSac || '998821',
        col,
        proc,
        qtyStr,
        ttlWgt,
        rateStr,
        amtStr
      ];
    });

    // Append TOTAL row
    const totalQtyStr = totalQuantity.toFixed(2);
    const totalAmountStr = (Number(invoice.subtotal) || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    tableRows.push([
      '',
      'TOTAL',
      '',
      '',
      '',
      totalQtyStr,
      '',
      '',
      totalAmountStr
    ]);

    runAutoTable(doc, {
      startY: tableStartY,
      head: [
        [
          'S.No',
          'DESCRIPTION',
          'HSN/SAC',
          'COLOUR',
          'PROCESS',
          'QTY',
          'TTL WGT',
          'RATE',
          'AMOUNT'
        ]
      ],
      body: tableRows,
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
      theme: 'grid',
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontSize: 7,
        fontStyle: 'bold',
        halign: 'center',
        lineColor: [0, 0, 0],
        lineWidth: 0.35,
        cellPadding: 1.5
      },
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.35
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'left', cellWidth: 26 },
        2: { halign: 'center', cellWidth: 18 },
        3: { halign: 'left', cellWidth: 38 },
        4: { halign: 'center', cellWidth: 28 },
        5: { halign: 'right', cellWidth: 18 },
        6: { halign: 'right', cellWidth: 14 },
        7: { halign: 'right', cellWidth: 14 },
        8: { halign: 'right', cellWidth: 20 }
      },
      didParseCell: (data: any) => {
        // Format bottom TOTAL row
        if (data.row.index === tableRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          if (data.column.index === 1) {
            data.cell.styles.halign = 'right';
          }
        }
      }
    });

    // --- 5. Bottom Section: Bank Details + Words (Left) & Tax Summary + Signatory (Right) ---
    const finalTableY = (doc as any).lastAutoTable?.finalY || tableStartY + 50;
    const bottomBlockHeight = 55;

    // Left Bottom Box (Words & Bank Details & Declaration)
    doc.rect(margin, finalTableY, leftColWidth, bottomBlockHeight);

    // Chargeable Amount in Words
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('Total Amount Chargeable (in Words)', margin + 2.5, finalTableY + 4);

    doc.setFontSize(7);
    let wordsText = invoice.amountInWords || 'Fifty-Seven Thousand Five Hundred and Forty-Four';
    wordsText = wordsText.replace(/^Rupees\s*/i, '').replace(/\s*Only$/i, '');
    const fullWordsStr = `INR - ${wordsText.toUpperCase()} RUPEES ONLY.`;
    const splitWords = doc.splitTextToSize(fullWordsStr, leftColWidth - 5);
    doc.text(splitWords, margin + 2.5, finalTableY + 8);

    // Dividing line above bank details
    doc.line(margin, finalTableY + 14, margin + leftColWidth, finalTableY + 14);

    // Bank Details from Firebase settings or invoice snapshot
    const bankName = (settings?.bankName || invoice.bankDetailsSnapshot?.bankName || 'STATE BANK OF INDIA').toUpperCase();
    const accountNumber = settings?.accountNumber || invoice.bankDetailsSnapshot?.accountNumber || '30407742234';
    const ifscCode = settings?.ifscCode || invoice.bankDetailsSnapshot?.ifscCode || 'SBIN0012931';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(`BANK DETAILS: (${bankName})`, margin + 2.5, finalTableY + 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Bank Account Number', margin + 2.5, finalTableY + 22.5);
    doc.text(`: ${accountNumber}`, margin + 35, finalTableY + 22.5);

    doc.text('IFS Code', margin + 2.5, finalTableY + 26.5);
    doc.text(`: ${ifscCode}`, margin + 35, finalTableY + 26.5);

    doc.text("COMPANY'S PAN", margin + 2.5, finalTableY + 30.5);
    doc.text(`: ${pan}`, margin + 35, finalTableY + 30.5);

    // Dividing line above declaration
    doc.line(margin, finalTableY + 33.5, margin + leftColWidth, finalTableY + 33.5);

    // Declaration from Firebase settings or invoice snapshot
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('Declaration', margin + 2.5, finalTableY + 37.5);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    const declText =
      settings?.declaration ||
      invoice.declarationSnapshot ||
      'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.';
    const splitDecl = doc.splitTextToSize(declText, leftColWidth - 5);
    doc.text(splitDecl, margin + 2.5, finalTableY + 41.5);

    // Right Bottom Box (Tax Summary Table & Signatory)
    doc.rect(rightBoxX, finalTableY, rightColWidth, bottomBlockHeight);

    const isIntraState =
      (invoice.customerSnapshot?.stateCode === '33' ||
        (invoice.customerSnapshot?.state || '').toLowerCase().includes('tamil nadu')) &&
      (invoice.totalIgst === 0 || !invoice.totalIgst);

    const taxSummaryRows: any[] = [
      ['Total Amount without Tax', (Number(invoice.subtotal) || 0).toFixed(2)]
    ];

    if (isIntraState) {
      taxSummaryRows.push([`Add : CGST ${(invoice.cgstRate || 2.5).toFixed(2)}%`, (Number(invoice.totalCgst) || 0).toFixed(2)]);
      taxSummaryRows.push([`Add : SGST ${(invoice.sgstRate || 2.5).toFixed(2)}%`, (Number(invoice.totalSgst) || 0).toFixed(2)]);
    } else {
      taxSummaryRows.push([`Add : IGST ${(invoice.igstRate || 5.0).toFixed(2)}%`, (Number(invoice.totalIgst) || 0).toFixed(2)]);
    }

    const totalGst = (Number(invoice.totalCgst) || 0) + (Number(invoice.totalSgst) || 0) + (Number(invoice.totalIgst) || 0);
    taxSummaryRows.push(['Total Tax Amount : GST', totalGst.toFixed(2)]);
    taxSummaryRows.push(['Round Off', (Number(invoice.roundOff) || 0).toFixed(2)]);
    taxSummaryRows.push(['Total Amount with Tax', (Number(invoice.finalTotal) || 0).toFixed(2)]);
    taxSummaryRows.push(['GST Payable On Reverse Charge', 'N.A.']);

    runAutoTable(doc, {
      startY: finalTableY,
      margin: { left: rightBoxX, right: margin },
      tableWidth: rightColWidth,
      head: [['E. & O.E', '']],
      body: taxSummaryRows,
      theme: 'grid',
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontSize: 6.5,
        fontStyle: 'bold',
        halign: 'right',
        lineColor: [0, 0, 0],
        lineWidth: 0.35,
        cellPadding: 0.8
      },
      styles: {
        fontSize: 6.8,
        cellPadding: 0.8,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.35
      },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'normal', cellWidth: rightColWidth * 0.65 },
        1: { halign: 'right', fontStyle: 'normal', cellWidth: rightColWidth * 0.35 }
      },
      didParseCell: (data: any) => {
        // Highlight Total Amount with Tax
        if (data.row.index === taxSummaryRows.length - 2) {
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    // Signatory box below tax summary in right column
    const taxTableFinalY = (doc as any).lastAutoTable?.finalY || finalTableY + 30;
    const signBoxY = taxTableFinalY + 1;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text(
      `FOR ${companyName.toUpperCase()}`,
      rightBoxX + rightColWidth / 2,
      signBoxY + 3.5,
      { align: 'center' }
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(settings?.signatoryName || 'Authorised Signatory', rightBoxX + rightColWidth / 2, finalTableY + bottomBlockHeight - 2, {
      align: 'center'
    });

    return doc;
  }

  /**
   * Triggers a browser download of the generated PDF using live Firebase tax & issuer settings
   */
  static async downloadInvoicePdf(invoice: Invoice, settings?: CompanyInvoiceSettings): Promise<void> {
    const liveSettings = settings || (await InvoiceSettingsService.getSettings());
    const doc = this.generateInvoicePdfDoc(invoice, liveSettings);
    const cleanNo = (invoice.invoiceNo || invoice.invoiceNumber || 'Invoice').replace(/[/\\?%*:|"<>]/g, '_');
    doc.save(`${cleanNo}.pdf`);
  }

  /**
   * Opens the PDF in a new window/tab for printing using live Firebase tax & issuer settings
   */
  static async printInvoicePdf(invoice: Invoice, settings?: CompanyInvoiceSettings): Promise<void> {
    const liveSettings = settings || (await InvoiceSettingsService.getSettings());
    const doc = this.generateInvoicePdfDoc(invoice, liveSettings);
    const pdfBlob = doc.output('blob');
    const blobUrl = URL.createObjectURL(pdfBlob);
    const printWindow = window.open(blobUrl, '_blank');
    if (printWindow) {
      printWindow.focus();
    }
  }
}
