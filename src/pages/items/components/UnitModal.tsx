import React, { useState, useEffect } from 'react';
import { UnitOfMeasure } from '../../../types/item';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { ItemService } from '../../../services/itemService';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface UnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (unit: UnitOfMeasure) => void;
  initialUnit?: UnitOfMeasure | null;
  currentUser: { uid: string; displayName?: string };
}

export const UnitModal: React.FC<UnitModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  initialUnit,
  currentUser
}) => {
  const [unitName, setUnitName] = useState(initialUnit?.unitName || '');
  const [symbol, setSymbol] = useState(initialUnit?.symbol || '');
  const [unitType, setUnitType] = useState<UnitOfMeasure['unitType']>(initialUnit?.unitType || 'weight');
  const [baseUnit, setBaseUnit] = useState(initialUnit?.baseUnit || '');
  const [conversionFactorToBase, setConversionFactorToBase] = useState<number>(
    initialUnit?.conversionFactorToBase || 1
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialUnit) {
      setUnitName(initialUnit.unitName);
      setSymbol(initialUnit.symbol);
      setUnitType(initialUnit.unitType);
      setBaseUnit(initialUnit.baseUnit || '');
      setConversionFactorToBase(initialUnit.conversionFactorToBase || 1);
    } else {
      setUnitName('');
      setSymbol('');
      setUnitType('weight');
      setBaseUnit('');
      setConversionFactorToBase(1);
    }
    setError(null);
  }, [initialUnit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitName.trim() || !symbol.trim()) {
      setError('Unit Name and Symbol are required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      let saved: UnitOfMeasure;
      if (initialUnit) {
        saved = await ItemService.updateUnitOfMeasure(initialUnit.id, {
          unitName: unitName.trim(),
          symbol: symbol.trim(),
          unitType,
          baseUnit: baseUnit.trim() || undefined,
          conversionFactorToBase: Number(conversionFactorToBase) || 1
        });
      } else {
        saved = await ItemService.createUnitOfMeasure(
          {
            unitName: unitName.trim(),
            symbol: symbol.trim(),
            unitType,
            baseUnit: baseUnit.trim() || undefined,
            conversionFactorToBase: Number(conversionFactorToBase) || 1
          },
          currentUser
        );
      }

      onSaved(saved);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save Unit of Measure.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialUnit ? 'Edit Unit of Measure' : 'Create Unit of Measure'}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Unit Name"
            value={unitName}
            onChange={(e) => setUnitName(e.target.value)}
            placeholder="e.g. Kilogram"
            required
          />

          <Input
            label="Symbol / Code"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="e.g. kg"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Measurement Physical Type
          </label>
          <select
            value={unitType}
            onChange={(e) => setUnitType(e.target.value as any)}
            className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs font-medium"
          >
            <option value="weight">Weight (Mass)</option>
            <option value="volume">Volume (Fluid)</option>
            <option value="count">Count (Units / Pieces)</option>
            <option value="length">Length (Meters / Yards)</option>
            <option value="package">Bulk Package (Bags / Drums / Bundles)</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
          <Input
            label="Base Metric Reference"
            value={baseUnit}
            onChange={(e) => setBaseUnit(e.target.value)}
            placeholder="e.g. kg / L"
          />

          <Input
            label="Conversion Factor"
            type="number"
            step="0.0001"
            value={conversionFactorToBase}
            onChange={(e) => setConversionFactorToBase(Number(e.target.value))}
            placeholder="1"
          />
        </div>

        <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            icon={<CheckCircle2 className="w-4 h-4" />}
          >
            {isSubmitting ? 'Saving...' : initialUnit ? 'Update Unit' : 'Create Unit'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
