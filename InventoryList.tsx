import React, { useState, useEffect } from 'react';
import { InventoryItem, ITEM_TYPES, INVENTORY_STATUSES } from '../types';
import { Package, Search, AlertTriangle, Filter } from 'lucide-react';

interface InventoryListProps {
  onAddItem: () => void;
  onEditItem: (item: InventoryItem) => void;
}

const InventoryList: React.FC<InventoryListProps> = ({ onAddItem, onEditItem }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const loadItems = async () => {
    try {
      setLoading(true);
      const rows = await window.tasklet.sqlQuery(
        `SELECT i.*, s.name as supplier_name FROM inventory i LEFT JOIN suppliers s ON i.supplier_id = s.id ORDER BY i.ingredient_name`
      );
      setItems(rows as unknown as InventoryItem[]);
    } catch (err) {
      console.error('Failed to load inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const filtered = items.filter((item) => {
    const matchesSearch = !searchTerm || item.ingredient_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = !filterType || item.item_type === filterType;
    const matchesStatus = !filterStatus || item.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  const totalItems = items.length;
  const inStockCount = items.filter((i) => i.status === 'In Stock').length;
  const lowStockCount = items.filter((i) => i.status === 'Low Stock').length;
  const outOfStockCount = items.filter((i) => i.status === 'Out of Stock').length;
  const totalValue = items.reduce((sum, i) => sum + (Number(i.current_stock_kg) || 0) * (Number(i.cost_per_kg) || 0), 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'In Stock':
        return <span className="badge badge-success badge-sm">{status}</span>;
      case 'Low Stock':
        return <span className="badge badge-warning badge-sm">{status}</span>;
      case 'Out of Stock':
        return <span className="badge badge-error badge-sm">{status}</span>;
      default:
        return <span className="badge badge-ghost badge-sm">{status}</span>;
    }
  };

  const formatLocation = (item: InventoryItem) => {
    const parts = [item.warehouse_aisle, item.warehouse_shelf, item.warehouse_bin].filter(Boolean);
    return parts.length > 0 ? parts.join('-') : '-';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">Inventory</h2>
          <span className="badge badge-ghost">{totalItems} items</span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={onAddItem}>
          + Add Item
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="stat bg-base-200 rounded-lg p-3">
          <div className="stat-title text-xs">Total Items</div>
          <div className="stat-value text-lg">{totalItems}</div>
        </div>
        <div className="stat bg-base-200 rounded-lg p-3">
          <div className="stat-title text-xs">In Stock</div>
          <div className="stat-value text-lg text-success">{inStockCount}</div>
        </div>
        <div className="stat bg-base-200 rounded-lg p-3">
          <div className="stat-title text-xs">Low Stock</div>
          <div className="stat-value text-lg text-warning">{lowStockCount}</div>
        </div>
        <div className="stat bg-base-200 rounded-lg p-3">
          <div className="stat-title text-xs">Out of Stock</div>
          <div className="stat-value text-lg text-error">{outOfStockCount}</div>
        </div>
        <div className="stat bg-base-200 rounded-lg p-3">
          <div className="stat-title text-xs">Total Value</div>
          <div className="stat-value text-lg">${totalValue.toFixed(2)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-base-200 rounded-lg p-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-base-content/50" />
          <input
            type="text"
            placeholder="Search ingredients..."
            className="input input-sm input-bordered w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-base-content/50" />
          <select
            className="select select-sm select-bordered"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">All Types</option>
            {ITEM_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            className="select select-sm select-bordered"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            {INVENTORY_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-base-200 rounded-lg">
          <AlertTriangle className="w-12 h-12 mx-auto text-base-content/30 mb-3" />
          <p className="text-base-content/50 text-lg font-medium">No inventory items found</p>
          <p className="text-base-content/40 text-sm mt-1">
            {items.length === 0 ? 'Add your first inventory item to get started.' : 'Try adjusting your filters.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-base-100 rounded-lg border border-base-300">
          <table className="table table-sm">
            <thead>
              <tr className="bg-base-200">
                <th>Name</th>
                <th>Type</th>
                <th>Supplier</th>
                <th>Stock (KG)</th>
                <th>Cost/KG</th>
                <th>Location</th>
                <th>Lot #</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="hover">
                  <td className="font-medium">{item.ingredient_name}</td>
                  <td>{item.item_type || '-'}</td>
                  <td>{(item as any).supplier_name || '-'}</td>
                  <td>{Number(item.current_stock_kg).toFixed(2)}</td>
                  <td>${Number(item.cost_per_kg).toFixed(2)}</td>
                  <td className="font-mono text-sm">{formatLocation(item)}</td>
                  <td>{item.lot_number || '-'}</td>
                  <td>{getStatusBadge(item.status)}</td>
                  <td>
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => onEditItem(item)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default InventoryList;
