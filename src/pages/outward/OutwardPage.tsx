import React, { useState } from 'react';
import { PurchaseOrder } from '../../types/po';
import { InwardEntry, OutwardEntry, OutwardLine } from '../../types/inwardOutward';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Table, Column } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { formatDate, formatQuantity } from '../../utils/formatters';
import { Plus, ArrowUpRight, CheckCircle2, AlertTriangle } from 'lucide-react';

interface OutwardPageProps {
  pos: PurchaseOrder[];
  inwards: InwardEntry[];
  outwards: OutwardEntry[];
  onAddOutward: (entry: OutwardEntry) => void;
}

export const OutwardPage: React.FC<OutwardPageProps> = ({ pos, inwards, outwards, onAddOutward }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const eligiblePos = pos.filter((p) =>
    inwards.some(
      (inE) =>
        (!inE.status || inE.status === 'posted') &&
        (inE.poId === p.id || inE.poNumber === p.poNumber)
    )
  );

  const [selectedPoId, setSelectedPoId] = useState(eligiblePos[0]?.id || '');
  const [ourDcNo, setOurDcNo] = useState(`DC-PERLA-${1040 + outwards.length + 1}`);
  const [ourDate, setOurDate] = useState(new Date().toISOString().split('T')[0]);
  const [vehicleNo, setVehicleNo] = useState('TN-22-AB-9912');

  const activePo = pos.find((p) => p.id === selectedPoId);
  const [dispatchQtyMap, setDispatchQtyMap] = useState<Record<string, number>>({});

  const handleQtyChange = (lineId: string, val: number) => {
    setDispatchQtyMap((prev) => ({ ...prev, [lineId]: val }));
  };

  const handleSubmitOutward = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePo) return;

    const outwardLines: OutwardLine[] = activePo.lines.map((l) => ({
      lineId: `outl-${Date.now()}-${l.lineId}`,
      poLineId: l.lineId,
      colour: l.colourName,
      dispatchQty: Number(dispatchQtyMap[l.lineId]) || 0,
      unit: l.unit
    })).filter((l) => l.dispatchQty > 0);

    if (outwardLines.length === 0) {
      alert('Please enter at least one dispatch quantity greater than zero.');
      return;
    }

    const newOutward: OutwardEntry = {
      id: `out-${Date.now()}`,
      entryId: `OUT-2026-00${outwards.length + 1}`,
      poId: activePo.id,
      poNumber: activePo.poNumber,
      styleNo: activePo.styleNo,
      customerId: activePo.customerId,
      customerName: activePo.customerName,
      ourDate,
      ourDcNo,
      vehicleNo,
      createdAt: new Date().toISOString(),
      createdBy: 'Active User',
      lines: outwardLines
    };

    onAddOutward(newOutward);
    setIsModalOpen(false);
  };

  const columns: Column<OutwardEntry>[] = [
    { header: 'Outward Ref', accessor: 'entryId', className: 'font-bold text-[#1F4E79]' },
    { header: 'Our DC Number', accessor: 'ourDcNo', className: 'font-bold' },
    { header: 'PO Number', accessor: 'poNumber' },
    { header: 'Customer', accessor: 'customerName' },
    { header: 'Vehicle No', accessor: (row) => row.vehicleNo || '-' },
    { header: 'Dispatch Date', accessor: (row) => formatDate(row.ourDate) },
    {
      header: 'Total Dispatched Qty',
      accessor: (row) => {
        const total = row.lines.reduce((acc, l) => acc + l.dispatchQty, 0);
        return formatQuantity(total, row.lines[0]?.unit || 'pc');
      },
      className: 'font-bold text-blue-700'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-[#1F4E79]">Outward Finished Goods Dispatch</h2>
          <p className="text-xs text-slate-500">Record finished processed garments dispatched back to customers</p>
        </div>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setIsModalOpen(true)}>
          New Dispatch Entry
        </Button>
      </div>

      <Card>
        <Table columns={columns} data={outwards} keyExtractor={(row) => row.id} />
      </Card>

      {/* New Outward Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Record Outward Dispatch Entry" maxWidth="2xl">
        <form onSubmit={handleSubmitOutward} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Select Active PO</label>
              <select
                value={selectedPoId}
                onChange={(e) => setSelectedPoId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm focus:ring-[#1F4E79]"
                required
              >
                {eligiblePos.map((p) => (
                  <option key={p.id} value={p.id}>{p.poNumber} ({p.customerName} - {p.styleNo})</option>
                ))}
              </select>
            </div>

            <Input
              label="Our Delivery DC Number"
              value={ourDcNo}
              onChange={(e) => setOurDcNo(e.target.value)}
              required
            />

            <Input
              label="Dispatch Date"
              type="date"
              value={ourDate}
              onChange={(e) => setOurDate(e.target.value)}
              required
            />

            <Input
              label="Vehicle Number"
              placeholder="e.g. TN-22-AB-9912"
              value={vehicleNo}
              onChange={(e) => setVehicleNo(e.target.value)}
            />
          </div>

          {/* Lines Table for Dispatchable Stock Validation */}
          {activePo && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase text-[#1F4E79]">Enter Dispatch Quantity (Checked against Available Received Stock)</h4>
              <div className="border rounded-xl overflow-hidden text-xs">
                <div className="grid grid-cols-5 bg-[#EEF5FB] p-2.5 font-bold text-[#1F4E79]">
                  <span>Colour Line</span>
                  <span>Total Inward</span>
                  <span>Prev Dispatched</span>
                  <span>Available Stock</span>
                  <span>Current Dispatch Qty</span>
                </div>

                {activePo.lines.map((line) => {
                  // Total inward received (posted receipts only)
                  const totalInward = inwards
                    .filter(
                      (inE) =>
                        (!inE.status || inE.status === 'posted') &&
                        (inE.poId === activePo.id || inE.poNumber === activePo.poNumber)
                    )
                    .reduce((acc, inE) => {
                      const match = inE.lines.find(
                        (l) =>
                          l.poLineId === line.lineId ||
                          l.colour === line.colourName ||
                          l.colourNameSnapshot === line.colourName
                      );
                      return acc + (match ? match.receivedQty : 0);
                    }, 0);

                  // Total outward dispatched
                  const totalOutward = outwards
                    .filter((outE) => outE.poId === activePo.id || outE.poNumber === activePo.poNumber)
                    .reduce((acc, outE) => {
                      const match = outE.lines.find((l) => l.poLineId === line.lineId || l.colour === line.colourName);
                      return acc + (match ? match.dispatchQty : 0);
                    }, 0);

                  const available = totalInward - totalOutward;

                  return (
                    <div key={line.lineId} className="grid grid-cols-5 p-2.5 items-center border-t border-slate-100 font-medium">
                      <span>{line.colourName}</span>
                      <span>{formatQuantity(totalInward, line.unit)}</span>
                      <span className="text-slate-500">{formatQuantity(totalOutward, line.unit)}</span>
                      <span className={`font-bold ${available > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                        {formatQuantity(available, line.unit)}
                      </span>
                      <div>
                        <Input
                          type="number"
                          placeholder="Qty"
                          max={available}
                          value={dispatchQtyMap[line.lineId] ?? available}
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
            <Button type="submit" variant="primary" icon={<CheckCircle2 className="w-4 h-4" />}>Save Outward Entry</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
