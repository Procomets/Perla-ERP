import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  RefreshCw,
  Hash,
  AlertCircle,
  CheckCircle2,
  Check,
  X
} from 'lucide-react';

import { HsnItem } from '../../../types/hsnMaster';
import { HsnMasterService } from '../../../services/hsnMasterService';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Card } from '../../../components/ui/Card';

interface HsnMasterSettingsProps {
  currentUserId: string;
  usersMap?: Record<string, string>;
  onNotify?: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const HsnMasterSettings: React.FC<HsnMasterSettingsProps> = ({
  currentUserId,
  onNotify
}) => {
  const [hsnList, setHsnList] = useState<HsnItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<HsnItem | null>(null);

  // Form Inputs (Two main fields: Description & HSN No.)
  const [hsnNo, setHsnNo] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Subscribe to HSN Master
  useEffect(() => {
    setLoading(true);
    const unsubscribe = HsnMasterService.subscribeHsnItems(
      (items) => {
        setHsnList(items);
        setLoading(false);
      },
      (error) => {
        console.error('HSN Master subscription error:', error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Filter HSN list
  const filteredList = hsnList.filter((item) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      item.hsnNo.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q);

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && item.isActive) ||
      (statusFilter === 'inactive' && !item.isActive);

    return matchesSearch && matchesStatus;
  });

  // Open Add Modal
  const handleOpenAdd = () => {
    setHsnNo('');
    setDescription('');
    setFormError('');
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item: HsnItem) => {
    setSelectedItem(item);
    setHsnNo(item.hsnNo);
    setDescription(item.description);
    setFormError('');
    setIsEditModalOpen(true);
  };

  // Open Delete Modal
  const handleOpenDelete = (item: HsnItem) => {
    setSelectedItem(item);
    setIsDeleteModalOpen(true);
  };

  // Handle Save New
  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const trimmedHsn = hsnNo.trim();
    const trimmedDesc = description.trim();

    if (!trimmedHsn) {
      setFormError('HSN No. is required.');
      return;
    }
    if (!trimmedDesc) {
      setFormError('Description is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await HsnMasterService.addHsnItem(trimmedHsn, trimmedDesc, currentUserId);
      setIsAddModalOpen(false);
      setHsnNo('');
      setDescription('');
      onNotify?.('success', `HSN "${trimmedHsn}" added successfully.`);
    } catch (err: any) {
      setFormError(err.message || 'Failed to add HSN entry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    setFormError('');

    const trimmedHsn = hsnNo.trim();
    const trimmedDesc = description.trim();

    if (!trimmedHsn) {
      setFormError('HSN No. is required.');
      return;
    }
    if (!trimmedDesc) {
      setFormError('Description is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await HsnMasterService.updateHsnItem(
        selectedItem.id,
        { hsnNo: trimmedHsn, description: trimmedDesc },
        currentUserId
      );
      setIsEditModalOpen(false);
      setSelectedItem(null);
      onNotify?.('success', `HSN "${trimmedHsn}" updated successfully.`);
    } catch (err: any) {
      setFormError(err.message || 'Failed to update HSN entry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Confirm Delete
  const handleConfirmDelete = async () => {
    if (!selectedItem) return;
    setIsSubmitting(true);
    try {
      await HsnMasterService.deleteHsnItem(selectedItem.id);
      setIsDeleteModalOpen(false);
      onNotify?.('success', `HSN "${selectedItem.hsnNo}" deleted.`);
      setSelectedItem(null);
    } catch (err: any) {
      onNotify?.('error', err.message || 'Failed to delete HSN item.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Toggle Active/Inactive
  const handleToggleStatus = async (item: HsnItem) => {
    const nextStatus = !item.isActive;
    try {
      await HsnMasterService.updateHsnItem(
        item.id,
        { isActive: nextStatus },
        currentUserId
      );
      onNotify?.('info', `HSN "${item.hsnNo}" is now ${nextStatus ? 'Active' : 'Inactive'}.`);
    } catch (err: any) {
      onNotify?.('error', 'Failed to toggle status.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Title and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-[#1F4E79]">
              <Hash className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900">HSN / SAC Master</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage HSN codes and descriptions used across PO colour lines and Invoice generation.
          </p>
        </div>

        <Button
          onClick={handleOpenAdd}
          className="bg-[#1F4E79] hover:bg-[#163a5c] text-white flex items-center gap-2 px-3.5 py-2 text-xs font-semibold shadow-xs shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New HSN</span>
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 bg-white border border-slate-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by HSN No. or Description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1F4E79] focus:bg-white transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
              >
                &times;
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            {(['all', 'active', 'inactive'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition cursor-pointer ${
                  statusFilter === status
                    ? 'bg-[#1F4E79] text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Table of HSN Items */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[#1F4E79]" />
            Loading HSN entries...
          </div>
        ) : filteredList.length === 0 ? (
          <div className="p-8 text-center">
            <Hash className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-600">No HSN entries found</p>
            <p className="text-[11px] text-slate-400 mt-1">
              {search ? 'Try clearing your search query.' : 'Click "Add New HSN" to define your first HSN entry.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4 w-36">HSN No.</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 w-28 text-center">Status</th>
                  <th className="py-3 px-4 w-28 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 text-center font-mono text-slate-400 text-[11px]">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2.5 py-1 rounded-md bg-blue-50 text-blue-900 border border-blue-200 font-mono font-bold text-xs">
                        {item.hsnNo}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {item.description}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(item)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                          item.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                        }`}
                        title="Click to toggle status"
                      >
                        {item.isActive ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            Active
                          </>
                        ) : (
                          <>
                            <X className="w-3 h-3 text-slate-400" />
                            Inactive
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 text-slate-400 hover:text-[#1F4E79] hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          title="Edit HSN"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDelete(item)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Delete HSN"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: ADD HSN ENTRY */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New HSN Entry"
      >
        <form onSubmit={handleSaveAdd} className="space-y-4">
          <p className="text-xs text-slate-500">
            Define an HSN code with its commercial goods or service description.
          </p>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              HSN No. <span className="text-rose-500">*</span>
            </label>
            <Input
              placeholder="e.g. 998821 or 6203"
              value={hsnNo}
              onChange={(e) => {
                setHsnNo(e.target.value);
                setFormError('');
              }}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Textiles, apparel dyeing and finishing services"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setFormError('');
              }}
              className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1F4E79] transition-colors"
              required
            />
          </div>

          {formError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#1F4E79] hover:bg-[#163a5c] text-white shadow-xs cursor-pointer"
              disabled={isSubmitting || !hsnNo.trim() || !description.trim()}
            >
              {isSubmitting ? 'Saving...' : 'Save HSN'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: EDIT HSN ENTRY */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit HSN Entry"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              HSN No. <span className="text-rose-500">*</span>
            </label>
            <Input
              placeholder="e.g. 998821 or 6203"
              value={hsnNo}
              onChange={(e) => {
                setHsnNo(e.target.value);
                setFormError('');
              }}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Textiles, apparel dyeing and finishing services"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setFormError('');
              }}
              className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1F4E79] transition-colors"
              required
            />
          </div>

          {formError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#1F4E79] hover:bg-[#163a5c] text-white shadow-xs cursor-pointer"
              disabled={isSubmitting || !hsnNo.trim() || !description.trim()}
            >
              {isSubmitting ? 'Updating...' : 'Update HSN'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: DELETE CONFIRMATION */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm HSN Removal"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Are you sure you want to delete HSN code{' '}
              <strong>"{selectedItem?.hsnNo}"</strong> ({selectedItem?.description})?
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Deleting...' : 'Delete HSN'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

