import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  runTransaction,
  limit
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import {
  RawMaterialPurchase,
  PurchaseLineItem,
  PurchaseFilterOptions,
  PurchaseStatus,
  PurchaseType,
  WeighbridgeDetails
} from '../types/purchase';
import { WarehouseService } from './warehouseService';

const PURCHASES_STORAGE_KEY = 'perla_raw_material_purchases';

function safeGetStorage(key: string): string | null {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return null;
}

function safeSetStorage(key: string, value: string): void {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  }
}

export class RawMaterialPurchaseService {
  /**
   * Retrieves list of all purchases with optional filters
   */
  static async getPurchases(filters?: PurchaseFilterOptions): Promise<RawMaterialPurchase[]> {
    let purchases: RawMaterialPurchase[] = [];

    try {
      const q = query(
        collection(db, 'raw_material_purchases'),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      const snap = await getDocs(q);

      purchases = snap.docs.map((d) => ({
        id: d.id,
        ...d.data()
      })) as RawMaterialPurchase[];

      safeSetStorage(PURCHASES_STORAGE_KEY, JSON.stringify(purchases));
    } catch (err) {
      console.warn('Firestore getPurchases error, fallback to cache:', err);
      const cached = safeGetStorage(PURCHASES_STORAGE_KEY);
      if (cached) {
        try {
          purchases = JSON.parse(cached);
        } catch {
          purchases = [];
        }
      }
    }

    let filtered = [...purchases];

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.purchaseNumber.toLowerCase().includes(q) ||
          p.vendorName.toLowerCase().includes(q) ||
          p.supplierInvoiceNo.toLowerCase().includes(q) ||
          p.lines?.some((l) => l.itemName.toLowerCase().includes(q) || l.itemCode.toLowerCase().includes(q))
      );
    }

    if (filters?.status && filters.status !== 'ALL') {
      filtered = filtered.filter((p) => p.status === filters.status);
    }

    if (filters?.purchaseType && filters.purchaseType !== 'ALL') {
      filtered = filtered.filter((p) => p.purchaseType === filters.purchaseType);
    }

    if (filters?.vendorId && filters.vendorId !== 'ALL') {
      filtered = filtered.filter((p) => p.vendorId === filters.vendorId);
    }

    if (filters?.startDate) {
      filtered = filtered.filter((p) => p.purchaseDate >= filters.startDate!);
    }

    if (filters?.endDate) {
      filtered = filtered.filter((p) => p.purchaseDate <= filters.endDate!);
    }

    return filtered;
  }

  /**
   * Get purchase details by ID
   */
  static async getPurchaseById(purchaseId: string): Promise<RawMaterialPurchase | null> {
    try {
      const snap = await getDoc(doc(db, 'raw_material_purchases', purchaseId));
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as RawMaterialPurchase;
      }
    } catch (err) {
      console.warn('Firestore getPurchaseById error, fallback to cache:', err);
      const cached = safeGetStorage(PURCHASES_STORAGE_KEY);
      if (cached) {
        try {
          const list: RawMaterialPurchase[] = JSON.parse(cached);
          const found = list.find((p) => p.id === purchaseId);
          if (found) return found;
        } catch {
          // ignore
        }
      }
    }
    return null;
  }

  /**
   * Generates next purchase number atomically
   */
  private static async generatePurchaseNumber(year: number): Promise<string> {
    const counterDocRef = doc(db, 'purchase_counters', `pur_${year}`);
    return await runTransaction(db, async (txn) => {
      const counterSnap = await txn.get(counterDocRef);
      let currentVal = 0;
      if (counterSnap.exists()) {
        currentVal = Number(counterSnap.data()?.currentValue || 0);
      }
      const nextVal = currentVal + 1;
      txn.set(
        counterDocRef,
        {
          year,
          currentValue: nextVal,
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );
      return `PUR-${year}-${String(nextVal).padStart(4, '0')}`;
    });
  }

  /**
   * Create a new purchase order entry (Draft or Confirmed)
   */
  static async createPurchase(
    payload: {
      purchaseDate: string;
      purchaseType: PurchaseType;
      vendorId: string;
      vendorName: string;
      vendorCode?: string;
      supplierInvoiceNo: string;
      supplierInvoiceDate?: string;
      vehicleNo?: string;
      driverName?: string;
      driverPhone?: string;
      weighbridge?: WeighbridgeDetails;
      remarks?: string;
      status?: PurchaseStatus;
      lines: Array<{
        itemId: string;
        itemCode: string;
        itemName: string;
        categoryName: string;
        quantity: number;
        unit: string;
        rate: number;
        remarks?: string;
      }>;
    },
    user: { uid: string; name: string }
  ): Promise<RawMaterialPurchase> {
    if (!payload.vendorId || !payload.vendorName) {
      throw new Error('Please select a supplier / vendor from the Vendor Master.');
    }
    if (!payload.supplierInvoiceNo || !payload.supplierInvoiceNo.trim()) {
      throw new Error('Supplier invoice / DC number is required.');
    }
    if (!payload.lines || payload.lines.length === 0) {
      throw new Error('Please add at least one raw material line item.');
    }

    // Try Cloud Function first
    try {
      if (functions) {
        const fn = httpsCallable(functions, 'createRawMaterialPurchase');
        const res: any = await fn({
          ...payload,
          purchaseDate: payload.purchaseDate || new Date().toISOString().split('T')[0]
        });
        if (res.data?.success && res.data?.purchase) {
          return res.data.purchase as RawMaterialPurchase;
        }
      }
    } catch (cfErr: any) {
      console.warn('createRawMaterialPurchase Cloud Function unavailable, executing client Firestore:', cfErr);
    }

    const year = new Date().getFullYear();
    const purchaseNumber = await this.generatePurchaseNumber(year);
    const purchaseId = `pur_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    let totalQuantity = 0;
    let grandTotal = 0;

    const processedLines: PurchaseLineItem[] = payload.lines.map((l, idx) => {
      const qty = Math.max(0, Number(l.quantity) || 0);
      const rate = Math.max(0, Number(l.rate) || 0);
      const amount = Math.round(qty * rate * 100) / 100;

      totalQuantity += qty;
      grandTotal += amount;

      return {
        lineId: `line_${idx + 1}_${Date.now()}`,
        itemId: l.itemId,
        itemCode: l.itemCode,
        itemName: l.itemName,
        categoryName: l.categoryName || '',
        quantity: qty,
        unit: l.unit || 'kg',
        rate: rate,
        amount: amount,
        remarks: l.remarks || ''
      };
    });

    const newPurchase: RawMaterialPurchase = {
      id: purchaseId,
      purchaseNumber,
      purchaseDate: payload.purchaseDate || nowIso.split('T')[0],
      purchaseType: payload.purchaseType || 'Raw Material',
      vendorId: payload.vendorId,
      vendorName: payload.vendorName,
      vendorCode: payload.vendorCode || '',
      supplierInvoiceNo: payload.supplierInvoiceNo.trim(),
      supplierInvoiceDate: payload.supplierInvoiceDate || payload.purchaseDate,
      vehicleNo: payload.vehicleNo?.trim() || '',
      driverName: payload.driverName?.trim() || '',
      driverPhone: payload.driverPhone?.trim() || '',
      weighbridge: payload.weighbridge || undefined,
      lines: processedLines,
      totalQuantity: Math.round(totalQuantity * 100) / 100,
      grandTotal: Math.round(grandTotal * 100) / 100,
      status: payload.status || 'Draft',
      stockInwardCompleted: false,
      remarks: payload.remarks || '',
      createdBy: user.uid,
      createdByName: user.name,
      createdAt: nowIso,
      updatedBy: user.uid,
      updatedByName: user.name,
      updatedAt: nowIso
    };

    await setDoc(doc(db, 'raw_material_purchases', purchaseId), newPurchase);

    return newPurchase;
  }

  /**
   * Edit draft purchase details
   */
  static async updatePurchase(
    purchaseId: string,
    updates: Partial<RawMaterialPurchase>,
    user: { uid: string; name: string }
  ): Promise<void> {
    const existing = await this.getPurchaseById(purchaseId);
    if (!existing) {
      throw new Error(`Purchase record ${purchaseId} not found.`);
    }
    if (existing.status === 'Cancelled') {
      throw new Error(`Cannot modify purchase in 'Cancelled' status.`);
    }

    const nowIso = new Date().toISOString();

    let lines = updates.lines || existing.lines;
    let totalQuantity = 0;
    let grandTotal = 0;

    lines = lines.map((l) => {
      const qty = Math.max(0, Number(l.quantity) || 0);
      const rate = Math.max(0, Number(l.rate) || 0);
      const amount = Math.round(qty * rate * 100) / 100;
      totalQuantity += qty;
      grandTotal += amount;
      return {
        ...l,
        quantity: qty,
        rate,
        amount
      };
    });

    // If this purchase was already received into warehouse stock, adjust warehouse stock for any quantity changes
    if (existing.stockInwardCompleted && Array.isArray(lines)) {
      const oldLineMap = new Map<string, number>();
      (existing.lines || []).forEach((l) => oldLineMap.set(l.itemId, (oldLineMap.get(l.itemId) || 0) + (l.quantity || 0)));

      const newLineMap = new Map<string, number>();
      lines.forEach((l) => newLineMap.set(l.itemId, (newLineMap.get(l.itemId) || 0) + (l.quantity || 0)));

      const allItemIds = Array.from(new Set([...oldLineMap.keys(), ...newLineMap.keys()]));
      for (const itId of allItemIds) {
        const oldQty = oldLineMap.get(itId) || 0;
        const newQty = newLineMap.get(itId) || 0;
        const diff = newQty - oldQty;

        if (diff > 0) {
          await WarehouseService.inwardMaterial(
            {
              itemId: itId,
              quantity: diff,
              source: 'PURCHASE_RECEIPT',
              referenceNumber: existing.purchaseNumber,
              referenceId: existing.id,
              receivedFrom: updates.vendorName || existing.vendorName,
              date: updates.purchaseDate || existing.purchaseDate || nowIso.split('T')[0],
              remarks: `Purchase update adjustment (+${diff}) for ${existing.purchaseNumber}`
            },
            user
          );
        } else if (diff < 0) {
          await WarehouseService.issueMaterial(
            {
              itemId: itId,
              quantity: Math.abs(diff),
              purpose: `Purchase Update Adjustment (-${Math.abs(diff)})`,
              issuedTo: updates.vendorName || existing.vendorName,
              date: updates.purchaseDate || existing.purchaseDate || nowIso.split('T')[0],
              remarks: `Purchase update adjustment (-${Math.abs(diff)}) for ${existing.purchaseNumber}`
            },
            user
          );
        }
      }
    }

    await updateDoc(doc(db, 'raw_material_purchases', purchaseId), {
      ...updates,
      lines,
      totalQuantity: Math.round(totalQuantity * 100) / 100,
      grandTotal: Math.round(grandTotal * 100) / 100,
      updatedBy: user.uid,
      updatedByName: user.name,
      updatedAt: nowIso
    });
  }

  /**
   * Delete purchase record
   * If the purchase was received, reverts the stock in warehouse properly.
   */
  static async deletePurchase(
    purchaseId: string,
    user: { uid: string; name: string }
  ): Promise<void> {
    const existing = await this.getPurchaseById(purchaseId);
    if (!existing) throw new Error('Purchase record not found.');

    // If stock inward was completed, revert the stock in warehouse
    if (existing.stockInwardCompleted && Array.isArray(existing.lines)) {
      for (const line of existing.lines) {
        if (line.quantity > 0 && line.itemId) {
          try {
            await WarehouseService.issueMaterial(
              {
                itemId: line.itemId,
                quantity: line.quantity,
                purpose: `Purchase Deletion Reversal: ${existing.purchaseNumber}`,
                issuedTo: 'Warehouse Stock Reversal',
                date: new Date().toISOString().split('T')[0],
                remarks: `Reverting stock due to deletion of purchase ${existing.purchaseNumber}`
              },
              user
            );
          } catch (revertErr) {
            console.warn(`Could not revert stock for item ${line.itemId}:`, revertErr);
          }
        }
      }
    }

    // Delete purchase record from Firestore
    await deleteDoc(doc(db, 'raw_material_purchases', purchaseId));

    // Update local cache
    try {
      const cached = safeGetStorage(PURCHASES_STORAGE_KEY);
      if (cached) {
        const list: RawMaterialPurchase[] = JSON.parse(cached);
        const filtered = list.filter((p) => p.id !== purchaseId);
        safeSetStorage(PURCHASES_STORAGE_KEY, JSON.stringify(filtered));
      }
    } catch {
      // ignore
    }
  }

  /**
   * Confirm a draft purchase
   */
  static async confirmPurchase(purchaseId: string, user: { uid: string; name: string }): Promise<void> {
    const existing = await this.getPurchaseById(purchaseId);
    if (!existing) throw new Error('Purchase not found.');
    if (existing.status !== 'Draft') {
      throw new Error(`Only Draft purchases can be confirmed. Current status: ${existing.status}`);
    }

    const nowIso = new Date().toISOString();
    await updateDoc(doc(db, 'raw_material_purchases', purchaseId), {
      status: 'Confirmed',
      updatedBy: user.uid,
      updatedByName: user.name,
      updatedAt: nowIso
    });
  }

  /**
   * Receive goods and auto-inward to warehouse stock
   * Idempotent: stock increases once, updates status to Received.
   */
  static async receivePurchase(
    purchaseId: string,
    user: { uid: string; name: string },
    receivedDate?: string
  ): Promise<{ inwardCount: number; purchase: RawMaterialPurchase }> {
    const existing = await this.getPurchaseById(purchaseId);
    if (!existing) throw new Error('Purchase not found.');

    if (existing.status === 'Received' || existing.stockInwardCompleted) {
      throw new Error('This purchase has already been received into the warehouse.');
    }

    if (existing.status === 'Cancelled') {
      throw new Error('Cancelled purchase entries cannot be received into stock.');
    }

    // Try Cloud Function first
    try {
      if (functions) {
        const fn = httpsCallable(functions, 'receiveRawMaterialPurchase');
        const res: any = await fn({
          purchaseId,
          receivedDate: receivedDate || new Date().toISOString().split('T')[0]
        });
        if (res.data?.success) {
          const updated = await this.getPurchaseById(purchaseId);
          return {
            inwardCount: res.data.inwardCount || existing.lines.length,
            purchase: updated || existing
          };
        }
      }
    } catch (cfErr: any) {
      console.warn('receiveRawMaterialPurchase Cloud Function unavailable, executing client inward transactions:', cfErr);
    }

    const recDate = receivedDate || new Date().toISOString().split('T')[0];
    const inwardTransactionIds: string[] = [];

    // Atomically inward each item line into warehouse stock
    for (const line of existing.lines) {
      if (line.quantity > 0) {
        const idempotencyKey = `pur_inward_${existing.id}_${line.lineId}`;
        const tx = await WarehouseService.inwardMaterial(
          {
            itemId: line.itemId,
            quantity: line.quantity,
            rate: line.rate,
            source: 'PURCHASE_RECEIPT',
            referenceNumber: existing.purchaseNumber,
            referenceId: existing.id,
            idempotencyKey,
            receivedFrom: existing.vendorName,
            date: recDate,
            remarks: `Purchase inward: ${line.itemName} (${line.quantity} ${line.unit}) from ${existing.vendorName} [Inv: ${existing.supplierInvoiceNo}]`
          },
          user
        );
        inwardTransactionIds.push(tx.id);
      }
    }

    const nowIso = new Date().toISOString();
    const updatedFields: Partial<RawMaterialPurchase> = {
      status: 'Received',
      stockInwardCompleted: true,
      inwardTransactionIds,
      receivedDate: recDate,
      receivedBy: user.uid,
      receivedByName: user.name,
      updatedBy: user.uid,
      updatedByName: user.name,
      updatedAt: nowIso
    };

    await updateDoc(doc(db, 'raw_material_purchases', purchaseId), updatedFields);

    return {
      inwardCount: inwardTransactionIds.length,
      purchase: {
        ...existing,
        ...updatedFields
      } as RawMaterialPurchase
    };
  }

  /**
   * Cancel a purchase order
   */
  static async cancelPurchase(
    purchaseId: string,
    reason: string,
    user: { uid: string; name: string }
  ): Promise<void> {
    const existing = await this.getPurchaseById(purchaseId);
    if (!existing) throw new Error('Purchase not found.');

    if (existing.status === 'Received') {
      throw new Error(
        'Cannot cancel a purchase that has already been received into warehouse stock. Please adjust warehouse stock manually if needed.'
      );
    }

    const nowIso = new Date().toISOString();
    await updateDoc(doc(db, 'raw_material_purchases', purchaseId), {
      status: 'Cancelled',
      remarks: existing.remarks ? `${existing.remarks} | Cancelled: ${reason}` : `Cancelled: ${reason}`,
      updatedBy: user.uid,
      updatedByName: user.name,
      updatedAt: nowIso
    });
  }
}

