import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  RefreshCw,
  FolderTree,
  AlertCircle,
  CheckCircle2,
  Lock
} from 'lucide-react';

import { ItemCategoryMasterItem } from '../../../types/categoryMaster';
import { ItemCategoryMasterService } from '../../../services/itemCategoryMasterService';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Card } from '../../../components/ui/Card';

interface ItemCategorySettingsProps {
  currentUserId: string;
  usersMap?: Record<string, string>;
  onNotify?: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const ItemCategorySettings: React.FC<ItemCategorySettingsProps> = ({
  currentUserId,
  usersMap = {},
  onNotify
}) => {
  const [categories, setCategories] = useState<ItemCategoryMasterItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<ItemCategoryMasterItem | null>(null);

  // Form Inputs
  const [categoryName, setCategoryName] = useState<string>('');
  const [categoryDescription, setCategoryDescription] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Auto-generate category code from name: take first letters of each word, max 4 chars
  const autoGenerateCategoryCode = (name: string): string => {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '';
    if (words.length === 1) return words[0].slice(0, 4).toUpperCase();
    return words.map((w) => w[0]).join('').slice(0, 4).toUpperCase();
  };

  const previewCode = autoGenerateCategoryCode(categoryName);

  // Helper to format timestamps
  const formatDateTime = (ts: any): string => {
    if (!ts) return '—';
    try {
      if (typeof ts === 'string') {
        const d = new Date(ts);
        return isNaN(d.getTime()) ? ts : d.toLocaleString();
      }
      if (ts.toDate && typeof ts.toDate === 'function') {
        return ts.toDate().toLocaleString();
      }
      if (ts.seconds) {
        return new Date(ts.seconds * 1000).toLocaleString();
      }
      return '—';
    } catch {
      return '—';
    }
  };

  const getUserDisplayName = (uid: string): string => {
    if (!uid || uid === 'system') return 'System Default';
    return usersMap[uid] || uid;
  };

  // Subscribe to real-time changes
  useEffect(() => {
    const unsubscribe = ItemCategoryMasterService.subscribeCategories(
      (items) => {
        setCategories(items);
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load item category master:', err);
        setLoading(false);
        if (onNotify) {
          onNotify('error', 'Failed to connect to item category master.');
        }
      }
    );

    return () => unsubscribe();
  }, [onNotify]);

  // Real-time normalized preview
  const normalizedNew = categoryName.trim().toLowerCase();
  const duplicateExisting = normalizedNew
    ? categories.find(
        (c) =>
          c.normalizedName === normalizedNew ||
          c.categoryName?.toLowerCase() === normalizedNew ||
          c.name?.toLowerCase() === normalizedNew
      )
    : undefined;

  // Filter categories
  const filteredCategories = categories.filter((item) => {
    const term = search.toLowerCase().trim();
    const matchesSearch =
      !term ||
      item.categoryName.toLowerCase().includes(term) ||
      item.categoryCode.toLowerCase().includes(term) ||
      (item.description && item.description.toLowerCase().includes(term));

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && item.isActive) ||
      (statusFilter === 'inactive' && !item.isActive);

    return matchesSearch && matchesStatus;
  });

  // Handle Add Category
  const handleOpenAdd = () => {
    setCategoryName('');
    setCategoryDescription('');
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const trimmedName = categoryName.trim();
    if (!trimmedName) {
      setFormError('Please enter a category name.');
      return;
    }

    if (duplicateExisting) {
      setFormError(`Category "${duplicateExisting.categoryName}" already exists in Master.`);
      return;
    }

    const generatedCode = autoGenerateCategoryCode(trimmedName);

    setIsSubmitting(true);
    try {
      const added = await ItemCategoryMasterService.addCategory(
        trimmedName,
        generatedCode,
        categoryDescription,
        currentUserId
      );
      if (onNotify) {
        onNotify('success', `Category "${added.categoryName}" added to Master.`);
      }
      setIsAddModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Failed to add category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Edit Category
  const handleOpenEdit = (cat: ItemCategoryMasterItem) => {
    setSelectedCategory(cat);
    setCategoryName(cat.categoryName || cat.name);
    setCategoryDescription(cat.description || '');
    setFormError('');
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory) return;
    setFormError('');

    const trimmedName = categoryName.trim();
    if (!trimmedName) {
      setFormError('Category name cannot be empty.');
      return;
    }

    setIsSubmitting(true);
    try {
      await ItemCategoryMasterService.updateCategory(
        selectedCategory.id,
        {
          categoryName: trimmedName,
          categoryCode: selectedCategory.categoryCode || autoGenerateCategoryCode(trimmedName),
          description: categoryDescription
        },
        currentUserId
      );
      if (onNotify) {
        onNotify('success', `Category updated to "${trimmedName}".`);
      }
      setIsEditModalOpen(false);
      setSelectedCategory(null);
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Failed to update category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Toggle Active/Inactive
  const handleToggleActive = async (cat: ItemCategoryMasterItem) => {
    const nextStatus = !cat.isActive;
    try {
      await ItemCategoryMasterService.updateCategory(
        cat.id,
        { isActive: nextStatus },
        currentUserId
      );
      if (onNotify) {
        onNotify('info', `Category "${cat.categoryName}" is now ${nextStatus ? 'Active' : 'Inactive'}.`);
      }
    } catch (err: any) {
      console.error(err);
      if (onNotify) {
        onNotify('error', 'Failed to update category status.');
      }
    }
  };

  // Handle Delete Category
  const handleOpenDelete = (cat: ItemCategoryMasterItem) => {
    setSelectedCategory(cat);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedCategory) return;
    setIsSubmitting(true);
    try {
      await ItemCategoryMasterService.deleteCategory(selectedCategory.id);
      if (onNotify) {
        onNotify('success', `Category "${selectedCategory.categoryName}" removed.`);
      }
      setIsDeleteModalOpen(false);
      setSelectedCategory(null);
    } catch (err: any) {
      console.error(err);
      if (onNotify) {
        onNotify('error', 'Failed to delete category.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-[#1F4E79]">Item Category Master</h2>
          <p className="text-xs text-slate-500">
            Configure material and chemical categories available in Item &amp; Chemical Master
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<Plus className="w-3.5 h-3.5" />}
          onClick={handleOpenAdd}
        >
          Add Category
        </Button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search category name, code, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent transition"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start sm:self-auto">
          {(['all', 'active', 'inactive'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1 rounded text-xs font-semibold capitalize transition cursor-pointer ${
                statusFilter === filter
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Categories Table Card */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin text-[#1F4E79] mx-auto" />
            <p className="text-xs font-medium text-slate-500">Loading item categories...</p>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <FolderTree className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">
              {categories.length === 0 ? 'No categories registered yet' : 'No matching categories found'}
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {categories.length === 0
                ? 'Click "Add Category" to create your first category for Item & Chemical Master.'
                : 'Try clearing your search query or switching the status filter.'}
            </p>
            {categories.length === 0 && (
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={handleOpenAdd}
              >
                Add Category
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 w-12">#</th>
                  <th className="py-3 px-4">Category Details</th>
                  <th className="py-3 px-4">Code / Prefix</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Audit Info</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredCategories.map((cat, idx) => {
                  const creatorName = getUserDisplayName(cat.createdBy);
                  const updaterName = cat.updatedBy ? getUserDisplayName(cat.updatedBy) : null;

                  return (
                    <tr key={cat.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Row Index */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                        {idx + 1}
                      </td>

                      {/* Category Name & Description */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-900 text-[13px] block">
                            {cat.categoryName}
                          </span>
                          {cat.description && (
                            <span className="text-[11px] text-slate-400 block line-clamp-1">
                              {cat.description}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Code Badge */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-xs bg-slate-100 text-[#1F4E79] px-2 py-0.5 rounded border border-slate-200">
                          {cat.categoryCode}
                        </span>
                      </td>

                      {/* Status Toggle */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleToggleActive(cat)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                            cat.isActive
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                          }`}
                          title="Click to toggle status"
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              cat.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                          />
                          <span>{cat.isActive ? 'Active' : 'Inactive'}</span>
                        </button>
                      </td>

                      {/* Created / Updated Info */}
                      <td className="py-3.5 px-4 text-slate-500">
                        <div>
                          <span className="text-[11px] text-slate-600 block">
                            Added by <span className="font-medium text-slate-800">{creatorName}</span>
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono block">
                            {formatDateTime(cat.createdAt)}
                          </span>
                          {cat.updatedAt && (
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              Updated {updaterName ? `by ${updaterName}` : ''}: {formatDateTime(cat.updatedAt)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(cat)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-[#1F4E79] hover:bg-slate-100 transition cursor-pointer"
                            title="Edit category"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenDelete(cat)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="Delete category"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ========================================================== */}
      {/* MODAL: ADD CATEGORY */}
      {/* ========================================================== */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setFormError('');
        }}
        title="Add Category to Item Master"
        maxWidth="md"
      >
        <form onSubmit={handleAddCategory} className="space-y-4">
          <Input
            label="Category Name *"
            placeholder="e.g. Finishing Chemicals, Packaging Supplies"
            value={categoryName}
            onChange={(e) => {
              setCategoryName(e.target.value);
              setFormError('');
            }}
            autoFocus
            required
          />

          {/* Auto-generated Category Code — read only */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-2">
              Category Code
              <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/80 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Auto-generated
              </span>
            </label>
            <input
              type="text"
              value={previewCode || '—'}
              readOnly
              tabIndex={-1}
              className="w-full h-10 bg-slate-100 border border-slate-200 rounded-xl px-3 text-sm font-mono font-bold text-slate-600 tracking-widest cursor-not-allowed focus:outline-none shadow-2xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Description (Optional)
            </label>
            <textarea
              value={categoryDescription}
              onChange={(e) => setCategoryDescription(e.target.value)}
              placeholder="e.g. Dyes, auxiliaries, enzymes, and finishing agents used in textile processing..."
              rows={3}
              className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-[#1F4E79] transition shadow-2xs"
            />
          </div>

          {/* Real-time normalized preview */}
          {categoryName.trim() && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Normalized Name:</span>
                <code className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {normalizedNew}
                </code>
              </div>
              {duplicateExisting && (
                <p className="text-rose-600 font-semibold text-[11px] pt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Warning: Category "{duplicateExisting.categoryName}" is already registered.
                </p>
              )}
            </div>
          )}

          {formError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => {
                setIsAddModalOpen(false);
                setFormError('');
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              icon={isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              disabled={isSubmitting || !categoryName.trim() || !!duplicateExisting}
            >
              {isSubmitting ? 'Saving...' : 'Add Category'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================== */}
      {/* MODAL: EDIT CATEGORY */}
      {/* ========================================================== */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedCategory(null);
          setFormError('');
        }}
        title={`Edit Category: ${selectedCategory?.categoryName || ''}`}
        maxWidth="md"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <Input
            label="Category Name *"
            value={categoryName}
            onChange={(e) => {
              setCategoryName(e.target.value);
              setFormError('');
            }}
            autoFocus
            required
          />

          {/* Category Code — read only in edit mode too */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-2">
              Category Code
              <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/80 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Read Only
              </span>
            </label>
            <input
              type="text"
              value={selectedCategory?.categoryCode || '—'}
              readOnly
              tabIndex={-1}
              className="w-full h-10 bg-slate-100 border border-slate-200 rounded-xl px-3 text-sm font-mono font-bold text-slate-600 tracking-widest cursor-not-allowed focus:outline-none shadow-2xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Description (Optional)
            </label>
            <textarea
              value={categoryDescription}
              onChange={(e) => setCategoryDescription(e.target.value)}
              rows={3}
              className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-[#1F4E79] transition shadow-2xs"
            />
          </div>

          {formError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => {
                setIsEditModalOpen(false);
                setSelectedCategory(null);
                setFormError('');
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              icon={isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              disabled={isSubmitting || !categoryName.trim()}
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================== */}
      {/* MODAL: DELETE CATEGORY CONFIRMATION */}
      {/* ========================================================== */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedCategory(null);
        }}
        title="Confirm Category Removal"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Are you sure you want to remove category{' '}
            <strong className="text-slate-900 font-bold">"{selectedCategory?.categoryName}"</strong> from Item Category Master?
          </p>
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Tip: You can deactivate it instead of deleting so existing catalog items remain unaffected.
            </span>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setSelectedCategory(null);
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              icon={isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              onClick={handleConfirmDelete}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
