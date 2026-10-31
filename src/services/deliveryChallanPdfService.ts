import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { collection, doc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { OutwardEntry, OutwardLine } from '../types/outward';
import { InwardEntry, InwardLine } from '../types/inward';
import { Vendor, VendorAddress } from '../types/vendor';
import { formatDate } from '../utils/formatters';
import { InvoiceSettingsService, DEFAULT_INVOICE_SETTINGS } from './invoiceSettingsService';

export interface DeliveryChallanData {
  dcNumber: string;
  dcDate: string;
  partyDcNumber: string;
  partyDcDate: string;
  customerName: string;
  customerAddress?: string;
  destination?: string;
  vehicleNumber?: string;
  driverName?: string;
  timeOut?: string;
  poNumber?: string;
  styleNo?: string;
  companyGstin?: string;
  companyPhone?: string;
  items: Array<{
    sNo: number;
    description: string;
    quantity: string;
  }>;
  totalQuantityStr: string;
}

export class DeliveryChallanPdfService {
  /**
   * Automatically computes the summary total quantity string (pieces and kg) from line items
   */
  static calculateTotalQuantity(items: Array<{ quantity?: string }>): string {
    if (!items || items.length === 0) return '';
    let totalPieces = 0;
    let totalKg = 0;
    let hasPieces = false;
    let hasKg = false;

    for (const item of items) {
      if (!item.quantity) continue;
      const raw = item.quantity.trim().toLowerCase();
      const isKg = raw.includes('kg');
      const match = raw.replace(/,/g, '').match(/([0-9]+(?:\.[0-9]+)?)/);
      if (match) {
        const val = parseFloat(match[1]);
        if (!isNaN(val)) {
          if (isKg) {
            totalKg += val;
            hasKg = true;
          } else {
            totalPieces += val;
            hasPieces = true;
          }
        }
      }
    }

    const parts: string[] = [];
    if (hasPieces) {
      const formattedPieces = Number.isInteger(totalPieces)
        ? totalPieces.toLocaleString()
        : totalPieces.toLocaleString(undefined, { maximumFractionDigits: 2 });
      parts.push(`${formattedPieces} ps`);
    }
    if (hasKg) {
      const formattedKg = Number.isInteger(totalKg)
        ? totalKg.toLocaleString()
        : totalKg.toLocaleString(undefined, { maximumFractionDigits: 2 });
      parts.push(`${formattedKg} kg`);
    }

    return parts.join(' / ');
  }

  /**
   * Helper to retrieve candidate inward entries from props or localStorage cache
   */
  static getCandidateInwards(inwards?: InwardEntry[]): InwardEntry[] {
    if (inwards && inwards.length > 0) return inwards;
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem('perla_erp_inward_entries');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {
        // ignore
      }
    }
    return [];
  }

  /**
   * Finds the best matching inward entry from a candidate list
   */
  static findMatchingInward(outward: OutwardEntry, inwardList: InwardEntry[]): InwardEntry | undefined {
    if (!inwardList || inwardList.length === 0) return undefined;

    // 1. Direct match by inwardId if recorded on outward
    const directInwardId = (outward as any).inwardId;
    if (directInwardId) {
      const byId = inwardList.find(
        (i) => (i.inwardId === directInwardId || i.id === directInwardId) && Boolean(i.customerDcNo)
      );
      if (byId) return byId;
    }

    // 2. Direct match by poId
    if (outward.poId) {
      const byPoId = inwardList.find((i) => i.poId === outward.poId && Boolean(i.customerDcNo));
      if (byPoId) return byPoId;
    }

    // 3. Match by PO Number snapshot or poNumber
    const poNum = outward.poNumberSnapshot || (outward as any).poNumber;
    if (poNum) {
      const byPoNum = inwardList.find(
        (i) =>
          ((i.poNumberSnapshot && i.poNumberSnapshot === poNum) ||
            ((i as any).poNumber && (i as any).poNumber === poNum)) &&
          Boolean(i.customerDcNo)
      );
      if (byPoNum) return byPoNum;
    }

    // 4. Match by customerVendorId & style
    if (outward.customerVendorId) {
      if (outward.styleNoSnapshot) {
        const byCustomerAndStyle = inwardList.find(
          (i) =>
            i.customerVendorId === outward.customerVendorId &&
            (i.styleNoSnapshot === outward.styleNoSnapshot || (i as any).styleNo === outward.styleNoSnapshot) &&
            Boolean(i.customerDcNo)
        );
        if (byCustomerAndStyle) return byCustomerAndStyle;
      }

      const byCustomer = inwardList.find(
        (i) => i.customerVendorId === outward.customerVendorId && Boolean(i.customerDcNo)
      );
      if (byCustomer) return byCustomer;
    }

    // 5. Match by customer company name snapshot
    const custName = (
      outward.customerCompanyNameSnapshot ||
      (outward as any).customerName ||
      ''
    ).trim().toLowerCase();
    if (custName) {
      const byName = inwardList.find(
        (i) =>
          (i.customerCompanyNameSnapshot || (i as any).customerName || '').trim().toLowerCase() === custName &&
          Boolean(i.customerDcNo)
      );
      if (byName) return byName;
    }

    return undefined;
  }

  /**
   * Resolves the Party DC No. and Date from direct fields or matching Inward Entry
   */
  static resolvePartyDcInfo(
    outward: OutwardEntry,
    inwards?: InwardEntry[]
  ): { partyDcNumber: string; partyDcDate: string } {
    // 1. Direct fields on outward if available
    const directDc = (outward as any).customerDcNo || (outward as any).partyDcNo || (outward as any).partyDcNumber;
    const directDate = (outward as any).customerDcDate || (outward as any).partyDcDate || (outward as any).customerDate;
    if (directDc) {
      return {
        partyDcNumber: directDc,
        partyDcDate: directDate ? formatDate(directDate) : '-'
      };
    }

    // 2. Lookup candidate inwards from passed inwards or localStorage
    const candidates = this.getCandidateInwards(inwards);
    const matchedInward = this.findMatchingInward(outward, candidates);

    if (matchedInward && matchedInward.customerDcNo) {
      return {
        partyDcNumber: matchedInward.customerDcNo,
        partyDcDate: matchedInward.customerDate
          ? formatDate(matchedInward.customerDate)
          : matchedInward.inwardDate
          ? formatDate(matchedInward.inwardDate)
          : '-'
      };
    }

    return {
      partyDcNumber: '-',
      partyDcDate: '-'
    };
  }

  /**
   * Asynchronously resolves the Party DC No. and Date, actively querying Firestore if needed
   */
  static async resolvePartyDcInfoAsync(
    outward: OutwardEntry,
    inwards?: InwardEntry[]
  ): Promise<{ partyDcNumber: string; partyDcDate: string }> {
    const syncResult = this.resolvePartyDcInfo(outward, inwards);
    if (syncResult.partyDcNumber !== '-') {
      return syncResult;
    }

    // Query Firestore inward_entries collection
    try {
      if (db) {
        // Query by poId
        if (outward.poId) {
          const qPoId = query(collection(db, 'inward_entries'), where('poId', '==', outward.poId));
          const snap = await getDocs(qPoId);
          for (const docSnap of snap.docs) {
            const data = docSnap.data() as InwardEntry;
            if (data.customerDcNo) {
              return {
                partyDcNumber: data.customerDcNo,
                partyDcDate: data.customerDate
                  ? formatDate(data.customerDate)
                  : data.inwardDate
                  ? formatDate(data.inwardDate)
                  : '-'
              };
            }
          }
        }

        // Query by poNumberSnapshot
        const poNum = outward.poNumberSnapshot || (outward as any).poNumber;
        if (poNum) {
          const qPoNum = query(collection(db, 'inward_entries'), where('poNumberSnapshot', '==', poNum));
          const snapNum = await getDocs(qPoNum);
          for (const docSnap of snapNum.docs) {
            const data = docSnap.data() as InwardEntry;
            if (data.customerDcNo) {
              return {
                partyDcNumber: data.customerDcNo,
                partyDcDate: data.customerDate
                  ? formatDate(data.customerDate)
                  : data.inwardDate
                  ? formatDate(data.inwardDate)
                  : '-'
              };
            }
          }
        }

        // Query by customerVendorId
        if (outward.customerVendorId) {
          const qCust = query(
            collection(db, 'inward_entries'),
            where('customerVendorId', '==', outward.customerVendorId)
          );
          const snapCust = await getDocs(qCust);
          for (const docSnap of snapCust.docs) {
            const data = docSnap.data() as InwardEntry;
            if (data.customerDcNo) {
              return {
                partyDcNumber: data.customerDcNo,
                partyDcDate: data.customerDate
                  ? formatDate(data.customerDate)
                  : data.inwardDate
                  ? formatDate(data.inwardDate)
                  : '-'
              };
            }
          }
        }
      }
    } catch (err) {
      console.warn('DeliveryChallanPdfService: Failed to query Firestore inward_entries for party DC info:', err);
    }

    return {
      partyDcNumber: '-',
      partyDcDate: '-'
    };
  }

  /**
   * Formats a structured VendorAddress into a readable single-line address string
   */
  static formatVendorAddress(address?: VendorAddress | any): string {
    if (!address) return '';
    if (typeof address === 'string') return address.trim();
    const parts = [
      address.addressLine1,
      address.addressLine2,
      address.city,
      address.district && address.district !== address.city ? address.district : null,
      address.state,
      address.pinCode ? `PIN: ${address.pinCode}` : null
    ].filter(Boolean);
    return parts.join(', ');
  }

  /**
   * Resolves customer full address from direct fields or matching Vendor
   */
  static resolveCustomerAddress(outward: OutwardEntry, vendors?: Vendor[]): string {
    const directAddr = (outward as any).customerAddress || (outward as any).companyAddress || (outward as any).fullAddress;
    if (directAddr) {
      return typeof directAddr === 'string' ? directAddr : this.formatVendorAddress(directAddr);
    }

    let vendorList = vendors;
    if (!vendorList || vendorList.length === 0) {
      if (typeof localStorage !== 'undefined') {
        try {
          const raw = localStorage.getItem('perla_erp_demo_vendors');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) vendorList = parsed;
          }
        } catch (e) {
          // ignore
        }
      }
    }

    if (vendorList && vendorList.length > 0) {
      const targetId = outward.customerVendorId || (outward as any).customerId;
      const targetName = (
        outward.customerCompanyNameSnapshot ||
        (outward as any).customerName ||
        ''
      ).trim().toLowerCase();

      const matched = vendorList.find(
        (v) =>
          (targetId && (v.vendorId === targetId || (v as any).id === targetId)) ||
          (targetName && v.companyName && v.companyName.trim().toLowerCase() === targetName)
      );

      if (matched && matched.address) {
        const formatted = this.formatVendorAddress(matched.address);
        if (formatted) return formatted;
      }
    }

    return outward.destination || '';
  }

  /**
   * Asynchronously resolves customer full address, querying Firestore vendors collection if needed
   */
  static async resolveCustomerAddressAsync(outward: OutwardEntry, vendors?: Vendor[]): Promise<string> {
    const syncAddr = this.resolveCustomerAddress(outward, vendors);
    if (syncAddr && syncAddr.length > 12) {
      return syncAddr;
    }

    try {
      if (db) {
        const targetId = outward.customerVendorId || (outward as any).customerId;
        if (targetId) {
          const docRef = doc(db, 'vendors', targetId);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data();
            const formatted = this.formatVendorAddress(data?.address);
            if (formatted) return formatted;
          }
        }

        const targetName = outward.customerCompanyNameSnapshot || (outward as any).customerName;
        if (targetName) {
          const q = query(collection(db, 'vendors'), where('companyName', '==', targetName));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const data = snap.docs[0].data();
            const formatted = this.formatVendorAddress(data?.address);
            if (formatted) return formatted;
          }
        }
      }
    } catch (err) {
      console.warn('DeliveryChallanPdfService: Failed to query vendor address from Firestore:', err);
    }

    return syncAddr || outward.destination || '';
  }

  /**
   * Converts an OutwardEntry into standardized DeliveryChallanData
   */
  static extractChallanData(
    outward: OutwardEntry,
    inwards?: InwardEntry[],
    vendors?: Vendor[]
  ): DeliveryChallanData {
    const { partyDcNumber, partyDcDate } = this.resolvePartyDcInfo(outward, inwards);
    const customerAddress = this.resolveCustomerAddress(outward, vendors);

    const dcNumber = outward.ourDcNo || outward.outwardNo || '10001';
    const dcDate = formatDate(outward.outwardDate);

    const customerName = outward.customerCompanyNameSnapshot || outward.customerName || 'Customer';
    const destination = outward.destination || '';

    const lines = outward.lines || [];
    let totalPieces = 0;
    let totalKg = 0;

    const items = lines.map((l: OutwardLine, idx: number) => {
      const qtyNum = Number(l.dispatchQty) || 0;
      const unitStr = l.unit === 'kg' ? 'kg' : 'ps';

      if (l.unit === 'kg') {
        totalKg += qtyNum;
      } else {
        totalPieces += qtyNum;
      }

      const parts: string[] = [];
      const itemDesc = l.itemNameSnapshot || outward.itemNameSnapshot || 'Garments';
      parts.push(itemDesc);

      const colour = l.colourNameSnapshot || l.colour;
      const wash = l.washTypeSnapshot || l.processType;

      if (colour && colour !== 'Standard') {
        parts.push(`Colour: ${colour}${l.colourCodeSnapshot ? ` (${l.colourCodeSnapshot})` : ''}`);
      }
      if (wash) {
        parts.push(`Process: ${wash}`);
      }

      const qtyDisplay = `${qtyNum.toLocaleString().padStart(2, '0')} ${unitStr}`;

      return {
        sNo: idx + 1,
        description: parts.join(' - '),
        quantity: qtyDisplay
      };
    });

    const calculatedTotal = this.calculateTotalQuantity(items);
    const totalQuantityStr = calculatedTotal || (outward.totalQuantity ? `${outward.totalQuantity.toLocaleString()} ps` : '');

    let companyGstin = DEFAULT_INVOICE_SETTINGS.gstin;
    let companyPhone = DEFAULT_INVOICE_SETTINGS.dcPhone || DEFAULT_INVOICE_SETTINGS.phone;
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem('perla_invoice_settings');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.gstin) companyGstin = parsed.gstin;
          if (parsed.dcPhone || parsed.phone) companyPhone = parsed.dcPhone || parsed.phone;
        }
      } catch {
        // ignore
      }
    }

    return {
      dcNumber,
      dcDate,
      partyDcNumber,
      partyDcDate,
      customerName,
      customerAddress,
      destination,
      vehicleNumber: outward.vehicleNumber || (outward as any).vehicleNo || '',
      driverName: outward.driverName || '',
      timeOut: (outward as any).outwardTime || (outward as any).timeOut || '',
      poNumber: outward.poNumberSnapshot || outward.poNumber,
      styleNo: outward.styleNoSnapshot || outward.styleNo,
      companyGstin,
      companyPhone,
      items,
      totalQuantityStr
    };
  }

  /**
   * Converts an InwardEntry into standardized DeliveryChallanData
   */
  static extractInwardChallanData(inward: InwardEntry): DeliveryChallanData {
    const dcNumber = inward.inwardNo || 'INW/PENDING';
    const dcDate = formatDate(inward.inwardDate);
    const partyDcNumber = inward.customerDcNo || '-';
    const partyDcDate = inward.customerDate ? formatDate(inward.customerDate) : formatDate(inward.inwardDate);
    const customerName = inward.customerCompanyNameSnapshot || inward.customerName || 'Customer';

    const lines = inward.lines || [];
    let totalPieces = 0;
    let totalKg = 0;

    const items = lines.map((l: InwardLine, idx: number) => {
      const qtyNum = Number(l.receivedQty) || 0;
      const unitStr = l.unit === 'kg' ? 'kg' : 'ps';
      if (l.unit === 'kg') totalKg += qtyNum;
      else totalPieces += qtyNum;

      const parts: string[] = [l.itemNameSnapshot || inward.itemNameSnapshot || 'Fabric / Garments'];
      if (l.colourNameSnapshot) parts.push(`Colour: ${l.colourNameSnapshot}`);
      if (l.processType) parts.push(`Process: ${l.processType}`);

      return {
        sNo: idx + 1,
        description: parts.join(' - '),
        quantity: `${qtyNum.toLocaleString().padStart(2, '0')} ${unitStr}`
      };
    });

    const calculatedTotal = this.calculateTotalQuantity(items);
    const totalQuantityStr = calculatedTotal || (inward.totalQuantity ? `${inward.totalQuantity.toLocaleString()} ps` : '');

    return {
      dcNumber,
      dcDate,
      partyDcNumber,
      partyDcDate,
      customerName,
      customerAddress: '',
      destination: (inward as any).vehicleNumber ? `Vehicle: ${(inward as any).vehicleNumber}` : '',
      vehicleNumber: (inward as any).vehicleNumber || '',
      driverName: (inward as any).driverName || '',
      timeOut: (inward as any).inwardTime || '',
      poNumber: inward.poNumberSnapshot || inward.poNumber,
      styleNo: inward.styleNoSnapshot || inward.styleNo,
      items,
      totalQuantityStr
    };
  }

  /**
   * Helper to draw a clean dotted line between slips on the A4 page
   */
  static drawCutLine(doc: any, y: number, pageWidth: number, margin: number): void {
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.25);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.line(margin, y, pageWidth - margin, y);
    doc.setLineDashPattern([], 0);
  }

  /**
   * Renders a single compact Delivery Challan slip inside a vertical slot on the A4 sheet
   */
  static renderSingleSlipOnA4(
    doc: any,
    runAutoTable: any,
    data: DeliveryChallanData,
    startY: number
  ): void {
    const margin = 7;
    const contentWidth = 196;
    const slipHeight = 88;

    // Outer border
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.35);
    doc.rect(margin, startY, contentWidth, slipHeight);

    let curY = startY + 3.8;

    // --- 1. Top Header Row ---
    // GSTIN (Left)
    const gstin = data.companyGstin || DEFAULT_INVOICE_SETTINGS.gstin;
    const contactNo = data.companyPhone || DEFAULT_INVOICE_SETTINGS.dcPhone || DEFAULT_INVOICE_SETTINGS.phone;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(0, 0, 0);
    doc.text(`GSTIN / UIN : ${gstin}`, margin + 2.5, curY);

    // DELIVERY CHALLAN placed in the right top corner
    doc.setFontSize(8.5);
    doc.text('DELIVERY CHALLAN', margin + contentWidth - 2.5, curY, { align: 'right' });

    // Cell / Phone (Left below GSTIN)
    curY += 3.5;
    doc.setFontSize(6.5);
    doc.text(`Cell : ${contactNo}`, margin + 2.5, curY);

    // Company Name (Center)
    doc.setFontSize(11);
    doc.text('PERLA TEXTILES PROCESSOR', margin + contentWidth / 2, curY, { align: 'center' });

    // Company Address (Center)
    curY += 3.5;
    doc.setFontSize(6);
    doc.text(
      'NO. 107, Industrial Estate, Thirumudivakkam, SIDCO, Chennai - 600 044.',
      margin + contentWidth / 2,
      curY,
      { align: 'center' }
    );

    // Divider Line
    curY += 1.8;
    doc.setLineWidth(0.25);
    doc.line(margin, curY, margin + contentWidth, curY);

    // --- 2. Metadata Section ---
    curY += 3.5;
    // Row 1: DC No (Left) & Party DC No (Right)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('No. :', margin + 2.5, curY);
    doc.setFontSize(8.5);
    doc.text(data.dcNumber, margin + 11, curY);

    doc.setFontSize(7);
    doc.text('Party D.C. No. :', margin + 128, curY);
    doc.setFontSize(8.5);
    doc.text(data.partyDcNumber, margin + 152, curY);

    // Row 2: Date (Left) & Party Date (Right)
    curY += 3.5;
    doc.setFontSize(7);
    doc.text('Date :', margin + 2.5, curY);
    doc.setFont('helvetica', 'normal');
    doc.text(data.dcDate, margin + 13, curY);

    doc.setFont('helvetica', 'bold');
    doc.text('Date :', margin + 128, curY);
    doc.setFont('helvetica', 'normal');
    doc.text(data.partyDcDate, margin + 140, curY);

    // Row 3: To (Customer Company Name & Full Address, no PO No)
    curY += 3.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('To :', margin + 2.5, curY);
    doc.setFontSize(7.5);
    const fullAddress = data.customerAddress || data.destination || '';
    const toText = [
      data.customerName,
      fullAddress ? `, ${fullAddress}` : ''
    ].filter(Boolean).join('');
    const cleanTo = doc.splitTextToSize(toText, contentWidth - 14)[0] || toText;
    doc.text(cleanTo, margin + 9, curY);

    // Table divider line
    curY += 1.8;
    doc.line(margin, curY, margin + contentWidth, curY);

    // --- 3. Particulars Table ---
    const tableBody = data.items.slice(0, 3).map((item) => [
      String(item.sNo).padStart(2, '0'),
      item.description,
      item.quantity
    ]);

    while (tableBody.length < 2) {
      tableBody.push(['', '', '']);
    }

    const displayTotal = data.totalQuantityStr || this.calculateTotalQuantity(data.items);
    tableBody.push(['', 'TOTAL QUANTITY:', displayTotal]);

    runAutoTable(doc, {
      startY: curY,
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
      head: [['S.No.', 'Particulars', 'Qty.']],
      body: tableBody,
      theme: 'plain',
      styles: {
        font: 'helvetica',
        fontSize: 6.5,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
        cellPadding: 0.8,
        valign: 'middle'
      },
      headStyles: {
        fontStyle: 'bold',
        fontSize: 6.5,
        halign: 'center',
        lineColor: [0, 0, 0],
        lineWidth: 0.25,
        fillColor: [240, 240, 240]
      },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 149, halign: 'left' },
        2: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }
      },
      didParseCell: (hookData: any) => {
        if (hookData.section === 'body' && hookData.row.index === tableBody.length - 1) {
          hookData.cell.styles.fontStyle = 'bold';
          if (hookData.column.index === 1) {
            hookData.cell.styles.halign = 'right';
          }
        }
      }
    });

    // --- 4. Bottom Vehicle Box & Signatures ---
    const botY = startY + slipHeight - 16;
    const vehicleBoxWidth = 62;
    const rowH = 4.3;

    doc.setLineWidth(0.25);
    // Vehicle box (3 rows)
    doc.rect(margin + 2, botY, vehicleBoxWidth, rowH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.text('Vehicle No. :', margin + 3.5, botY + 3.1);
    doc.setFont('helvetica', 'normal');
    doc.text(data.vehicleNumber || '—', margin + 22, botY + 3.1);

    doc.rect(margin + 2, botY + rowH, vehicleBoxWidth, rowH);
    doc.setFont('helvetica', 'bold');
    doc.text('Driver Name :', margin + 3.5, botY + rowH + 3.1);
    doc.setFont('helvetica', 'normal');
    doc.text(data.driverName || '—', margin + 22, botY + rowH + 3.1);

    doc.rect(margin + 2, botY + rowH * 2, vehicleBoxWidth, rowH);
    doc.setFont('helvetica', 'bold');
    doc.text('Time Out :', margin + 3.5, botY + rowH * 2 + 3.1);
    doc.setFont('helvetica', 'normal');
    doc.text(data.timeOut || '—', margin + 22, botY + rowH * 2 + 3.1);

    // Receiver's Signature (Middle)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.line(margin + 85, botY + 8.5, margin + 125, botY + 8.5);
    doc.text("Receiver's Signature", margin + 105, botY + 12, { align: 'center' });

    // For PERLA TEXTILES PROCESSOR (Right)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text('For PERLA TEXTILES PROCESSOR', margin + contentWidth - 4, botY + 2.5, { align: 'right' });
    doc.line(margin + contentWidth - 48, botY + 8.5, margin + contentWidth - 4, botY + 8.5);
    doc.text('Authorized Signature', margin + contentWidth - 26, botY + 12, { align: 'center' });
  }

  /**
   * Renders 3 identical Delivery Challan copies on a single A4 portrait sheet
   * Formats: 1. ORIGINAL (CONSIGNEE), 2. DUPLICATE (TRANSPORTER), 3. TRIPLICATE (OFFICE COPY)
   */
  static renderPdfFromChallanData(data: DeliveryChallanData): jsPDF {
    const jsPdfConstructor: any = (jsPDF as any).default || jsPDF;
    const doc = new jsPdfConstructor({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4' // 210 x 297 mm
    });

    const runAutoTable = (autoTable as any).default || autoTable;

    const slips = [
      { startY: 5 },
      { startY: 100 },
      { startY: 195 }
    ];

    slips.forEach((slip, idx) => {
      this.renderSingleSlipOnA4(doc, runAutoTable, data, slip.startY);

      // Draw cut line between slips
      if (idx === 0) {
        this.drawCutLine(doc, 96.5, 210, 7);
      } else if (idx === 1) {
        this.drawCutLine(doc, 191.5, 210, 7);
      }
    });

    return doc;
  }

  /**
   * Asynchronously converts an OutwardEntry into standardized DeliveryChallanData,
   * querying Firestore for the inward's customerDcNo and vendor full address if needed.
   */
  static async extractChallanDataAsync(
    outward: OutwardEntry,
    inwards?: InwardEntry[],
    vendors?: Vendor[]
  ): Promise<DeliveryChallanData> {
    const baseData = this.extractChallanData(outward, inwards, vendors);

    const [resolvedParty, resolvedAddress, settings] = await Promise.all([
      baseData.partyDcNumber && baseData.partyDcNumber !== '-'
        ? Promise.resolve({ partyDcNumber: baseData.partyDcNumber, partyDcDate: baseData.partyDcDate })
        : this.resolvePartyDcInfoAsync(outward, inwards),
      this.resolveCustomerAddressAsync(outward, vendors),
      InvoiceSettingsService.getSettings().catch(() => DEFAULT_INVOICE_SETTINGS)
    ]);

    return {
      ...baseData,
      partyDcNumber: resolvedParty.partyDcNumber,
      partyDcDate: resolvedParty.partyDcDate,
      customerAddress: resolvedAddress || baseData.customerAddress,
      companyGstin: settings.gstin || baseData.companyGstin,
      companyPhone: settings.dcPhone || settings.phone || baseData.companyPhone
    };
  }

  /**
   * Generates a jsPDF instance for an OutwardEntry
   */
  static generateDeliveryChallanPdfDoc(
    outward: OutwardEntry,
    inwards?: InwardEntry[],
    vendors?: Vendor[]
  ): jsPDF {
    const data = this.extractChallanData(outward, inwards, vendors);
    return this.renderPdfFromChallanData(data);
  }

  /**
   * Generates a jsPDF instance for an OutwardEntry with full async inward and vendor address lookup
   */
  static async generateDeliveryChallanPdfDocAsync(
    outward: OutwardEntry,
    inwards?: InwardEntry[],
    vendors?: Vendor[]
  ): Promise<jsPDF> {
    const data = await this.extractChallanDataAsync(outward, inwards, vendors);
    return this.renderPdfFromChallanData(data);
  }

  /**
   * Triggers an automatic download of the Delivery Challan PDF for Outward
   */
  static async downloadDeliveryChallan(
    outward: OutwardEntry,
    inwards?: InwardEntry[],
    vendors?: Vendor[]
  ): Promise<void> {
    const doc = await this.generateDeliveryChallanPdfDocAsync(outward, inwards, vendors);
    const cleanDcNo = (outward.ourDcNo || outward.outwardNo || 'DC').replace(/[\/\\]/g, '_');
    doc.save(`Delivery_Challan_${cleanDcNo}.pdf`);
  }

  /**
   * Triggers an automatic download of the Delivery Challan PDF directly from live DeliveryChallanData
   */
  static downloadPdfFromData(data: DeliveryChallanData): void {
    const doc = this.renderPdfFromChallanData(data);
    const cleanDcNo = (data.dcNumber || 'DC').replace(/[\/\\]/g, '_');
    doc.save(`Delivery_Challan_${cleanDcNo}.pdf`);
  }

  /**
   * Triggers an automatic download of the Delivery Challan PDF for Inward
   */
  static downloadInwardDeliveryChallan(inward: InwardEntry): void {
    const data = this.extractInwardChallanData(inward);
    const doc = this.renderPdfFromChallanData(data);
    const cleanDcNo = (inward.customerDcNo || inward.inwardNo || 'DC').replace(/[\/\\]/g, '_');
    doc.save(`Delivery_Challan_${cleanDcNo}.pdf`);
  }
}
