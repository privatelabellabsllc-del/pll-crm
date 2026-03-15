import React, { useState, useEffect } from 'react';
import { Supplier } from '../types';
import { Truck, Search, Plus, Eye, Edit2 } from 'lucide-react';
import CsvImport from './CsvImport';

interface SupplierListProps {
  onAddSupplier: () => void;
  onEditSupplier: (supplier: Supplier) => void;
  onViewSupplier: (supplier: Supplier) => void;
}

const SupplierList: React.FC<SupplierListProps> = ({ onAddSupplier, onEditSupplier, onViewSupplier }) => {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const rows = await window.tasklet.sqlQuery(
        `SELECT s.*, 
          (SELECT COUNT(*) FROM inventory WHERE supplier_id = s.id) as ingredient_count,
          (SELECT COUNT(*) FROM purchase_orders WHERE supplier_id = s.id AND status NOT IN ('Received','Delivered')) as open_po_count
        FROM suppliers s ORDER BY s.name`
      );
      setSuppliers(rows);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = suppliers.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (s.name && String(s.name).toLowerCase().includes(q)) ||
      (s.contact_name && String(s.contact_name).toLowerCase().includes(q)) ||
      (s.email && String(s.email).toLowerCase().includes(q)) ||
      (s.phone && String(s.phone).toLowerCase().includes(q))
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  return (
    <div className="p-6 overflow-y-auto h-full space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Truck className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">Suppliers</h2>
          <span className="badge badge-primary">{suppliers.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <CsvImport type="suppliers" onImportComplete={loadSuppliers} />
          <button className="btn btn-primary btn-sm gap-2" onClick={onAddSupplier}>
            <Plus className="w-4 h-4" />
            Add Supplier
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50" />
        <input
          type="text"
          className="input input-bordered w-full pl-10"
          placeholder="Search by name or contact..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Cards Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Truck className="w-12 h-12 mx-auto text-base-content/30 mb-3" />
          <p className="text-base-content/50 text-lg font-medium">
            {search ? 'No suppliers match your search' : 'No suppliers yet'}
          </p>
          {!search && (
            <button className="btn btn-primary btn-sm mt-4 gap-2" onClick={onAddSupplier}>
              <Plus className="w-4 h-4" />
              Add your first supplier
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((supplier) => (
            <div
              key={supplier.id}
              className="bg-base-100 border border-base-300 rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              {/* Card Header */}
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="font-bold text-lg leading-tight">{supplier.name}</h3>
                  {supplier.lead_time_days != null && (
                    <span className="badge badge-outline badge-sm whitespace-nowrap">
                      {supplier.lead_time_days} days
                    </span>
                  )}
                </div>

                {/* Contact Info */}
                <div className="space-y-1 text-sm text-base-content/70">
                  {supplier.contact_name && (
                    <p className="font-medium text-base-content/90">{supplier.contact_name}</p>
                  )}
                  {supplier.email && <p>{supplier.email}</p>}
                  {supplier.phone && <p>{supplier.phone}</p>}
                  {supplier.address && (
                    <p className="mt-2 text-xs text-base-content/50">{supplier.address}</p>
                  )}
                  {supplier.website && (
                    <a
                      href={String(supplier.website).startsWith('http') ? String(supplier.website) : `https://${supplier.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link link-primary text-xs mt-1 inline-block"
                    >
                      {supplier.website}
                    </a>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-base-300">
                <div className="flex items-center gap-2">
                  <span className="badge badge-ghost badge-sm">
                    {supplier.ingredient_count || 0} ingredient{Number(supplier.ingredient_count) !== 1 ? 's' : ''}
                  </span>
                  {Number(supplier.open_po_count) > 0 && (
                    <span className="badge badge-warning badge-sm">
                      {supplier.open_po_count} open PO{Number(supplier.open_po_count) !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    className="btn btn-ghost btn-xs gap-1"
                    onClick={() => onViewSupplier(supplier as Supplier)}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View
                  </button>
                  <button
                    className="btn btn-ghost btn-xs gap-1"
                    onClick={() => onEditSupplier(supplier as Supplier)}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SupplierList;
