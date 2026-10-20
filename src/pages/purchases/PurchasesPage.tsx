import React, { useState, useEffect } from 'react';
import { MasterItem } from '../../types/item';
import { Vendor } from '../../types/vendor';
import { ItemService } from '../../services/itemService';
import { VendorService } from '../../services/vendorService';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Table, Column } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { StatusChip } from '../../components/ui/StatusChip';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { ShoppingBag, Plus, Truck, CheckCircle2, AlertCircle } from 'lucide-react';

interface PurchaseReceipt {
  id: string;
  date: string;
  type: 'Chemical Purchase' | 'Firewood Delivery' | 'Raw Material Purchase';
  vendorId: string;
  vendor: string;
  itemId: string;
  itemCode: string;
  item: string;
  qty: string;
  numericQty: number;
  unit: string;
  invoiceNo: string;
  vehicleNo?: string;
  driverName?: string;
  rate: number;
  amount: number;
  status: 'Posted to Stock' | 'Pending Verification';
}

export const PurchasesPage: React.FC = () => {
  const [purchases, setPurchases] = useState<PurchaseReceipt[]>([
    {
      id: 'pur1',
      date: '2026-02-02',
      type: 'Chemical Purchase',
      vendorId: 'v-101',
      vendor: 'Sree Kumar Texind Corporation',
      itemId: 'item-chm-01',
      itemCode: 'CHM-ENZ-01',
      item: 'Neutral Bio-Enzyme Powder',
      qty: '200 kg',
      numericQty: 200,
      unit: 'kg',
      invoiceNo: 'INV-SKT-901',
      rate: 160,
      amount: 32000,
      status: 'Posted to Stock'
    },
    {
      id: 'pur2',
      date: '2026-02-04',
      type: 'Firewood Delivery',
      vendorId: 'v-102',
      vendor: 'Paramount Apparel Processing',
      itemId: 'item-fwd-01',
      itemCode: 'FWD-CAS-01',
      item: 'Casuarina Firewood Logs (Boiler Fuel)',
      qty: '10.5 t',
      numericQty: 10.5,
      unit: 't',
      invoiceNo: 'DC-WOOD-44',
      vehicleNo: 'TN-22-BY-8901',
      driverName: 'S. Shanmugam',
      rate: 4500,
      amount: 47250,
      status: 'Posted to Stock'
    }
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [items, setItems] = useState<MasterItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  // Form State
  const [purchaseType, setPurchaseType] = useState<PurchaseReceipt['type']>('Chemical Purchase');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [quantity, setQuantity] = useState(100);
  const [rate, setRate] = useState(160);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    Promise.all([
      ItemService.getItems({ status: 'active' }, { page: 1, pageSize: 500 }),
      VendorService.getVendors({}, { page: 1, pageSize: 200 })
    ]).then(([itemsRes, vendorsRes]) => {
      setItems(itemsRes.items || []);
      setVendors(vendorsRes.vendors || []);
      if (itemsRes.items?.length > 0) {
        setSelectedItemId(itemsRes.items[0].id);
        setRate(itemsRes.items[0].defaultPurchaseRate || 100);
      }
      if (vendorsRes.vendors?.length > 0) {
        setSelectedVendorId(vendorsRes.vendors[0].id || vendorsRes.vendors[0].vendorId);
      }
    });
  }, []);

  const handleItemSelect = (id: string) => {
    setSelectedItemId(id);
    const it = items.find((i) => i.id === id);
    if (it) {
      if (it.defaultPurchaseRate) setRate(it.defaultPurchaseRate);
      if (it.preferredSupplierId) setSelectedVendorId(it.preferredSupplierId);
      if (it.itemType === 'firewood') setPurchaseType('Firewood Delivery');
      else if (it.itemType === 'chemical') setPurchaseType('Chemical Purchase');
      else setPurchaseType('Raw Material Purchase');
    }
  };

  const handleCreatePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    const it = items.find((i) => i.id === selectedItemId);
    const ven = vendors.find((v) => v.id === selectedVendorId || v.vendorId === selectedVendorId);
    if (!it) return;

    const unit = it.baseUnit || 'kg';
    const totalAmount = quantity * rate;

    const newPurchase: PurchaseReceipt = {
      id: `pur-${Date.now()}`,
      date,
      type: purchaseType,
      vendorId: ven?.id || ven?.vendorId || 'direct',
      vendor: ven?.companyName || 'Direct Vendor',
      itemId: it.id,
      itemCode: it.itemCode,
      item: it.itemName,
      qty: `${quantity} ${unit}`,
      numericQty: quantity,
      unit,
      invoiceNo: invoiceNo || `INV-${Date.now().toString().slice(-4)}`,
      vehicleNo: purchaseType === 'Firewood Delivery' ? vehicleNo : undefined,
      driverName: purchaseType === 'Firewood Delivery' ? driverName : undefined,
      rate,
      amount: totalAmount,
      status: 'Posted to Stock'
    };

    setPurchases([newPurchase, ...purchases]);
    setIsModalOpen(false);
    setInvoiceNo('');
    setVehicleNo('');
  };

  const columns: Column<PurchaseReceipt>[] = [
    { header: 'Date', accessor: (row) => formatDate(row.date) },
    { header: 'Purchase Category', accessor: 'type', className: 'font-bold text-[#1F4E79]' },
    { header: 'Supplier / Vendor', accessor: 'vendor' },
    {
      header: 'Item / Material',
      accessor: (row) => (
        <div>
          <span className="font-bold text-slate-900 block text-xs">{row.item}</span>
          <span className="text-[11px] text-[#1F4E79] font-mono">{row.itemCode}</span>
        </div>
      )
    },
    { header: 'Delivered Qty', accessor: 'qty', className: 'font-bold' },
    {
      header: 'Supplier Invoice / DC',
      accessor: (row) => (
        <div>
          <span className="text-xs font-semibold text-slate-800">{row.invoiceNo}</span>
          {row.vehicleNo && <span className="text-[11px] text-slate-400 block font-mono">{row.vehicleNo}</span>}
        </div>
      )
    },
    { header: 'Amount', accessor: (row) => formatCurrency(row.amount), className: 'font-extrabold' },
    { header: 'Inventory Status', accessor: (row) => <StatusChip status={row.status} variant="green" /> }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-[#1F4E79] flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#1F4E79]" />
            Raw Material & Firewood Purchases
          </h2>
          <p className="text-xs text-slate-500">
            Record chemical acquisitions, supplier invoices, and firewood weighbridge receipts linked with Master Items
          </p>
        </div>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setIsModalOpen(true)}>
          New Purchase Receipt
        </Button>
      </div>

      <Card>
        <Table columns={columns} data={purchases} keyExtractor={(row) => row.id} />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Record Material / Fuel Purchase Receipt" maxWidth="lg">
        <form onSubmit={handleCreatePurchase} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Purchase Category
              </label>
              <select
                value={purchaseType}
                onChange={(e) => setPurchaseType(e.target.value as any)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs font-medium"
              >
                <option value="Chemical Purchase">Chemical Purchase</option>
                <option value="Firewood Delivery">Firewood Weighbridge Delivery</option>
                <option value="Raw Material Purchase">Raw Material / Packaging</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Material from Item Master <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedItemId}
                onChange={(e) => handleItemSelect(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs font-medium"
                required
              >
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    [{it.itemCode}] {it.itemName} ({it.baseUnit})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Supplier (Vendor Master) <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedVendorId}
                onChange={(e) => setSelectedVendorId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs font-medium"
                required
              >
                {vendors.map((v) => (
                  <option key={v.id || v.vendorId} value={v.id || v.vendorId}>
                    {v.companyName}
                  </option>
                ))}
              </select>
            </div>

            <Input label="Receipt / Delivery Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>

          <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <Input
              label="Delivered Quantity"
              type="number"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              required
            />
            <Input
              label="Purchase Rate (₹)"
              type="number"
              step="0.01"
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              required
            />
            <div>
              <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Computed Total
              </span>
              <span className="text-base font-extrabold text-slate-900 block mt-1.5">
                {formatCurrency(quantity * rate)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Supplier Invoice / Delivery Challan"
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              placeholder="e.g. INV-2026-904"
              required
            />

            {purchaseType === 'Firewood Delivery' ? (
              <Input
                label="Lorry / Vehicle Number"
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value)}
                placeholder="e.g. TN-22-AB-1234"
                required
              />
            ) : (
              <Input
                label="Batch / Lot Number (Optional)"
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value)}
                placeholder="e.g. BATCH-2026-09"
              />
            )}
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" icon={<CheckCircle2 className="w-4 h-4" />}>
              Save Purchase Receipt
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
