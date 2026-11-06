import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { collection, doc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { OutwardEntry, OutwardLine } from '../types/outward';
import { InwardEntry, InwardLine } from '../types/inward';
import { Vendor, VendorAddress } from '../types/vendor';
import { formatDate } from '../utils/formatters';
import { InvoiceSettingsService, DEFAULT_INVOICE_SETTINGS } from './invoiceSettingsService';

export interface DeliveryChallanItem {
  sNo: number;
  itemName?: string;
  colour?: string;
  process?: string;
  description: string;
  quantity: string;
}

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
  notes?: string;
  items: DeliveryChallanItem[];
  totalQuantityStr: string;
}

export type ChallanSlipLayout = 'three' | 'two' | 'one';

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
   * Helper to parse category fields from a composite description or explicit properties
   */
  static parseItemDescription(item: {
    description?: string;
    itemName?: string;
    colour?: string;
    process?: string;
  }): { itemName: string; colour: string; process: string } {
    let itemName = (item.itemName || '').trim();
    let colour = (item.colour || '').trim();
    let process = (item.process || '').trim();

    if ((!itemName || (!colour && !process)) && item.description) {
      const desc = item.description.trim();
      const colourMatch = desc.match(/-\s*Colour:\s*([^-]+)/i);
      const processMatch = desc.match(/-\s*Process:\s*(.+)$/i);

      if (colourMatch || processMatch) {
        if (!colour && colourMatch) colour = colourMatch[1].trim();
        if (!process && processMatch) process = processMatch[1].trim();

        if (!itemName) {
          const idxColour = desc.search(/-\s*Colour:/i);
          const idxProcess = desc.search(/-\s*Process:/i);
          const cutIdx = idxColour > -1 ? idxColour : idxProcess;
          if (cutIdx > -1) {
            itemName = desc.substring(0, cutIdx).trim();
          } else {
            itemName = desc;
          }
        }
      } else if (!itemName) {
        itemName = desc;
      }
    }

    return {
      itemName: itemName || 'Garments',
      colour: colour || '-',
      process: process || '-'
    };
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

      const itemDesc = (l.itemNameSnapshot || outward.itemNameSnapshot || 'Garments').trim();
      const rawColour = (l.colourNameSnapshot || l.colour || '').trim();
      const colourCode = l.colourCodeSnapshot ? ` (${l.colourCodeSnapshot})` : '';
      const colour = rawColour && rawColour !== 'Standard' ? `${rawColour}${colourCode}` : (rawColour || '-');
      const wash = (l.washTypeSnapshot || l.processType || '-').trim();

      const parts: string[] = [itemDesc];
      if (colour && colour !== '-') {
        parts.push(`Colour: ${colour}`);
      }
      if (wash && wash !== '-') {
        parts.push(`Process: ${wash}`);
      }

      const qtyDisplay = `${qtyNum.toLocaleString().padStart(2, '0')} ${unitStr}`;

      return {
        sNo: idx + 1,
        itemName: itemDesc,
        colour: colour,
        process: wash,
        description: parts.join(' - '),
        quantity: qtyDisplay
      };
    });

    const calculatedTotal = this.calculateTotalQuantity(items);
    const totalQuantityStr = calculatedTotal || (outward.totalQuantity ? `${outward.totalQuantity.toLocaleString()} ps` : '');
    const notes = (outward.remarks || (outward as any).notes || (outward as any).note || '').trim();

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
      notes,
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

      const itemDesc = (l.itemNameSnapshot || inward.itemNameSnapshot || 'Fabric / Garments').trim();
      const colour = (l.colourNameSnapshot || '-').trim();
      const wash = (l.processType || '-').trim();

      const parts: string[] = [itemDesc];
      if (colour && colour !== '-') parts.push(`Colour: ${colour}`);
      if (wash && wash !== '-') parts.push(`Process: ${wash}`);

      return {
        sNo: idx + 1,
        itemName: itemDesc,
        colour,
        process: wash,
        description: parts.join(' - '),
        quantity: `${qtyNum.toLocaleString().padStart(2, '0')} ${unitStr}`
      };
    });

    const calculatedTotal = this.calculateTotalQuantity(items);
    const totalQuantityStr = calculatedTotal || (inward.totalQuantity ? `${inward.totalQuantity.toLocaleString()} ps` : '');
    const notes = (inward.remarks || (inward as any).notes || (inward as any).note || '').trim();

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
      notes,
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
   * Automatically determines whether to render:
   * - 'three' (3 challans on A4, if content fits in 3 slips of <= 83mm)
   * - 'two' (2 challans on A4, if content fits in 2 slips of <= 135mm)
   * - 'one' (1 challan alone on A4, if content requires full page clearance)
   */
  static determineChallanSlipLayout(data: DeliveryChallanData): ChallanSlipLayout {
    const itemCount = data.items.length;
    const noteText = (data.notes || '').trim();

    // 1. Check if 3 slips can fit on A4 (Max safe slip height <= 83mm)
    // Base fixed overhead in 3-slip mode:
    // Header (~11.5) + Metadata (~12) + Table Header & Total row (~9) + Vehicle Box & Signatures (~13) + spacing (~4) = 49.5mm
    const baseHeight3 = 49.5;
    const noteHeight3 = noteText ? 5.0 : 2.5;

    const itemRowsHeight3 = data.items.reduce((sum, item) => {
      const parsed = DeliveryChallanPdfService.parseItemDescription(item);
      const isWrapped = parsed.itemName.length > 34 || parsed.colour.length > 20 || parsed.process.length > 20;
      return sum + (isWrapped ? 6.5 : 4.0);
    }, 0);

    const estimatedHeight3 = baseHeight3 + itemRowsHeight3 + noteHeight3;

    // Up to 4 compact items easily fit within 83mm for 3 slips on A4
    if (itemCount <= 4 && estimatedHeight3 <= 83) {
      return 'three';
    }

    // 2. Check if 2 slips can fit on A4 (Max safe slip height <= 135mm)
    // Base fixed overhead in 2-slip mode: ~54mm
    const baseHeight2 = 54;
    const noteLines2 = noteText ? Math.min(2, Math.ceil(noteText.length / 65)) : 1;
    const noteHeight2 = 2.5 + (noteLines2 * 3.4);

    const itemRowsHeight2 = data.items.reduce((sum, item) => {
      const parsed = DeliveryChallanPdfService.parseItemDescription(item);
      const isWrapped = parsed.itemName.length > 34 || parsed.colour.length > 20 || parsed.process.length > 20;
      return sum + (isWrapped ? 7.2 : 5.0);
    }, 0);

    const estimatedHeight2 = baseHeight2 + itemRowsHeight2 + noteHeight2;

    // Up to 9-10 items fit comfortably within 135mm for 2 slips on A4
    if (itemCount <= 9 && estimatedHeight2 <= 135) {
      return 'two';
    }

    // 3. Otherwise, render 1 challan alone on the A4 page
    return 'one';
  }

  static canFitTwoSlipsOnA4(data: DeliveryChallanData): boolean {
    return this.determineChallanSlipLayout(data) !== 'one';
  }

  /**
   * Renders a single compact Delivery Challan slip inside a vertical slot on the A4 sheet.
   * Dynamically positions all elements and calculates outer border height to avoid any clipping.
   */
  static renderSingleSlipOnA4(
    doc: any,
    runAutoTable: any,
    data: DeliveryChallanData,
    startY: number,
    layoutMode: ChallanSlipLayout = 'two'
  ): number {
    const isThree = layoutMode === 'three';
    const isTwo = layoutMode === 'two';
    const isOne = layoutMode === 'one';

    const margin = 7;
    const contentWidth = 196;

    let curY = startY + (isThree ? 3.2 : isTwo ? 3.8 : 4.5);

    // --- 1. Top Header Row ---
    const gstin = data.companyGstin || DEFAULT_INVOICE_SETTINGS.gstin;
    const contactNo = data.companyPhone || DEFAULT_INVOICE_SETTINGS.dcPhone || DEFAULT_INVOICE_SETTINGS.phone;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isThree ? 7.5 : isTwo ? 8 : 8.5);
    doc.setTextColor(0, 0, 0);
    doc.text(`GSTIN / UIN : ${gstin}`, margin + 2.5, curY);

    // DELIVERY CHALLAN placed in the right top corner
    doc.setFontSize(isThree ? 9.5 : isTwo ? 10 : 11);
    doc.text('DELIVERY CHALLAN', margin + contentWidth - 2.5, curY, { align: 'right' });

    // Cell / Phone (Left below GSTIN)
    curY += (isThree ? 3.3 : isTwo ? 3.8 : 4.5);
    doc.setFontSize(isThree ? 7.5 : isTwo ? 8 : 8.5);
    doc.text(`Cell : ${contactNo}`, margin + 2.5, curY);

    // Company Name (Center)
    doc.setFontSize(isThree ? 11.5 : isTwo ? 12.5 : 14);
    doc.text('PERLA TEXTILES PROCESSOR', margin + contentWidth / 2, curY, { align: 'center' });

    // Company Address (Center)
    curY += (isThree ? 3.2 : isTwo ? 3.6 : 4.2);
    doc.setFontSize(isThree ? 7 : isTwo ? 7.5 : 8);
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
    curY += (isThree ? 3.2 : isTwo ? 3.6 : 4.2);
    // Row 1: DC No (Left) & Party DC No (Right)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isThree ? 8 : isTwo ? 8.5 : 9);
    doc.text('No. :', margin + 2.5, curY);
    doc.setFontSize(isThree ? 9 : isTwo ? 9.5 : 10.5);
    doc.text(data.dcNumber, margin + 12, curY);

    doc.setFontSize(isThree ? 8 : isTwo ? 8.5 : 9);
    doc.text('Party D.C. No. :', margin + 124, curY);
    doc.setFontSize(isThree ? 9 : isTwo ? 9.5 : 10.5);
    doc.text(data.partyDcNumber, margin + 152, curY);

    // Row 2: Date (Left) & Party Date (Right)
    curY += (isThree ? 3.2 : isTwo ? 3.6 : 4.2);
    doc.setFontSize(isThree ? 8 : isTwo ? 8.5 : 9);
    doc.text('Date :', margin + 2.5, curY);
    doc.setFont('helvetica', 'normal');
    doc.text(data.dcDate, margin + 14, curY);

    doc.setFont('helvetica', 'bold');
    doc.text('Date :', margin + 124, curY);
    doc.setFont('helvetica', 'normal');
    doc.text(data.partyDcDate, margin + 138, curY);

    // Row 3: To (Customer Company Name & Full Address, no PO No)
    curY += (isThree ? 3.2 : isTwo ? 3.6 : 4.2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isThree ? 8 : isTwo ? 8.5 : 9);
    doc.text('To :', margin + 2.5, curY);
    doc.setFontSize(isThree ? 8 : isTwo ? 8.5 : 9);
    const fullAddress = data.customerAddress || data.destination || '';
    const toText = [
      data.customerName,
      fullAddress ? `, ${fullAddress}` : ''
    ].filter(Boolean).join('');
    const cleanTo = doc.splitTextToSize(toText, contentWidth - 14)[0] || toText;
    doc.text(cleanTo, margin + 10, curY);

    // Table divider line
    curY += 1.8;
    doc.line(margin, curY, margin + contentWidth, curY);

    // --- 3. Particulars Table (Separate Columns for Category: Particulars, Colour, Process, Qty) ---
    // Render all line items without truncation
    const tableBody = data.items.map((item, idx) => {
      const parsed = DeliveryChallanPdfService.parseItemDescription(item);
      return [
        String(item.sNo || idx + 1).padStart(2, '0'),
        parsed.itemName,
        parsed.colour,
        parsed.process,
        item.quantity
      ];
    });

    if ((isTwo || isThree) && tableBody.length === 1) {
      tableBody.push(['', '', '', '', '']);
    }

    const displayTotal = data.totalQuantityStr || this.calculateTotalQuantity(data.items);
    tableBody.push([
      { content: 'TOTAL QUANTITY:', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
      { content: displayTotal, styles: { halign: 'right', fontStyle: 'bold' } }
    ] as any);

    const tableFontSize = isThree ? 7.5 : (isTwo ? (data.items.length > 4 ? 7.5 : 8) : 8.5);
    const tablePadding = isThree ? 0.75 : (isTwo ? (data.items.length > 4 ? 0.8 : 1.0) : 1.25);

    runAutoTable(doc, {
      startY: curY,
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
      head: [['S.No.', 'Particulars', 'Colour', 'Process', 'Qty.']],
      body: tableBody,
      theme: 'plain',
      styles: {
        font: 'helvetica',
        fontSize: tableFontSize,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
        cellPadding: tablePadding,
        valign: 'middle'
      },
      headStyles: {
        fontStyle: 'bold',
        fontSize: isThree ? 8 : (isTwo ? 8.5 : 9),
        halign: 'left',
        lineColor: [0, 0, 0],
        lineWidth: 0.25,
        fillColor: [240, 240, 240]
      },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 74, halign: 'left', fontStyle: 'bold' },
        2: { cellWidth: 43, halign: 'left' },
        3: { cellWidth: 43, halign: 'left' },
        4: { cellWidth: 24, halign: 'right', fontStyle: 'bold' }
      },
      didParseCell: (hookData: any) => {
        if (hookData.section === 'head' && hookData.column.index === 0) {
          hookData.cell.styles.halign = 'center';
        }
        if (hookData.section === 'head' && hookData.column.index === 4) {
          hookData.cell.styles.halign = 'right';
        }
        if (hookData.section === 'body' && hookData.row.index === tableBody.length - 1) {
          hookData.cell.styles.fontStyle = 'bold';
          hookData.cell.styles.fontSize = isThree ? 8 : (isTwo ? 8.5 : 9);
        }
      }
    });

    const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : curY + 22;

    // --- 3.5. Note Section (Fetched from Database Remarks / Notes) ---
    const noteY = finalY + (isThree ? 2.0 : isTwo ? 2.5 : 3.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isThree ? 7.5 : isTwo ? 8 : 8.5);
    doc.text('Note :', margin + 2.5, noteY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(isThree ? 7.5 : isTwo ? 8 : 8.5);
    const noteText = data.notes && data.notes.trim() ? data.notes.trim() : '—';
    const maxNoteLines = isThree ? 1 : (isTwo ? 2 : 4);
    const splitNote = doc.splitTextToSize(noteText, contentWidth - 22);
    const renderedNote = splitNote.slice(0, maxNoteLines);
    doc.text(renderedNote, margin + 14, noteY);
    const noteLineHeight = isThree ? 3.0 : isTwo ? 3.4 : 4.0;
    const noteHeight = Math.max(1, renderedNote.length) * noteLineHeight;
    const noteEndY = noteY + noteHeight;

    // --- 4. Bottom Vehicle Box & Signatures (Dynamically positioned below Note) ---
    const botY = noteEndY + (isThree ? 2.0 : isTwo ? 2.5 : 4.0);
    const vehicleBoxWidth = 64;
    const rowH = isThree ? 3.6 : (isTwo ? 4.0 : 4.8);

    doc.setLineWidth(0.25);
    // Vehicle box (3 rows)
    doc.rect(margin + 2, botY, vehicleBoxWidth, rowH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isThree ? 7 : isTwo ? 7.5 : 8);
    doc.text('Vehicle No. :', margin + 3.5, botY + (rowH * 0.72));
    doc.setFont('helvetica', 'normal');
    doc.text(data.vehicleNumber || '—', margin + 24, botY + (rowH * 0.72));

    doc.rect(margin + 2, botY + rowH, vehicleBoxWidth, rowH);
    doc.setFont('helvetica', 'bold');
    doc.text('Driver Name :', margin + 3.5, botY + rowH + (rowH * 0.72));
    doc.setFont('helvetica', 'normal');
    doc.text(data.driverName || '—', margin + 24, botY + rowH + (rowH * 0.72));

    doc.rect(margin + 2, botY + rowH * 2, vehicleBoxWidth, rowH);
    doc.setFont('helvetica', 'bold');
    doc.text('Time Out :', margin + 3.5, botY + rowH * 2 + (rowH * 0.72));
    doc.setFont('helvetica', 'normal');
    doc.text(data.timeOut || '—', margin + 24, botY + rowH * 2 + (rowH * 0.72));

    // Signatures vertical baseline alignment
    const sigLineY = botY + rowH * 2;
    const sigTextY = sigLineY + (isThree ? 3.2 : isTwo ? 3.8 : 4.2);

    // Receiver's Signature (Middle)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isThree ? 7.5 : isTwo ? 8 : 8.5);
    doc.line(margin + 80, sigLineY, margin + 128, sigLineY);
    doc.text("Receiver's Signature", margin + 104, sigTextY, { align: 'center' });

    // For PERLA TEXTILES PROCESSOR (Right)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isThree ? 7.5 : isTwo ? 8 : 8.5);
    doc.text('For PERLA TEXTILES PROCESSOR', margin + contentWidth - 4, botY + 2.0, { align: 'right' });
    doc.line(margin + contentWidth - 52, sigLineY, margin + contentWidth - 4, sigLineY);
    doc.text('Authorized Signature', margin + contentWidth - 28, sigTextY, { align: 'center' });

    // Outer border rectangle encompassing the entire challan with exact height
    const slipActualHeight = (botY + rowH * 3 + (isThree ? 1.6 : isTwo ? 2.0 : 3.0)) - startY;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.35);
    doc.rect(margin, startY, contentWidth, slipActualHeight);

    return slipActualHeight;
  }

  /**
   * Renders Delivery Challan PDF on A4 portrait sheet:
   * - If content fits in 3 slips (<= 83mm per slip, <= 4 items), renders THREE slips on 1 A4 sheet with 2 cut lines.
   * - If content fits in 2 slips (<= 135mm per slip, <= 9 items), renders TWO slips on 1 A4 sheet with 1 center cut line.
   * - Otherwise, renders ONE slip alone on the A4 sheet with full clearance.
   */
  static renderPdfFromChallanData(data: DeliveryChallanData): jsPDF {
    const jsPdfConstructor: any = (jsPDF as any).default || jsPDF;
    const doc = new jsPdfConstructor({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4' // 210 x 297 mm
    });

    const runAutoTable = (autoTable as any).default || autoTable;
    const layout = this.determineChallanSlipLayout(data);

    if (layout === 'three') {
      // 3 Challans on 1 A4 portrait sheet
      // Slip 1 (Top)
      this.renderSingleSlipOnA4(doc, runAutoTable, data, 4, 'three');

      // Cut line 1
      this.drawCutLine(doc, 96.5, 210, 7);

      // Slip 2 (Middle)
      this.renderSingleSlipOnA4(doc, runAutoTable, data, 99.5, 'three');

      // Cut line 2
      this.drawCutLine(doc, 192, 210, 7);

      // Slip 3 (Bottom)
      this.renderSingleSlipOnA4(doc, runAutoTable, data, 195, 'three');
    } else if (layout === 'two') {
      // 2 Challans on 1 A4 portrait sheet
      // Slip 1 (Top half)
      this.renderSingleSlipOnA4(doc, runAutoTable, data, 6, 'two');

      // Center cut line at exact middle (148.5 mm)
      this.drawCutLine(doc, 148.5, 210, 7);

      // Slip 2 (Bottom half)
      this.renderSingleSlipOnA4(doc, runAutoTable, data, 153, 'two');
    } else {
      // 1 Challan alone on A4 portrait sheet (spacious clearance for many line items)
      this.renderSingleSlipOnA4(doc, runAutoTable, data, 12, 'one');
    }

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

    let resolvedNotes = baseData.notes;
    if (!resolvedNotes && db) {
      try {
        const docId = outward.id || outward.outwardId || (outward as any).entryId;
        if (docId) {
          const docSnap = await getDoc(doc(db, 'outward_entries', docId));
          if (docSnap.exists()) {
            const d = docSnap.data();
            if (d?.remarks || d?.notes) {
              resolvedNotes = (d.remarks || d.notes).trim();
            }
          }
        }
      } catch (err) {
        console.warn('DeliveryChallanPdfService: Failed to fetch outward notes from Firestore:', err);
      }
    }

    return {
      ...baseData,
      partyDcNumber: resolvedParty.partyDcNumber,
      partyDcDate: resolvedParty.partyDcDate,
      customerAddress: resolvedAddress || baseData.customerAddress,
      companyGstin: settings.gstin || baseData.companyGstin,
      companyPhone: settings.dcPhone || settings.phone || baseData.companyPhone,
      notes: resolvedNotes
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
