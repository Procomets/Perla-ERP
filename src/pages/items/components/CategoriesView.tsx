import React from 'react';
import { ItemCategoryRecord, MasterItem } from '../../../types/item';
import { Table, Column } from '../../../components/ui/Table';
import { StatusChip } from '../../../components/ui/StatusChip';
import { Button } from '../../../components/ui/Button';
import { formatDate } from '../../../utils/formatters';
import { Tag, Plus, Edit2, CheckCircle2, XCircle } from 'lucide-react';

interface CategoriesViewProps {
  categories: ItemCategoryRecord[];
  items: MasterItem[];
  onAddCategory: () => void;
  onEditCategory: (cat: ItemCategoryRecord) => void;
  onToggleStatus: (cat: ItemCategoryRecord) => void;
  isAdminOrManager?: boolean;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  categories,
  items,
  onAddCategory,
  onEditCategory,
  onToggleStatus,
  isAdminOrManager
}) => {
  // Count items dynamically per category
  const getCategoryItemCount = (categoryId: string) => {
    return items.filter((i) => i.categoryId === categoryId).length;
  };

  const columns: Column<ItemCategoryRecord>[] = [
    {
      header: 'Category Code',
      accessor: (row) => (
        <span className="font-bold text-[#1F4E79] font-mono text-xs">{row.categoryCode}</span>
      )
    },
    {
      header: 'Category Name',
      accessor: (row) => (
        <div>
          <span className="font-bold text-slate-900 block text-xs">{row.categoryName}</span>
          {row.description && <span className="text-[11px] text-slate-400">{row.description}</span>}
        </div>
      )
    },
    {
      header: 'Items Registered',
      accessor: (row) => {
        const count = getCategoryItemCount(row.categoryId);
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            {count} {count === 1 ? 'item' : 'items'}
          </span>
        );
      }
    },
    {
      header: 'Last Updated',
      accessor: (row) => (
        <span className="text-xs text-slate-500 font-mono">{formatDate(row.updatedAt)}</span>
      )
    },
    {
      header: 'Status',
      accessor: (row) => (
        <StatusChip
          status={row.status === 'active' ? 'Active' : 'Inactive'}
          variant={row.status === 'active' ? 'green' : 'slate'}
        />
      )
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <div className="flex items-center gap-1.5">
          {isAdminOrManager && (
            <>
              <button
                onClick={() => onEditCategory(row)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-[#1F4E79] hover:bg-slate-100 transition-colors"
                title="Edit Category"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => onToggleStatus(row)}
                className={`p-1.5 rounded-lg transition-colors ${
                  row.status === 'active'
                    ? 'text-rose-500 hover:bg-rose-50'
                    : 'text-emerald-600 hover:bg-emerald-50'
                }`}
                title={row.status === 'active' ? 'Deactivate Category' : 'Activate Category'}
              >
                {row.status === 'active' ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              </button>
            </>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Configurable Item Categories</h3>
          <p className="text-xs text-slate-500">
            Organize factory materials, chemicals, packaging, and maintenance components
          </p>
        </div>
        {isAdminOrManager && (
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={onAddCategory}
          >
            New Category
          </Button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <Table columns={columns} data={categories} keyExtractor={(row) => row.id} />
      </div>
    </div>
  );
};
