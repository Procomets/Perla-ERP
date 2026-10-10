import React, { useState } from 'react';
import { PurchaseOrder } from '../../types/po';
import { InwardEntry, InwardLine } from '../../types/inwardOutward';
import { Vendor } from '../../types/vendor';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Table, Column } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { formatDate, formatQuantity } from '../../utils/formatters';
import { Plus, ArrowDownLeft, CheckCircle2 } from 'lucide-react';

interface InwardPageProps {
  pos: PurchaseOrder[];
  inwards: InwardEntry[];
  vendors: Vendor[];
  onAddInward: (entry: InwardEntry) => void;
}

export const InwardPage: React.FC<InwardPageProps> = ({ pos, inwards, vendors, onAddInward }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const eligiblePos = pos.filter((p) => p.status === 'Approved' || p.status === 'In Progress');
  
  const [selectedPoId, setSelectedPoId] = useState(eligiblePos[0]?.id || '');
  const [customerDcNo, setCustomerDcNo] = useState('');
  const [customerDate, setCustomerDate] = useState(new Date().toISOString().split('T')[0]);

  const activePo = pos.find((p) => p.id === selectedPoId);

  // Inward line quantities input map
  const [receivedQtyMap, setReceivedQtyMap] = useState<Record<string, number>>({});

  const handlePoChange = (poId: string) => {
    setSelectedPoId(poId);
    setReceivedQtyMap({});
  };

  const handleQtyChange = (lineId: string, val: number) => {
    setReceivedQtyMap((prev) => ({ ...prev, [lineId]: val }));
  };

  const handleSubmitInward = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePo) return;

    const inwardLines: InwardLine[] = activePo.lines.map((l) => ({
      lineId: `inl-${Date.now()}-${l.lineId}`,
      poLineId: l.lineId,
      colour: l.colourName,
      receivedQty: Number(receivedQtyMap[l.lineId]) || 0,
      unit: l.unit
    })).filter((l) => l.receivedQty > 0);

    if (inwardLines.length === 0) {
      alert('Please enter at least one received quantity greater than zero.');
      return;
    }

    const newInward: InwardEntry = {
      id: `in-${Date.now()}`,
      entryId: `IN-2026-00${inwards.length + 1}`,
      poId: activePo.id,
      poNumber: activePo.poNumber,
      styleNo: activePo.styleNo,
      customerId: activePo.customerId,
      customerName: activePo.customerName,
      customerDate,
      customerDcNo,
      createdAt: new Date().toISOString(),
      createdBy: 'Active User',
      lines: inwardLines
    };

    onAddInward(newInward);
    setIsModalOpen(false);
    setCustomerDcNo('');
  };

  const columns: Column<InwardEntry>[] = [
    { header: 'Inward Ref', accessor: 'entryId', className: 'font-bold text-[#1F4E79]' },
    { header: 'Customer DC No', accessor: 'customerDcNo', className: 'font-bold' },
    { header: 'PO Number', accessor: 'poNumber' },
    { header: 'Customer', accessor: 'customerName' },
    { header: 'Style No', accessor: 'styleNo' },
    { header: 'DC Date', accessor: (row) => formatDate(row.customerDate) },
    {
      header: 'Total Received Qty',
      accessor: (row) => {
        const total = row.lines.reduce((acc, l) => acc + l.receivedQty, 0);
        return formatQuantity(total, row.lines[0]?.unit || 'pc');
      },
      className: 'font-bold text-emerald-700'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-[#1F4E79]">Inward Material Receipt</h2>
          <p className="text-xs text-slate-500">Record customer fabric/garments received against Purchase Orders</p>
        </div>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setIsModalOpen(true)}>
          New Inward Receipt
        </Button>
      </div>

      <Card>
        <Table columns={columns} data={inwards} keyExtractor={(row) => row.id} />
      </Card>

      {/* New Inward Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Record Customer Inward Entry" maxWidth="2xl">
        <form onSubmit={handleSubmitInward} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Select Active PO</label>
              <select
                value={selectedPoId}
                onChange={(e) => handlePoChange(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm focus:ring-[#1F4E79]"
                required
              >
                {eligiblePos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.poNumber} ({p.customerName} - {p.styleNo})
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Customer DC Number"
              placeholder="e.g. DC-APEX-8891"
              value={customerDcNo}
              onChange={(e) => setCustomerDcNo(e.target.value)}
              required
            />

            <Input
              label="Customer DC Date"
              type="date"
              value={customerDate}
              onChange={(e) => setCustomerDate(e.target.value)}
              required
            />
          </div>

          {/* PO Colour Lines Table for Inward Quantity Entry */}
          {activePo && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase text-[#1F4E79]">Enter Received Quantities Per Colour Line</h4>
              <div className="border rounded-xl overflow-hidden text-xs">
                <div className="grid grid-cols-5 bg-[#EEF5FB] p-2.5 font-bold text-[#1F4E79]">
                  <span>Colour Line</span>
                  <span>Ordered Qty</span>
                  <span>Prev Received</span>
                  <span>Inward Balance</span>
                  <span>Current Received Qty</span>
                </div>

                {activePo.lines.map((line) => {
                  // Calculate existing received total
                  const prevReceived = inwards
                    .filter((inE) => inE.poId === activePo.id)
                    .reduce((acc, inE) => {
                      const match = inE.lines.find((l) => l.poLineId === line.lineId || l.colour === line.colourName);
                      return acc + (match ? match.receivedQty : 0);
                    }, 0);

                  const balance = line.quantity - prevReceived;

                  return (
                    <div key={line.lineId} className="grid grid-cols-5 p-2.5 items-center border-t border-slate-100 font-medium">
                      <span>{line.colourName}</span>
                      <span>{formatQuantity(line.quantity, line.unit)}</span>
                      <span className="text-slate-500">{formatQuantity(prevReceived, line.unit)}</span>
                      <span className="font-bold text-[#1F4E79]">{formatQuantity(balance, line.unit)}</span>
                      <div>
                        <Input
                          type="number"
                          placeholder="Qty"
                          value={receivedQtyMap[line.lineId] ?? balance}
                          onChange={(e) => handleQtyChange(line.lineId, Number(e.target.value))}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" icon={<CheckCircle2 className="w-4 h-4" />}>Save Inward Transaction</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
