import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  ChemicalEntryRecord,
  ChemicalEntryType,
  CreateChemicalEntryPayload
} from '../../types/chemicalEntry';
import { MasterItem } from '../../types/item';
import { Vendor } from '../../types/vendor';
import { PurchaseOrder } from '../../types/po';
import { ChemicalEntryService } from '../../services/chemicalEntryService';
import { MachineMasterService } from '../../services/machineMasterService';
import { MachineItem } from '../../types/machineMaster';
import {
  convertQuantity,
  convertRate,
  getCompatibleUnits,
  normalizeUnit,
  UnitOption
} from '../../utils/unitConversion';
import { Modal } from '../../components/ui/Modal';
import { LoadingOverlay } from '../../components/ui/LoadingOverlay';
import { formatDate, formatCurrency, formatQuantity } from '../../utils/formatters';
import {
  FlaskConical,
  Flame,
  Plus,
  Search,
  RefreshCw,
  ShoppingBag,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  Clock,
  Trash2,
  Eye,
  AlertCircle,
  Building2,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  SlidersHorizontal,
  RotateCcw,
  Package,
  X,
  FileSpreadsheet,
  Check,
  Calendar,
  Layers,
  Factory
} from 'lucide-react';
import ExcelJS from 'exceljs';

interface SearchableChemicalSelectProps {
  value: string;
  items: MasterItem[];
  onSelect: (item: MasterItem) => void;
  disabled?: boolean;
}

const SearchableChemicalSelect: React.FC<SearchableChemicalSelectProps> = ({
  value,
  items,
  onSelect,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  const selectedItem = items.find((it) => it.id === value || it.itemId === value);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.itemName.toLowerCase().includes(q) ||
        it.itemCode.toLowerCase().includes(q) ||
        (it.chemicalDetails?.chemicalDisplayName || '').toLowerCase().includes(q) ||
        (it.categoryName || '').toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  return (
    <div className={`relative w-full ${isOpen ? 'z-50' : 'z-10'}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className="w-full h-10 bg-white border border-slate-200 hover:border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-left flex items-center justify-between gap-1.5 transition focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer disabled:opacity-50"
      >
        {selectedItem ? (
          <div className="flex items-center gap-1.5 truncate">
            <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-100 text-slate-700 shrink-0">
              {selectedItem.itemCode}
            </span>
            <span className="font-semibold text-slate-900 truncate">
              {selectedItem.chemicalDetails?.chemicalDisplayName || selectedItem.itemName}
            </span>
            <span className="text-[10px] text-slate-500 shrink-0 ml-1">
              (Stock: {selectedItem.currentStock || 0} {selectedItem.baseUnit})
            </span>
          </div>
        ) : (
          <span className="text-slate-400 font-normal">-- Select Chemical from Master --</span>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="p-2 border-b border-slate-100 bg-slate-50/50">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chemical name, code, brand..."
                className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 p-1">
            {filteredItems.length === 0 ? (
              <div className="py-5 text-center text-xs text-slate-400 italic">
                No active chemicals found matching "{searchQuery}".
              </div>
            ) : (
              filteredItems.map((it) => {
                const isSelected = it.id === value || it.itemId === value;
                const displayName = it.chemicalDetails?.chemicalDisplayName || it.itemName;
                const available = Number(it.currentStock || 0);
                const isLow = available <= (it.reorderLevel || it.minimumStockLevel || 0);

                return (
                  <div
                    key={it.id || it.itemId}
                    onClick={() => {
                      onSelect(it);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    className={`p-2 rounded-lg cursor-pointer transition flex items-center justify-between gap-2 text-xs ${
                      isSelected ? 'bg-slate-100 font-semibold' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-200/70 text-slate-800 shrink-0">
                        {it.itemCode}
                      </span>
                      <div className="truncate">
                        <div className="font-medium text-slate-900 truncate">{displayName}</div>
                        <div className="text-[10px] text-slate-400">
                          {it.chemicalDetails?.chemicalCategory || it.categoryName || 'Chemical'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`text-xs font-bold font-mono ${
                          available <= 0
                            ? 'text-rose-600'
                            : isLow
                            ? 'text-amber-600'
                            : 'text-slate-700'
                        }`}
                      >
                        {available} {it.baseUnit}
                      </span>
                      <div className="text-[9px] text-slate-400">Available Stock</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface SearchableWoodSelectProps {
  value: string;
  items: MasterItem[];
  onSelect: (item: MasterItem) => void;
  disabled?: boolean;
}

const SearchableWoodSelect: React.FC<SearchableWoodSelectProps> = ({
  value,
  items,
  onSelect,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  const selectedItem = items.find((it) => it.id === value || it.itemId === value);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.itemName.toLowerCase().includes(q) ||
        it.itemCode.toLowerCase().includes(q) ||
        (it.categoryName || '').toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  return (
    <div className={`relative w-full ${isOpen ? 'z-50' : 'z-10'}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className="w-full h-10 bg-white border border-slate-200 hover:border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-left flex items-center justify-between gap-1.5 transition focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer disabled:opacity-50"
      >
        {selectedItem ? (
          <div className="flex items-center gap-1.5 truncate">
            <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-100 text-slate-700 shrink-0">
              {selectedItem.itemCode}
            </span>
            <span className="font-semibold text-slate-900 truncate">
              {selectedItem.itemName}
            </span>
            <span className="text-[10px] text-slate-500 shrink-0 ml-1">
              (Stock: {selectedItem.currentStock || 0} {selectedItem.baseUnit})
            </span>
          </div>
        ) : (
          <span className="text-slate-400 font-normal">-- Select Raw Wood / Firewood Item --</span>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="p-2 border-b border-slate-100 bg-slate-50/50">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search raw wood, firewood, code..."
                className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 p-1">
            {filteredItems.length === 0 ? (
              <div className="py-5 text-center text-xs text-slate-400 italic">
                No active raw wood items found matching "{searchQuery}".
              </div>
            ) : (
              filteredItems.map((it) => {
                const isSelected = it.id === value || it.itemId === value;
                const available = Number(it.currentStock || 0);
                const isLow = available <= (it.reorderLevel || it.minimumStockLevel || 0);

                return (
                  <div
                    key={it.id || it.itemId}
                    onClick={() => {
                      onSelect(it);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    className={`p-2 rounded-lg cursor-pointer transition flex items-center justify-between gap-2 text-xs ${
                      isSelected ? 'bg-slate-100 font-semibold' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-200/70 text-slate-800 shrink-0">
                        {it.itemCode}
                      </span>
                      <div className="truncate">
                        <div className="font-medium text-slate-900 truncate">{it.itemName}</div>
                        <div className="text-[10px] text-slate-400">
                          {it.categoryName || 'Firewood & Boiler Fuel'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`text-xs font-bold font-mono ${
                          available <= 0
                            ? 'text-rose-600'
                            : isLow
                            ? 'text-amber-600'
                            : 'text-slate-700'
                        }`}
                      >
                        {available} {it.baseUnit}
                      </span>
                      <div className="text-[9px] text-slate-400">Available Stock</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export type ProcessEntrySortField =
  | 'entryNumber'
  | 'date'
  | 'itemName'
  | 'quantity'
  | 'rate'
  | 'totalAmount'
  | 'process'
  | 'status';

export type ProcessEntrySearchColumn =
  | 'ALL'
  | 'entryNumber'
  | 'date'
  | 'itemName'
  | 'quantity'
  | 'rate'
  | 'totalAmount'
  | 'process'
  | 'status';

const ChemicalEntryContent: React.FC = () => {
  const { user } = useAuth();

  // Active section: 'chemical' for Chemical Process Entry, 'wood' for Raw Wood Usage
  const [activeSection, setActiveSection] = useState<'chemical' | 'wood'>('chemical');

  // Live Data State
  const [entries, setEntries] = useState<ChemicalEntryRecord[]>([]);
  const [chemicals, setChemicals] = useState<MasterItem[]>([]);
  const [woodItems, setWoodItems] = useState<MasterItem[]>([]);
  const [suppliers, setSuppliers] = useState<Vendor[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Filters & Table Controls State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchColumn, setSearchColumn] = useState<ProcessEntrySearchColumn>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showColumnFilters, setShowColumnFilters] = useState<boolean>(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({
    entryNumber: '',
    date: '',
    itemName: '',
    quantity: '',
    rate: '',
    totalAmount: '',
    process: '',
    status: ''
  });
  const [sortField, setSortField] = useState<ProcessEntrySortField | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | 'normal' | null>(null);

  // Purchase Entry Modal State
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [purchaseItemId, setPurchaseItemId] = useState('');
  const [purchaseSupplierId, setPurchaseSupplierId] = useState('');
  const [purchaseSupplierInvoiceNo, setPurchaseSupplierInvoiceNo] = useState('');
  const [purchaseQuantity, setPurchaseQuantity] = useState<number | ''>('');
  const [purchaseUnit, setPurchaseUnit] = useState('kg');
  const [purchaseRate, setPurchaseRate] = useState<number | ''>('');
  const [purchaseIsReceived, setPurchaseIsReceived] = useState(true);
  const [purchaseRemarks, setPurchaseRemarks] = useState('');
  const [purchaseSubmitting, setPurchaseSubmitting] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  // Chemical Consumption Modal State
  const [isConsumptionModalOpen, setIsConsumptionModalOpen] = useState(false);
  const [consumptionDate, setConsumptionDate] = useState(new Date().toISOString().split('T')[0]);
  const [consumptionItemId, setConsumptionItemId] = useState('');
  const [consumptionQuantity, setConsumptionQuantity] = useState<number | ''>('');
  const [consumptionRate, setConsumptionRate] = useState<number | ''>('');
  const [consumptionUnit, setConsumptionUnit] = useState('kg');
  const [consumptionProcessType, setConsumptionProcessType] = useState('Dyeing');
  const [consumptionMachineNo, setConsumptionMachineNo] = useState('');
  const [consumptionStartTime, setConsumptionStartTime] = useState('09:00');
  const [consumptionEndTime, setConsumptionEndTime] = useState('11:00');
  const [consumptionOperatorName, setConsumptionOperatorName] = useState('');
  const [consumptionRemarks, setConsumptionRemarks] = useState('');
  const [consumptionSubmitting, setConsumptionSubmitting] = useState(false);
  const [consumptionError, setConsumptionError] = useState<string | null>(null);

  // Raw Wood Consumption Modal State
  const [isWoodModalOpen, setIsWoodModalOpen] = useState(false);
  const [woodDate, setWoodDate] = useState(new Date().toISOString().split('T')[0]);
  const [woodItemId, setWoodItemId] = useState('');
  const [woodQuantity, setWoodQuantity] = useState<number | ''>('');
  const [woodRate, setWoodRate] = useState<number | ''>('');
  const [woodUnit, setWoodUnit] = useState('t');
  const [woodBoilerStage, setWoodBoilerStage] = useState('Steam Generation (Boiler)');
  const [woodBoilerNo, setWoodBoilerNo] = useState('');
  const [woodStartTime, setWoodStartTime] = useState('');
  const [woodEndTime, setWoodEndTime] = useState('');
  const [woodOperatorName, setWoodOperatorName] = useState(''); // NO DEFAULT VALUE
  const [woodRemarks, setWoodRemarks] = useState('');
  const [woodSubmitting, setWoodSubmitting] = useState(false);
  const [woodError, setWoodError] = useState<string | null>(null);

  // Machine Master State
  const [machines, setMachines] = useState<MachineItem[]>([]);
  const [isCustomConsumptionMachine, setIsCustomConsumptionMachine] = useState(false);
  const [isCustomWoodBoiler, setIsCustomWoodBoiler] = useState(false);

  // All active machines from Machine Master
  const activeMachines = useMemo(() => {
    return machines.filter((m) => m.status === 'active');
  }, [machines]);

  // Boiler machines from Machine Master
  const boilerMachines = useMemo(() => {
    return activeMachines.filter(
      (m) =>
        m.processType === 'Boiler' ||
        (m.name || '').toLowerCase().includes('boiler') ||
        (m.machineId || '').toLowerCase().includes('boil')
    );
  }, [activeMachines]);

  // Other machines for Wood modal
  const otherMachinesForWood = useMemo(() => {
    return activeMachines.filter((m) => !boilerMachines.some((b) => b.id === m.id));
  }, [activeMachines, boilerMachines]);

  // Currently selected boiler machine from Machine Master
  const selectedWoodBoilerMachine = useMemo(() => {
    if (!woodBoilerNo) return null;
    return activeMachines.find(
      (m) =>
        `${m.machineId} - ${m.name}` === woodBoilerNo ||
        m.machineId === woodBoilerNo ||
        m.name === woodBoilerNo
    );
  }, [activeMachines, woodBoilerNo]);

  // Matching process machines for Chemical Consumption
  const matchingProcessMachines = useMemo(() => {
    const stage = (consumptionProcessType || '').toLowerCase();
    return activeMachines.filter((m) => {
      const pType = (m.processType || '').toLowerCase();
      const mName = (m.name || '').toLowerCase();
      if (stage.includes('dye')) return pType === 'dyeing' || mName.includes('dye');
      if (
        stage.includes('wash') ||
        stage.includes('enzyme') ||
        stage.includes('scour') ||
        stage.includes('bleach') ||
        stage.includes('soften')
      ) {
        return pType === 'washing' || mName.includes('wash') || mName.includes('hydro');
      }
      if (stage.includes('boiler') || stage.includes('utility')) {
        return pType === 'boiler' || mName.includes('boiler');
      }
      if (stage.includes('finish')) {
        return pType === 'finishing' || mName.includes('finish') || mName.includes('stenter');
      }
      return pType === stage;
    });
  }, [activeMachines, consumptionProcessType]);

  // Other machines for Chemical Consumption
  const otherProcessMachines = useMemo(() => {
    return activeMachines.filter((m) => !matchingProcessMachines.some((mat) => mat.id === m.id));
  }, [activeMachines, matchingProcessMachines]);

  // Currently selected chemical consumption machine from Machine Master
  const selectedConsumptionMachine = useMemo(() => {
    if (!consumptionMachineNo) return null;
    return activeMachines.find(
      (m) =>
        `${m.machineId} - ${m.name}` === consumptionMachineNo ||
        m.machineId === consumptionMachineNo ||
        m.name === consumptionMachineNo
    );
  }, [activeMachines, consumptionMachineNo]);

  // View Details Modal State
  const [viewEntry, setViewEntry] = useState<ChemicalEntryRecord | null>(null);

  // Load Data
  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [fetchedEntries, fetchedChemicals, fetchedWood, fetchedSuppliers, fetchedPos, fetchedMachines] = await Promise.all([
        ChemicalEntryService.getChemicalEntries(),
        ChemicalEntryService.getChemicalItems(),
        ChemicalEntryService.getWoodItems(),
        ChemicalEntryService.getSuppliers(),
        ChemicalEntryService.getPurchaseOrders(),
        MachineMasterService.getMachines().catch(() => [])
      ]);

      setEntries(fetchedEntries);
      setChemicals(fetchedChemicals);
      setWoodItems(fetchedWood);
      setSuppliers(fetchedSuppliers);
      setPurchaseOrders(fetchedPos);
      setMachines(fetchedMachines);
    } catch (err) {
      console.error('Failed to load process entries data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsubMachines = MachineMasterService.subscribeMachines((list) => {
      if (Array.isArray(list) && list.length > 0) {
        setMachines(list);
      }
    });
    return () => {
      unsubMachines();
    };
  }, []);

  // 1. Current section entries
  const currentSectionEntries = useMemo(() => {
    return entries.filter((e) => {
      const isWood = e.materialType === 'wood' || (e.entryNumber || '').startsWith('WD-');
      return activeSection === 'wood' ? isWood : !isWood;
    });
  }, [entries, activeSection]);

  // 2. Filtered entries (date range, integrated search by column, and inline column filters)
  const filteredEntries = useMemo(() => {
    return currentSectionEntries.filter((e) => {
      const isPurchase = e.entryType === 'Purchase';
      const statusText = isPurchase ? (e.isReceived ? 'Received' : 'Pending Receipt') : 'Deducted';

      // Date Range Filter
      if (startDate && e.date < startDate) return false;
      if (endDate && e.date > endDate) return false;

      // Integrated Search Filter
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        if (searchColumn === 'ALL') {
          const matchAll =
            (e.entryNumber || '').toLowerCase().includes(q) ||
            (e.date || '').toLowerCase().includes(q) ||
            formatDate(e.date).toLowerCase().includes(q) ||
            (e.chemicalName || '').toLowerCase().includes(q) ||
            (e.itemCode || '').toLowerCase().includes(q) ||
            String(e.quantity || '').toLowerCase().includes(q) ||
            (e.unit || '').toLowerCase().includes(q) ||
            String(e.rate || '').toLowerCase().includes(q) ||
            String(e.totalAmount || '').toLowerCase().includes(q) ||
            (e.supplierName || '').toLowerCase().includes(q) ||
            (e.processType || '').toLowerCase().includes(q) ||
            (e.machineNo || '').toLowerCase().includes(q) ||
            (e.boilerNo || '').toLowerCase().includes(q) ||
            (e.startTime || '').toLowerCase().includes(q) ||
            (e.endTime || '').toLowerCase().includes(q) ||
            (e.operatorName || '').toLowerCase().includes(q) ||
            statusText.toLowerCase().includes(q) ||
            (e.remarks || '').toLowerCase().includes(q);
          if (!matchAll) return false;
        } else {
          let fieldVal = '';
          switch (searchColumn) {
            case 'entryNumber':
              fieldVal = e.entryNumber || '';
              break;
            case 'date':
              fieldVal = `${e.date} ${formatDate(e.date)}`;
              break;
            case 'itemName':
              fieldVal = `${e.chemicalName || ''} ${e.itemCode || ''} ${e.remarks || ''}`;
              break;
            case 'quantity':
              fieldVal = `${e.quantity} ${e.unit || ''}`;
              break;
            case 'rate':
              fieldVal = String(e.rate || '');
              break;
            case 'totalAmount':
              fieldVal = String(e.totalAmount || '');
              break;
            case 'process':
              fieldVal = `${e.processType || ''} ${e.boilerNo || ''} ${e.machineNo || ''} ${e.operatorName || ''} ${e.supplierName || ''} ${e.startTime || ''} ${e.endTime || ''}`;
              break;
            case 'status':
              fieldVal = statusText;
              break;
          }
          if (!fieldVal.toLowerCase().includes(q)) return false;
        }
      }

      // Inline Column Filters
      for (const [colKey, filterVal] of Object.entries(columnFilters)) {
        const needle = (filterVal || '').trim().toLowerCase();
        if (!needle) continue;

        let haystack = '';
        switch (colKey) {
          case 'entryNumber':
            haystack = e.entryNumber || '';
            break;
          case 'date':
            haystack = `${e.date} ${formatDate(e.date)}`;
            break;
          case 'itemName':
            haystack = `${e.chemicalName || ''} ${e.itemCode || ''} ${e.remarks || ''}`;
            break;
          case 'quantity':
            haystack = `${e.quantity} ${e.unit || ''}`;
            break;
          case 'rate':
            haystack = String(e.rate || '');
            break;
          case 'totalAmount':
            haystack = String(e.totalAmount || '');
            break;
          case 'process':
            haystack = `${e.processType || ''} ${e.boilerNo || ''} ${e.machineNo || ''} ${e.operatorName || ''} ${e.supplierName || ''} ${e.startTime || ''} ${e.endTime || ''}`;
            break;
          case 'status':
            haystack = statusText;
            break;
        }

        if (!haystack.toLowerCase().includes(needle)) {
          return false;
        }
      }

      return true;
    });
  }, [currentSectionEntries, startDate, endDate, searchQuery, searchColumn, columnFilters]);

  // 3. Sorted Entries (3-state column sorting)
  const sortedEntries = useMemo(() => {
    if (!sortField || sortDirection === 'normal') {
      // Default: Most recent date and entry number first
      return [...filteredEntries].sort((a, b) => {
        const timeA = new Date(a.date || a.createdAt || 0).getTime();
        const timeB = new Date(b.date || b.createdAt || 0).getTime();
        if (timeB !== timeA) return timeB - timeA;
        return (b.entryNumber || '').localeCompare(a.entryNumber || '', undefined, { numeric: true });
      });
    }

    const mult = sortDirection === 'desc' ? -1 : 1;
    return [...filteredEntries].sort((a, b) => {
      switch (sortField) {
        case 'entryNumber':
          return (
            (a.entryNumber || '').localeCompare(b.entryNumber || '', undefined, {
              numeric: true,
              sensitivity: 'base'
            }) * mult
          );
        case 'date': {
          const dateA = a.date ? new Date(a.date).getTime() : 0;
          const dateB = b.date ? new Date(b.date).getTime() : 0;
          return (dateA - dateB) * mult;
        }
        case 'itemName': {
          const nameA = a.chemicalName || '';
          const nameB = b.chemicalName || '';
          return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' }) * mult;
        }
        case 'quantity': {
          const qtyA = Number(a.quantity || 0);
          const qtyB = Number(b.quantity || 0);
          return (qtyA - qtyB) * mult;
        }
        case 'rate': {
          const rateA = Number(a.rate || 0);
          const rateB = Number(b.rate || 0);
          return (rateA - rateB) * mult;
        }
        case 'totalAmount': {
          const amtA = Number(a.totalAmount || 0);
          const amtB = Number(b.totalAmount || 0);
          return (amtA - amtB) * mult;
        }
        case 'process': {
          const procA = `${a.processType || ''} ${a.boilerNo || a.machineNo || ''} ${a.operatorName || ''}`;
          const procB = `${b.processType || ''} ${b.boilerNo || b.machineNo || ''} ${b.operatorName || ''}`;
          return procA.localeCompare(procB, undefined, { sensitivity: 'base' }) * mult;
        }
        case 'status': {
          const isPurchaseA = a.entryType === 'Purchase';
          const isPurchaseB = b.entryType === 'Purchase';
          const statA = isPurchaseA ? (a.isReceived ? 'Received' : 'Pending Receipt') : 'Deducted';
          const statB = isPurchaseB ? (b.isReceived ? 'Received' : 'Pending Receipt') : 'Deducted';
          return statA.localeCompare(statB) * mult;
        }
        default:
          return 0;
      }
    });
  }, [filteredEntries, sortField, sortDirection]);

  // Active column filters count
  const activeFilterCount = useMemo(() => {
    return Object.values(columnFilters).filter((v) => (v || '').trim() !== '').length;
  }, [columnFilters]);

  // Check if any filter is active
  const hasActiveFilters = useMemo(() => {
    return (
      searchQuery.trim() !== '' ||
      searchColumn !== 'ALL' ||
      startDate !== '' ||
      endDate !== '' ||
      activeFilterCount > 0 ||
      (sortField !== null && sortDirection !== 'normal')
    );
  }, [searchQuery, searchColumn, startDate, endDate, activeFilterCount, sortField, sortDirection]);

  // Reset all filters to default
  const handleResetAllFilters = () => {
    setSearchQuery('');
    setSearchColumn('ALL');
    setStartDate('');
    setEndDate('');
    setColumnFilters({
      entryNumber: '',
      date: '',
      itemName: '',
      quantity: '',
      rate: '',
      totalAmount: '',
      process: '',
      status: ''
    });
    setSortField(null);
    setSortDirection('normal');
  };

  const handleColumnFilterChange = (colKey: string, val: string) => {
    setColumnFilters((prev) => ({
      ...prev,
      [colKey]: val
    }));
  };

  // 3-state column sorting handler
  const handleSort = (field: ProcessEntrySortField) => {
    if (sortField !== field) {
      setSortField(field);
      const defaultDesc = ['date', 'quantity', 'rate', 'totalAmount'].includes(field);
      setSortDirection(defaultDesc ? 'desc' : 'asc');
    } else {
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else if (sortDirection === 'asc') {
        setSortDirection('normal');
        setSortField(null);
      } else {
        const defaultDesc = ['date', 'quantity', 'rate', 'totalAmount'].includes(field);
        setSortDirection(defaultDesc ? 'desc' : 'asc');
      }
    }
  };

  const renderSortIcon = (field: ProcessEntrySortField) => {
    if (sortField === field && sortDirection !== 'normal') {
      if (sortDirection === 'asc') {
        return (
          <span className="p-0.5 rounded bg-blue-100 text-[#1F4E79] shadow-2xs">
            <ChevronUp className="w-3.5 h-3.5 stroke-[2.5]" />
          </span>
        );
      }
      if (sortDirection === 'desc') {
        return (
          <span className="p-0.5 rounded bg-blue-100 text-[#1F4E79] shadow-2xs">
            <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
          </span>
        );
      }
    }
    return (
      <span className="p-0.5 rounded text-slate-400 group-hover:text-slate-600 transition-colors">
        <ArrowUpDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" />
      </span>
    );
  };

  const getSortTooltip = (field: ProcessEntrySortField, label: string) => {
    if (sortField !== field || !sortDirection || sortDirection === 'normal') {
      return `Click to sort by ${label}`;
    }
    if (sortDirection === 'asc') {
      return `Currently sorted ${label} ascending. Click for descending`;
    }
    return `Currently sorted ${label} descending. Click to reset (normal form)`;
  };

  const getSortColumnLabel = (field: ProcessEntrySortField) => {
    switch (field) {
      case 'entryNumber': return 'Entry No';
      case 'date': return 'Date';
      case 'itemName': return activeSection === 'wood' ? 'Raw Wood Material' : 'Chemical Name';
      case 'quantity': return 'Quantity';
      case 'rate': return 'Rate / Unit';
      case 'totalAmount': return 'Total Amount';
      case 'process': return activeSection === 'wood' ? 'Boiler & Timing' : 'Process & Timing';
      case 'status': return 'Stock Status';
      default: return field;
    }
  };

  // KPI Metrics calculated per section
  const metrics = useMemo(() => {
    const chemicalEntries = entries.filter(
      (e) => e.materialType !== 'wood' && !(e.entryNumber || '').startsWith('WD-')
    );
    const woodEntries = entries.filter(
      (e) => e.materialType === 'wood' || (e.entryNumber || '').startsWith('WD-')
    );

    let chemicalPurchasesAmount = 0;
    let chemicalConsumedQty = 0;
    let chemicalConsumedAmount = 0;

    chemicalEntries.forEach((e) => {
      if (e.entryType === 'Purchase') {
        chemicalPurchasesAmount += Number(e.totalAmount || 0);
      } else if (e.entryType === 'Consumption') {
        chemicalConsumedQty += Number(e.quantity || 0);
        chemicalConsumedAmount += Number(e.totalAmount || 0);
      }
    });

    let woodConsumedQty = 0;
    let woodConsumedAmount = 0;

    woodEntries.forEach((e) => {
      woodConsumedQty += Number(e.quantity || 0);
      woodConsumedAmount += Number(e.totalAmount || 0);
    });

    const woodPrimaryUnit = woodItems.length > 0 ? woodItems[0].baseUnit || 't' : 't';

    return {
      // Chemical tab stats
      chemicalTotalEntries: chemicalEntries.length,
      chemicalPurchasesCount: chemicalEntries.filter((e) => e.entryType === 'Purchase').length,
      chemicalConsumptionsCount: chemicalEntries.filter((e) => e.entryType === 'Consumption').length,
      chemicalConsumedQty,
      chemicalConsumedAmount,
      activeChemicalsCount: chemicals.length,

      // Wood tab stats
      woodTotalEntries: woodEntries.length,
      woodConsumedQty,
      woodConsumedAmount,
      woodPrimaryUnit,
      activeWoodCount: woodItems.length
    };
  }, [entries, chemicals, woodItems]);

  // Handlers for Purchase Modal
  const openPurchaseModal = () => {
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setPurchaseItemId(chemicals[0]?.id || chemicals[0]?.itemId || '');
    setPurchaseUnit(chemicals[0]?.baseUnit || 'kg');
    setPurchaseRate(chemicals[0]?.defaultPurchaseRate || '');
    setPurchaseQuantity('');
    setPurchaseSupplierId(suppliers[0]?.id || '');
    setPurchaseSupplierInvoiceNo('');
    setPurchaseIsReceived(true);
    setPurchaseRemarks('');
    setPurchaseError(null);
    setIsPurchaseModalOpen(true);
  };

  const handleSelectPurchaseChemical = (item: MasterItem) => {
    setPurchaseItemId(item.id || item.itemId);
    setPurchaseUnit(item.baseUnit || 'kg');
    if (item.defaultPurchaseRate) {
      setPurchaseRate(item.defaultPurchaseRate);
    }
  };

  const handlePurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseItemId) {
      setPurchaseError('Please select a chemical item from the Chemical Master.');
      return;
    }
    const qty = parseFloat(String(purchaseQuantity));
    if (isNaN(qty) || qty <= 0) {
      setPurchaseError('Quantity must be greater than zero.');
      return;
    }
    const rate = parseFloat(String(purchaseRate || 0));
    if (rate < 0) {
      setPurchaseError('Rate per unit cannot be negative.');
      return;
    }

    setPurchaseSubmitting(true);
    setPurchaseError(null);

    try {
      const selectedChemical = chemicals.find(
        (c) => c.id === purchaseItemId || c.itemId === purchaseItemId
      );
      const selectedSupplier = suppliers.find((s) => s.id === purchaseSupplierId);

      const payload: CreateChemicalEntryPayload = {
        entryType: 'Purchase',
        itemId: purchaseItemId,
        date: purchaseDate,
        quantity: qty,
        unit: purchaseUnit,
        rate: rate,
        supplierId: purchaseSupplierId || undefined,
        supplierName: selectedSupplier?.companyName || undefined,
        supplierInvoiceNo: purchaseSupplierInvoiceNo.trim() || undefined,
        isReceived: purchaseIsReceived,
        remarks: purchaseRemarks.trim() || undefined
      };

      const newEntry = await ChemicalEntryService.recordEntry(payload, {
        uid: user?.uid || 'user-1',
        displayName: user?.displayName || user?.email || 'Authorized User'
      });

      setEntries((prev) => [newEntry, ...prev]);
      setIsPurchaseModalOpen(false);

      // Refresh stock balance
      loadData(true);
    } catch (err: any) {
      console.error('Error saving chemical purchase:', err);
      setPurchaseError(err?.message || 'Failed to save chemical purchase entry.');
    } finally {
      setPurchaseSubmitting(false);
    }
  };

  // Handlers for Consumption Modal
  const openConsumptionModal = () => {
    setConsumptionDate(new Date().toISOString().split('T')[0]);
    const firstChem = chemicals[0];
    setConsumptionItemId(firstChem?.id || firstChem?.itemId || '');
    setConsumptionUnit(firstChem?.baseUnit || 'kg');
    const initRate = firstChem?.defaultPurchaseRate || 0;
    setConsumptionRate(initRate > 0 ? initRate : '');
    setConsumptionQuantity('');
    setConsumptionProcessType('Dyeing');
    const initialMach = activeMachines.find((m) => (m.processType || '').toLowerCase() === 'dyeing') || activeMachines[0];
    setConsumptionMachineNo(initialMach ? `${initialMach.machineId} - ${initialMach.name}` : '');
    setIsCustomConsumptionMachine(false);
    setConsumptionStartTime('');
    setConsumptionEndTime('');
    setConsumptionOperatorName('');
    setConsumptionRemarks('');
    setConsumptionError(null);
    setIsConsumptionModalOpen(true);
  };

  const handleSelectConsumptionChemical = (item: MasterItem) => {
    setConsumptionItemId(item.id || item.itemId);
    setConsumptionUnit(item.baseUnit || 'kg');
    const r = item.defaultPurchaseRate || 0;
    setConsumptionRate(r > 0 ? r : '');
    setConsumptionQuantity('');
  };

  const selectedConsumptionChemical = useMemo(() => {
    return chemicals.find((c) => c.id === consumptionItemId || c.itemId === consumptionItemId);
  }, [chemicals, consumptionItemId]);

  const availableStockForSelected = Number(selectedConsumptionChemical?.currentStock || 0);

  // Compatible units for chemical (e.g. kg, g, qtl, or l, ml)
  const compatibleChemicalUnits = useMemo(() => {
    return getCompatibleUnits(selectedConsumptionChemical?.baseUnit || 'kg');
  }, [selectedConsumptionChemical?.baseUnit]);

  // Warehouse stock converted to the currently selected consumptionUnit
  const availableStockInSelectedChemUnit = useMemo(() => {
    const baseUnit = selectedConsumptionChemical?.baseUnit || 'kg';
    return convertQuantity(availableStockForSelected, baseUnit, consumptionUnit);
  }, [availableStockForSelected, selectedConsumptionChemical?.baseUnit, consumptionUnit]);

  // Average rate converted to the currently selected consumptionUnit
  const avgRateInSelectedChemUnit = useMemo(() => {
    const baseRate = Number(selectedConsumptionChemical?.defaultPurchaseRate || 0);
    const baseUnit = selectedConsumptionChemical?.baseUnit || 'kg';
    return convertRate(baseRate, baseUnit, consumptionUnit);
  }, [selectedConsumptionChemical?.defaultPurchaseRate, selectedConsumptionChemical?.baseUnit, consumptionUnit]);

  const handleConsumptionUnitChange = (newUnit: string) => {
    if (newUnit === consumptionUnit) return;
    const oldUnit = consumptionUnit;
    setConsumptionUnit(newUnit);
    if (consumptionQuantity !== '' && !isNaN(Number(consumptionQuantity))) {
      const convertedQty = convertQuantity(Number(consumptionQuantity), oldUnit, newUnit);
      setConsumptionQuantity(convertedQty > 0 ? convertedQty : '');
    }
    if (consumptionRate !== '' && !isNaN(Number(consumptionRate))) {
      const convertedRate = convertRate(Number(consumptionRate), oldUnit, newUnit);
      setConsumptionRate(convertedRate > 0 ? Math.round(convertedRate * 10000) / 10000 : '');
    }
  };

  const handleProcessStageChange = (newStage: string) => {
    setConsumptionProcessType(newStage);
    if (!isCustomConsumptionMachine) {
      const stageLower = newStage.toLowerCase();
      const match = activeMachines.find((m) => {
        const pType = (m.processType || '').toLowerCase();
        const mName = (m.name || '').toLowerCase();
        if (stageLower.includes('dye')) return pType === 'dyeing' || mName.includes('dye');
        if (
          stageLower.includes('wash') ||
          stageLower.includes('enzyme') ||
          stageLower.includes('scour') ||
          stageLower.includes('bleach') ||
          stageLower.includes('soften')
        ) {
          return pType === 'washing' || mName.includes('wash') || mName.includes('hydro');
        }
        if (stageLower.includes('boiler') || stageLower.includes('utility')) {
          return pType === 'boiler' || mName.includes('boiler');
        }
        if (stageLower.includes('finish')) {
          return pType === 'finishing' || mName.includes('finish') || mName.includes('stenter');
        }
        return pType === stageLower;
      });
      if (match) {
        setConsumptionMachineNo(`${match.machineId} - ${match.name}`);
      }
    }
  };

  const handleConsumptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consumptionItemId) {
      setConsumptionError('Please select a chemical item from the Chemical Master.');
      return;
    }
    const qty = parseFloat(String(consumptionQuantity));
    if (isNaN(qty) || qty <= 0) {
      setConsumptionError('Consumed quantity must be greater than zero.');
      return;
    }

    if (qty > availableStockInSelectedChemUnit) {
      setConsumptionError(
        `Insufficient stock! Requested: ${qty.toLocaleString('en-IN')} ${consumptionUnit}, but only ${availableStockInSelectedChemUnit.toLocaleString('en-IN', { maximumFractionDigits: 3 })} ${consumptionUnit} is available in warehouse stock.`
      );
      return;
    }

    const baseUnit = selectedConsumptionChemical?.baseUnit || 'kg';
    const qtyInBaseUnit = convertQuantity(qty, consumptionUnit, baseUnit);

    const rateVal =
      parseFloat(String(consumptionRate)) > 0
        ? parseFloat(String(consumptionRate))
        : avgRateInSelectedChemUnit;
    const totalAmt = Math.round(qty * rateVal * 100) / 100;

    setConsumptionSubmitting(true);
    setConsumptionError(null);

    try {
      const payload: CreateChemicalEntryPayload = {
        materialType: 'chemical',
        entryType: 'Consumption',
        itemId: consumptionItemId,
        date: consumptionDate,
        quantity: qty,
        unit: consumptionUnit,
        baseQuantity: qtyInBaseUnit,
        baseUnit: baseUnit,
        rate: rateVal,
        totalAmount: totalAmt,
        processType: consumptionProcessType,
        machineNo: consumptionMachineNo.trim() || undefined,
        startTime: consumptionStartTime || undefined,
        endTime: consumptionEndTime || undefined,
        operatorName: consumptionOperatorName.trim() || undefined,
        remarks: consumptionRemarks.trim() || undefined
      };

      const newEntry = await ChemicalEntryService.recordEntry(payload, {
        uid: user?.uid || 'user-1',
        displayName: user?.displayName || user?.email || 'Authorized User'
      });

      setEntries((prev) => [newEntry, ...prev]);
      setIsConsumptionModalOpen(false);

      // Refresh stock balance
      loadData(true);
    } catch (err: any) {
      console.error('Error saving chemical consumption:', err);
      setConsumptionError(err?.message || 'Failed to save chemical consumption.');
    } finally {
      setConsumptionSubmitting(false);
    }
  };

  // Handlers for Raw Wood Usage Modal
  const openWoodModal = () => {
    setWoodDate(new Date().toISOString().split('T')[0]);
    const firstWood = woodItems[0];
    setWoodItemId(firstWood?.id || firstWood?.itemId || '');
    const baseUnit = firstWood?.baseUnit || 't';
    setWoodUnit(baseUnit);
    const initRate = firstWood?.defaultPurchaseRate || 0;
    setWoodRate(initRate > 0 ? initRate : '');
    setWoodQuantity('');
    setWoodBoilerStage('Steam Generation (Boiler)');
    const initialBoiler = boilerMachines[0] || activeMachines[0];
    setWoodBoilerNo(initialBoiler ? `${initialBoiler.machineId} - ${initialBoiler.name}` : '');
    setIsCustomWoodBoiler(false);
    setWoodStartTime('');
    setWoodEndTime('');
    setWoodOperatorName(''); // NO DEFAULT VALUE
    setWoodRemarks('');
    setWoodError(null);
    setIsWoodModalOpen(true);
  };

  const handleSelectWoodItem = (item: MasterItem) => {
    setWoodItemId(item.id || item.itemId);
    const baseUnit = item.baseUnit || 't';
    setWoodUnit(baseUnit);
    const r = item.defaultPurchaseRate || 0;
    setWoodRate(r > 0 ? r : '');
    setWoodQuantity('');
  };

  const selectedConsumptionWood = useMemo(() => {
    return woodItems.find((w) => w.id === woodItemId || w.itemId === woodItemId);
  }, [woodItems, woodItemId]);

  const availableStockForSelectedWood = Number(selectedConsumptionWood?.currentStock || 0);

  // Compatible units for the selected wood item (e.g. t, kg, qtl)
  const compatibleWoodUnits = useMemo(() => {
    return getCompatibleUnits(selectedConsumptionWood?.baseUnit || 't');
  }, [selectedConsumptionWood?.baseUnit]);

  // Warehouse stock converted to the currently selected woodUnit
  const availableStockInSelectedWoodUnit = useMemo(() => {
    const baseUnit = selectedConsumptionWood?.baseUnit || 't';
    return convertQuantity(availableStockForSelectedWood, baseUnit, woodUnit);
  }, [availableStockForSelectedWood, selectedConsumptionWood?.baseUnit, woodUnit]);

  // Average rate converted to the currently selected woodUnit
  const avgRateInSelectedWoodUnit = useMemo(() => {
    const baseRate = Number(selectedConsumptionWood?.defaultPurchaseRate || 0);
    const baseUnit = selectedConsumptionWood?.baseUnit || 't';
    return convertRate(baseRate, baseUnit, woodUnit);
  }, [selectedConsumptionWood?.defaultPurchaseRate, selectedConsumptionWood?.baseUnit, woodUnit]);

  const handleWoodUnitChange = (newUnit: string) => {
    if (newUnit === woodUnit) return;
    const oldUnit = woodUnit;
    setWoodUnit(newUnit);

    // Smoothly convert existing entered quantity if present
    if (woodQuantity !== '' && !isNaN(Number(woodQuantity))) {
      const convertedQty = convertQuantity(Number(woodQuantity), oldUnit, newUnit);
      setWoodQuantity(convertedQty > 0 ? convertedQty : '');
    }

    // Smoothly convert existing entered rate if present
    if (woodRate !== '' && !isNaN(Number(woodRate))) {
      const convertedRate = convertRate(Number(woodRate), oldUnit, newUnit);
      setWoodRate(convertedRate > 0 ? Math.round(convertedRate * 10000) / 10000 : '');
    }
  };

  const handleWoodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!woodItemId) {
      setWoodError('Please select a raw wood / firewood item from the Item Master.');
      return;
    }
    const qty = parseFloat(String(woodQuantity));
    if (isNaN(qty) || qty <= 0) {
      setWoodError('Consumed wood quantity must be greater than zero.');
      return;
    }

    if (qty > availableStockInSelectedWoodUnit) {
      setWoodError(
        `Insufficient wood stock! Requested: ${qty.toLocaleString('en-IN')} ${woodUnit}, but only ${availableStockInSelectedWoodUnit.toLocaleString('en-IN', { maximumFractionDigits: 3 })} ${woodUnit} is available in warehouse stock.`
      );
      return;
    }

    const baseUnit = selectedConsumptionWood?.baseUnit || 't';
    const qtyInBaseUnit = convertQuantity(qty, woodUnit, baseUnit);

    const rateVal =
      parseFloat(String(woodRate)) > 0
        ? parseFloat(String(woodRate))
        : avgRateInSelectedWoodUnit;
    const totalAmt = Math.round(qty * rateVal * 100) / 100;

    setWoodSubmitting(true);
    setWoodError(null);

    try {
      const payload: CreateChemicalEntryPayload = {
        materialType: 'wood',
        entryType: 'Consumption',
        itemId: woodItemId,
        date: woodDate,
        quantity: qty,
        unit: woodUnit,
        baseQuantity: qtyInBaseUnit,
        baseUnit: baseUnit,
        rate: rateVal,
        totalAmount: totalAmt,
        processType: woodBoilerStage,
        machineNo: woodBoilerNo.trim() || undefined,
        boilerNo: woodBoilerNo.trim() || undefined,
        startTime: woodStartTime || undefined,
        endTime: woodEndTime || undefined,
        operatorName: woodOperatorName.trim() || undefined,
        remarks: woodRemarks.trim() || undefined
      };

      const newEntry = await ChemicalEntryService.recordEntry(payload, {
        uid: user?.uid || 'user-1',
        displayName: user?.displayName || user?.email || 'Authorized User'
      });

      setEntries((prev) => [newEntry, ...prev]);
      setIsWoodModalOpen(false);

      // Refresh stock balance
      loadData(true);
    } catch (err: any) {
      console.error('Error saving raw wood usage:', err);
      setWoodError(err?.message || 'Failed to save raw wood usage.');
    } finally {
      setWoodSubmitting(false);
    }
  };

  // Confirm receipt of pending purchase
  const handleConfirmReceipt = async (entry: ChemicalEntryRecord) => {
    const confirm = window.confirm(
      `Confirm physical arrival and inward ${entry.quantity} ${entry.unit} of '${entry.chemicalName}' into warehouse stock?`
    );
    if (!confirm) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const updated = await ChemicalEntryService.receivePurchase(entry.id, today, {
        uid: user?.uid || 'user-1',
        displayName: user?.displayName || user?.email || 'Authorized User'
      });

      setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      loadData(true);
    } catch (err: any) {
      alert(`Error receiving stock: ${err?.message || 'Operation failed'}`);
    }
  };

  // Delete / Revert Entry
  const handleDeleteEntry = async (entry: ChemicalEntryRecord) => {
    const isWood = entry.materialType === 'wood' || (entry.entryNumber || '').startsWith('WD-');
    const confirm = window.confirm(
      `Are you sure you want to delete ${isWood ? 'raw wood usage' : 'chemical'} entry '${entry.entryNumber}'? The consumed quantity will be restored to warehouse stock, and the stock valuation and average rate will be automatically updated.`
    );
    if (!confirm) return;

    try {
      await ChemicalEntryService.deleteEntry(entry.id, {
        uid: user?.uid || 'user-1',
        displayName: user?.displayName || user?.email || 'Authorized User'
      });
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      loadData(true);
    } catch (err: any) {
      alert(`Error deleting entry: ${err?.message || 'Operation failed'}`);
    }
  };

  // Export to Excel
  const handleExportExcel = async () => {
    try {
      const isWood = activeSection === 'wood';
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(isWood ? 'Raw Wood Usage' : 'Process Entries');

      if (isWood) {
        worksheet.columns = [
          { header: 'Entry Number', key: 'entryNumber', width: 18 },
          { header: 'Date', key: 'date', width: 14 },
          { header: 'Wood / Material Name', key: 'materialName', width: 28 },
          { header: 'Quantity', key: 'quantity', width: 14 },
          { header: 'Unit', key: 'unit', width: 10 },
          { header: 'Rate (₹)', key: 'rate', width: 14 },
          { header: 'Total Amount (₹)', key: 'totalAmount', width: 18 },
          { header: 'Boiler / Stage', key: 'boilerStage', width: 24 },
          { header: 'Boiler / Machine No', key: 'boilerNo', width: 18 },
          { header: 'Start Time', key: 'startTime', width: 14 },
          { header: 'End Time', key: 'endTime', width: 14 },
          { header: 'Operator', key: 'operator', width: 18 },
          { header: 'Stock Status', key: 'stockStatus', width: 18 },
          { header: 'Remarks', key: 'remarks', width: 25 }
        ];

        sortedEntries.forEach((e) => {
          worksheet.addRow({
            entryNumber: e.entryNumber,
            date: e.date,
            materialName: e.chemicalName,
            quantity: Number(e.quantity) || 0,
            unit: e.unit || 't',
            rate: Number(e.rate) || 0,
            totalAmount: Number(e.totalAmount) || 0,
            boilerStage: e.processType || 'Steam Generation (Boiler)',
            boilerNo: e.boilerNo || e.machineNo || '—',
            startTime: e.startTime || '—',
            endTime: e.endTime || '—',
            operator: e.operatorName || '—',
            stockStatus: 'Deducted from Stock',
            remarks: e.remarks || ''
          });
        });
      } else {
        worksheet.columns = [
          { header: 'Entry Number', key: 'entryNumber', width: 18 },
          { header: 'Date', key: 'date', width: 14 },
          { header: 'Type', key: 'entryType', width: 14 },
          { header: 'Chemical Name', key: 'chemicalName', width: 28 },
          { header: 'Quantity', key: 'quantity', width: 14 },
          { header: 'Unit', key: 'unit', width: 10 },
          { header: 'Rate (₹)', key: 'rate', width: 14 },
          { header: 'Total Amount (₹)', key: 'totalAmount', width: 18 },
          { header: 'Process / Supplier', key: 'processStage', width: 22 },
          { header: 'Machine No', key: 'machineNo', width: 16 },
          { header: 'Start Time', key: 'startTime', width: 14 },
          { header: 'End Time', key: 'endTime', width: 14 },
          { header: 'Operator', key: 'operator', width: 18 },
          { header: 'Stock Status', key: 'stockStatus', width: 18 },
          { header: 'Remarks', key: 'remarks', width: 25 }
        ];

        sortedEntries.forEach((e) => {
          worksheet.addRow({
            entryNumber: e.entryNumber,
            date: e.date,
            entryType: e.entryType,
            chemicalName: e.chemicalName,
            quantity: Number(e.quantity) || 0,
            unit: e.unit || 'kg',
            rate: Number(e.rate) || 0,
            totalAmount: Number(e.totalAmount) || 0,
            processStage:
              e.entryType === 'Purchase'
                ? e.supplierName || 'Direct'
                : e.processType || 'Processing',
            machineNo: e.machineNo || '—',
            startTime: e.startTime || '—',
            endTime: e.endTime || '—',
            operator: e.operatorName || '—',
            stockStatus:
              e.entryType === 'Purchase'
                ? e.isReceived
                  ? 'Received & Inwarded'
                  : 'Pending Receipt'
                : 'Deducted from Stock',
            remarks: e.remarks || ''
          });
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const today = new Date().toISOString().split('T')[0];
      a.download = isWood
        ? `Perla_Raw_Wood_Usage_${today}.xlsx`
        : `Perla_Chemical_Process_Entries_${today}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting excel:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header - Minimal & Airy */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Process Entry</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Shopfloor chemical recipe consumption, washing &amp; dyeing batches, and boiler raw wood usage
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-medium hover:bg-slate-50 transition cursor-pointer"
            title="Reload data"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Reload</span>
          </button>

          {activeSection === 'chemical' ? (
            <button
              type="button"
              onClick={openConsumptionModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-medium transition cursor-pointer shadow-2xs"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Record Consumption</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={openWoodModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-medium transition cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Wood Usage</span>
            </button>
          )}
        </div>
      </div>

      {/* TABS ROW: Chemical Process Entry & Raw Wood Usage */}
      <div className="flex items-center gap-8 border-b border-slate-200/90 px-1 pt-1">
        <button
          onClick={() => {
            setActiveSection('chemical');
            setSearchQuery('');
            setSearchColumn('ALL');
            setColumnFilters({
              entryNumber: '',
              date: '',
              itemName: '',
              quantity: '',
              rate: '',
              totalAmount: '',
              process: '',
              status: ''
            });
            setSortField(null);
            setSortDirection('normal');
          }}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition cursor-pointer border-b-2 ${
            activeSection === 'chemical'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FlaskConical className="w-4 h-4" />
          <span>Chemical Process Entry</span>
        </button>

        <button
          onClick={() => {
            setActiveSection('wood');
            setSearchQuery('');
            setSearchColumn('ALL');
            setColumnFilters({
              entryNumber: '',
              date: '',
              itemName: '',
              quantity: '',
              rate: '',
              totalAmount: '',
              process: '',
              status: ''
            });
            setSortField(null);
            setSortDirection('normal');
          }}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition cursor-pointer border-b-2 ${
            activeSection === 'wood'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Flame className="w-4 h-4" />
          <span>Raw Wood Usage</span>
        </button>
      </div>

      {/* KPI Cards (3 in a row, clean & simple) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Entries */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Total Entries Recorded
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {activeSection === 'chemical' ? metrics.chemicalTotalEntries : metrics.woodTotalEntries}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {activeSection === 'chemical'
              ? `${metrics.chemicalPurchasesCount} Purchases · ${metrics.chemicalConsumptionsCount} Consumptions`
              : `${metrics.woodTotalEntries} Boiler Fuel Consumptions`}
          </div>
        </div>

        {/* Card 2: Total Consumed Quantity */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            {activeSection === 'chemical' ? 'Total Consumed Quantity' : 'Total Wood Consumed'}
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {activeSection === 'chemical'
              ? `${(Number(metrics.chemicalConsumedQty) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} kg`
              : `${(Number(metrics.woodConsumedQty) || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })} ${metrics.woodPrimaryUnit}`}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {activeSection === 'chemical'
              ? 'Shopfloor recipe usage deducted from warehouse stock'
              : 'Boiler steam fuel deducted from warehouse stock'}
          </div>
        </div>

        {/* Card 3: Total Worth */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            {activeSection === 'chemical' ? 'Total Material Consumed Worth' : 'Total Fuel Consumed Worth'}
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {formatCurrency(activeSection === 'chemical' ? metrics.chemicalConsumedAmount : metrics.woodConsumedAmount)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Valuation based on warehouse average cost
          </div>
        </div>
      </div>

      {/* Main Ledger Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Integrated Search & Filters Header */}
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white">
          {/* Left: Column Selector Dropdown + Search Input + Column Filters Toggle */}
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[300px]">
            {/* Column Selector & Search Group */}
            <div className="flex items-center rounded-lg border border-slate-300 bg-white overflow-hidden shadow-2xs h-9">
              <select
                value={searchColumn}
                onChange={(e) => setSearchColumn(e.target.value as ProcessEntrySearchColumn)}
                className="h-full bg-slate-50 border-r border-slate-300 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus:outline-none cursor-pointer"
                title="Select column to search"
              >
                <option value="ALL">All Columns</option>
                <option value="entryNumber">Entry No</option>
                <option value="date">Date</option>
                <option value="itemName">{activeSection === 'wood' ? 'Raw Wood Material' : 'Chemical Name'}</option>
                <option value="quantity">Quantity</option>
                <option value="rate">Rate / Unit</option>
                <option value="totalAmount">Total Amount</option>
                <option value="process">{activeSection === 'wood' ? 'Boiler & Timing' : 'Process & Timing'}</option>
                <option value="status">Stock Status</option>
              </select>

              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5" />
                <input
                  type="text"
                  placeholder={
                    searchColumn === 'ALL'
                      ? 'Search all columns...'
                      : `Search ${searchColumn}...`
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-7 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none w-48 sm:w-64"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Column Filters Toggle Button */}
            <button
              type="button"
              onClick={() => setShowColumnFilters((prev) => !prev)}
              className={`h-9 px-3 rounded-lg border text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                showColumnFilters || activeFilterCount > 0
                  ? 'bg-blue-50 border-blue-300 text-[#1F4E79]'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
              title="Toggle column-wise search inputs on table header"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Column Filters</span>
              {activeFilterCount > 0 && (
                <span className="bg-slate-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Reset All Filters button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetAllFilters}
                className="h-9 px-2.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
                title="Reset All Filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Right: Date Range & Export Excel */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 h-9">
              <span className="text-[10px] font-bold text-slate-400 uppercase">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-xs text-slate-700 font-medium focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 h-9">
              <span className="text-[10px] font-bold text-slate-400 uppercase">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-xs text-slate-700 font-medium focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleExportExcel}
              className="h-9 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* Active Sort Banner */}
        {sortField && sortDirection && sortDirection !== 'normal' && (
          <div className="flex items-center justify-between px-4 py-2 bg-blue-50/90 border-b border-blue-200 text-xs text-[#1F4E79]">
            <div className="flex items-center gap-2">
              <span className="font-medium">
                Sorted by <strong className="font-bold underline">{getSortColumnLabel(sortField)}</strong> ({sortDirection === 'asc' ? 'Ascending ↑' : 'Descending ↓'})
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setSortField(null);
                setSortDirection('normal');
              }}
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 underline cursor-pointer"
              title="Reset to default order"
            >
              Clear / Desort
            </button>
          </div>
        )}

        {/* Sticky Table Container */}
        <div className="overflow-x-auto max-h-[620px] overflow-y-auto relative">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-20 shadow-[0_1px_3px_rgba(0,0,0,0.06)] bg-[#EEF5FB] text-[#1F4E79] font-bold uppercase tracking-wider text-[11px] border-b-2 border-slate-300">
              <tr>
                {/* 1. Entry No */}
                <th
                  className={`py-3 px-3.5 border-r border-b-2 border-slate-300 cursor-pointer select-none transition-colors group whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] ${
                    sortField === 'entryNumber' && sortDirection !== 'normal' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                  }`}
                  onClick={() => handleSort('entryNumber')}
                  title={getSortTooltip('entryNumber', 'Entry Number')}
                >
                  <div className="flex items-center gap-1.5 justify-start">
                    <span>Entry No</span>
                    {renderSortIcon('entryNumber')}
                  </div>
                </th>

                {/* 2. Date */}
                <th
                  className={`py-3 px-3.5 border-r border-b-2 border-slate-300 cursor-pointer select-none transition-colors group whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] ${
                    sortField === 'date' && sortDirection !== 'normal' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                  }`}
                  onClick={() => handleSort('date')}
                  title={getSortTooltip('date', 'Date')}
                >
                  <div className="flex items-center gap-1.5 justify-center">
                    <span>Date</span>
                    {renderSortIcon('date')}
                  </div>
                </th>

                {/* 3. Chemical / Raw Wood */}
                <th
                  className={`py-3 px-3.5 border-r border-b-2 border-slate-300 cursor-pointer select-none transition-colors group whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] ${
                    sortField === 'itemName' && sortDirection !== 'normal' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                  }`}
                  onClick={() => handleSort('itemName')}
                  title={getSortTooltip('itemName', activeSection === 'wood' ? 'Raw Wood Material' : 'Chemical Name')}
                >
                  <div className="flex items-center gap-1.5 justify-start">
                    <span>{activeSection === 'wood' ? 'Raw Wood / Material' : 'Chemical Name'}</span>
                    {renderSortIcon('itemName')}
                  </div>
                </th>

                {/* 4. Quantity */}
                <th
                  className={`py-3 px-3 border-r border-b-2 border-slate-300 cursor-pointer select-none transition-colors group whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] text-right ${
                    sortField === 'quantity' && sortDirection !== 'normal' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                  }`}
                  onClick={() => handleSort('quantity')}
                  title={getSortTooltip('quantity', 'Quantity')}
                >
                  <div className="flex items-center gap-1.5 justify-end">
                    <span>Quantity</span>
                    {renderSortIcon('quantity')}
                  </div>
                </th>

                {/* 5. Rate / Unit */}
                <th
                  className={`py-3 px-3 border-r border-b-2 border-slate-300 cursor-pointer select-none transition-colors group whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] text-right ${
                    sortField === 'rate' && sortDirection !== 'normal' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                  }`}
                  onClick={() => handleSort('rate')}
                  title={getSortTooltip('rate', 'Rate / Unit')}
                >
                  <div className="flex items-center gap-1.5 justify-end">
                    <span>Rate / Unit</span>
                    {renderSortIcon('rate')}
                  </div>
                </th>

                {/* 6. Total Amount */}
                <th
                  className={`py-3 px-3.5 border-r border-b-2 border-slate-300 cursor-pointer select-none transition-colors group whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] text-right ${
                    sortField === 'totalAmount' && sortDirection !== 'normal' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                  }`}
                  onClick={() => handleSort('totalAmount')}
                  title={getSortTooltip('totalAmount', 'Total Amount')}
                >
                  <div className="flex items-center gap-1.5 justify-end">
                    <span>Total Amount</span>
                    {renderSortIcon('totalAmount')}
                  </div>
                </th>

                {/* 7. Process & Timing / Boiler */}
                <th
                  className={`py-3 px-3.5 border-r border-b-2 border-slate-300 cursor-pointer select-none transition-colors group whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] ${
                    sortField === 'process' && sortDirection !== 'normal' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                  }`}
                  onClick={() => handleSort('process')}
                  title={getSortTooltip('process', activeSection === 'wood' ? 'Boiler & Timing' : 'Process & Timing')}
                >
                  <div className="flex items-center gap-1.5 justify-start">
                    <span>{activeSection === 'wood' ? 'Boiler & Timing' : 'Process & Timing'}</span>
                    {renderSortIcon('process')}
                  </div>
                </th>

                {/* 8. Stock Status */}
                <th
                  className={`py-3 px-3 border-r border-b-2 border-slate-300 cursor-pointer select-none transition-colors group whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] text-center ${
                    sortField === 'status' && sortDirection !== 'normal' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                  }`}
                  onClick={() => handleSort('status')}
                  title={getSortTooltip('status', 'Stock Status')}
                >
                  <div className="flex items-center gap-1.5 justify-center">
                    <span>Stock Status</span>
                    {renderSortIcon('status')}
                  </div>
                </th>

                {/* 9. Actions */}
                <th className="py-3 px-3.5 text-center w-28 whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] border-b-2 border-slate-300">
                  Actions
                </th>
              </tr>

              {/* Inline Column Filter Inputs Row */}
              {showColumnFilters && (
                <tr className="bg-slate-100/90 border-b-2 border-slate-300">
                  <th className="p-1.5 border-r border-slate-300 sticky top-[41px] z-20 bg-slate-100">
                    <input
                      type="text"
                      placeholder="Filter entry #..."
                      value={columnFilters.entryNumber || ''}
                      onChange={(e) => handleColumnFilterChange('entryNumber', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 font-normal"
                    />
                  </th>
                  <th className="p-1.5 border-r border-slate-300 sticky top-[41px] z-20 bg-slate-100 text-center">
                    <input
                      type="text"
                      placeholder="Filter date..."
                      value={columnFilters.date || ''}
                      onChange={(e) => handleColumnFilterChange('date', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 font-normal text-center"
                    />
                  </th>
                  <th className="p-1.5 border-r border-slate-300 sticky top-[41px] z-20 bg-slate-100">
                    <input
                      type="text"
                      placeholder={activeSection === 'wood' ? 'Filter wood material...' : 'Filter chemical...'}
                      value={columnFilters.itemName || ''}
                      onChange={(e) => handleColumnFilterChange('itemName', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 font-normal"
                    />
                  </th>
                  <th className="p-1.5 border-r border-slate-300 sticky top-[41px] z-20 bg-slate-100 text-right">
                    <input
                      type="text"
                      placeholder="Filter qty..."
                      value={columnFilters.quantity || ''}
                      onChange={(e) => handleColumnFilterChange('quantity', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 font-normal text-right font-mono"
                    />
                  </th>
                  <th className="p-1.5 border-r border-slate-300 sticky top-[41px] z-20 bg-slate-100 text-right">
                    <input
                      type="text"
                      placeholder="Filter rate..."
                      value={columnFilters.rate || ''}
                      onChange={(e) => handleColumnFilterChange('rate', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 font-normal text-right font-mono"
                    />
                  </th>
                  <th className="p-1.5 border-r border-slate-300 sticky top-[41px] z-20 bg-slate-100 text-right">
                    <input
                      type="text"
                      placeholder="Filter amount..."
                      value={columnFilters.totalAmount || ''}
                      onChange={(e) => handleColumnFilterChange('totalAmount', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 font-normal text-right font-mono"
                    />
                  </th>
                  <th className="p-1.5 border-r border-slate-300 sticky top-[41px] z-20 bg-slate-100">
                    <input
                      type="text"
                      placeholder={activeSection === 'wood' ? 'Filter boiler, op...' : 'Filter process, op...'}
                      value={columnFilters.process || ''}
                      onChange={(e) => handleColumnFilterChange('process', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 font-normal"
                    />
                  </th>
                  <th className="p-1.5 border-r border-slate-300 sticky top-[41px] z-20 bg-slate-100 text-center">
                    <input
                      type="text"
                      placeholder="Filter status..."
                      value={columnFilters.status || ''}
                      onChange={(e) => handleColumnFilterChange('status', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 font-normal text-center"
                    />
                  </th>
                  <th className="p-1.5 sticky top-[41px] z-20 bg-slate-100 text-center">
                    {activeFilterCount > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setColumnFilters({
                            entryNumber: '',
                            date: '',
                            itemName: '',
                            quantity: '',
                            rate: '',
                            totalAmount: '',
                            process: '',
                            status: ''
                          })
                        }
                        className="px-2 py-1 text-[11px] font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-xs text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                    Loading {activeSection === 'wood' ? 'wood usage' : 'chemical process'} entries...
                  </td>
                </tr>
              ) : sortedEntries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-14 text-center text-xs text-slate-400 bg-white">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                      <div className="p-3 rounded-full bg-slate-50 text-slate-400">
                        <Package className="w-8 h-8 stroke-[1.5]" />
                      </div>
                      <div className="text-sm font-bold text-slate-700">No Matching Entries</div>
                      <p className="text-slate-400 text-xs leading-relaxed">
                        {hasActiveFilters
                          ? `No ${activeSection === 'wood' ? 'wood usage' : 'chemical process'} entries match your current search, column filters, or date range.`
                          : `No ${activeSection === 'wood' ? 'raw wood usage' : 'chemical process'} entries have been recorded yet.`}
                      </p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={handleResetAllFilters}
                          className="mt-2 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition shadow-2xs cursor-pointer flex items-center gap-1.5"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reset All Filters</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                sortedEntries.map((entry) => {
                  const isPurchase = entry.entryType === 'Purchase';
                  const isWood = entry.materialType === 'wood' || (entry.entryNumber || '').startsWith('WD-');

                  return (
                    <tr
                      key={entry.id}
                      className="hover:bg-slate-50/70 transition-colors border-b border-slate-200"
                    >
                      {/* Entry No */}
                      <td className="py-3 px-3.5 border-r border-slate-200 align-middle">
                        <div className="font-mono font-bold text-slate-900">{entry.entryNumber}</div>
                      </td>

                      {/* Date */}
                      <td className="py-3 px-3.5 border-r border-slate-200 align-middle whitespace-nowrap text-slate-600 font-medium">
                        {formatDate(entry.date)}
                      </td>

                      {/* Chemical or Wood Name */}
                      <td className="py-3 px-3.5 border-r border-slate-200 align-middle">
                        <div className="font-semibold text-slate-900">{entry.chemicalName}</div>
                        {entry.remarks && (
                          <div className="text-[10px] text-slate-400 truncate max-w-xs mt-0.5">
                            {entry.remarks}
                          </div>
                        )}
                      </td>

                      {/* Quantity */}
                      <td className="py-3 px-3 border-r border-slate-200 align-middle text-right font-mono font-bold text-slate-900">
                        {(Number(entry.quantity) || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })}{' '}
                        <span className="text-[10px] text-slate-500 font-normal">{entry.unit || (isWood ? 't' : 'kg')}</span>
                        {entry.baseQuantity !== undefined &&
                          entry.baseUnit &&
                          normalizeUnit(entry.unit) !== normalizeUnit(entry.baseUnit) && (
                            <div className="text-[10px] text-slate-400 font-normal">
                              (= {entry.baseQuantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })} {entry.baseUnit})
                            </div>
                          )}
                      </td>

                      {/* Rate / Unit */}
                      <td className="py-3 px-3 border-r border-slate-200 align-middle text-right font-mono">
                        {(Number(entry.rate) || 0) > 0 ? (
                          <span className="text-slate-800">
                            ₹{(Number(entry.rate) || 0).toFixed(2)}
                            <span className="text-[10px] text-slate-400 font-normal">/{entry.unit || (isWood ? 't' : 'kg')}</span>
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Total Amount */}
                      <td className="py-3 px-3.5 border-r border-slate-200 align-middle text-right font-mono font-bold text-slate-900">
                        {(Number(entry.totalAmount) || 0) > 0 ? (
                          formatCurrency(Number(entry.totalAmount) || 0)
                        ) : (
                          <span className="text-slate-300 font-normal">—</span>
                        )}
                      </td>

                      {/* Process & Timing / Boiler & Timing */}
                      <td className="py-3 px-3.5 border-r border-slate-200 align-middle">
                        {isWood ? (
                          <div>
                            <div className="font-semibold text-slate-800">
                              {entry.processType || 'Steam Generation'}
                              {(entry.boilerNo || entry.machineNo) && (
                                <span className="font-normal text-slate-500 ml-1">· {entry.boilerNo || entry.machineNo}</span>
                              )}
                            </div>
                            {(entry.startTime || entry.endTime) && (
                              <div className="text-[10px] text-slate-600 font-mono mt-0.5 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{entry.startTime || '—'} to {entry.endTime || '—'}</span>
                              </div>
                            )}
                            {entry.operatorName && (
                              <div className="text-[10px] text-slate-400">
                                Op: {entry.operatorName}
                              </div>
                            )}
                          </div>
                        ) : isPurchase ? (
                          entry.supplierName ? (
                            <div>
                              <div className="font-medium text-slate-800">{entry.supplierName}</div>
                              {entry.supplierInvoiceNo && (
                                <div className="text-[10px] text-slate-400 font-mono">
                                  Inv: {entry.supplierInvoiceNo}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Direct Delivery</span>
                          )
                        ) : (
                          <div>
                            <div className="font-semibold text-slate-800">
                              {entry.processType || 'Processing'}
                              {entry.machineNo && (
                                <span className="font-normal text-slate-500 ml-1">· {entry.machineNo}</span>
                              )}
                            </div>
                            {(entry.startTime || entry.endTime) && (
                              <div className="text-[10px] text-slate-600 font-mono mt-0.5 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{entry.startTime || '—'} to {entry.endTime || '—'}</span>
                              </div>
                            )}
                            {entry.operatorName && (
                              <div className="text-[10px] text-slate-400">
                                Op: {entry.operatorName}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Stock Status */}
                      <td className="py-3 px-3 border-r border-slate-200 align-middle text-center">
                        {isPurchase ? (
                          entry.isReceived ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Received
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600" />
                              Pending Receipt
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            <Check className="w-3 h-3 text-slate-600" />
                            Deducted
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3.5 align-middle text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewEntry(entry)}
                            className="px-2 py-0.5 rounded text-[11px] font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                          >
                            View
                          </button>

                          {isPurchase && !entry.isReceived && (
                            <button
                              type="button"
                              onClick={() => handleConfirmReceipt(entry)}
                              className="px-2 py-0.5 rounded text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 transition cursor-pointer"
                            >
                              Receive
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteEntry(entry)}
                            className="px-2 py-0.5 rounded text-[11px] font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* All Records Summary Bar - One Stretch */}
        <div className="px-5 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <span>
              Showing all <strong className="text-slate-900 font-bold">{sortedEntries.length}</strong> {sortedEntries.length === 1 ? 'entry' : 'entries'} in one stretch
            </span>
            {sortedEntries.length !== currentSectionEntries.length && (
              <span className="text-slate-400 font-normal">
                (filtered from {currentSectionEntries.length} total)
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            Full view · Header stays at top
          </span>
        </div>
      </div>

      {/* MODAL 1: New Chemical Purchase */}
      <Modal
        isOpen={isPurchaseModalOpen}
        onClose={() => !purchaseSubmitting && setIsPurchaseModalOpen(false)}
        title="Record Chemical Purchase Entry"
        maxWidth="lg"
      >
        <form onSubmit={handlePurchaseSubmit} className="space-y-4">
          {purchaseError && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{purchaseError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Entry Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Entry Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                required
                className="w-full h-10 bg-white border border-slate-200 rounded-lg px-3 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
              />
            </div>

            {/* Supplier / Vendor */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Supplier / Vendor
              </label>
              <select
                value={purchaseSupplierId}
                onChange={(e) => setPurchaseSupplierId(e.target.value)}
                className="w-full h-10 bg-white border border-slate-200 rounded-lg px-3 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none cursor-pointer"
              >
                <option value="">-- Direct / Unassigned Supplier --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.companyName} ({s.vendorCode || 'Supplier'})
                  </option>
                ))}
              </select>
            </div>

            {/* Chemical Master Item Selector */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Chemical Item (From Master) <span className="text-rose-500">*</span>
              </label>
              <SearchableChemicalSelect
                value={purchaseItemId}
                items={chemicals}
                onSelect={handleSelectPurchaseChemical}
              />
            </div>

            {/* Supplier Invoice / Challan No */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Supplier Invoice / DC No
              </label>
              <input
                type="text"
                value={purchaseSupplierInvoiceNo}
                onChange={(e) => setPurchaseSupplierInvoiceNo(e.target.value)}
                placeholder="e.g. INV-2026-8812"
                className="w-full h-10 bg-white border border-slate-200 rounded-lg px-3 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
              />
            </div>

            {/* Quantity & Unit */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Quantity <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={purchaseQuantity}
                  onChange={(e) =>
                    setPurchaseQuantity(e.target.value === '' ? '' : parseFloat(e.target.value))
                  }
                  placeholder="0.00"
                  required
                  className="flex-1 h-10 bg-white border border-slate-200 rounded-lg px-3 text-xs font-bold text-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                />
                <span className="w-16 h-10 flex items-center justify-center bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700">
                  {purchaseUnit}
                </span>
              </div>
            </div>

            {/* Rate per Unit */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Rate Per {purchaseUnit} (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={purchaseRate}
                onChange={(e) =>
                  setPurchaseRate(e.target.value === '' ? '' : parseFloat(e.target.value))
                }
                placeholder="0.00"
                className="w-full h-10 bg-white border border-slate-200 rounded-lg px-3 text-xs font-mono font-bold text-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-none"
              />
            </div>

            {/* Calculated Total Amount */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Total Amount (₹)
              </label>
              <div className="h-10 bg-slate-50 border border-slate-200 rounded-lg px-3 flex items-center justify-between font-mono font-bold text-slate-900 text-sm">
                <span>Total:</span>
                <span>
                  {formatCurrency(
                    Math.round(
                      (Number(purchaseQuantity || 0) * Number(purchaseRate || 0)) * 100
                    ) / 100
                  )}
                </span>
              </div>
            </div>

            {/* Receipt & Stock Inward Confirmation */}
            <div className="md:col-span-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={purchaseIsReceived}
                  onChange={(e) => setPurchaseIsReceived(e.target.checked)}
                  className="w-4 h-4 text-slate-900 rounded border-slate-300 focus:ring-slate-900"
                />
                <span className="text-xs font-bold text-slate-900">
                  Mark as Received immediately (automatically inward stock to warehouse)
                </span>
              </label>
              <p className="text-[11px] text-slate-500 mt-1 pl-6">
                When checked, the purchased quantity will be added directly to the active warehouse
                inventory and recorded in the stock ledger. Uncheck if awaiting physical gate arrival.
              </p>
            </div>

            {/* Remarks */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Remarks / Delivery Notes
              </label>
              <textarea
                rows={2}
                value={purchaseRemarks}
                onChange={(e) => setPurchaseRemarks(e.target.value)}
                placeholder="Optional supplier delivery notes, batch certificate details, or transport info..."
                className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={purchaseSubmitting}
              onClick={() => setIsPurchaseModalOpen(false)}
              className="h-9 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={purchaseSubmitting}
              className="h-9 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer disabled:opacity-50"
            >
              {purchaseSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>{purchaseSubmitting ? 'Saving...' : 'Save Purchase Entry'}</span>
            </button>
          </div>
        </form>

        <LoadingOverlay
          isOpen={purchaseSubmitting}
          title="Saving Chemical Purchase..."
          message="Updating chemical stock ledger, recording vendor lot, and securing transaction..."
        />
      </Modal>

      {/* MODAL 2: Record Process Entry */}
      <Modal
        isOpen={isConsumptionModalOpen}
        onClose={() => !consumptionSubmitting && setIsConsumptionModalOpen(false)}
        title="Record Process Entry"
        maxWidth="lg"
      >
        <form onSubmit={handleConsumptionSubmit} className="space-y-4">
          {consumptionError && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{consumptionError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Process Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Process Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={consumptionDate}
                onChange={(e) => setConsumptionDate(e.target.value)}
                required
                className="w-full h-10 bg-white border border-slate-200 rounded-lg px-3 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
              />
            </div>

            {/* Process Stage */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Process Stage
              </label>
              <select
                value={consumptionProcessType}
                onChange={(e) => handleProcessStageChange(e.target.value)}
                className="w-full h-10 bg-white border border-slate-200 rounded-lg px-3 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none cursor-pointer"
              >
                <option value="Dyeing">Dyeing</option>
                <option value="Bleaching">Bleaching</option>
                <option value="Scouring">Scouring</option>
                <option value="Washing">Washing</option>
                <option value="Softening">Softening</option>
                <option value="Enzyme Wash">Enzyme Wash</option>
                <option value="Finishing">Finishing</option>
                <option value="Boiler / Utility">Boiler / Utility</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Chemical Master Item Selector */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Select Chemical <span className="text-rose-500">*</span>
              </label>
              <SearchableChemicalSelect
                value={consumptionItemId}
                items={chemicals}
                onSelect={handleSelectConsumptionChemical}
              />

              {/* Real-time stock display */}
              {selectedConsumptionChemical && (
                <div
                  className={`mt-2 p-2.5 rounded-lg border flex items-center justify-between text-xs ${
                    availableStockForSelected <= 0
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : availableStockForSelected <=
                        (selectedConsumptionChemical.reorderLevel ||
                          selectedConsumptionChemical.minimumStockLevel ||
                          0)
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Factory className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>
                      Warehouse Stock:{' '}
                      <strong className="font-mono text-slate-900 text-sm">
                        {availableStockInSelectedChemUnit.toLocaleString('en-IN', { maximumFractionDigits: 3 })}{' '}
                        {consumptionUnit}
                      </strong>
                      {normalizeUnit(consumptionUnit) !== normalizeUnit(selectedConsumptionChemical.baseUnit || 'kg') && (
                        <span className="text-slate-500 font-normal ml-1.5 text-[11px]">
                          (= {availableStockForSelected.toLocaleString('en-IN', { maximumFractionDigits: 3 })}{' '}
                          {selectedConsumptionChemical.baseUnit || 'kg'} in warehouse base unit)
                        </span>
                      )}
                    </span>
                  </div>
                  {availableStockForSelected <= 0 && (
                    <span className="text-[11px] font-bold text-rose-600">
                      Out of stock! Cannot consume.
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Consumed Quantity */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Consumed Quantity <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step={consumptionUnit === 'g' || consumptionUnit === 'ml' ? '1' : '0.01'}
                  min="0.001"
                  max={availableStockInSelectedChemUnit > 0 ? availableStockInSelectedChemUnit : undefined}
                  value={consumptionQuantity}
                  onChange={(e) =>
                    setConsumptionQuantity(e.target.value === '' ? '' : parseFloat(e.target.value))
                  }
                  placeholder="0.00"
                  required
                  className="flex-1 h-10 bg-white border border-slate-200 rounded-lg px-3 text-xs font-bold text-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                />
                <select
                  value={consumptionUnit}
                  onChange={(e) => handleConsumptionUnitChange(e.target.value)}
                  className="h-10 w-28 sm:w-32 px-2.5 bg-slate-100 hover:bg-slate-200/80 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none cursor-pointer transition shadow-2xs shrink-0"
                  title="Change unit"
                >
                  {compatibleChemicalUnits.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Rate / Unit */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Rate / Unit (₹)
                </label>
                {avgRateInSelectedChemUnit > 0 ? (
                  <span className="text-[10px] text-slate-500 font-medium">
                    Avg: ₹{(avgRateInSelectedChemUnit >= 1 ? avgRateInSelectedChemUnit.toFixed(2) : avgRateInSelectedChemUnit.toFixed(4))}/{consumptionUnit}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-10 h-10 flex items-center justify-center bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 shrink-0">
                  ₹
                </span>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={consumptionRate}
                  onChange={(e) =>
                    setConsumptionRate(e.target.value === '' ? '' : parseFloat(e.target.value))
                  }
                  placeholder={
                    avgRateInSelectedChemUnit > 0
                      ? String(avgRateInSelectedChemUnit >= 1 ? avgRateInSelectedChemUnit.toFixed(2) : avgRateInSelectedChemUnit.toFixed(4))
                      : '0.00'
                  }
                  className="flex-1 h-10 bg-white border border-slate-200 rounded-lg px-3 text-xs font-bold font-mono text-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                />
              </div>
            </div>

            {/* Total Material Worth Highlight */}
            <div className="md:col-span-2 bg-gradient-to-r from-slate-50 to-slate-100/70 border border-slate-200 rounded-xl p-3 flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Material Worth
                </span>
                <span className="text-xs text-slate-600 font-medium">
                  {Number(consumptionQuantity) || 0} {consumptionUnit} @ ₹
                  {(
                    Number(consumptionRate) ||
                    avgRateInSelectedChemUnit ||
                    0
                  ).toLocaleString('en-IN', { maximumFractionDigits: 4 })}
                  /{consumptionUnit}
                </span>
              </div>
              <div className="text-base font-black text-slate-900 font-mono">
                {formatCurrency(
                  Math.round(
                    (Number(consumptionQuantity) || 0) *
                      (Number(consumptionRate) ||
                        avgRateInSelectedChemUnit ||
                        0) *
                      100
                  ) / 100
                )}
              </div>
            </div>

            {/* Machine / Washer No - Fetched from Machine Master */}
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Machine / Washer No
                </label>
                <span className="text-[10px] text-slate-400 font-medium">
                  General Settings &gt; Machine Master
                </span>
              </div>

              {isCustomConsumptionMachine ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={consumptionMachineNo}
                      onChange={(e) => setConsumptionMachineNo(e.target.value)}
                      placeholder="e.g. Washer-03"
                      className="flex-1 h-10 bg-white border border-slate-200 rounded-lg px-3 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomConsumptionMachine(false);
                        const initialMach = matchingProcessMachines[0] || activeMachines[0];
                        setConsumptionMachineNo(initialMach ? `${initialMach.machineId} - ${initialMach.name}` : '');
                      }}
                      className="h-10 px-2.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 cursor-pointer"
                    >
                      Choose from Master
                    </button>
                  </div>
                </div>
              ) : (
                <select
                  value={consumptionMachineNo}
                  onChange={(e) => {
                    if (e.target.value === '__CUSTOM__') {
                      setIsCustomConsumptionMachine(true);
                      setConsumptionMachineNo('');
                    } else {
                      setConsumptionMachineNo(e.target.value);
                    }
                  }}
                  className="w-full h-10 bg-white border border-slate-200 rounded-lg px-3 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Select Machine from Machine Master --</option>
                  {matchingProcessMachines.length > 0 && (
                    <optgroup label={`${consumptionProcessType} Machines (Machine Master)`}>
                      {matchingProcessMachines.map((m) => (
                        <option key={m.id} value={`${m.machineId} - ${m.name}`}>
                          {m.machineId} · {m.name} {m.capacity ? `(${m.capacity})` : ''} [{m.modelYear}]
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {otherProcessMachines.length > 0 && (
                    <optgroup label="Other Machines (Machine Master)">
                      {otherProcessMachines.map((m) => (
                        <option key={m.id} value={`${m.machineId} - ${m.name}`}>
                          {m.machineId} · {m.name} ({m.processType}) {m.capacity ? `(${m.capacity})` : ''} [{m.modelYear}]
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <option value="__CUSTOM__">+ Enter Custom Machine...</option>
                </select>
              )}

              {/* Selected Machine Detail Pill */}
              {selectedConsumptionMachine && !isCustomConsumptionMachine && (
                <div className="mt-2 px-3 py-2 rounded-lg bg-sky-50/80 border border-sky-200/80 text-xs text-sky-950 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-sky-100 flex items-center justify-center text-sky-800 shrink-0">
                      <Factory className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="font-bold text-slate-900">{selectedConsumptionMachine.name}</span>
                      <span className="font-mono text-slate-500 text-[11px] ml-1.5">({selectedConsumptionMachine.machineId})</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-sky-800 font-medium">
                    <span className="bg-sky-100/90 px-2 py-0.5 rounded border border-sky-200/50">
                      {selectedConsumptionMachine.processType}
                    </span>
                    {selectedConsumptionMachine.capacity && (
                      <span className="font-mono bg-sky-100/90 px-2 py-0.5 rounded border border-sky-200/50">
                        Cap: {selectedConsumptionMachine.capacity}
                      </span>
                    )}
                    <span className="font-mono bg-sky-100/90 px-2 py-0.5 rounded border border-sky-200/50">
                      Yr: {selectedConsumptionMachine.modelYear}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Operator Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Operator / Person Responsible
              </label>
              <input
                type="text"
                value={consumptionOperatorName}
                onChange={(e) => setConsumptionOperatorName(e.target.value)}
                placeholder="Operator name"
                className="w-full h-10 bg-white border border-slate-200 rounded-lg px-3 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
              />
            </div>

            {/* Operating Shift Timing: Start Time & End Time */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Operating Shift Timing
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <input
                    type="time"
                    value={consumptionStartTime}
                    onChange={(e) => setConsumptionStartTime(e.target.value)}
                    className="w-full h-10 bg-white border border-slate-200 rounded-lg px-2.5 text-xs font-mono focus:ring-1 focus:ring-slate-900 focus:outline-none"
                    title="Start Time"
                  />
                  <span className="absolute -top-1.5 left-2 bg-white px-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    Start
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="time"
                    value={consumptionEndTime}
                    onChange={(e) => setConsumptionEndTime(e.target.value)}
                    className="w-full h-10 bg-white border border-slate-200 rounded-lg px-2.5 text-xs font-mono focus:ring-1 focus:ring-slate-900 focus:outline-none"
                    title="End Time"
                  />
                  <span className="absolute -top-1.5 left-2 bg-white px-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    End
                  </span>
                </div>
              </div>
            </div>

            {/* Remarks */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Remarks / Recipe Notes
              </label>
              <textarea
                rows={2}
                value={consumptionRemarks}
                onChange={(e) => setConsumptionRemarks(e.target.value)}
                placeholder="Recipe specifications, shade remarks, or processing notes..."
                className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={consumptionSubmitting}
              onClick={() => setIsConsumptionModalOpen(false)}
              className="h-9 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                consumptionSubmitting ||
                availableStockForSelected <= 0 ||
                Number(consumptionQuantity || 0) > availableStockForSelected
              }
              className="h-9 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer disabled:opacity-50"
            >
              {consumptionSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>{consumptionSubmitting ? 'Recording...' : 'Confirm & Deduct Stock'}</span>
            </button>
          </div>
        </form>

        <LoadingOverlay
          isOpen={consumptionSubmitting}
          title="Deducting Chemical Stock..."
          message="Calculating recipe consumption, updating batch logs, and deducting inventory..."
        />
      </Modal>

      {/* MODAL 3: Record Raw Wood Usage */}
      <Modal
        isOpen={isWoodModalOpen}
        onClose={() => !woodSubmitting && setIsWoodModalOpen(false)}
        title="Record Raw Wood Usage"
        maxWidth="lg"
      >
        <form onSubmit={handleWoodSubmit} className="space-y-4">
          {woodError && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{woodError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Usage Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Usage Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={woodDate}
                onChange={(e) => setWoodDate(e.target.value)}
                required
                className="w-full h-10 bg-white border border-slate-200 rounded-lg px-3 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
              />
            </div>

            {/* Boiler Purpose / Stage */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Boiler / Purpose Stage
              </label>
              <select
                value={woodBoilerStage}
                onChange={(e) => setWoodBoilerStage(e.target.value)}
                className="w-full h-10 bg-white border border-slate-200 rounded-lg px-3 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none cursor-pointer"
              >
                <option value="Steam Generation (Boiler)">Steam Generation (Boiler)</option>
                <option value="High Pressure Steam">High Pressure Steam</option>
                <option value="Hot Wash Heating">Hot Wash Heating</option>
                <option value="Drying Chamber Boiler">Drying Chamber Boiler</option>
                <option value="Dyeing Steam Boiler">Dyeing Steam Boiler</option>
                <option value="General Boiler Fuel">General Boiler Fuel</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Raw Wood Item Selector */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Select Raw Wood Item <span className="text-rose-500">*</span>
              </label>
              <SearchableWoodSelect
                value={woodItemId}
                items={woodItems}
                onSelect={handleSelectWoodItem}
              />

              {/* Real-time stock display */}
              {selectedConsumptionWood && (
                <div
                  className={`mt-2 p-2.5 rounded-lg border flex items-center justify-between text-xs ${
                    availableStockForSelectedWood <= 0
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : availableStockForSelectedWood <=
                        (selectedConsumptionWood.reorderLevel ||
                          selectedConsumptionWood.minimumStockLevel ||
                          0)
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Factory className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>
                      Warehouse Stock:{' '}
                      <strong className="font-mono text-slate-900 text-sm">
                        {availableStockInSelectedWoodUnit.toLocaleString('en-IN', { maximumFractionDigits: 3 })}{' '}
                        {woodUnit}
                      </strong>
                      {normalizeUnit(woodUnit) !== normalizeUnit(selectedConsumptionWood.baseUnit || 't') && (
                        <span className="text-slate-500 font-normal ml-1.5 text-[11px]">
                          (= {availableStockForSelectedWood.toLocaleString('en-IN', { maximumFractionDigits: 3 })}{' '}
                          {selectedConsumptionWood.baseUnit || 't'} in warehouse base unit)
                        </span>
                      )}
                    </span>
                  </div>
                  {availableStockForSelectedWood <= 0 && (
                    <span className="text-[11px] font-bold text-rose-600">
                      Out of stock! Cannot record consumption.
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Consumed Quantity */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Consumed Quantity <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step={woodUnit === 'kg' ? '0.1' : '0.001'}
                  min="0.001"
                  max={availableStockInSelectedWoodUnit > 0 ? availableStockInSelectedWoodUnit : undefined}
                  value={woodQuantity}
                  onChange={(e) =>
                    setWoodQuantity(e.target.value === '' ? '' : parseFloat(e.target.value))
                  }
                  placeholder={woodUnit === 'kg' ? '0.0' : '0.000'}
                  required
                  className="flex-1 h-10 bg-white border border-slate-200 rounded-lg px-3 text-xs font-bold text-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                />
                <select
                  value={woodUnit}
                  onChange={(e) => handleWoodUnitChange(e.target.value)}
                  className="h-10 w-28 sm:w-32 px-2.5 bg-slate-100 hover:bg-slate-200/80 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none cursor-pointer transition shadow-2xs shrink-0"
                  title="Change consumed unit"
                >
                  {compatibleWoodUnits.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Rate / Unit */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Rate / Unit (₹)
                </label>
                {avgRateInSelectedWoodUnit > 0 ? (
                  <span className="text-[10px] text-slate-500 font-medium">
                    Avg: ₹{(avgRateInSelectedWoodUnit >= 1 ? avgRateInSelectedWoodUnit.toFixed(2) : avgRateInSelectedWoodUnit.toFixed(4))}/{woodUnit}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-10 h-10 flex items-center justify-center bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 shrink-0">
                  ₹
                </span>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={woodRate}
                  onChange={(e) =>
                    setWoodRate(e.target.value === '' ? '' : parseFloat(e.target.value))
                  }
                  placeholder={
                    avgRateInSelectedWoodUnit > 0
                      ? String(avgRateInSelectedWoodUnit >= 1 ? avgRateInSelectedWoodUnit.toFixed(2) : avgRateInSelectedWoodUnit.toFixed(4))
                      : '0.00'
                  }
                  className="flex-1 h-10 bg-white border border-slate-200 rounded-lg px-3 text-xs font-bold font-mono text-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                />
              </div>
            </div>

            {/* Total Material Worth Highlight */}
            <div className="md:col-span-2 bg-gradient-to-r from-slate-50 to-slate-100/70 border border-slate-200 rounded-xl p-3 flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Wood Worth
                </span>
                <span className="text-xs text-slate-600 font-medium">
                  {Number(woodQuantity) || 0} {woodUnit} @ ₹
                  {(
                    Number(woodRate) ||
                    avgRateInSelectedWoodUnit ||
                    0
                  ).toLocaleString('en-IN', { maximumFractionDigits: 4 })}
                  /{woodUnit}
                </span>
              </div>
              <div className="text-base font-black text-slate-900 font-mono">
                {formatCurrency(
                  Math.round(
                    (Number(woodQuantity) || 0) *
                      (Number(woodRate) ||
                        avgRateInSelectedWoodUnit ||
                        0) *
                      100
                  ) / 100
                )}
              </div>
            </div>

            {/* Boiler / Machine No - Fetched from Machine Master */}
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Boiler / Machine No
                </label>
                <span className="text-[10px] text-slate-400 font-medium">
                  General Settings &gt; Machine Master
                </span>
              </div>

              {isCustomWoodBoiler ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={woodBoilerNo}
                      onChange={(e) => setWoodBoilerNo(e.target.value)}
                      placeholder="e.g. Boiler-01"
                      className="flex-1 h-10 bg-white border border-slate-200 rounded-lg px-3 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomWoodBoiler(false);
                        const initialBoiler = boilerMachines[0] || activeMachines[0];
                        setWoodBoilerNo(initialBoiler ? `${initialBoiler.machineId} - ${initialBoiler.name}` : '');
                      }}
                      className="h-10 px-2.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 cursor-pointer"
                    >
                      Choose from Master
                    </button>
                  </div>
                </div>
              ) : (
                <select
                  value={woodBoilerNo}
                  onChange={(e) => {
                    if (e.target.value === '__CUSTOM__') {
                      setIsCustomWoodBoiler(true);
                      setWoodBoilerNo('');
                    } else {
                      setWoodBoilerNo(e.target.value);
                    }
                  }}
                  className="w-full h-10 bg-white border border-slate-200 rounded-lg px-3 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Select Boiler Machine from Machine Master --</option>
                  {boilerMachines.length > 0 && (
                    <optgroup label="Boiler Machines (Machine Master)">
                      {boilerMachines.map((m) => (
                        <option key={m.id} value={`${m.machineId} - ${m.name}`}>
                          {m.machineId} · {m.name} {m.capacity ? `(${m.capacity})` : ''} [{m.modelYear}]
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {otherMachinesForWood.length > 0 && (
                    <optgroup label="Other Machines (Machine Master)">
                      {otherMachinesForWood.map((m) => (
                        <option key={m.id} value={`${m.machineId} - ${m.name}`}>
                          {m.machineId} · {m.name} ({m.processType}) {m.capacity ? `(${m.capacity})` : ''} [{m.modelYear}]
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <option value="__CUSTOM__">+ Enter Custom Machine...</option>
                </select>
              )}

              {/* Selected Machine Detail Pill */}
              {selectedWoodBoilerMachine && !isCustomWoodBoiler && (
                <div className="mt-2 px-3 py-2 rounded-lg bg-amber-50/80 border border-amber-200/80 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-amber-100 flex items-center justify-center text-amber-800 shrink-0">
                      <Factory className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="font-bold text-slate-900">{selectedWoodBoilerMachine.name}</span>
                      <span className="font-mono text-slate-500 text-[11px] ml-1.5">({selectedWoodBoilerMachine.machineId})</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-amber-900 font-medium">
                    {selectedWoodBoilerMachine.capacity && (
                      <span className="font-mono bg-amber-100/90 px-2 py-0.5 rounded border border-amber-200/50">
                        Cap: {selectedWoodBoilerMachine.capacity}
                      </span>
                    )}
                    <span className="font-mono bg-amber-100/90 px-2 py-0.5 rounded border border-amber-200/50">
                      Model: {selectedWoodBoilerMachine.modelYear}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Operator Name - NO DEFAULT VALUE */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Operator / Person Responsible
              </label>
              <input
                type="text"
                value={woodOperatorName}
                onChange={(e) => setWoodOperatorName(e.target.value)}
                placeholder="Operator name"
                className="w-full h-10 bg-white border border-slate-200 rounded-lg px-3 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
              />
            </div>

            {/* Operating Shift Timing: Start Time & End Time */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Operating Shift Timing
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <input
                    type="time"
                    value={woodStartTime}
                    onChange={(e) => setWoodStartTime(e.target.value)}
                    className="w-full h-10 bg-white border border-slate-200 rounded-lg px-2.5 text-xs font-mono focus:ring-1 focus:ring-slate-900 focus:outline-none"
                    title="Start Time"
                  />
                  <span className="absolute -top-1.5 left-2 bg-white px-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    Start
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="time"
                    value={woodEndTime}
                    onChange={(e) => setWoodEndTime(e.target.value)}
                    className="w-full h-10 bg-white border border-slate-200 rounded-lg px-2.5 text-xs font-mono focus:ring-1 focus:ring-slate-900 focus:outline-none"
                    title="End Time"
                  />
                  <span className="absolute -top-1.5 left-2 bg-white px-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    End
                  </span>
                </div>
              </div>
            </div>

            {/* Remarks */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Remarks / Shift Notes
              </label>
              <textarea
                rows={2}
                value={woodRemarks}
                onChange={(e) => setWoodRemarks(e.target.value)}
                placeholder="Boiler pressure readings, steam consumption notes, or shift handover remarks..."
                className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={woodSubmitting}
              onClick={() => setIsWoodModalOpen(false)}
              className="h-9 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                woodSubmitting ||
                availableStockForSelectedWood <= 0 ||
                Number(woodQuantity || 0) > availableStockForSelectedWood
              }
              className="h-9 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer disabled:opacity-50"
            >
              {woodSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>{woodSubmitting ? 'Recording...' : 'Confirm & Deduct Stock'}</span>
            </button>
          </div>
        </form>

        <LoadingOverlay
          isOpen={woodSubmitting}
          title="Recording Boiler Wood Consumption..."
          message="Logging raw wood weight, updating boiler ledger, and adjusting inventory..."
        />
      </Modal>

      {/* MODAL 4: View Entry Details */}
      {viewEntry && (
        <Modal
          isOpen={Boolean(viewEntry)}
          onClose={() => setViewEntry(null)}
          title={`${viewEntry.materialType === 'wood' || (viewEntry.entryNumber || '').startsWith('WD-') ? 'Raw Wood Usage Details' : 'Chemical Entry Details'}: ${viewEntry.entryNumber}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            {/* Summary Header */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Entry Reference
                </span>
                <div className="text-base font-bold text-slate-900 font-mono">
                  {viewEntry.entryNumber}
                </div>
                <div className="text-slate-500 mt-0.5">{formatDate(viewEntry.date)}</div>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Movement Type
                </span>
                {viewEntry.materialType === 'wood' || (viewEntry.entryNumber || '').startsWith('WD-') ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 mt-1">
                    <Flame className="w-3 h-3 text-amber-600" /> Boiler Fuel Consumption
                  </span>
                ) : viewEntry.entryType === 'Purchase' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 mt-1">
                    <ArrowDownLeft className="w-3 h-3" /> Purchase Inward
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 mt-1">
                    <ArrowUpRight className="w-3 h-3" /> Shopfloor Consumption
                  </span>
                )}
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-3 bg-white p-4 rounded-xl border border-slate-200">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">
                  {viewEntry.materialType === 'wood' || (viewEntry.entryNumber || '').startsWith('WD-')
                    ? 'Wood Material'
                    : 'Chemical Item'}
                </div>
                <div className="font-bold text-slate-900 text-sm mt-0.5">
                  {viewEntry.chemicalName}
                </div>
                {viewEntry.itemCode && !viewEntry.itemCode.startsWith('item_') && (
                  <div className="font-mono text-slate-500 text-[11px]">{viewEntry.itemCode}</div>
                )}
              </div>

              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">Quantity & Unit</div>
                <div className="font-bold text-slate-900 text-sm font-mono mt-0.5">
                  {(Number(viewEntry.quantity) || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })}{' '}
                  {viewEntry.unit || (viewEntry.materialType === 'wood' ? 't' : 'kg')}
                </div>
                {viewEntry.baseQuantity !== undefined &&
                  viewEntry.baseUnit &&
                  normalizeUnit(viewEntry.unit) !== normalizeUnit(viewEntry.baseUnit) && (
                    <div className="text-[11px] text-slate-500 font-normal font-mono mt-0.5">
                      (= {viewEntry.baseQuantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })} {viewEntry.baseUnit} in warehouse base unit)
                    </div>
                  )}
              </div>

              {(Number(viewEntry.rate) || 0) > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Rate Per Unit</div>
                  <div className="font-bold text-slate-900 font-mono mt-0.5">
                    ₹{(Number(viewEntry.rate) || 0).toFixed(2)} / {viewEntry.unit || (viewEntry.materialType === 'wood' ? 't' : 'kg')}
                  </div>
                </div>
              )}

              {(Number(viewEntry.totalAmount) || 0) > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Total Amount</div>
                  <div className="font-bold text-slate-900 font-mono text-sm mt-0.5">
                    {formatCurrency(Number(viewEntry.totalAmount) || 0)}
                  </div>
                </div>
              )}

              {/* Purchase Specifics */}
              {viewEntry.entryType === 'Purchase' && (
                <>
                  <div className="col-span-2 pt-2 border-t border-slate-100">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">
                      Supplier / Vendor
                    </div>
                    <div className="font-semibold text-slate-800 mt-0.5">
                      {viewEntry.supplierName || 'Direct / Unassigned'}
                    </div>
                  </div>
                  {viewEntry.supplierInvoiceNo && (
                    <div className="col-span-2">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">
                        Invoice / DC Number
                      </div>
                      <div className="font-mono font-semibold text-slate-800 mt-0.5">
                        {viewEntry.supplierInvoiceNo}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Consumption Specifics */}
              {viewEntry.entryType === 'Consumption' && (
                <>
                  <div className="col-span-2 pt-2 border-t border-slate-100">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">
                      {viewEntry.materialType === 'wood' || (viewEntry.entryNumber || '').startsWith('WD-')
                        ? 'Boiler Stage / Purpose'
                        : 'Process Stage'}
                    </div>
                    <div className="font-semibold text-slate-800 mt-0.5">
                      {viewEntry.processType || (viewEntry.materialType === 'wood' ? 'Steam Generation' : 'Processing')}
                    </div>
                  </div>

                  {(viewEntry.boilerNo || viewEntry.machineNo) && (
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">
                        {viewEntry.materialType === 'wood' || (viewEntry.entryNumber || '').startsWith('WD-')
                          ? 'Boiler / Machine No'
                          : 'Machine No'}
                      </div>
                      <div className="font-semibold text-slate-800 mt-0.5">
                        {viewEntry.boilerNo || viewEntry.machineNo}
                      </div>
                    </div>
                  )}

                  {(viewEntry.startTime || viewEntry.endTime) && (
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Timings</div>
                      <div className="font-mono font-semibold text-slate-800 mt-0.5">
                        {viewEntry.startTime || '—'} to {viewEntry.endTime || '—'}
                      </div>
                    </div>
                  )}

                  {viewEntry.operatorName && (
                    <div className="col-span-2">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Operator</div>
                      <div className="font-semibold text-slate-800 mt-0.5">{viewEntry.operatorName}</div>
                    </div>
                  )}
                </>
              )}

              {/* Remarks */}
              {viewEntry.remarks && (
                <div className="col-span-2 pt-2 border-t border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Remarks</div>
                  <div className="text-slate-700 mt-0.5 whitespace-pre-wrap">{viewEntry.remarks}</div>
                </div>
              )}

              {/* Stock Movement Link */}
              <div className="col-span-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Warehouse Transaction Ref:</span>
                <span className="font-mono font-bold text-slate-900">
                  {viewEntry.stockTransactionNumber || viewEntry.stockTransactionId || 'Linked'}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewEntry(null)}
                className="h-9 px-4 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

class ChemicalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ChemicalEntryPage error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-white rounded-2xl border border-slate-200 shadow-2xs text-center space-y-4 max-w-lg mx-auto mt-12">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Chemical Module Notice</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            {this.state.error?.message || 'An error occurred while displaying chemical entries.'}
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            Reload Module
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export const ChemicalEntryPage: React.FC = () => {
  return (
    <ChemicalErrorBoundary>
      <ChemicalEntryContent />
    </ChemicalErrorBoundary>
  );
};

