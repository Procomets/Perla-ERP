import React, { useState } from 'react';
import { ChemicalEntry } from '../../types/stock';
import { PurchaseOrder } from '../../types/po';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Table, Column } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { formatDate, formatQuantity } from '../../utils/formatters';
import { Plus, FlaskConical, CheckCircle2 } from 'lucide-react';

interface ChemicalEntryPageProps {
  entries: ChemicalEntry[];
  pos: PurchaseOrder[];
  onAddEntry: (entry: ChemicalEntry) => void;
}

export const ChemicalEntryPage: React.FC<ChemicalEntryPageProps> = ({ entries, pos, onAddEntry }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPoId, setSelectedPoId] = useState(pos[0]?.id || '');
  const [machineNo, setMachineNo] = useState('Washer-M03');
  const [operatorName, setOperatorName] = useState('M. Palani');
  const [lotNo, setLotNo] = useState('LOT-A4');
  const [processedQty, setProcessedQty] = useState(1250);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const activePo = pos.find((p) => p.id === selectedPoId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePo) return;

    const newEntry: ChemicalEntry = {
      id: `ce-${Date.now()}`,
      entryId: `CE-2026-00${entries.length + 1}`,
      poId: activePo.id,
      poNumber: activePo.poNumber,
      poLineId: activePo.lines[0]?.lineId || 'pol-1',
      styleNo: activePo.styleNo,
      colour: activePo.lines[0]?.colourName || 'Indigo',
      processType: activePo.processCategory,
      machineNo,
      operatorName,
      lotNo,
      processedQty,
      unit: activePo.lines[0]?.unit || 'piece',
      startTime: '09:00',
      endTime: '11:30',
      date,
      consumptions: [
        { chemicalItemId: 'item1', chemicalName: 'Bio-Enzyme Powder (Neutral)', quantity: 12.5, unit: 'kg' },
        { chemicalItemId: 'item2', chemicalName: 'Silicon Softener Liquid', quantity: 8.0, unit: 'kg' }
      ],
      createdBy: 'Active User',
      createdAt: new Date().toISOString()
    };

    onAddEntry(newEntry);
    setIsModalOpen(false);
  };

  const columns: Column<ChemicalEntry>[] = [
    { header: 'Entry Ref', accessor: 'entryId', className: 'font-bold text-[#1F4E79]' },
    { header: 'Date', accessor: (row) => formatDate(row.date) },
    { header: 'PO Number', accessor: 'poNumber' },
    { header: 'Machine No', accessor: 'machineNo' },
    { header: 'Operator', accessor: 'operatorName' },
    { header: 'Lot No', accessor: 'lotNo', className: 'font-mono' },
    { header: 'Processed Qty', accessor: (row) => formatQuantity(row.processedQty, row.unit), className: 'font-bold' },
    {
      header: 'Chemicals Consumed',
      accessor: (row) => (
        <span className="text-xs text-slate-700">
          {row.consumptions.map((c) => `${c.chemicalName} (${c.quantity} ${c.unit})`).join(', ')}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-[#1F4E79]">Chemical Entry & Shopfloor Consumption</h2>
          <p className="text-xs text-slate-500">Record machine batch usage and deduct chemicals from warehouse ledger</p>
        </div>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setIsModalOpen(true)}>
          New Chemical Batch Entry
        </Button>
      </div>

      <Card>
        <Table columns={columns} data={entries} keyExtractor={(row) => row.id} />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Record Chemical Processing Entry" maxWidth="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Target PO</label>
              <select
                value={selectedPoId}
                onChange={(e) => setSelectedPoId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm focus:ring-[#1F4E79]"
              >
                {pos.map((p) => (
                  <option key={p.id} value={p.id}>{p.poNumber} ({p.styleNo})</option>
                ))}
              </select>
            </div>

            <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            <Input label="Machine Number" value={machineNo} onChange={(e) => setMachineNo(e.target.value)} required />
            <Input label="Operator Name" value={operatorName} onChange={(e) => setOperatorName(e.target.value)} required />
            <Input label="Lot Number" value={lotNo} onChange={(e) => setLotNo(e.target.value)} required />
            <Input label="Processed Qty" type="number" value={processedQty} onChange={(e) => setProcessedQty(Number(e.target.value))} required />
          </div>

          <div className="bg-[#EEF5FB] p-3 rounded-xl border border-blue-200 text-xs space-y-1">
            <span className="font-bold text-[#1F4E79]">Auto-Linked Chemical Standard Recipe:</span>
            <p className="text-slate-700">• Bio-Enzyme Powder (Neutral): 12.5 kg</p>
            <p className="text-slate-700">• Silicon Softener Liquid: 8.0 kg</p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" icon={<CheckCircle2 className="w-4 h-4" />}>Post Chemical Entry</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
