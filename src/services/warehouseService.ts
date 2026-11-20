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
  WarehouseItemStock,
  StockTransaction,
  IssueMaterialPayload,
  InwardMaterialPayload,
  WarehouseDashboardMetrics,
  WarehouseFilterOptions,
  TransactionFilterOptions
} from '../types/warehouse';
import { ItemService } from './itemService';

const WAREHOUSE_STOCK_KEY = 'perla_warehouse_stock';
const TRANSACTIONS_KEY = 'perla_warehouse_transactions';

const DUMMY_IDS = [
  'item-chm-01',
  'item-chm-02',
  'item-fwd-01',
  'item-raw-01',
  'itm-1',
  'itm-2',
  'itm-3',
  'itm-4',
  'itm-5'
];

function cleanItemData(list: any[]): any[] {
  return list.filter((it) => {
    if (!it) return false;
    const name = (it.itemName || it.name || '').trim();
    const code = (it.itemCode || it.code || '').trim();
    const isDummy =
      DUMMY_IDS.includes(it.id) ||
      DUMMY_IDS.includes(it.itemId) ||
      (typeof it.id === 'string' && it.id.startsWith('itm-')) ||
      (typeof it.itemId === 'string' && it.itemId.startsWith('itm-'));
    return Boolean(name) && Boolean(code) && !isDummy;
  });
}

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

export class WarehouseService {
  /**
   * Retrieves all items with their current stock and minimum stock levels
   */
  static async getStockItems(filters?: WarehouseFilterOptions): Promise<WarehouseItemStock[]> {
    let stockList: WarehouseItemStock[] = [];

    try {
      // 1. Fetch master items directly from Firestore items collection
      const itemsSnap = await getDocs(collection(db, 'items'));
      const items: any[] = [];
      if (!itemsSnap.empty) {
        itemsSnap.docs.forEach((d) => {
          const data = d.data();
          const docId = d.id;
          const rawName = (data.itemName || data.name || '').trim();
          const rawCode = (data.itemCode || data.code || '').trim();
          const rawUnit = (data.baseUnit || data.unit || 'kg').trim();
          const status = data.status || (data.active === false ? 'inactive' : 'active');

          const isDummy =
            DUMMY_IDS.includes(docId) ||
            DUMMY_IDS.includes(data.itemId) ||
            docId.startsWith('itm-') ||
            docId.startsWith('item-chm-') ||
            docId.startsWith('item-fwd-') ||
            docId.startsWith('item-raw-');

          if (isDummy) {
            // Delete legacy dummy doc from Firestore in background
            deleteDoc(doc(db, 'items', docId)).catch(() => {});
            return;
          }

          // Only keep valid active items with a name and code from Item Master
          if (rawName && rawCode && status === 'active') {
            items.push({
              ...data,
              id: docId,
              itemId: data.itemId || docId,
              itemCode: rawCode,
              itemName: rawName,
              baseUnit: rawUnit,
              status: 'active'
            });
          }
        });
      }

      // If itemsSnap was empty, fallback to ItemService
      if (items.length === 0) {
        const itemRes = await ItemService.getItems({ status: 'active' }, { page: 1, pageSize: 500 });
        (itemRes.items || []).forEach((it) => {
          const rawName = (it.itemName || (it as any).name || '').trim();
          const rawCode = (it.itemCode || (it as any).code || '').trim();
          const isDummy = DUMMY_IDS.includes(it.id) || it.id.startsWith('itm-');
          if (rawName && rawCode && it.status === 'active' && !isDummy) {
            items.push({
              ...it,
              itemName: rawName,
              itemCode: rawCode
            });
          }
        });
      }

      // 2. Fetch warehouse_stock records
      const snap = await getDocs(collection(db, 'warehouse_stock'));
      const stockMap = new Map<string, any>();
      snap.docs.forEach((d) => {
        stockMap.set(d.id, d.data());
      });

      // 3. Fetch latest inward dates from transactions if available
      const txSnap = await getDocs(
        query(collection(db, 'stock_transactions'), where('type', '==', 'INWARD'), limit(100))
      );
      const lastInwardMap = new Map<string, string>();
      txSnap.docs.forEach((t) => {
        const txData = t.data();
        if (txData.itemId && txData.date) {
          const cur = lastInwardMap.get(txData.itemId);
          if (!cur || txData.date > cur) {
            lastInwardMap.set(txData.itemId, txData.date);
          }
        }
      });

      // 4. Fetch purchase rate history to calculate average cost:
      // (previous purchase cost + most recent purchase cost) / 2
      const itemPurchaseRatesMap = new Map<string, number[]>();
      try {
        const purchaseSnap = await getDocs(
          query(collection(db, 'raw_material_purchases'), orderBy('purchaseDate', 'asc'), limit(500))
        );
        purchaseSnap.docs.forEach((docSnap) => {
          const pData = docSnap.data();
          if (Array.isArray(pData.lines)) {
            pData.lines.forEach((l: any) => {
              const r = Number(l.rate || 0);
              if (l.itemId && r > 0) {
                const rates = itemPurchaseRatesMap.get(l.itemId) || [];
                rates.push(r);
                itemPurchaseRatesMap.set(l.itemId, rates);
              }
            });
          }
        });
      } catch (pErr) {
        console.warn('Could not load purchase rate history:', pErr);
      }

      // 5. Merge master items with warehouse stock
      stockList = items.map((item) => {
        const stockDocId = `stock_${item.id}`;
        const wsData = stockMap.get(stockDocId) || stockMap.get(item.id);

        const available = wsData?.availableStock !== undefined
          ? Number(wsData.availableStock)
          : Number(item.currentStock || 0);

        const minStock = wsData?.minimumStockLevel !== undefined
          ? Number(wsData.minimumStockLevel)
          : Number(item.minimumStockLevel || 0);

        // Calculate average cost: take most recent purchase cost and previous cost, and average them
        const rates = itemPurchaseRatesMap.get(item.id) || itemPurchaseRatesMap.get(item.itemId) || [];
        const existingAvg = Number(wsData?.averageRate || 0);
        let calculatedAvg = existingAvg;

        if (rates.length > 0) {
          if (rates.length === 1) {
            const recentCost = rates[0];
            const prevCost = Number(item.defaultPurchaseRate || item.lastPurchaseRate || 0);
            if (prevCost > 0 && prevCost !== recentCost) {
              calculatedAvg = Math.round(((prevCost + recentCost) / 2) * 100) / 100;
            } else {
              calculatedAvg = recentCost;
            }
          } else {
            // Take the most recent purchase cost and previous purchase cost, and average them
            const recentCost = rates[rates.length - 1];
            const previousCost = rates[rates.length - 2];
            calculatedAvg = Math.round(((previousCost + recentCost) / 2) * 100) / 100;
          }
        } else if (existingAvg > 0) {
          calculatedAvg = existingAvg;
        } else {
          calculatedAvg = Number(item.defaultPurchaseRate || item.lastPurchaseRate || 0);
        }

        const avgRate = calculatedAvg;
        const lastInward = wsData?.lastInwardDate || lastInwardMap.get(item.id) || item.lastInwardDate || undefined;

        // Persist to warehouse_stock if averageRate is not set or changed
        if (avgRate > 0 && (!wsData?.averageRate || wsData.averageRate !== avgRate)) {
          setDoc(
            doc(db, 'warehouse_stock', stockDocId),
            {
              averageRate: avgRate,
              totalValue: Math.round(available * avgRate * 100) / 100,
              updatedAt: new Date().toISOString()
            },
            { merge: true }
          ).catch((e) => console.warn('Sync averageRate to warehouse_stock failed:', e));
        }

        let health: 'Healthy' | 'Low Stock' | 'Critical' | 'Out Of Stock' = 'Healthy';
        if (available <= 0) {
          health = 'Out Of Stock';
        } else if (minStock <= 0) {
          health = 'Healthy';
        } else if (available >= minStock) {
          health = 'Healthy';
        } else if (available >= minStock * 0.4) {
          health = 'Low Stock';
        } else {
          health = 'Critical';
        }

        return {
          id: stockDocId,
          itemId: item.id,
          itemCode: item.itemCode || '',
          itemName: item.itemName || '',
          categoryId: item.categoryId || '',
          categoryName: item.categoryName || '',
          baseUnit: item.baseUnit || '',
          availableStock: Math.max(0, available),
          minimumStockLevel: Math.max(0, minStock),
          reorderLevel: wsData?.reorderLevel || minStock,
          healthStatus: health,
          averageRate: Number(avgRate) || 0,
          storageLocation: wsData?.storageLocation || 'Main Warehouse',
          lastInwardDate: lastInward,
          lastOutwardDate: wsData?.lastOutwardDate || undefined,
          updatedAt: wsData?.updatedAt || item.updatedAt || new Date().toISOString(),
          updatedBy: wsData?.updatedBy || item.updatedBy || 'System'
        };
      });

      stockList = cleanItemData(stockList);
      safeSetStorage(WAREHOUSE_STOCK_KEY, JSON.stringify(stockList));
    } catch (err) {
      console.warn('Firestore getStockItems error, fallback to cache:', err);
      const cached = safeGetStorage(WAREHOUSE_STOCK_KEY);
      if (cached) {
        try {
          stockList = cleanItemData(JSON.parse(cached));
        } catch {
          stockList = [];
        }
      }
    }

    // Apply filtering
    let filtered = [...stockList];
    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      filtered = filtered.filter(
        (it) =>
          it.itemName.toLowerCase().includes(q) ||
          it.itemCode.toLowerCase().includes(q) ||
          it.categoryName.toLowerCase().includes(q)
      );
    }

    if (filters?.categoryId && filters.categoryId !== 'ALL') {
      filtered = filtered.filter(
        (it) => it.categoryId === filters.categoryId || it.categoryName === filters.categoryId
      );
    }

    if (filters?.lowStockOnly) {
      filtered = filtered.filter((it) => it.availableStock <= it.minimumStockLevel);
    }

    return filtered;
  }

  /**
   * Retrieves stock transactions ledger
   */
  static async getStockTransactions(filters?: TransactionFilterOptions): Promise<StockTransaction[]> {
    let transactions: StockTransaction[] = [];

    try {
      const q = query(collection(db, 'stock_transactions'), orderBy('createdAt', 'desc'), limit(150));
      const snap = await getDocs(q);

      transactions = snap.docs.map((d) => ({
        id: d.id,
        ...d.data()
      })) as StockTransaction[];

      safeSetStorage(TRANSACTIONS_KEY, JSON.stringify(transactions));
    } catch (err) {
      console.warn('Firestore getStockTransactions error, fallback to cache:', err);
      const cached = safeGetStorage(TRANSACTIONS_KEY);
      if (cached) {
        try {
          transactions = JSON.parse(cached);
        } catch {
          transactions = [];
        }
      }
    }

    let filtered = [...transactions];

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      filtered = filtered.filter(
        (tx) =>
          tx.itemName.toLowerCase().includes(q) ||
          tx.itemCode.toLowerCase().includes(q) ||
          tx.transactionNumber.toLowerCase().includes(q) ||
          tx.referenceNumber.toLowerCase().includes(q) ||
          (tx.purpose && tx.purpose.toLowerCase().includes(q)) ||
          (tx.issuedTo && tx.issuedTo.toLowerCase().includes(q))
      );
    }

    if (filters?.itemId && filters.itemId !== 'ALL') {
      filtered = filtered.filter((tx) => tx.itemId === filters.itemId);
    }

    if (filters?.type && filters.type !== 'ALL') {
      filtered = filtered.filter((tx) => tx.type === filters.type);
    }

    if (filters?.startDate) {
      filtered = filtered.filter((tx) => tx.date >= filters.startDate!);
    }

    if (filters?.endDate) {
      filtered = filtered.filter((tx) => tx.date <= filters.endDate!);
    }

    return filtered;
  }

  /**
   * Issue materials from the warehouse (Stock Outward)
   * Validates available balance to strictly prevent over-issuing.
   */
  static async issueMaterial(
    payload: IssueMaterialPayload,
    user: { uid: string; name: string }
  ): Promise<StockTransaction> {
    if (!payload.itemId) {
      throw new Error('Please select an item to issue.');
    }
    const issueQty = Number(payload.quantity);
    if (!issueQty || issueQty <= 0) {
      throw new Error('Issue quantity must be greater than zero.');
    }
    if (!payload.purpose || !payload.purpose.trim()) {
      throw new Error('Purpose of issue is required.');
    }
    if (!payload.issuedTo || !payload.issuedTo.trim()) {
      throw new Error('Recipient / person responsible is required.');
    }

    // Try Cloud Function first if available
    try {
      if (functions) {
        const fn = httpsCallable(functions, 'recordStockTransaction');
        const res: any = await fn({
          itemId: payload.itemId,
          type: 'OUTWARD',
          source: 'SHOPFLOOR_ISSUE',
          quantity: issueQty,
          date: payload.date || new Date().toISOString().split('T')[0],
          purpose: payload.purpose.trim(),
          issuedTo: payload.issuedTo.trim(),
          referenceNumber: payload.referenceNumber || `ISSUE-${Date.now().toString().slice(-6)}`,
          remarks: payload.remarks || ''
        });
        if (res.data?.success && res.data?.transaction) {
          return res.data.transaction as StockTransaction;
        }
      }
    } catch (cfErr: any) {
      console.warn('recordStockTransaction Cloud Function unavailable, executing direct transaction:', cfErr);
      // Fall through to atomic client Firestore transaction
    }

    // Direct atomic Firestore transaction
    return await runTransaction(db, async (txn) => {
      const stockDocRef = doc(db, 'warehouse_stock', `stock_${payload.itemId}`);
      const itemDocRef = doc(db, 'items', payload.itemId);

      const [stockSnap, itemSnap] = await Promise.all([
        txn.get(stockDocRef),
        txn.get(itemDocRef)
      ]);

      if (!itemSnap.exists()) {
        throw new Error('Item record not found in Item Master.');
      }

      const itemData = itemSnap.data();
      const currentStock = stockSnap.exists()
        ? Number(stockSnap.data()?.availableStock || 0)
        : Number(itemData?.currentStock || 0);

      if (currentStock < issueQty) {
        throw new Error(
          `Cannot issue ${issueQty} ${itemData.baseUnit || ''}. Only ${currentStock} ${itemData.baseUnit || ''} available in stock.`
        );
      }

      const newStock = Math.max(0, currentStock - issueQty);
      const nowIso = new Date().toISOString();
      const txId = `stk_tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const txNumber = `TX-OUT-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

      const transactionRecord: StockTransaction = {
        id: txId,
        transactionNumber: txNumber,
        itemId: payload.itemId,
        itemCode: itemData.itemCode || '',
        itemName: itemData.itemName || '',
        categoryName: itemData.categoryName || '',
        baseUnit: itemData.baseUnit || '',
        type: 'OUTWARD',
        source: 'SHOPFLOOR_ISSUE',
        quantity: issueQty,
        previousStock: currentStock,
        newStock: newStock,
        referenceNumber: payload.referenceNumber || txNumber,
        purpose: payload.purpose.trim(),
        issuedTo: payload.issuedTo.trim(),
        date: payload.date || nowIso.split('T')[0],
        remarks: payload.remarks || '',
        createdBy: user.uid,
        createdByName: user.name,
        createdAt: nowIso
      };

      // 1. Update warehouse_stock
      txn.set(
        stockDocRef,
        {
          id: `stock_${payload.itemId}`,
          itemId: payload.itemId,
          itemCode: itemData.itemCode || '',
          itemName: itemData.itemName || '',
          categoryId: itemData.categoryId || '',
          categoryName: itemData.categoryName || '',
          baseUnit: itemData.baseUnit || '',
          availableStock: newStock,
          minimumStockLevel: Number(itemData.minimumStockLevel || 0),
          lastOutwardDate: transactionRecord.date,
          updatedAt: nowIso,
          updatedBy: user.name
        },
        { merge: true }
      );

      // 2. Synchronize currentStock in items collection
      txn.update(itemDocRef, {
        currentStock: newStock,
        updatedAt: nowIso,
        updatedBy: user.name
      });

      // 3. Save stock transaction ledger
      const txRef = doc(db, 'stock_transactions', txId);
      txn.set(txRef, transactionRecord);

      return transactionRecord;
    });
  }

  /**
   * Add stock received into warehouse (Stock Inward)
   * Idempotent check ensures duplicate purchase receipts are not posted multiple times.
   */
  static async inwardMaterial(
    payload: InwardMaterialPayload,
    user: { uid: string; name: string }
  ): Promise<StockTransaction> {
    if (!payload.itemId) {
      throw new Error('Please select an item for stock inward.');
    }
    const inwardQty = Number(payload.quantity);
    if (!inwardQty || inwardQty <= 0) {
      throw new Error('Inward quantity must be greater than zero.');
    }
    if (!payload.referenceNumber || !payload.referenceNumber.trim()) {
      throw new Error('Reference number (e.g. Purchase No, DC No) is required.');
    }

    // Try Cloud Function first
    try {
      if (functions) {
        const fn = httpsCallable(functions, 'recordStockTransaction');
        const res: any = await fn({
          itemId: payload.itemId,
          type: 'INWARD',
          source: payload.source || 'MANUAL_INWARD',
          quantity: inwardQty,
          date: payload.date || new Date().toISOString().split('T')[0],
          referenceNumber: payload.referenceNumber.trim(),
          referenceId: payload.referenceId || null,
          idempotencyKey: payload.idempotencyKey || null,
          receivedFrom: payload.receivedFrom || '',
          remarks: payload.remarks || ''
        });
        if (res.data?.success && res.data?.transaction) {
          return res.data.transaction as StockTransaction;
        }
      }
    } catch (cfErr: any) {
      console.warn('recordStockTransaction Cloud Function unavailable, running direct transaction:', cfErr);
    }

    // Direct atomic Firestore transaction
    return await runTransaction(db, async (txn) => {
      // Idempotency check if idempotencyKey provided
      if (payload.idempotencyKey) {
        const existingTxnSnap = await getDocs(
          query(
            collection(db, 'stock_transactions'),
            where('idempotencyKey', '==', payload.idempotencyKey),
            limit(1)
          )
        );
        if (!existingTxnSnap.empty) {
          const existing = existingTxnSnap.docs[0].data() as StockTransaction;
          return existing;
        }
      }

      const stockDocRef = doc(db, 'warehouse_stock', `stock_${payload.itemId}`);
      const itemDocRef = doc(db, 'items', payload.itemId);

      const [stockSnap, itemSnap] = await Promise.all([
        txn.get(stockDocRef),
        txn.get(itemDocRef)
      ]);

      if (!itemSnap.exists()) {
        throw new Error('Item record not found in Item Master.');
      }

      const itemData = itemSnap.data();
      const currentStock = stockSnap.exists()
        ? Number(stockSnap.data()?.availableStock || 0)
        : Number(itemData?.currentStock || 0);

      const newStock = currentStock + inwardQty;
      const nowIso = new Date().toISOString();
      const txId = `stk_tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const txNumber = `TX-IN-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

      const transactionRecord: StockTransaction = {
        id: txId,
        transactionNumber: txNumber,
        itemId: payload.itemId,
        itemCode: itemData.itemCode || '',
        itemName: itemData.itemName || '',
        categoryName: itemData.categoryName || '',
        baseUnit: itemData.baseUnit || '',
        type: 'INWARD',
        source: payload.source || 'MANUAL_INWARD',
        quantity: inwardQty,
        previousStock: currentStock,
        newStock: newStock,
        referenceNumber: payload.referenceNumber.trim(),
        referenceId: payload.referenceId,
        idempotencyKey: payload.idempotencyKey,
        receivedFrom: payload.receivedFrom || '',
        date: payload.date || nowIso.split('T')[0],
        remarks: payload.remarks || '',
        createdBy: user.uid,
        createdByName: user.name,
        createdAt: nowIso
      };

      // Calculate Average Cost: (previous cost + most recent purchase cost) / 2
      const previousCost = Number(
        stockSnap.data()?.averageRate ||
        itemData?.defaultPurchaseRate ||
        (itemData as any)?.lastPurchaseRate ||
        0
      );
      const recentCost = Number(payload.rate || 0);

      let newAvgCost = previousCost;
      if (recentCost > 0) {
        if (previousCost > 0) {
          newAvgCost = Math.round(((previousCost + recentCost) / 2) * 100) / 100;
        } else {
          newAvgCost = Math.round(recentCost * 100) / 100;
        }
      }

      // 1. Update warehouse_stock
      txn.set(
        stockDocRef,
        {
          id: `stock_${payload.itemId}`,
          itemId: payload.itemId,
          itemCode: itemData.itemCode || '',
          itemName: itemData.itemName || '',
          categoryId: itemData.categoryId || '',
          categoryName: itemData.categoryName || '',
          baseUnit: itemData.baseUnit || '',
          availableStock: newStock,
          averageRate: newAvgCost,
          totalValue: Math.round(newStock * newAvgCost * 100) / 100,
          minimumStockLevel: Number(itemData.minimumStockLevel || 0),
          lastInwardDate: transactionRecord.date,
          updatedAt: nowIso,
          updatedBy: user.name
        },
        { merge: true }
      );

      // 2. Synchronize currentStock and rates in items collection
      txn.update(itemDocRef, {
        currentStock: newStock,
        defaultPurchaseRate: newAvgCost,
        lastPurchaseRate: recentCost > 0 ? recentCost : ((itemData as any)?.lastPurchaseRate || previousCost),
        updatedAt: nowIso,
        updatedBy: user.name
      });

      // 3. Save stock transaction ledger
      const txRef = doc(db, 'stock_transactions', txId);
      txn.set(txRef, transactionRecord);

      return transactionRecord;
    });
  }

  /**
   * Updates minimum stock level for low-stock alerts
   */
  static async updateMinimumStock(
    itemId: string,
    minimumStockLevel: number,
    user: { uid: string; name: string }
  ): Promise<void> {
    const minVal = Math.max(0, Number(minimumStockLevel) || 0);
    const nowIso = new Date().toISOString();

    const stockDocRef = doc(db, 'warehouse_stock', `stock_${itemId}`);
    const itemDocRef = doc(db, 'items', itemId);

    await Promise.all([
      setDoc(
        stockDocRef,
        {
          minimumStockLevel: minVal,
          reorderLevel: minVal,
          updatedAt: nowIso,
          updatedBy: user.name
        },
        { merge: true }
      ),
      updateDoc(itemDocRef, {
        minimumStockLevel: minVal,
        updatedAt: nowIso,
        updatedBy: user.name
      })
    ]);
  }

  /**
   * Calculates dashboard summary metrics
   */
  static async getDashboardMetrics(): Promise<WarehouseDashboardMetrics> {
    const [stocks, transactions] = await Promise.all([
      this.getStockItems(),
      this.getStockTransactions()
    ]);

    const totalAvailableItems = stocks.filter((s) => s.availableStock > 0).length;
    const lowStockItems = stocks.filter((s) => s.availableStock <= s.minimumStockLevel);
    const inwardTxs = transactions.filter((t) => t.type === 'INWARD');
    const outwardTxs = transactions.filter((t) => t.type === 'OUTWARD');
    const totalVolume = stocks.reduce((acc, curr) => acc + curr.availableStock, 0);

    return {
      totalAvailableItems,
      lowStockItemsCount: lowStockItems.length,
      totalInwardTransactions: inwardTxs.length,
      totalOutwardTransactions: outwardTxs.length,
      totalStockVolume: Math.round(totalVolume * 100) / 100,
      recentInwards: inwardTxs.slice(0, 5),
      recentOutwards: outwardTxs.slice(0, 5)
    };
  }
}

