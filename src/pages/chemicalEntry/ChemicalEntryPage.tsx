import React, { useState, useEffect } from 'react';
import { ChemicalEntry, ChemicalConsumptionLine } from '../../types/stock';
import { PurchaseOrder } from '../../types/po';
import { MasterItem } from '../../types/item';
import { ItemService } from '../../services/itemService';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Table, Column } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { formatDate, formatQuantity } from '../../utils/formatters';
import { Plus, FlaskConical, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';

interface ChemicalEntryPageProps {
  entries: ChemicalEntry[];
  pos: PurchaseOrder[];
  onAddEntry: (entry: ChemicalEntry) => void;
}

export const ChemicalEntryPage: React.FC<ChemicalEntryPageProps> = ({ entries, pos, onAddEntry }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [availableChemicals, setAvailableChemicals] = useState<MasterItem[]>([]);
  const [selectedPoId, setSelectedPoId] = useState(pos[0]?.id || '');
  const [machineNo, setMachineNo] = useState('Washer-M03');
  const [operatorName, setOperatorName] = useState('M. Palani');
  const [lotNo, setLotNo] = useState('LOT-A4');
  const [processedQty, setProcessedQty] = useState(1250);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Selected chemicals consumed
  const [consumptions, setConsumptions] = useState<ChemicalConsumptionLine[]>([
    { chemicalItemId: '', chemicalName: '', quantity: 10, unit: 'kg' }
  ]);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    ItemService.getChemicalItems()
      .then((items) => {
        setAvailableChemicals(items);
        if (items.length > 0 && consumptions[0]?.chemicalItemId === '') {
          setConsumptions([
            {
              chemicalItemId: items[0].id,
              chemicalName: items[0].chemicalDetails?.chemicalDisplayName || items[0].itemName,
              quantity: 12.5,
              unit: items[0].baseUnit
            }
          ]);
        }
      })
      .catch(() => setAvailableChemicals([]));
  }, []);

  const activePo = pos.find((p) => p.id === selectedPoId);

  const handleChemicalChange = (index: number, chemId: string) => {
    const chem = availableChemicals.find((c) => c.id === chemId || c.itemId === chemId);
    if (!chem) return;
    const copy = [...consumptions];
    copy[index] = {
      ...copy[index],
      chemicalItemId: chem.id,
      chemicalName: chem.chemicalDetails?.chemicalDisplayName || chem.itemName,
      unit: chem.baseUnit
    };
    setConsumptions(copy);
  };

  const handleQuantityChange = (index: number, qty: number) => {
    const copy = [...consumptions];
    copy[index] = { ...copy[index], quantity: qty };
    setConsumptions(copy);
  };

  const handleAddConsumptionLine = () => {
    if (availableChemicals.length === 0) return;
    const defaultChem = availableChemicals[0];
    setConsumptions([
      ...consumptions,
      {
        chemicalItemId: defaultChem.id,
        chemicalName: defaultChem.chemicalDetails?.chemicalDisplayName || defaultChem.itemName,
        quantity: 5,
        unit: defaultChem.baseUnit
      }
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (consumptions.length === 1) return;
    setConsumptions(consumptions.filter((_, idx) => idx !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePo) {
      setFormError('Please select a valid Purchase Order.');
      return;
    }

    // Verify stock availability
    for (const c of consumptions) {
      const chem = availableChemicals.find((item) => item.id === c.chemicalItemId);
      if (chem && (chem.currentStock || 0) < c.quantity) {
        setFormError(
          `Insufficient stock for '${c.chemicalName}'. Available: ${chem.currentStock || 0} ${chem.baseUnit}, Requested: ${c.quantity} ${c.unit}`
        );
        return;
      }
    }

    setFormError(null);
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
      consumptions,
      createdBy: 'Authorized Staff',
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
          <h2 className="text-xl font-bold text-[#1F4E79] flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-indigo-600" />
            Chemical Entry & Shopfloor Consumption
          </h2>
          <p className="text-xs text-slate-500">
            Record batch processing recipe usage linked directly with active Chemical Master
          </p>
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
          {formError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

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

          {/* Chemical Consumptions linked to Master */}
          <div className="bg-[#EEF5FB] p-3.5 rounded-xl border border-blue-200 text-xs space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-bold text-[#1F4E79]">Chemical Master Items Consumed:</span>
              <button
                type="button"
                onClick={handleAddConsumptionLine}
                className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Chemical Line
              </button>
            </div>

            <div className="space-y-2">
              {consumptions.map((line, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
                  <select
                    value={line.chemicalItemId}
                    onChange={(e) => handleChemicalChange(idx, e.target.value)}
                    className="flex-1 bg-white border border-slate-300 rounded p-1.5 text-xs font-medium"
                    required
                  >
                    {availableChemicals.map((chem) => (
                      <option key={chem.id} value={chem.id}>
                        {chem.chemicalDetails?.chemicalDisplayName || chem.itemName} (Stock: {chem.currentStock || 0} {chem.baseUnit})
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-1 w-28">
                    <input
                      type="number"
                      step="0.1"
                      value={line.quantity}
                      onChange={(e) => handleQuantityChange(idx, Number(e.target.value))}
                      className="w-16 border border-slate-300 rounded p-1 text-xs text-right font-bold"
                      required
                    />
                    <span className="text-xs text-slate-500 font-bold">{line.unit}</span>
                  </div>

                  {consumptions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveLine(idx)}
                      className="p-1 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
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
