import React, { useState } from 'react';
import { PurchaseOrder, POLine, ProcessCategory, RateBasis, UnitType } from '../../types/po';
import { Vendor } from '../../types/vendor';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Table, Column } from '../../components/ui/Table';
import { StatusChip } from '../../components/ui/StatusChip';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { formatCurrency, formatQuantity, formatDate } from '../../utils/formatters';
import { Plus, Trash2, FileText, CheckCircle2 } from 'lucide-react';

interface PurchaseOrdersPageProps {
  pos: PurchaseOrder[];
  vendors: Vendor[];
  onAddPo: (newPo: PurchaseOrder) => void;
}

export const PurchaseOrdersPage: React.FC<PurchaseOrdersPageProps> = ({ pos, vendors, onAddPo }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);

  // Form State
  const customers = vendors.filter((v) => v.vendorType === 'customer' || v.vendorType === 'both' || v.roles?.includes('Customer') || v.roles?.includes('Both'));
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.vendorId || customers[0]?.id || '');
  const [processCategory, setProcessCategory] = useState<ProcessCategory>('Washing');
  const [styleNo, setStyleNo] = useState('');
  const [itemName, setItemName] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');

  // Colour Lines State
  const [lines, setLines] = useState<POLine[]>([
    {
      lineId: 'pol-new-1',
      colourName: 'Indigo Blue',
      colourCode: 'IND-01',
      processType: 'Bio-Enzyme Wash',
      quantity: 1000,
      unit: 'piece',
      rate: 6.00,
      rateBasis: 'per piece',
      amount: 6000.00
    }
  ]);

  const handleAddLine = () => {
    setLines([
      ...lines,
      {
        lineId: `pol-new-${Date.now()}`,
        colourName: '',
        colourCode: '',
        processType: 'Enzyme Wash',
        quantity: 500,
        unit: 'piece',
        rate: 6.00,
        rateBasis: 'per piece',
        amount: 3000.00
      }
    ]);
  };

  const handleLineChange = (index: number, field: keyof POLine, value: any) => {
    const updated = [...lines];
    const item = { ...updated[index], [field]: value };
    if (field === 'quantity' || field === 'rate') {
      item.amount = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
    }
    updated[index] = item;
    setLines(updated);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length === 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const calculateTotalQty = () => lines.reduce((acc, l) => acc + (Number(l.quantity) || 0), 0);
  const calculateTotalVal = () => lines.reduce((acc, l) => acc + (Number(l.amount) || 0), 0);

  const handleSubmitPo = (e: React.FormEvent) => {
    e.preventDefault();
    const customer = vendors.find((v) => (v.vendorId || v.id) === selectedCustomerId);
    const poNumber = `PO/2026-27/000${pos.length + 1}`;

    const newPo: PurchaseOrder = {
      id: `po-${Date.now()}`,
      poId: `po-${Date.now()}`,
      poNumber,
      customerId: selectedCustomerId,
      customerName: customer ? customer.companyName : 'Customer',
      processCategory,
      styleNo,
      itemName,
      orderDate,
      deliveryDate,
      status: 'Approved',
      lines,
      totalQuantity: calculateTotalQty(),
      totalAmount: calculateTotalVal(),
      createdBy: 'Active User',
      createdAt: new Date().toISOString(),
      notes
    };

    onAddPo(newPo);
    setIsModalOpen(false);
    // Reset form
    setStyleNo('');
    setItemName('');
  };

  const columns: Column<PurchaseOrder>[] = [
    { header: 'PO Number', accessor: 'poNumber', className: 'font-bold text-[#1F4E79]' },
    { header: 'Customer', accessor: 'customerName' },
    { header: 'Process', accessor: 'processCategory' },
    { header: 'Style Number', accessor: 'styleNo' },
    { header: 'Item Name', accessor: 'itemName' },
    { header: 'Order Date', accessor: (row) => formatDate(row.orderDate) },
    { header: 'Total Quantity', accessor: (row) => formatQuantity(row.totalQuantity, row.lines[0]?.unit || 'pc') },
    { header: 'Order Value', accessor: (row) => formatCurrency(row.totalAmount), className: 'font-bold' },
    { header: 'Status', accessor: (row) => <StatusChip status={row.status} /> }
  ];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-[#1F4E79]">Purchase Orders (PO)</h2>
          <p className="text-xs text-slate-500">Create & manage work orders by style and colour specifications</p>
        </div>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setIsModalOpen(true)}>
          Create Purchase Order
        </Button>
      </div>

      {/* PO Data Table */}
      <Card>
        <Table
          columns={columns}
          data={pos}
          keyExtractor={(row) => row.id}
          onRowClick={(row) => setSelectedPo(row)}
        />
      </Card>

      {/* PO Detail View Modal */}
      {selectedPo && (
        <Modal isOpen={!!selectedPo} onClose={() => setSelectedPo(null)} title={`PO Details: ${selectedPo.poNumber}`} maxWidth="2xl">
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-500 block">Customer:</span>
                <strong className="text-slate-900 text-sm">{selectedPo.customerName}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Process Category:</span>
                <strong className="text-[#1F4E79] text-sm">{selectedPo.processCategory}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Style Number:</span>
                <strong className="text-slate-900">{selectedPo.styleNo}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Item Name:</span>
                <strong className="text-slate-900">{selectedPo.itemName}</strong>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase text-[#1F4E79] mb-2">Colour Lines & Quantities</h4>
              <div className="divide-y border rounded-xl overflow-hidden text-xs">
                <div className="grid grid-cols-5 bg-[#EEF5FB] p-2.5 font-bold text-[#1F4E79]">
                  <span>Colour</span>
                  <span>Wash/Process</span>
                  <span>Quantity</span>
                  <span>Rate</span>
                  <span>Amount</span>
                </div>
                {selectedPo.lines.map((l, idx) => (
                  <div key={idx} className="grid grid-cols-5 p-2.5 font-medium">
                    <span>{l.colourName} ({l.colourCode || '-'})</span>
                    <span>{l.processType}</span>
                    <span>{formatQuantity(l.quantity, l.unit)}</span>
                    <span>{formatCurrency(l.rate)} / {l.unit}</span>
                    <span className="font-bold">{formatCurrency(l.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-200 text-xs">
              <div>
                <span className="text-slate-500">Order Date:</span> {formatDate(selectedPo.orderDate)}
              </div>
              <div className="text-right">
                <span className="text-slate-500 block text-xs">Total Order Value:</span>
                <strong className="text-lg font-black text-[#1F4E79]">{formatCurrency(selectedPo.totalAmount)}</strong>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Create New PO Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Customer Purchase Order" maxWidth="4xl">
        <form onSubmit={handleSubmitPo} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Select Customer</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm focus:ring-[#1F4E79]"
                required
              >
                {customers.map((c) => (
                  <option key={c.vendorId || c.id} value={c.vendorId || c.id}>{c.companyName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Process Category</label>
              <select
                value={processCategory}
                onChange={(e) => setProcessCategory(e.target.value as ProcessCategory)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm focus:ring-[#1F4E79]"
              >
                <option value="Washing">Washing</option>
                <option value="Dyeing">Dyeing</option>
              </select>
            </div>

            <Input
              label="Style Number"
              placeholder="e.g. STYLE-M-902"
              value={styleNo}
              onChange={(e) => setStyleNo(e.target.value)}
              required
            />

            <Input
              label="Item Description"
              placeholder="e.g. Men's Denim Shirt"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              required
            />

            <Input
              label="Order Date"
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              required
            />

            <Input
              label="Delivery Date"
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
            />
          </div>

          {/* Dynamic Colour Lines Builder */}
          <div className="space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <h4 className="text-xs font-bold uppercase text-[#1F4E79]">Colour Rows (Multiple Allowed)</h4>
              <Button type="button" variant="secondary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={handleAddLine}>
                Add Colour Row
              </Button>
            </div>

            <div className="space-y-3">
              {lines.map((line, idx) => (
                <div key={line.lineId} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                  <div className="col-span-3">
                    <Input
                      placeholder="Colour Name (e.g. Indigo)"
                      value={line.colourName}
                      onChange={(e) => handleLineChange(idx, 'colourName', e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      placeholder="Wash / Process Type"
                      value={line.processType}
                      onChange={(e) => handleLineChange(idx, 'processType', e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={line.quantity}
                      onChange={(e) => handleLineChange(idx, 'quantity', Number(e.target.value))}
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      step="0.5"
                      placeholder="Rate ₹"
                      value={line.rate}
                      onChange={(e) => handleLineChange(idx, 'rate', Number(e.target.value))}
                      required
                    />
                  </div>
                  <div className="col-span-1 text-right font-bold text-slate-800">
                    {formatCurrency(line.amount)}
                  </div>
                  <div className="col-span-1 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveLine(idx)}
                      className="text-rose-500 hover:text-rose-700 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center bg-[#EEF5FB] p-3 rounded-xl text-xs font-bold text-[#1F4E79]">
              <span>Total Ordered Qty: {formatQuantity(calculateTotalQty())}</span>
              <span>Total PO Value: {formatCurrency(calculateTotalVal())}</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" icon={<CheckCircle2 className="w-4 h-4" />}>Save & Approve PO</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
