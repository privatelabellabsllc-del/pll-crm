import React, { useState, useEffect } from 'react';
import { PurchaseOrder, PO_STATUSES } from '../types';
import { ShoppingCart, Search, Filter, Plus, Edit2, ExternalLink, ChevronRight } from 'lucide-react';

interface PurchaseOrderListProps {
  onAddPO: () => void;
  onEditPO: (po: PurchaseOrder) => void;
}

const STATUS_ORDER = ['Draft', 'Ordered', 'Shipped', 'Delivered', 'Received'];

const statusBadgeClass = (status: string): string => {
  switch (status) {
    case 'Draft': return 'badge-ghost';
    case 'Ordered': return 'badge-info';
    case 'Shipped': return 'badge-warning';
    case 'Delivered': return 'badge-accent';
    case 'Received': return 'badge-success';
    default: return 'badge-ghost';
  }
};

const PurchaseOrderList: React.FC<PurchaseOrderListProps> = ({ onAddPO, onEditPO }) => {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const loadPurchaseOrders = async () => {
    try {
      const rows = await window.tasklet.sqlQuery(
        `SELECT po.*, s.name as supplier_name, i.ingredient_name, pp.project_name
         FROM purchase_orders po
         LEFT JOIN suppliers s ON po.supplier_id = s.id
         LEFT JOIN inventory i ON po.inventory_id = i.id
         LEFT JOIN production_projects pp ON po.production_project_id = pp.id
         ORDER BY po.created_at DESC`
      );
      setPurchaseOrders(rows as unknown as PurchaseOrder[]);
    } catch (err) {
      console.error('Failed to load purchase orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPurchaseOrders();
  }, []);

  const filtered = purchaseOrders.filter((po) => {
    const poNumber = `PO-${String(po.id).padStart(4, '0')}`;
    const matchesSearch =
      !searchTerm ||
      ((po as any).supplier_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      ((po as any).ingredient_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (po.status || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      ((po as any).project_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || po.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPOs = purchaseOrders.length;
  const draftCount = purchaseOrders.filter((p) => p.status === 'Draft').length;
  const orderedCount = purchaseOrders.filter((p) => p.status === 'Ordered').length;
  const shippedCount = purchaseOrders.filter((p) => p.status === 'Shipped').length;
  const deliveredCount = purchaseOrders.filter((p) => p.status === 'Delivered').length;
  const receivedCount = purchaseOrders.filter((p) => p.status === 'Received').length;
  const totalValue = purchaseOrders.reduce((sum, p) => sum + (Number(p.total_price) || 0), 0);

  const getNextStatus = (current: string): string | null => {
    const idx = STATUS_ORDER.indexOf(current);
    if (idx >= 0 && idx < STATUS_ORDER.length - 1) {
      return STATUS_ORDER[idx + 1];
    }
    return null;
  };

  const advanceStatus = async (po: PurchaseOrder) => {
    const next = getNextStatus(po.status);
    if (!next) return;
    const escaped = next.replace(/'/g, "''");
    try {
      await window.tasklet.sqlQuery(
        `UPDATE purchase_orders SET status = '${escaped}' WHERE id = ${po.id}`
      );
      await loadPurchaseOrders();
    } catch (err) {
      console.error('Failed to advance status:', err);
    }
  };

  const formatPONumber = (id: number): string => {
    return `PO-${String(id).padStart(4, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  return (
    <div className="p-6 overflow-y-auto h-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShoppingCart className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">Purchase Orders</h2>
          <span className="badge badge-primary">{totalPOs}</span>
        </div>
        <button className="btn btn-primary gap-2" onClick={onAddPO}>
          <Plus className="w-4 h-4" />
          New PO
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="stat bg-base-200 rounded-lg p-3 text-center">
          <div className="text-xs opacity-60">Total POs</div>
          <div className="text-lg font-bold">{totalPOs}</div>
        </div>
        <div className="stat bg-base-200 rounded-lg p-3 text-center">
          <div className="text-xs opacity-60">Draft</div>
          <div className="text-lg font-bold">{draftCount}</div>
        </div>
        <div className="stat bg-base-200 rounded-lg p-3 text-center">
          <div className="text-xs opacity-60">Ordered</div>
          <div className="text-lg font-bold">{orderedCount}</div>
        </div>
        <div className="stat bg-base-200 rounded-lg p-3 text-center">
          <div className="text-xs opacity-60">In Transit</div>
          <div className="text-lg font-bold">{shippedCount}</div>
        </div>
        <div className="stat bg-base-200 rounded-lg p-3 text-center">
          <div className="text-xs opacity-60">Delivered</div>
          <div className="text-lg font-bold">{deliveredCount}</div>
        </div>
        <div className="stat bg-base-200 rounded-lg p-3 text-center">
          <div className="text-xs opacity-60">Received</div>
          <div className="text-lg font-bold">{receivedCount}</div>
        </div>
        <div className="stat bg-base-200 rounded-lg p-3 text-center">
          <div className="text-xs opacity-60">Total Value</div>
          <div className="text-lg font-bold text-primary">${totalValue.toFixed(2)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
          <input
            type="text"
            placeholder="Search by supplier or ingredient..."
            className="input input-bordered w-full pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 opacity-50" />
          <select
            className="select select-bordered"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            {PO_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-base-200 rounded-xl">
          <ShoppingCart className="w-12 h-12 mx-auto opacity-30 mb-3" />
          <p className="text-lg font-semibold opacity-60">No purchase orders found</p>
          <p className="text-sm opacity-40 mt-1">Create a new PO to get started</p>
          <button className="btn btn-primary btn-sm mt-4 gap-2" onClick={onAddPO}>
            <Plus className="w-4 h-4" />
            New PO
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-420px)] bg-base-100 rounded-xl shadow">
          <table className="table table-zebra w-full">
            <thead>
              <tr>
                <th>PO #</th>
                <th>Supplier</th>
                <th>Ingredient</th>
                <th>Qty (KG)</th>
                <th>Price ($)</th>
                <th>Status</th>
                <th>Carrier</th>
                <th>Tracking #</th>
                <th>Expected Delivery</th>
                <th>Project</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((po) => {
                const nextStatus = getNextStatus(po.status);
                return (
                  <tr key={po.id}>
                    <td className="font-mono font-semibold">{formatPONumber(po.id)}</td>
                    <td>{(po as any).supplier_name || '—'}</td>
                    <td>{(po as any).ingredient_name || '—'}</td>
                    <td>{po.quantity_kg != null ? Number(po.quantity_kg).toFixed(2) : '—'}</td>
                    <td>{po.total_price != null ? `$${Number(po.total_price).toFixed(2)}` : '—'}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <span className={`badge badge-sm ${statusBadgeClass(po.status)}`}>
                          {po.status}
                        </span>
                        {nextStatus && (
                          <button
                            className="btn btn-ghost btn-xs p-0 min-h-0 h-5 w-5"
                            title={`Advance to ${nextStatus}`}
                            onClick={() => advanceStatus(po)}
                          >
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td>{po.carrier || '—'}</td>
                    <td>
                      {po.tracking_number ? (
                        <span className="font-mono text-xs">{po.tracking_number}</span>
                      ) : '—'}
                    </td>
                    <td>
                      {po.expected_delivery
                        ? new Date(po.expected_delivery).toLocaleDateString()
                        : '—'}
                    </td>
                    <td>
                      {(po as any).project_name ? (
                        <span className="flex items-center gap-1 text-sm">
                          <ExternalLink className="w-3 h-3 opacity-50" />
                          {(po as any).project_name}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm gap-1"
                        onClick={() => onEditPO(po)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrderList;
