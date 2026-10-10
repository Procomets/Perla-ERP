import React, { useState } from 'react';
import { InventoryItem, ItemCategory } from '../../types/stock';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Table, Column } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Package, Plus, CheckCircle2 } from 'lucide-react';

interface ItemMasterPageProps {
  items: InventoryItem[];
  onAddItem: (item: InventoryItem) => void;
}

export const ItemMasterPage: React.FC<ItemMasterPageProps> = ({ items, onAddItem }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ItemCategory>('Chemical');
  const [baseUnit, setBaseUnit] = useState('kg');
  const [currentStock, setCurrentStock] = useState(100);
  const [reorderLevel, setReorderLevel] = useState(25);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newItem: InventoryItem = {
      id: `item-${Date.now()}`,
      itemId: `ITM-00${items.length + 1}`,
      code,
      name,
      category,
      baseUnit,
      currentStock,
      reorderLevel,
      active: true
    };
    onAddItem(newItem);
    setIsModalOpen(false);
    setCode('');
    setName('');
  };

  const columns: Column<InventoryItem>[] = [
    { header: 'Item Code', accessor: 'code', className: 'font-bold text-[#1F4E79]' },
    { header: 'Item Name', accessor: 'name', className: 'font-bold' },
    { header: 'Category', accessor: 'category' },
    { header: 'Base Unit', accessor: 'baseUnit' },
    { header: 'Initial Stock', accessor: (row) => `${row.currentStock} ${row.baseUnit}` },
    { header: 'Reorder Level', accessor: (row) => `${row.reorderLevel} ${row.baseUnit}` }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-[#1F4E79]">Item & Chemical Master Directory</h2>
          <p className="text-xs text-slate-500">Master specifications for processing chemicals, firewood fuel, and packaging</p>
        </div>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setIsModalOpen(true)}>
          Add Master Item
        </Button>
      </div>

      <Card>
        <Table columns={columns} data={items} keyExtractor={(row) => row.id} />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Master Item Record" maxWidth="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Item Code" placeholder="e.g. ENZ-800" value={code} onChange={(e) => setCode(e.target.value)} required />
          <Input label="Item Name" placeholder="e.g. Neutral Bio-Enzyme Powder" value={name} onChange={(e) => setName(e.target.value)} required />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as ItemCategory)} className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm">
                <option value="Chemical">Chemical</option>
                <option value="Firewood">Firewood</option>
                <option value="Raw Material">Raw Material</option>
                <option value="Packaging">Packaging</option>
              </select>
            </div>
            <Input label="Base Measurement Unit" placeholder="e.g. kg / tons / liters" value={baseUnit} onChange={(e) => setBaseUnit(e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Initial Stock" type="number" value={currentStock} onChange={(e) => setCurrentStock(Number(e.target.value))} required />
            <Input label="Reorder Level" type="number" value={reorderLevel} onChange={(e) => setReorderLevel(Number(e.target.value))} required />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" icon={<CheckCircle2 className="w-4 h-4" />}>Save Item Master</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
