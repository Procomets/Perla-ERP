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
  limit,
  runTransaction
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import {
  ChemicalEntryRecord,
  ChemicalEntryType,
  CreateChemicalEntryPayload,
  ChemicalEntryFilterOptions
} from '../types/chemicalEntry';
import { MasterItem } from '../types/item';
import { ItemService } from './itemService';
import { Vendor } from '../types/vendor';
import { VendorService } from './vendorService';
import { PurchaseOrder } from '../types/po';
import { POService } from './poService';

const CHEMICAL_ENTRIES_CACHE_KEY = 'perla_chemical_entries_cache_v1';

export class ChemicalEntryService {
  /**
   * Safe document normalizer for Firestore / Cache records
   */
  static normalizeChemicalEntry(id: string, data: any): ChemicalEntryRecord {
    const hasConsumptions = Array.isArray(data?.consumptions) && data.consumptions.length > 0;
    const firstConsumption = hasConsumptions ? data.consumptions[0] : null;

    const entryType: ChemicalEntryType =
      data?.entryType || (data?.supplierId || data?.supplierName ? 'Purchase' : 'Consumption');

    const quantity = Number(
      data?.quantity ??
      (firstConsumption ? firstConsumption.quantity : (data?.processedQty ?? 0))
    ) || 0;

    const rate = Number(data?.rate ?? 0) || 0;
    const totalAmount = Number(data?.totalAmount ?? (quantity * rate)) || 0;

    const chemicalName =
      data?.chemicalName ||
      (firstConsumption ? firstConsumption.chemicalName : 'Textile Material');

    const unit =
      data?.unit ||
      (firstConsumption ? firstConsumption.unit : 'kg');

    let itemCode = data?.itemCode || '';
    if (itemCode.startsWith('item_')) {
      itemCode = '';
    }

    const rawNumber = data?.entryNumber || data?.entryId || '';
    const rawName = (chemicalName || '').toLowerCase();
    const rawCode = itemCode.toUpperCase();

    let materialType: 'chemical' | 'wood' = data?.materialType;
    if (!materialType) {
      if (
        rawNumber.startsWith('WD-') ||
        rawNumber.startsWith('RWD-') ||
        rawCode.startsWith('RWD') ||
        rawName.includes('wood') ||
        rawName.includes('firewood') ||
        (data?.processType || '').toLowerCase().includes('boiler')
      ) {
        materialType = 'wood';
      } else {
        materialType = 'chemical';
      }
    }

    const entryNumber =
      data?.entryNumber ||
      data?.entryId ||
      (materialType === 'wood' ? `WD-${id.slice(0, 8)}` : `CHM-${id.slice(0, 8)}`);

    return {
      id,
      entryNumber,
      entryType,
      materialType,
      date: data?.date || new Date().toISOString().split('T')[0],
      itemId: data?.itemId || (firstConsumption ? firstConsumption.chemicalItemId : '') || id,
      itemCode,
      chemicalName,
      unit,
      quantity,
      rate,
      totalAmount,
      supplierId: data?.supplierId || null,
      supplierName: data?.supplierName || null,
      supplierInvoiceNo: data?.supplierInvoiceNo || null,
      isReceived: data?.isReceived ?? true,
      receivedDate: data?.receivedDate || null,
      poId: data?.poId || null,
      poNumber: data?.poNumber || null,
      styleNo: data?.styleNo || null,
      batchNo: data?.batchNo || data?.lotNo || null,
      processType: data?.processType || null,
      machineNo: data?.machineNo || null,
      boilerNo: data?.boilerNo || (materialType === 'wood' ? data?.machineNo : null) || null,
      startTime: data?.startTime || null,
      endTime: data?.endTime || null,
      operatorName: data?.operatorName || null,
      remarks: data?.remarks || null,
      stockTransactionId: data?.stockTransactionId || null,
      stockTransactionNumber: data?.stockTransactionNumber || null,
      stockUpdated: Boolean(data?.stockUpdated),
      idempotencyKey: data?.idempotencyKey || null,
      createdBy: data?.createdBy || 'Authorized User',
      createdByName: data?.createdByName || null,
      createdAt: data?.createdAt || new Date().toISOString(),
      updatedAt: data?.updatedAt || new Date().toISOString()
    };
  }

  /**
   * Safe local cache retrieval
   */
  private static getCache(): ChemicalEntryRecord[] {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem(CHEMICAL_ENTRIES_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            return parsed.map((e) =>
              this.normalizeChemicalEntry(e.id || `cache_${Date.now()}`, e)
            );
          }
        }
      }
    } catch (e) {
      console.warn('Failed to read chemical entries cache', e);
    }
    return [];
  }

  /**
   * Safe local cache write
   */
  private static setCache(entries: ChemicalEntryRecord[]): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(CHEMICAL_ENTRIES_CACHE_KEY, JSON.stringify(entries));
      }
    } catch (e) {
      console.warn('Failed to set chemical entries cache', e);
    }
  }

  /**
   * 1. Fetch all chemical entries from Firestore
   */
  static async getChemicalEntries(
    filters?: ChemicalEntryFilterOptions,
    isDemo: boolean = false
  ): Promise<ChemicalEntryRecord[]> {
    let entries: ChemicalEntryRecord[] = [];

    if (!isDemo) {
      try {
        const q = query(collection(db, 'chemical_entries'), orderBy('date', 'desc'));
        const snap = await getDocs(q);
        if (!snap.empty) {
          entries = snap.docs.map((d) => this.normalizeChemicalEntry(d.id, d.data()));

          // Auto-repair any entries missing rate or totalAmount
          const needsRepair = entries.some(
            (e) => (Number(e.rate) || 0) <= 0 || (Number(e.totalAmount) || 0) <= 0
          );
          if (needsRepair) {
            try {
              const chemicals = await this.getChemicalItems();
              const chemRateMap = new Map<string, number>();
              chemicals.forEach((c) => {
                const r = Number(c.defaultPurchaseRate || 0);
                if (r > 0) {
                  chemRateMap.set(c.id, r);
                  if (c.itemId) chemRateMap.set(c.itemId, r);
                  if (c.itemName) chemRateMap.set(c.itemName.toLowerCase(), r);
                }
              });

              entries = entries.map((entry) => {
                if ((Number(entry.rate) || 0) <= 0 || (Number(entry.totalAmount) || 0) <= 0) {
                  const resolvedRate =
                    chemRateMap.get(entry.itemId) ||
                    chemRateMap.get((entry.chemicalName || '').toLowerCase()) ||
                    0;
                  if (resolvedRate > 0) {
                    const newRate = resolvedRate;
                    const newTotal = Math.round(Number(entry.quantity || 0) * newRate * 100) / 100;
                    // Persist repair to Firestore
                    updateDoc(doc(db, 'chemical_entries', entry.id), {
                      rate: newRate,
                      totalAmount: newTotal
                    }).catch((e) => console.warn('Repair entry rate failed:', e));

                    return {
                      ...entry,
                      rate: newRate,
                      totalAmount: newTotal
                    };
                  }
                }
                return entry;
              });
            } catch (repairErr) {
              console.warn('Auto-repair entry rates encountered an issue:', repairErr);
            }
          }

          this.setCache(entries);
        } else {
          entries = this.getCache();
        }
      } catch (err) {
        console.warn('Firestore fetch failed for chemical_entries, loading from local cache:', err);
        entries = this.getCache();
      }
    } else {
      entries = this.getCache();
    }

    // Apply Client-side Filters
    if (filters) {
      const { search, materialType, entryType, startDate, endDate, itemId } = filters;

      if (materialType && materialType !== 'ALL') {
        entries = entries.filter((e) => (e.materialType || 'chemical') === materialType);
      }

      if (entryType && entryType !== 'ALL') {
        entries = entries.filter((e) => e.entryType === entryType);
      }

      if (itemId) {
        entries = entries.filter((e) => e.itemId === itemId);
      }

      if (startDate) {
        entries = entries.filter((e) => e.date >= startDate);
      }

      if (endDate) {
        entries = entries.filter((e) => e.date <= endDate);
      }

      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        entries = entries.filter((e) => {
          return (
            (e.entryNumber || '').toLowerCase().includes(q) ||
            (e.chemicalName || '').toLowerCase().includes(q) ||
            (e.itemCode || '').toLowerCase().includes(q) ||
            (e.supplierName || '').toLowerCase().includes(q) ||
            (e.poNumber || '').toLowerCase().includes(q) ||
            (e.batchNo || '').toLowerCase().includes(q) ||
            (e.remarks || '').toLowerCase().includes(q)
          );
        });
      }
    }

    return entries;
  }

  /**
   * 2. Fetch chemicals from Chemical Master / Item Master
   * Also merges with live warehouse stock balances.
   */
  static async getChemicalItems(isDemo: boolean = false): Promise<MasterItem[]> {
    try {
      // 1. Get items from ItemService
      let items = await ItemService.getChemicalItems(isDemo);

      if (items.length === 0) {
        // Fallback: search all items in case category or itemType differs
        const res = await ItemService.getItems({ status: 'active' }, { page: 1, pageSize: 500 }, isDemo);
        items = res.items.filter(
          (it) =>
            it.itemType === 'chemical' ||
            Boolean(it.chemicalDetails) ||
            (it.categoryName || '').toLowerCase().includes('chem')
        );
      }

      // 2. Augment with real-time stock balances and purchase costs
      try {
        const [stockSnap, purchaseSnap] = await Promise.all([
          getDocs(collection(db, 'warehouse_stock')),
          getDocs(query(collection(db, 'raw_material_purchases'), orderBy('purchaseDate', 'asc'), limit(500)))
        ]);

        const stockMap = new Map<string, { availableStock: number; averageRate?: number }>();
        if (!stockSnap.empty) {
          stockSnap.docs.forEach((d) => {
            const data = d.data();
            const itemId = data.itemId || d.id.replace('stock_', '');
            stockMap.set(itemId, {
              availableStock: Number(data.availableStock || 0),
              averageRate: Number(data.averageRate || 0)
            });
          });
        }

        const purchaseRatesMap = new Map<string, number[]>();
        if (!purchaseSnap.empty) {
          purchaseSnap.docs.forEach((docSnap) => {
            const pData = docSnap.data();
            if (Array.isArray(pData.lines)) {
              pData.lines.forEach((l: any) => {
                const r = Number(l.rate || 0);
                if (l.itemId && r > 0) {
                  const arr = purchaseRatesMap.get(l.itemId) || [];
                  arr.push(r);
                  purchaseRatesMap.set(l.itemId, arr);
                }
              });
            }
          });
        }

        items = items.map((it) => {
          const stockInfo = stockMap.get(it.id) || stockMap.get(it.itemId);
          const currentStock = stockInfo ? stockInfo.availableStock : (it.currentStock || 0);
          const rates = purchaseRatesMap.get(it.id) || purchaseRatesMap.get(it.itemId) || [];

          let effectiveRate = stockInfo?.averageRate || 0;
          if (effectiveRate <= 0) {
            if (rates.length === 1) {
              const recentCost = rates[0];
              const prevCost = Number(it.defaultPurchaseRate || (it as any).lastPurchaseRate || 0);
              effectiveRate = (prevCost > 0 && prevCost !== recentCost)
                ? Math.round(((prevCost + recentCost) / 2) * 100) / 100
                : recentCost;
            } else if (rates.length >= 2) {
              const recentCost = rates[rates.length - 1];
              const prevCost = rates[rates.length - 2];
              effectiveRate = Math.round(((prevCost + recentCost) / 2) * 100) / 100;
            } else {
              effectiveRate = Number(it.defaultPurchaseRate || (it as any).lastPurchaseRate || 0);
            }
          }

          return {
            ...it,
            currentStock,
            defaultPurchaseRate: effectiveRate > 0 ? effectiveRate : it.defaultPurchaseRate
          };
        });
      } catch (stockErr) {
        console.warn('Could not load warehouse stock / purchase rates in chemicalEntryService:', stockErr);
      }

      return items;
    } catch (err) {
      console.error('Error fetching chemical items:', err);
      return [];
    }
  }

  /**
   * 2b. Fetch firewood / raw wood items from Item Master
   * Also merges with live warehouse stock balances and purchase costs.
   */
  static async getWoodItems(isDemo: boolean = false): Promise<MasterItem[]> {
    try {
      let items = await ItemService.getFirewoodItems(isDemo);

      if (items.length === 0) {
        const res = await ItemService.getItems({ status: 'active' }, { page: 1, pageSize: 500 }, isDemo);
        items = res.items.filter(
          (it) =>
            it.itemType === 'firewood' ||
            (it.itemCode || '').toUpperCase().startsWith('RWD') ||
            (it.categoryName || '').toLowerCase().includes('wood') ||
            (it.categoryName || '').toLowerCase().includes('firewood') ||
            (it.itemName || '').toLowerCase().includes('wood') ||
            (it.itemName || '').toLowerCase().includes('firewood')
        );
      }

      // Augment with real-time stock balances and purchase costs
      try {
        const [stockSnap, purchaseSnap] = await Promise.all([
          getDocs(collection(db, 'warehouse_stock')),
          getDocs(query(collection(db, 'raw_material_purchases'), orderBy('purchaseDate', 'asc'), limit(500)))
        ]);

        const stockMap = new Map<string, { availableStock: number; averageRate?: number }>();
        if (!stockSnap.empty) {
          stockSnap.docs.forEach((d) => {
            const data = d.data();
            const itemId = data.itemId || d.id.replace('stock_', '');
            stockMap.set(itemId, {
              availableStock: Number(data.availableStock || 0),
              averageRate: Number(data.averageRate || 0)
            });
          });
        }

        const purchaseRatesMap = new Map<string, number[]>();
        if (!purchaseSnap.empty) {
          purchaseSnap.docs.forEach((docSnap) => {
            const pData = docSnap.data();
            if (Array.isArray(pData.lines)) {
              pData.lines.forEach((l: any) => {
                const r = Number(l.rate || 0);
                if (l.itemId && r > 0) {
                  const arr = purchaseRatesMap.get(l.itemId) || [];
                  arr.push(r);
                  purchaseRatesMap.set(l.itemId, arr);
                }
              });
            }
          });
        }

        items = items.map((it) => {
          const stockInfo = stockMap.get(it.id) || stockMap.get(it.itemId);
          const currentStock = stockInfo ? stockInfo.availableStock : (it.currentStock || 0);
          const rates = purchaseRatesMap.get(it.id) || purchaseRatesMap.get(it.itemId) || [];

          let effectiveRate = stockInfo?.averageRate || 0;
          if (effectiveRate <= 0) {
            if (rates.length === 1) {
              const recentCost = rates[0];
              const prevCost = Number(it.defaultPurchaseRate || (it as any).lastPurchaseRate || 0);
              effectiveRate = (prevCost > 0 && prevCost !== recentCost)
                ? Math.round(((prevCost + recentCost) / 2) * 100) / 100
                : recentCost;
            } else if (rates.length >= 2) {
              const recentCost = rates[rates.length - 1];
              const prevCost = rates[rates.length - 2];
              effectiveRate = Math.round(((prevCost + recentCost) / 2) * 100) / 100;
            } else {
              effectiveRate = Number(it.defaultPurchaseRate || (it as any).lastPurchaseRate || 0);
            }
          }

          return {
            ...it,
            currentStock,
            defaultPurchaseRate: effectiveRate > 0 ? effectiveRate : it.defaultPurchaseRate
          };
        });
      } catch (stockErr) {
        console.warn('Could not load warehouse stock / purchase rates in getWoodItems:', stockErr);
      }

      return items;
    } catch (err) {
      console.error('Error fetching wood items:', err);
      return [];
    }
  }

  /**
   * 3. Fetch active suppliers
   */
  static async getSuppliers(isDemo: boolean = false): Promise<Vendor[]> {
    try {
      const res = await VendorService.getVendors({}, { page: 1, pageSize: 500 }, isDemo);
      return (res.vendors || []).filter(
        (v) => v.vendorType === 'supplier' || v.vendorType === 'both'
      );
    } catch (err) {
      console.error('Error fetching suppliers:', err);
      return [];
    }
  }

  /**
   * 4. Fetch active purchase orders (for consumption batch linking)
   */
  static async getPurchaseOrders(isDemo: boolean = false): Promise<PurchaseOrder[]> {
    try {
      const res = await POService.getPurchaseOrders({}, { page: 1, pageSize: 500 }, isDemo);
      return res.pos || [];
    } catch (err) {
      console.error('Error fetching purchase orders:', err);
      return [];
    }
  }

  /**
   * 5. Record a Chemical Entry (Purchase or Consumption)
   * Calls Cloud Function first; falls back to atomic Firestore client transaction.
   */
  static async recordEntry(
    payload: CreateChemicalEntryPayload,
    user: { uid: string; displayName?: string }
  ): Promise<ChemicalEntryRecord> {
    const numericQty = parseFloat(String(payload.quantity));
    if (isNaN(numericQty) || numericQty <= 0) {
      throw new Error('Quantity must be greater than zero.');
    }

    const numericRate = parseFloat(String(payload.rate || 0));
    if (numericRate < 0) {
      throw new Error('Rate cannot be negative.');
    }

    const idempotencyKey =
      payload.idempotencyKey || `chem_${payload.entryType.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // A. Attempt via Firebase Cloud Function
    try {
      if (functions) {
        const fn = httpsCallable(functions, 'recordChemicalEntry');
        const res: any = await fn({
          ...payload,
          quantity: numericQty,
          rate: numericRate,
          idempotencyKey
        });

        if (res.data?.success && res.data?.entry) {
          const newEntry = res.data.entry as ChemicalEntryRecord;
          const current = this.getCache();
          this.setCache([newEntry, ...current.filter((e) => e.id !== newEntry.id)]);
          return newEntry;
        }
      }
    } catch (cfErr: any) {
      console.warn('recordChemicalEntry Cloud Function failed or unavailable, running client transaction:', cfErr);
      if (cfErr?.message?.includes('Insufficient stock')) {
        throw new Error(cfErr.message);
      }
    }

    // B. Direct Atomic Firestore Transaction Fallback
    const now = new Date().toISOString();
    const year = new Date(payload.date).getFullYear() || new Date().getFullYear();
    const isWood = payload.materialType === 'wood';

    const itemDocRef = doc(db, 'items', payload.itemId);
    const stockDocRef = doc(db, 'warehouse_stock', `stock_${payload.itemId}`);
    const counterDocRef = isWood
      ? doc(db, 'wood_counters', `entry_seq_${year}`)
      : doc(db, 'chemical_counters', `entry_seq_${year}`);
    const stockCounterDocRef = doc(db, 'stock_counters', 'transaction_seq');
    const entryDocRef = doc(collection(db, 'chemical_entries'));
    const txDocRef = doc(collection(db, 'stock_transactions'));

    const shouldUpdateStock =
      payload.entryType === 'Consumption' ||
      (payload.entryType === 'Purchase' && Boolean(payload.isReceived));

    return await runTransaction(db, async (txn) => {
      // 1. ALL READS FIRST (Firestore requires all reads to be executed before any writes)
      const [itemSnap, stockSnap, counterSnap, stockCounterSnap] = await Promise.all([
        txn.get(itemDocRef),
        txn.get(stockDocRef),
        txn.get(counterDocRef),
        txn.get(stockCounterDocRef)
      ]);

      if (!itemSnap.exists()) {
        throw new Error(`Selected ${isWood ? 'raw wood' : 'chemical'} item not found in Item Master.`);
      }
      const itemData = itemSnap.data();
      const chemicalName =
        itemData?.chemicalDetails?.chemicalDisplayName ||
        itemData?.itemName ||
        (isWood ? 'Raw Wood / Firewood' : 'Chemical Item');
      const itemCode = itemData?.itemCode || '';
      const categoryName = itemData?.categoryName || (isWood ? 'Firewood & Boiler Fuel' : 'Textile Processing Chemicals');
      const effectiveUnit = payload.unit || itemData?.baseUnit || (isWood ? 't' : 'kg');

      // Stock balance calculation
      let previousStock = 0;
      if (stockSnap.exists()) {
        previousStock = parseFloat(String(stockSnap.data()?.availableStock || 0));
      } else {
        previousStock = parseFloat(String(itemData?.currentStock || 0));
      }
      if (isNaN(previousStock)) previousStock = 0;

      let newStock = previousStock;
      let txNumber = '';
      let nextTxSeq = 1;

      if (shouldUpdateStock) {
        if (payload.entryType === 'Consumption') {
          if (previousStock < numericQty) {
            throw new Error(
              `Insufficient stock for '${chemicalName}'. Available: ${previousStock} ${effectiveUnit}, Requested: ${numericQty} ${effectiveUnit}`
            );
          }
          newStock = Math.round((previousStock - numericQty) * 1000) / 1000;
        } else {
          // Purchase received
          newStock = Math.round((previousStock + numericQty) * 1000) / 1000;
        }

        if (stockCounterSnap.exists()) {
          nextTxSeq = (stockCounterSnap.data()?.currentSeq || 0) + 1;
        }
        txNumber = `TX-${year}-${String(nextTxSeq).padStart(4, '0')}`;
      }

      // Entry Number sequence (WD-YYYY-XXXX for wood, CHM-YYYY-XXXX for chemical)
      let nextEntrySeq = 1;
      if (counterSnap.exists()) {
        nextEntrySeq = (counterSnap.data()?.currentSeq || 0) + 1;
      }
      const entryPrefix = isWood ? 'WD' : 'CHM';
      const entryNumber = `${entryPrefix}-${year}-${String(nextEntrySeq).padStart(4, '0')}`;

      // Determine effective rate, total amount and stock valuation
      const stockAvgRate = Number(stockSnap.data()?.averageRate || itemData?.defaultPurchaseRate || (itemData as any)?.lastPurchaseRate || 0);
      const effectiveRate = numericRate > 0 ? numericRate : stockAvgRate;
      const effectiveTotalAmount = Math.round(numericQty * effectiveRate * 100) / 100;

      let warehouseAvgRate = stockAvgRate || effectiveRate;
      let warehouseTotalVal = Math.round(newStock * warehouseAvgRate * 100) / 100;

      if (payload.entryType === 'Purchase') {
        const previousCost = stockAvgRate;
        const recentCost = effectiveRate;
        if (recentCost > 0) {
          if (previousCost > 0) {
            warehouseAvgRate = Math.round(((previousCost + recentCost) / 2) * 100) / 100;
          } else {
            warehouseAvgRate = recentCost;
          }
        }
        warehouseTotalVal = Math.round(newStock * warehouseAvgRate * 100) / 100;
      }

      // 2. ALL WRITES EXECUTE HERE (No reads after this point)
      if (shouldUpdateStock) {
        txn.set(stockCounterDocRef, { currentSeq: nextTxSeq, updatedAt: now }, { merge: true });
      }
      txn.set(counterDocRef, { currentSeq: nextEntrySeq, updatedAt: now }, { merge: true });

      // Update warehouse_stock & items
      if (shouldUpdateStock) {
        const stockPayload = {
          id: `stock_${payload.itemId}`,
          itemId: payload.itemId,
          itemCode,
          itemName: itemData?.itemName || chemicalName,
          categoryId: itemData?.categoryId || '',
          categoryName,
          baseUnit: effectiveUnit,
          availableStock: newStock,
          averageRate: warehouseAvgRate,
          totalValue: warehouseTotalVal,
          minimumStockLevel: itemData?.minimumStockLevel || 0,
          reorderLevel: itemData?.reorderLevel || itemData?.minimumStockLevel || 0,
          storageLocation: itemData?.storageLocation || '',
          ...(payload.entryType === 'Purchase' ? { lastInwardDate: payload.date } : { lastOutwardDate: payload.date }),
          updatedAt: now,
          updatedBy: user.uid
        };
        txn.set(stockDocRef, stockPayload, { merge: true });

        txn.update(itemDocRef, {
          currentStock: newStock,
          ...(warehouseAvgRate > 0 ? { defaultPurchaseRate: warehouseAvgRate } : {}),
          updatedAt: now,
          updatedBy: user.uid,
          updatedByName: user.displayName || 'Authorized User'
        });

        // Record stock_transactions
        const isPurchase = payload.entryType === 'Purchase';
        const txPayload = {
          id: txDocRef.id,
          transactionNumber: txNumber,
          itemId: payload.itemId,
          itemCode,
          itemName: chemicalName,
          categoryName,
          baseUnit: effectiveUnit,
          type: isPurchase ? 'INWARD' : 'OUTWARD',
          source: isPurchase ? 'PURCHASE_RECEIPT' : 'PRODUCTION_CONSUMPTION',
          quantity: numericQty,
          previousStock,
          newStock,
          referenceNumber: entryNumber,
          referenceId: entryDocRef.id,
          idempotencyKey,
          purpose: isPurchase
            ? `${isWood ? 'Raw Wood' : 'Chemical'} Purchase Inward - ${payload.supplierName || 'Supplier'}`
            : isWood
            ? `Boiler Fuel / Raw Wood Consumption - ${payload.machineNo || payload.boilerNo || 'Boiler'} (${payload.processType || 'Steam Generation'})`
            : `Processing Consumption - ${payload.processType || 'Shopfloor'} (Batch: ${payload.batchNo || 'N/A'})`,
          issuedTo: isPurchase ? null : payload.operatorName || user.displayName || 'Operator',
          receivedFrom: isPurchase ? payload.supplierName || null : null,
          date: payload.date,
          remarks: payload.remarks || null,
          createdBy: user.uid,
          createdByName: user.displayName || 'Authorized User',
          createdAt: now
        };
        txn.set(txDocRef, txPayload);
      }

      // 5. Save chemical_entries record
      const entryRecord: ChemicalEntryRecord = {
        id: entryDocRef.id,
        entryNumber,
        entryType: payload.entryType,
        materialType: isWood ? 'wood' : 'chemical',
        date: payload.date,
        itemId: payload.itemId,
        itemCode,
        chemicalName,
        unit: effectiveUnit,
        quantity: numericQty,
        rate: effectiveRate,
        totalAmount: effectiveTotalAmount,
        supplierId: payload.supplierId || null,
        supplierName: payload.supplierName || null,
        supplierInvoiceNo: payload.supplierInvoiceNo || null,
        isReceived: payload.entryType === 'Purchase' ? Boolean(payload.isReceived) : true,
        receivedDate: payload.entryType === 'Purchase' && payload.isReceived ? payload.date : null,
        poId: payload.poId || null,
        poNumber: payload.poNumber || null,
        styleNo: payload.styleNo || null,
        batchNo: payload.batchNo || null,
        processType: payload.processType || null,
        machineNo: payload.machineNo || null,
        boilerNo: payload.boilerNo || (isWood ? payload.machineNo : null) || null,
        startTime: payload.startTime || null,
        endTime: payload.endTime || null,
        operatorName: payload.operatorName || null,
        remarks: payload.remarks || null,
        stockTransactionId: shouldUpdateStock ? txDocRef.id : null,
        stockTransactionNumber: shouldUpdateStock ? txNumber : null,
        stockUpdated: shouldUpdateStock,
        idempotencyKey,
        createdBy: user.uid,
        createdByName: user.displayName || 'Authorized User',
        createdAt: now,
        updatedAt: now
      };

      txn.set(entryDocRef, entryRecord);

      // Update cache
      const current = this.getCache();
      this.setCache([entryRecord, ...current.filter((e) => e.id !== entryRecord.id)]);

      return entryRecord;
    });
  }

  /**
   * 6. Confirm receipt of a pending chemical purchase
   */
  static async receivePurchase(
    entryId: string,
    receivedDate: string,
    user: { uid: string; displayName?: string }
  ): Promise<ChemicalEntryRecord> {
    // A. Attempt via Firebase Cloud Function
    try {
      if (functions) {
        const fn = httpsCallable(functions, 'receiveChemicalPurchase');
        const res: any = await fn({ entryId, receivedDate });
        if (res.data?.success && res.data?.entry) {
          const updated = res.data.entry as ChemicalEntryRecord;
          const current = this.getCache();
          this.setCache(current.map((e) => (e.id === updated.id ? updated : e)));
          return updated;
        }
      }
    } catch (cfErr) {
      console.warn('receiveChemicalPurchase Cloud Function failed, running client transaction:', cfErr);
    }

    // B. Direct Atomic Firestore Transaction Fallback
    const now = new Date().toISOString();
    const year = new Date(receivedDate).getFullYear() || new Date().getFullYear();

    const entryDocRef = doc(db, 'chemical_entries', entryId);
    const stockCounterDocRef = doc(db, 'stock_counters', 'transaction_seq');
    const txDocRef = doc(collection(db, 'stock_transactions'));

    return await runTransaction(db, async (txn) => {
      const entrySnap = await txn.get(entryDocRef);
      if (!entrySnap.exists()) {
        throw new Error('Chemical purchase entry not found.');
      }
      const entryData = entrySnap.data() as ChemicalEntryRecord;
      if (entryData.entryType !== 'Purchase') {
        throw new Error('Only purchase entries can be marked as received.');
      }
      if (entryData.isReceived && entryData.stockUpdated) {
        return entryData;
      }

      const itemId = entryData.itemId;
      const numericQty = entryData.quantity;
      const itemDocRef = doc(db, 'items', itemId);
      const stockDocRef = doc(db, 'warehouse_stock', `stock_${itemId}`);

      const itemSnap = await txn.get(itemDocRef);
      if (!itemSnap.exists()) {
        throw new Error('Item record not found in Item Master.');
      }
      const itemData = itemSnap.data();

      const stockSnap = await txn.get(stockDocRef);
      let previousStock = 0;
      if (stockSnap.exists()) {
        previousStock = parseFloat(String(stockSnap.data()?.availableStock || 0));
      } else {
        previousStock = parseFloat(String(itemData?.currentStock || 0));
      }
      if (isNaN(previousStock)) previousStock = 0;

      const newStock = Math.round((previousStock + numericQty) * 1000) / 1000;

      // Stock transaction seq
      const stockCounterSnap = await txn.get(stockCounterDocRef);
      let nextTxSeq = 1;
      if (stockCounterSnap.exists()) {
        nextTxSeq = (stockCounterSnap.data()?.currentSeq || 0) + 1;
      }
      txn.set(stockCounterDocRef, { currentSeq: nextTxSeq, updatedAt: now }, { merge: true });
      const txNumber = `TX-${year}-${String(nextTxSeq).padStart(4, '0')}`;

      // Update warehouse_stock & items
      txn.set(
        stockDocRef,
        {
          id: `stock_${itemId}`,
          itemId,
          itemCode: entryData.itemCode,
          itemName: entryData.chemicalName,
          baseUnit: entryData.unit,
          availableStock: newStock,
          lastInwardDate: receivedDate,
          updatedAt: now,
          updatedBy: user.uid
        },
        { merge: true }
      );

      txn.update(itemDocRef, {
        currentStock: newStock,
        updatedAt: now,
        updatedBy: user.uid,
        updatedByName: user.displayName || 'Authorized User'
      });

      // Write stock_transactions
      txn.set(txDocRef, {
        id: txDocRef.id,
        transactionNumber: txNumber,
        itemId,
        itemCode: entryData.itemCode,
        itemName: entryData.chemicalName,
        categoryName: itemData?.categoryName || 'Textile Processing Chemicals',
        baseUnit: entryData.unit,
        type: 'INWARD',
        source: 'PURCHASE_RECEIPT',
        quantity: numericQty,
        previousStock,
        newStock,
        referenceNumber: entryData.entryNumber,
        referenceId: entryId,
        idempotencyKey: `rec_purch_${entryId}`,
        purpose: `Chemical Purchase Inward - ${entryData.supplierName || 'Supplier'}`,
        receivedFrom: entryData.supplierName || null,
        date: receivedDate,
        remarks: entryData.remarks || 'Stock received and inwarded from purchase entry',
        createdBy: user.uid,
        createdByName: user.displayName || 'Authorized User',
        createdAt: now
      });

      const updatedRecord: ChemicalEntryRecord = {
        ...entryData,
        isReceived: true,
        receivedDate,
        stockTransactionId: txDocRef.id,
        stockTransactionNumber: txNumber,
        stockUpdated: true,
        updatedAt: now
      };

      txn.set(entryDocRef, updatedRecord);

      // Update cache
      const current = this.getCache();
      this.setCache(current.map((e) => (e.id === updatedRecord.id ? updatedRecord : e)));

      return updatedRecord;
    });
  }

  /**
   * 7. Delete / Revert Chemical Entry
   */
  static async deleteEntry(
    entryId: string,
    user: { uid: string; displayName?: string }
  ): Promise<void> {
    // A. Attempt via Firebase Cloud Function
    try {
      if (functions) {
        const fn = httpsCallable(functions, 'deleteChemicalEntry');
        const res: any = await fn({ entryId });
        if (res.data?.success) {
          const current = this.getCache();
          this.setCache(current.filter((e) => e.id !== entryId));
          return;
        }
      }
    } catch (cfErr) {
      console.warn('deleteChemicalEntry Cloud Function failed, running client transaction:', cfErr);
    }

    // B. Direct Atomic Firestore Transaction Fallback
    const now = new Date().toISOString();
    const entryDocRef = doc(db, 'chemical_entries', entryId);

    await runTransaction(db, async (txn) => {
      const entrySnap = await txn.get(entryDocRef);
      if (!entrySnap.exists()) return;

      const entryData = entrySnap.data() as ChemicalEntryRecord;
      const { itemId, quantity, entryType, stockUpdated } = entryData;
      const numericQty = parseFloat(String(quantity || 0));

      if (stockUpdated && itemId && numericQty > 0) {
        const itemDocRef = doc(db, 'items', itemId);
        const stockDocRef = doc(db, 'warehouse_stock', `stock_${itemId}`);

        const stockSnap = await txn.get(stockDocRef);
        const itemSnap = await txn.get(itemDocRef);

        let currentStock = 0;
        let currentAvgRate = 0;
        if (stockSnap.exists()) {
          const sData = stockSnap.data();
          currentStock = parseFloat(String(sData?.availableStock || 0));
          currentAvgRate = parseFloat(String(sData?.averageRate || 0));
        }
        if (itemSnap.exists()) {
          const iData = itemSnap.data();
          if (!stockSnap.exists()) {
            currentStock = parseFloat(String(iData?.currentStock || 0));
          }
          if (currentAvgRate <= 0) {
            currentAvgRate = parseFloat(String(iData?.defaultPurchaseRate || iData?.lastPurchaseRate || 0));
          }
        }
        if (isNaN(currentStock)) currentStock = 0;
        if (isNaN(currentAvgRate)) currentAvgRate = 0;

        let restoredStock = currentStock;
        let finalAvgRate = currentAvgRate;
        let finalTotalAmount = Math.round(currentStock * currentAvgRate * 100) / 100;

        if (entryType === 'Consumption') {
          // Revert consumption: ADD the consumed quantity back into warehouse stock
          restoredStock = Math.round((currentStock + numericQty) * 1000) / 1000;

          // Alter warehouse amount and calculate weighted average rate
          const entryRate = parseFloat(String(entryData.rate || 0)) || currentAvgRate;
          const restoredAmount = (Number(entryData.totalAmount) > 0)
            ? Number(entryData.totalAmount)
            : Math.round(numericQty * entryRate * 100) / 100;

          finalTotalAmount = Math.round((currentStock * currentAvgRate + restoredAmount) * 100) / 100;
          finalAvgRate = restoredStock > 0
            ? Math.round((finalTotalAmount / restoredStock) * 100) / 100
            : currentAvgRate;
        } else if (entryType === 'Purchase') {
          // Revert purchase addition: deduct quantity from warehouse stock
          restoredStock = Math.max(0, Math.round((currentStock - numericQty) * 1000) / 1000);

          const purchaseAmount = (Number(entryData.totalAmount) > 0)
            ? Number(entryData.totalAmount)
            : Math.round(numericQty * (parseFloat(String(entryData.rate || 0)) || currentAvgRate) * 100) / 100;

          finalTotalAmount = Math.max(0, Math.round((currentStock * currentAvgRate - purchaseAmount) * 100) / 100);
          finalAvgRate = restoredStock > 0
            ? Math.round((finalTotalAmount / restoredStock) * 100) / 100
            : 0;
        }

        // Update warehouse_stock with new quantity, average rate and total valuation
        txn.set(
          stockDocRef,
          {
            availableStock: restoredStock,
            averageRate: finalAvgRate,
            totalValue: finalTotalAmount,
            updatedAt: now,
            updatedBy: user.uid
          },
          { merge: true }
        );

        // Synchronize Item Master
        if (itemSnap.exists()) {
          txn.update(itemDocRef, {
            currentStock: restoredStock,
            defaultPurchaseRate: finalAvgRate > 0 ? finalAvgRate : (itemSnap.data()?.defaultPurchaseRate || 0),
            lastPurchaseRate: finalAvgRate > 0 ? finalAvgRate : (itemSnap.data()?.lastPurchaseRate || 0),
            updatedAt: now,
            updatedBy: user.uid,
            updatedByName: user.displayName || 'Authorized User'
          });
        }

        // Record reversal stock transaction
        const txDocRef = doc(collection(db, 'stock_transactions'));
        const isConsumption = entryType === 'Consumption';
        txn.set(txDocRef, {
          id: txDocRef.id,
          transactionNumber: `TX-REV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
          itemId,
          itemCode: itemSnap.exists() ? itemSnap.data()?.itemCode : (entryData.itemCode || ''),
          itemName: itemSnap.exists() ? itemSnap.data()?.itemName : (entryData.chemicalName || ''),
          categoryName: itemSnap.exists() ? itemSnap.data()?.categoryName : ((entryData as any).categoryName || ''),
          baseUnit: entryData.unit || (itemSnap.exists() ? itemSnap.data()?.baseUnit : 'kg'),
          type: isConsumption ? 'INWARD' : 'OUTWARD',
          source: 'ADJUSTMENT',
          quantity: numericQty,
          previousStock: currentStock,
          newStock: restoredStock,
          referenceNumber: entryData.entryNumber || entryId,
          referenceId: entryId,
          purpose: `Reversal of deleted ${entryData.materialType === 'wood' ? 'raw wood' : 'chemical'} ${isConsumption ? 'consumption' : 'purchase'} ${entryData.entryNumber || ''}`,
          date: now.split('T')[0],
          remarks: `Stock restored upon deletion of ${entryData.entryNumber || 'entry'}. New Avg Cost: ₹${finalAvgRate}, New Total Value: ₹${finalTotalAmount}`,
          createdBy: user.uid,
          createdByName: user.displayName || 'Authorized User',
          createdAt: now
        });
      }

      txn.delete(entryDocRef);
    });

    const current = this.getCache();
    this.setCache(current.filter((e) => e.id !== entryId));
  }
}
