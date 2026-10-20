import React, { useState, useEffect } from 'react';
import { ItemCategoryRecord } from '../../../types/item';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { ItemService } from '../../../services/itemService';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (category: ItemCategoryRecord) => void;
  initialCategory?: ItemCategoryRecord | null;
  currentUser: { uid: string; displayName?: string };
}

export const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  initialCategory,
  currentUser
}) => {
  const [categoryName, setCategoryName] = useState(initialCategory?.categoryName || '');
  const [categoryCode, setCategoryCode] = useState(initialCategory?.categoryCode || '');
  const [description, setDescription] = useState(initialCategory?.description || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialCategory) {
      setCategoryName(initialCategory.categoryName);
      setCategoryCode(initialCategory.categoryCode);
      setDescription(initialCategory.description || '');
    } else {
      setCategoryName('');
      setCategoryCode('');
      setDescription('');
    }
    setError(null);
  }, [initialCategory, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) {
      setError('Category Name is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      let saved: ItemCategoryRecord;
      if (initialCategory) {
        saved = await ItemService.updateCategory(initialCategory.id, {
          categoryName: categoryName.trim(),
          categoryCode: categoryCode.trim().toUpperCase() || categoryName.trim().slice(0, 3).toUpperCase(),
          description: description.trim() || undefined
        });
      } else {
        saved = await ItemService.createCategory(
          {
            categoryName: categoryName.trim(),
            categoryCode: categoryCode.trim().toUpperCase() || categoryName.trim().slice(0, 3).toUpperCase(),
            description: description.trim() || undefined
          },
          currentUser
        );
      }

      onSaved(saved);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialCategory ? 'Edit Item Category' : 'Create New Item Category'}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Input
          label="Category Name"
          value={categoryName}
          onChange={(e) => setCategoryName(e.target.value)}
          placeholder="e.g. Finishing Chemicals"
          required
        />

        <Input
          label="Category Code / Prefix"
          value={categoryCode}
          onChange={(e) => setCategoryCode(e.target.value.toUpperCase())}
          placeholder="e.g. FCH"
        />

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Details about materials filed under this category..."
            rows={3}
            className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-[#1F4E79]/20 focus:border-[#1F4E79]"
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
            {isSubmitting ? 'Saving...' : initialCategory ? 'Update Category' : 'Create Category'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
