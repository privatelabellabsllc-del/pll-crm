import React, { useEffect, useState } from 'react';
import { X, Mail, Phone, Globe, MapPin, Edit, Plus, Building2, Star } from 'lucide-react';
import { Customer, SalesProject, ProductionProject } from '../types';
import { formatCurrency, salesStageColor, productionStageColor, priorityColor, timeAgo } from '../utils/helpers';

interface CustomerDetailProps {
  customer: Customer;
  onClose: () => void;
  onEdit: () => void;
  onAddProject: () => void;
}

export const CustomerDetail: React.FC<CustomerDetailProps> = ({ customer, onClose, onEdit, onAddProject }) => {
  const [salesProjects, setSalesProjects] = useState<SalesProject[]>([]);
  const [prodProjects, setProdProjects] = useState<ProductionProject[]>([]);

  useEffect(() => {
    loadRelated();
  }, [customer.id]);

  async function loadRelated() {
    try {
      const [sales, prod] = await Promise.all([
        window.tasklet.sqlQuery(`SELECT * FROM sales_projects WHERE customer_id=${customer.id} ORDER BY updated_at DESC`),
        window.tasklet.sqlQuery(`SELECT * FROM production_projects WHERE customer_id=${customer.id} ORDER BY updated_at DESC`),
      ]);
      setSalesProjects(sales as unknown as SalesProject[]);
      setProdProjects(prod as unknown as ProductionProject[]);
    } catch (err) {
      console.error('Failed to load related data:', err);
    }
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl max-h-[85vh]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="avatar placeholder">
              <div className="bg-primary text-primary-content rounded-full w-12">
                <span className="text-lg">{customer.name.charAt(0)}</span>
              </div>
            </div>
            <div>
              <h3 className="font-bold text-lg">{customer.name}</h3>
              {customer.company_name && (
                <p className="text-sm text-base-content/50 flex items-center gap-1"><Building2 size={12} /> {customer.company_name}</p>
              )}
            </div>
            {customer.priority !== 'normal' && (
              <span className={`badge ${priorityColor(customer.priority)}`}>
                {customer.priority === 'vip' ? '⭐ VIP' : '🔥 High Priority'}
              </span>
            )}
          </div>
          <div className="flex gap-1">
            <button className="btn btn-ghost btn-sm" onClick={onEdit}><Edit size={16} /></button>
            <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        {/* Contact Info */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {customer.email && (
            <div className="flex items-center gap-2 text-sm"><Mail size={14} className="opacity-50" /> {customer.email}</div>
          )}
          {customer.phone && (
            <div className="flex items-center gap-2 text-sm"><Phone size={14} className="opacity-50" /> {customer.phone}</div>
          )}
          {customer.website && (
            <div className="flex items-center gap-2 text-sm"><Globe size={14} className="opacity-50" /> {customer.website}</div>
          )}
          {customer.address && (
            <div className="flex items-center gap-2 text-sm"><MapPin size={14} className="opacity-50" /> {customer.address}</div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-base-200 rounded-lg p-3 text-center">
            <p className="text-xs text-base-content/50">Revenue</p>
            <p className="font-bold text-success">{formatCurrency(customer.total_revenue)}</p>
          </div>
          <div className="bg-base-200 rounded-lg p-3 text-center">
            <p className="text-xs text-base-content/50">Orders</p>
            <p className="font-bold">{customer.order_count}</p>
          </div>
          <div className="bg-base-200 rounded-lg p-3 text-center">
            <p className="text-xs text-base-content/50">Sales Rep</p>
            <p className="font-bold text-sm">{customer.sales_rep || '—'}</p>
          </div>
        </div>

        {/* Notes */}
        {customer.notes && (
          <div className="bg-base-200 rounded-lg p-3 mb-4">
            <p className="text-xs text-base-content/50 mb-1">Notes</p>
            <p className="text-sm whitespace-pre-wrap">{customer.notes}</p>
          </div>
        )}

        {/* Sales Projects */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm">Sales Projects ({salesProjects.length})</h4>
            <button className="btn btn-ghost btn-xs" onClick={onAddProject}><Plus size={14} /> New Deal</button>
          </div>
          {salesProjects.length === 0 ? (
            <p className="text-sm text-base-content/40">No sales projects yet.</p>
          ) : (
            <div className="space-y-2">
              {salesProjects.map((sp) => (
                <div key={sp.id} className="flex items-center justify-between p-2 bg-base-200 rounded">
                  <div>
                    <p className="text-sm font-medium">{sp.project_name}</p>
                    <p className="text-xs text-base-content/50">{sp.product_type} • {sp.estimated_units?.toLocaleString()} units</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{formatCurrency(sp.estimated_revenue)}</span>
                    <span className={`badge badge-xs ${salesStageColor(sp.sales_stage)}`}>{sp.sales_stage}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Production Projects */}
        <div>
          <h4 className="font-medium text-sm mb-2">Production Projects ({prodProjects.length})</h4>
          {prodProjects.length === 0 ? (
            <p className="text-sm text-base-content/40">No production projects yet.</p>
          ) : (
            <div className="space-y-2">
              {prodProjects.map((pp) => (
                <div key={pp.id} className="flex items-center justify-between p-2 bg-base-200 rounded">
                  <div>
                    <p className="text-sm font-medium">{pp.project_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <progress className="progress progress-primary w-24 progress-xs" value={pp.progress_percent} max={100} />
                      <span className="text-xs text-base-content/50">{pp.progress_percent}%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{formatCurrency(pp.total_value)}</span>
                    <span className={`badge badge-xs ${productionStageColor(pp.production_stage)}`}>{pp.production_stage}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-action">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
};
