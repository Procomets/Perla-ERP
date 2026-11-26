import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SampleInvoice } from '../types/sampleInvoice';
import { CompanyInvoiceSettings } from '../types/invoice';
import { DEFAULT_INVOICE_SETTINGS } from './invoiceSettingsService';

function formatSlashDate(dateStr?: string): string {
  if (!dateStr || dateStr === '-') return '—';
  try {
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
  } catch {}
  return dateStr;
}

function formatNum2(val: number): string {
  return (Number(val) || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export class SampleInvoicePdfService {
  static generatePdfDoc(invoice: SampleInvoice, settings?: CompanyInvoiceSettings): jsPDF {
    const jsPdfConstructor: any = (jsPDF as any).default || jsPDF;
    const doc = new jsPdfConstructor({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const runAutoTable = (autoTable as any).default || autoTable;
    const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
    const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
    const margin = 8;
    const contentWidth = pageWidth - margin * 2; // 194mm

    // Core company details fetched from General Settings (Tax & Issuer Settings)
    const cfg = settings || DEFAULT_INVOICE_SETTINGS;
    const companyName = (cfg.companyName || DEFAULT_INVOICE_SETTINGS.companyName).toUpperCase();
    const addressLine = [cfg.addressLine1, cfg.addressLine2].filter(Boolean).join(', ');
    const cityPin = [cfg.city, cfg.pincode].filter(Boolean).join(' - ');
    const statePart = cfg.state ? `State: ${cfg.state}` : '';
    const codePart = cfg.stateCode ? `Code: ${cfg.stateCode}` : '';
    const cityStateLine = [cityPin, statePart, codePart].filter(Boolean).join(', ');
    const phoneText = cfg.dcPhone || cfg.phone || DEFAULT_INVOICE_SETTINGS.dcPhone || '';
    const emailText = cfg.email || DEFAULT_INVOICE_SETTINGS.email;
    const gstin = cfg.gstin || DEFAULT_INVOICE_SETTINGS.gstin;
    const bankName = cfg.bankName || DEFAULT_INVOICE_SETTINGS.bankName;
    const accountNo = cfg.accountNumber || DEFAULT_INVOICE_SETTINGS.accountNumber;
    const ifsc = cfg.ifscCode || DEFAULT_INVOICE_SETTINGS.ifscCode;
    const declarationText =
      cfg.declaration ||
      'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.';
    const signatoryLabel = cfg.signatoryDesignation || cfg.signatoryName || 'Authorised Signatory';

    let y = margin;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.32);

    // --- 1. Centered INVOICE Title & Company Header Box ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0);
    doc.text('INVOICE', pageWidth / 2, y + 4.5, { align: 'center' });

    y += 7;
    const headerHeight = 32;
    doc.rect(margin, y, contentWidth, headerHeight);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(companyName, pageWidth / 2, y + 6.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(addressLine || 'No.107, SIDCO Industrial Estate, Thirumudivakkam', pageWidth / 2, y + 11.8, {
      align: 'center'
    });
    doc.text(cityStateLine || 'Chennai - 600044, State: Tamil Nadu, Code: 33', pageWidth / 2, y + 16.3, {
      align: 'center'
    });
    doc.text(`Mobile: ${phoneText}`, pageWidth / 2, y + 20.8, { align: 'center' });
    doc.text(`Email: ${emailText}`, pageWidth / 2, y + 25.3, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`GSTIN No: ${gstin}`, pageWidth / 2, y + 29.8, { align: 'center' });

    y += headerHeight;

    // --- 2. Two-Column Customer & Invoice Metadata Box ---
    const metaHeight = 35;
    const leftW = contentWidth * 0.54;
    const rightW = contentWidth - leftW;

    doc.rect(margin, y, leftW, metaHeight);
    doc.rect(margin + leftW, y, rightW, metaHeight);

    // Left: MAIN CUSTOMER
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('MAIN CUSTOMER:', margin + 2.5, y + 5.5);
    doc.setFontSize(10.5);
    doc.text((invoice.vendorName || '—').toUpperCase(), margin + 2.5, y + 10.8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const addrLines = doc.splitTextToSize(invoice.vendorAddress || '', leftW - 6);
    let addrY = y + 15.8;
    addrLines.slice(0, 2).forEach((line: string) => {
      doc.text(line, margin + 2.5, addrY);
      addrY += 4.5;
    });
    doc.text(`Ph: ${invoice.vendorPhone || ''}`, margin + 2.5, y + 26.8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(`GSTIN. ${invoice.vendorGst || 'N/A'}`, margin + 2.5, y + 32.2);

    // Right: Invoice No, Invoice Date, HSN/SAC
    doc.line(margin + leftW, y + 11.5, margin + contentWidth, y + 11.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(`Invoice No : ${invoice.invoiceNo}`, margin + leftW + 2.5, y + 7.2);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date : ${formatSlashDate(invoice.invoiceDate)}`, margin + contentWidth - 2.5, y + 7.2, {
      align: 'right'
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(`HSN/SAC: ${invoice.hsnSacCode || cfg.defaultHsnSacCode || '998821'}`, margin + leftW + 2.5, y + 18.5);

    y += metaHeight + 2.5;

    // --- 3. Line Items Table (13 columns from template, larger font & spacing) ---
    const colWidths = [8, 18, 13, 17, 21, 24, 13, 9, 18, 13, 12, 13, 15]; // sum = 194mm

    const bodyRows = (invoice.items || []).map((it, idx) => [
      String(idx + 1),
      formatSlashDate(it.custDcDate),
      it.custDcNo || '—',
      it.styleNo || '—',
      it.itemName || '—',
      it.washType || '—',
      formatNum2(it.inwQty),
      it.unit || 'PCS',
      formatSlashDate(it.outDcDate),
      it.outDcNo || '—',
      formatNum2(it.qty),
      formatNum2(it.rate),
      formatNum2(it.amount)
    ]);

    runAutoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin, bottom: 12 },
      head: [
        [
          'SN',
          'Cust DC Date',
          'DC NO',
          'Style No',
          'ItemName',
          'Type of Wash',
          'Inw Qty',
          'Unit',
          'Out DC Date',
          'Out DC No',
          'Qty',
          'Rate',
          'Amount'
        ]
      ],
      body: bodyRows,
      theme: 'grid',
      styles: {
        lineColor: [0, 0, 0],
        lineWidth: 0.25,
        textColor: [0, 0, 0]
      },
      headStyles: {
        fillColor: [242, 244, 247],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 8.5,
        cellPadding: { top: 2.8, right: 1.4, bottom: 2.8, left: 1.4 },
        halign: 'center',
        valign: 'middle'
      },
      bodyStyles: {
        fontSize: 8.5,
        cellPadding: { top: 3.0, right: 1.4, bottom: 3.0, left: 1.4 },
        valign: 'middle'
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: colWidths[0] },
        1: { halign: 'left', cellWidth: colWidths[1] },
        2: { halign: 'left', cellWidth: colWidths[2] },
        3: { halign: 'left', cellWidth: colWidths[3] },
        4: { halign: 'left', cellWidth: colWidths[4] },
        5: { halign: 'left', cellWidth: colWidths[5] },
        6: { halign: 'right', cellWidth: colWidths[6] },
        7: { halign: 'center', cellWidth: colWidths[7] },
        8: { halign: 'left', cellWidth: colWidths[8] },
        9: { halign: 'left', cellWidth: colWidths[9] },
        10: { halign: 'right', cellWidth: colWidths[10] },
        11: { halign: 'right', cellWidth: colWidths[11] },
        12: { halign: 'right', cellWidth: colWidths[12] }
      }
    });

    const tableEndY = (doc as any).lastAutoTable.finalY || y + 40;

    // --- 4. Stretch Table to Cover Full A4 Page & Anchor Bottom Summary ---
    const bottomBoxHeight = 56;
    const signatureHeight = 24;
    const footHeight = 9;
    const targetBottomStartY = pageHeight - margin - bottomBoxHeight - signatureHeight; // 209mm

    let footTopY = tableEndY;
    if (tableEndY + footHeight <= targetBottomStartY) {
      // Extend vertical column lines down to Total row so invoice fills the entire A4 page
      const fillerHeight = targetBottomStartY - footHeight - tableEndY;
      if (fillerHeight > 0.5) {
        doc.setLineWidth(0.25);
        doc.rect(margin, tableEndY, contentWidth, fillerHeight);
        let cx = margin;
        for (let i = 0; i < colWidths.length - 1; i++) {
          cx += colWidths[i];
          doc.line(cx, tableEndY, cx, tableEndY + fillerHeight);
        }
      }
      footTopY = targetBottomStartY - footHeight;
    } else if (tableEndY + footHeight + bottomBoxHeight + signatureHeight > pageHeight - margin) {
      doc.addPage();
      footTopY = margin;
    }

    // Draw Total Row
    doc.setLineWidth(0.25);
    doc.rect(margin, footTopY, contentWidth, footHeight);
    // Vertical dividers in Total row matching col 6 (Inw Qty) and col 10 (Qty)
    const xCol6Start = margin + colWidths.slice(0, 6).reduce((a, b) => a + b, 0);
    const xCol6End = xCol6Start + colWidths[6];
    const xCol10Start = margin + colWidths.slice(0, 10).reduce((a, b) => a + b, 0);
    const xCol10End = xCol10Start + colWidths[10];
    doc.line(xCol6Start, footTopY, xCol6Start, footTopY + footHeight);
    doc.line(xCol6End, footTopY, xCol6End, footTopY + footHeight);
    doc.line(xCol10Start, footTopY, xCol10Start, footTopY + footHeight);
    doc.line(xCol10End, footTopY, xCol10End, footTopY + footHeight);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('Total:', xCol6Start - 2, footTopY + 6.2, { align: 'right' });
    doc.text(formatNum2(invoice.totalInwQty), xCol6End - 1.5, footTopY + 6.2, { align: 'right' });
    doc.text('Total:', xCol10Start - 2, footTopY + 6.2, { align: 'right' });
    doc.text(formatNum2(invoice.totalOutQty), xCol10End - 1.5, footTopY + 6.2, { align: 'right' });

    y = footTopY + footHeight;

    // --- 5. Bottom Summary Section (Bank Details + Words + Tax Totals) ---
    const sumLeftW = contentWidth * 0.60;
    const sumRightW = contentWidth - sumLeftW;

    doc.setLineWidth(0.32);
    doc.rect(margin, y, sumLeftW, bottomBoxHeight);
    doc.rect(margin + sumLeftW, y, sumRightW, bottomBoxHeight);

    // Left: Bank Details, Amount in words, Declaration
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('Bank Details:', margin + 2.5, y + 5.5);
    doc.text(`Bank Name: ${bankName}`, margin + 2.5, y + 10.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Account No: ${accountNo}`, margin + 2.5, y + 15.2);
    doc.text(`IFSC Code: ${ifsc}`, margin + 2.5, y + 19.9);

    doc.line(margin, y + 22.5, margin + sumLeftW, y + 22.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    const wordsText = `Amount Chargeable (in words) : ${invoice.amountInWords || ''}`;
    const wrappedWords = doc.splitTextToSize(wordsText, sumLeftW - 5);
    let wy = y + 27.5;
    wrappedWords.slice(0, 2).forEach((line: string) => {
      doc.text(line, margin + 2.5, wy);
      wy += 4.8;
    });

    doc.line(margin, y + 37.5, margin + sumLeftW, y + 37.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Declaration:', margin + 2.5, y + 42.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const declLines = doc.splitTextToSize(declarationText, sumLeftW - 5);
    let dy = y + 47.2;
    declLines.slice(0, 2).forEach((line: string) => {
      doc.text(line, margin + 2.5, dy);
      dy += 4.3;
    });

    // Right: Totals Breakdown
    const rxLabel = margin + sumLeftW + 2.5;
    const rxColon = margin + sumLeftW + 38;
    const rxVal = margin + contentWidth - 2.5;

    let ry = y + 6.5;
    doc.setFontSize(9.5);
    const drawSummaryRow = (label: string, valStr: string, bold = false) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.text(label, rxLabel, ry);
      doc.text(':', rxColon, ry);
      doc.text(valStr, rxVal, ry, { align: 'right' });
      ry += 6.8;
    };

    drawSummaryRow('TOTAL', formatNum2(invoice.subtotal), true);
    drawSummaryRow('Discount', formatNum2(invoice.discount));

    if (invoice.gstMode === 'cgst_sgst') {
      drawSummaryRow(`CGST ${invoice.cgstRate.toFixed(2)}%`, formatNum2(invoice.cgstAmount));
      drawSummaryRow(`SGST ${invoice.sgstRate.toFixed(2)}%`, formatNum2(invoice.sgstAmount));
    } else if (invoice.gstMode === 'igst') {
      drawSummaryRow(`IGST ${invoice.igstRate.toFixed(2)}%`, formatNum2(invoice.igstAmount));
    } else {
      drawSummaryRow('GST (Exempt)', '0.00');
    }

    drawSummaryRow('Forwarding', formatNum2(invoice.forwarding));

    doc.line(margin + sumLeftW, y + 45.5, margin + contentWidth, y + 45.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Total Amt:', rxLabel, y + 52);
    doc.text(formatNum2(invoice.totalAmount), rxVal, y + 52, { align: 'right' });

    // Signature Block
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(`FOR ${companyName}`, margin + contentWidth - 2, y + bottomBoxHeight + 6.5, {
      align: 'right'
    });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(signatoryLabel, margin + contentWidth - 8, y + bottomBoxHeight + 21, { align: 'right' });

    return doc;
  }

  static downloadPdf(invoice: SampleInvoice, settings?: CompanyInvoiceSettings): void {
    const doc = this.generatePdfDoc(invoice, settings);
    const safeNo = (invoice.invoiceNo || 'Sample_Invoice').replace(/[/\\]/g, '_');
    doc.save(`Sample_Invoice_${safeNo}.pdf`);
  }
}
