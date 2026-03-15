import React, { useEffect, useState } from 'react';
import {
  ArrowLeft, Mail, Phone, Globe, MapPin, Edit, Plus, Building2,
  FileText, Upload, Trash2, Image, TrendingUp, Factory, FlaskConical,
  FolderOpen, Eye, DollarSign, Package, Calendar, StickyNote, Download
} from 'lucide-react';
import { Customer, SalesProject, ProductionProject, Formula, Attachment, PurchaseOrder } from '../types';
import { formatCurrency, formatDate, salesStageColor, productionStageColor, priorityColor, timeAgo } from '../utils/helpers';
import { apiGet, apiUpload, apiDelete } from '../api';

type ProfileTab = 'overview' | 'sales' | 'production' | 'formulas' | 'documents';

interface CustomerDetailProps {
  customer: Customer;
  onClose: () => void;
  onEdit: () => void;
  onAddSalesDeal: () => void;
  onAddProduction: () => void;
}

const TAB_CONFIG: { key: ProfileTab; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: 'Overview', icon: <Eye size={15} /> },
  { key: 'sales', label: 'Sales', icon: <TrendingUp size={15} /> },
  { key: 'production', label: 'Production', icon: <Factory size={15} /> },
  { key: 'formulas', label: 'Formulas', icon: <FlaskConical size={15} /> },
  { key: 'documents', label: 'Documents', icon: <FolderOpen size={15} /> },
];

export const CustomerDetail: React.FC<CustomerDetailProps> = ({
  customer,
  onClose,
  onEdit,
  onAddSalesDeal,
  onAddProduction,
}) => {
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [salesProjects, setSalesProjects] = useState<SalesProject[]>([]);
  const [prodProjects, setProdProjects] = useState<ProductionProject[]>([]);
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllData();
  }, [customer.id]);

  async function loadAllData() {
    setLoading(true);
    try {
      await Promise.all([loadRelated(), loadFormulas(), loadAttachments(), loadPurchaseOrders()]);
    } finally {
      setLoading(false);
    }
  }

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

  async function loadFormulas() {
    try {
      const rows = await window.tasklet.sqlQuery(
        `SELECT DISTINCT f.* FROM formulas f JOIN production_projects pp ON pp.formula_id = f.id WHERE pp.customer_id = ${customer.id}`
      );
      setFormulas(rows as unknown as Formula[]);
    } catch (err) {
      console.error('Failed to load formulas:', err);
    }
  }

  async function loadPurchaseOrders() {
    try {
      const rows = await window.tasklet.sqlQuery(
        `SELECT po.*, s.name as supplier_name, i.ingredient_name FROM purchase_orders po LEFT JOIN suppliers s ON po.supplier_id = s.id LEFT JOIN inventory i ON po.inventory_id = i.id WHERE po.production_project_id IN (SELECT id FROM production_projects WHERE customer_id = ${customer.id}) ORDER BY po.created_at DESC`
      );
      setPurchaseOrders(rows as unknown as PurchaseOrder[]);
    } catch (err) {
      console.error('Failed to load purchase orders:', err);
    }
  }

  async function loadAttachments() {
    try {
      const data = await apiGet(`/api/attachments/customer/${customer.id}`);
      setAttachments(data);
    } catch (err) {
      console.error('Failed to load attachments:', err);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        await apiUpload(`/api/attachments/customer/${customer.id}`, fd);
      }
      await loadAttachments();
    } catch (err) {
      console.error('Failed to upload file:', err);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function deleteAttachment(id: number) {
    try {
      await apiDelete(`/api/attachments/${id}`);
      setAttachments(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error('Failed to delete attachment:', err);
    }
  }

  const activeDeals = salesProjects.filter(s => s.sales_stage !== 'Project Started');
  const totalPipelineValue = salesProjects.reduce((sum, s) => sum + (s.estimated_revenue || 0), 0);

  // Combined recent activity for overview
  const recentActivity = [
    ...salesProjects.map(s => ({ type: 'sale' as const, name: s.project_name, date: s.updated_at, stage: s.sales_stage, value: s.estimated_revenue })),
    ...prodProjects.map(p => ({ type: 'production' as const, name: p.project_name, date: p.updated_at, stage: p.production_stage, value: p.total_value })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-y-auto animate-in">
      {/* ===== HEADER ===== */}
      <div className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
        <div className="flex items-start gap-5">
          {/* Photo */}
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-100 flex-shrink-0 shadow-sm">
            {customer.photo_url ? (
              <img src={customer.photo_url} alt={customer.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 text-blue-500 text-2xl font-bold">
                {customer.name.charAt(0)}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-bold text-gray-900 truncate">{customer.name}</h2>
              {customer.priority !== 'normal' && (
                <span className={`badge ${priorityColor(customer.priority)}`}>
                  {customer.priority === 'vip' ? '⭐ VIP' : '🔥 High Priority'}
                </span>
              )}
            </div>
            {customer.company_name && (
              <p className="text-gray-500 flex items-center gap-1 mt-0.5">
                <Building2 size={14} /> {customer.company_name}
              </p>
            )}
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
              {customer.email && (
                <span className="flex items-center gap-1"><Mail size={13} /> {customer.email}</span>
              )}
              {customer.phone && (
                <span className="flex items-center gap-1"><Phone size={13} /> {customer.phone}</span>
              )}
              {customer.website && (
                <span className="flex items-center gap-1"><Globe size={13} /> {customer.website}</span>
              )}
              {customer.address && (
                <span className="flex items-center gap-1"><MapPin size={13} /> {customer.address}</span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-shrink-0">
            <button className="btn btn-sm btn-outline gap-1" onClick={onEdit}>
              <Edit size={14} /> Edit
            </button>
            <button className="btn btn-sm btn-ghost gap-1" onClick={onClose}>
              <ArrowLeft size={14} /> Back
            </button>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <div className="glass-card p-3 text-center rounded-xl">
            <p className="text-xs text-gray-400 mb-1">Total Revenue</p>
            <p className="font-bold text-green-600 text-lg">{formatCurrency(customer.total_revenue)}</p>
          </div>
          <div className="glass-card p-3 text-center rounded-xl">
            <p className="text-xs text-gray-400 mb-1">Orders</p>
            <p className="font-bold text-gray-800 text-lg">{customer.order_count}</p>
          </div>
          <div className="glass-card p-3 text-center rounded-xl">
            <p className="text-xs text-gray-400 mb-1">Active Deals</p>
            <p className="font-bold text-blue-600 text-lg">{activeDeals.length}</p>
          </div>
          <div className="glass-card p-3 text-center rounded-xl">
            <p className="text-xs text-gray-400 mb-1">Production Jobs</p>
            <p className="font-bold text-purple-600 text-lg">{prodProjects.length}</p>
          </div>
        </div>
      </div>

      {/* ===== TABS ===== */}
      <div className="bg-white rounded-xl p-1 mb-4 shadow-sm flex gap-1 overflow-x-auto">
        {TAB_CONFIG.map(tab => (
          <button
            key={tab.key}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ===== TAB CONTENT ===== */}
      <div className="animate-in">
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'sales' && renderSalesTab()}
        {activeTab === 'production' && renderProductionTab()}
        {activeTab === 'formulas' && renderFormulasTab()}
        {activeTab === 'documents' && renderDocumentsTab()}
      </div>
    </div>
  );

  // ==================== OVERVIEW TAB ====================
  function renderOverviewTab() {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column: Notes + Contact */}
        <div className="lg:col-span-1 space-y-4">
          {/* Sales Rep */}
          {customer.sales_rep && (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-xs text-gray-400 mb-1">Sales Representative</p>
              <p className="font-medium text-gray-800">{customer.sales_rep}</p>
            </div>
          )}

          {/* Notes */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-sm text-gray-700 flex items-center gap-2 mb-2">
              <StickyNote size={15} /> Notes
            </h3>
            {customer.notes ? (
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{customer.notes}</p>
            ) : (
              <p className="text-sm text-gray-400 italic">No notes added yet.</p>
            )}
          </div>

          {/* Pipeline Summary */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-sm text-gray-700 flex items-center gap-2 mb-3">
              <DollarSign size={15} /> Pipeline Summary
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Total Pipeline Value</span>
                <span className="font-bold text-green-600">{formatCurrency(totalPipelineValue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Sales Deals</span>
                <span className="font-medium">{salesProjects.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Production Jobs</span>
                <span className="font-medium">{prodProjects.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Formulas Used</span>
                <span className="font-medium">{formulas.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Documents</span>
                <span className="font-medium">{attachments.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Recent Activity */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-sm text-gray-700 flex items-center gap-2 mb-3">
              <Calendar size={15} /> Recent Activity
            </h3>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-gray-400 italic py-4 text-center">No activity yet. Create a sales deal or production job to get started.</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        item.type === 'sale' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
                      }`}>
                        {item.type === 'sale' ? <TrendingUp size={14} /> : <Factory size={14} />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{item.name}</p>
                        <p className="text-xs text-gray-400">
                          {item.type === 'sale' ? 'Sales Deal' : 'Production'} • {timeAgo(item.date)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{formatCurrency(item.value)}</span>
                      <span className={`badge badge-xs ${
                        item.type === 'sale'
                          ? salesStageColor(item.stage as any)
                          : productionStageColor(item.stage as any)
                      }`}>
                        {item.stage}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Purchase Orders linked to this customer's production */}
          {purchaseOrders.length > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-sm mt-4">
              <h3 className="font-semibold text-sm text-gray-700 flex items-center gap-2 mb-3">
                <Package size={15} /> Related Purchase Orders
              </h3>
              <div className="space-y-2">
                {purchaseOrders.slice(0, 5).map(po => (
                  <div key={po.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div>
                      <p className="text-sm font-medium">{po.ingredient_name || `PO #${po.id}`}</p>
                      <p className="text-xs text-gray-400">{po.supplier_name} • {formatDate(po.expected_delivery)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{formatCurrency(po.price)}</span>
                      <span className="badge badge-xs badge-outline">{po.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==================== SALES TAB ====================
  function renderSalesTab() {
    return (
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-800">Sales Deals</h3>
            <p className="text-sm text-gray-400">{salesProjects.length} total deals • {formatCurrency(totalPipelineValue)} pipeline</p>
          </div>
          <button className="btn btn-primary btn-sm gap-1" onClick={onAddSalesDeal}>
            <Plus size={14} /> New Deal
          </button>
        </div>

        {salesProjects.length === 0 ? (
          <div className="text-center py-10">
            <TrendingUp size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="text-gray-400">No sales deals yet.</p>
            <button className="btn btn-primary btn-sm mt-3 gap-1" onClick={onAddSalesDeal}>
              <Plus size={14} /> Create First Deal
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {salesProjects.map(sp => (
              <div key={sp.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                    <TrendingUp size={16} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{sp.project_name}</p>
                    <p className="text-xs text-gray-400">
                      {sp.product_type || 'No type'} • {sp.estimated_units?.toLocaleString() || 0} units • {timeAgo(sp.updated_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold">{formatCurrency(sp.estimated_revenue)}</span>
                  <span className={`badge ${salesStageColor(sp.sales_stage)}`}>{sp.sales_stage}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ==================== PRODUCTION TAB ====================
  function renderProductionTab() {
    return (
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-800">Production Jobs</h3>
            <p className="text-sm text-gray-400">{prodProjects.length} total jobs</p>
          </div>
          <button className="btn btn-primary btn-sm gap-1" onClick={onAddProduction}>
            <Plus size={14} /> New Job
          </button>
        </div>

        {prodProjects.length === 0 ? (
          <div className="text-center py-10">
            <Factory size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="text-gray-400">No production jobs yet.</p>
            <button className="btn btn-primary btn-sm mt-3 gap-1" onClick={onAddProduction}>
              <Plus size={14} /> Create First Job
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {prodProjects.map(pp => (
              <div key={pp.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0">
                    <Factory size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-800 truncate">{pp.project_name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                        <progress className="progress progress-primary w-full h-2" value={pp.progress_percent} max={100} />
                        <span className="text-xs text-gray-400 whitespace-nowrap">{pp.progress_percent}%</span>
                      </div>
                      {pp.expected_completion && (
                        <span className="text-xs text-gray-400">Due {formatDate(pp.expected_completion)}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                  <span className="text-sm font-bold">{formatCurrency(pp.total_value)}</span>
                  <span className={`badge ${productionStageColor(pp.production_stage)}`}>{pp.production_stage}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ==================== FORMULAS TAB ====================
  function renderFormulasTab() {
    return (
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-800">Formulas</h3>
            <p className="text-sm text-gray-400">{formulas.length} formulas linked through production jobs</p>
          </div>
        </div>

        {formulas.length === 0 ? (
          <div className="text-center py-10">
            <FlaskConical size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="text-gray-400">No formulas linked yet.</p>
            <p className="text-xs text-gray-400 mt-1">Formulas are linked through production jobs that use them.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {formulas.map(f => (
              <div key={f.id} className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-100 text-green-600 flex items-center justify-center">
                      <FlaskConical size={16} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{f.formula_name}</p>
                      <p className="text-xs text-gray-400">{f.product_type || 'No type'}</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <div>
                    <p className="text-xs text-gray-400">Cost/Unit</p>
                    <p className="text-sm font-bold">{formatCurrency(f.total_cost_per_unit)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Price</p>
                    <p className="text-sm font-bold text-green-600">{formatCurrency(f.suggested_price)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Margin</p>
                    <p className="text-sm font-bold text-blue-600">{f.profit_margin?.toFixed(1)}%</p>
                  </div>
                </div>
                {f.ingredient_count != null && (
                  <p className="text-xs text-gray-400 mt-2">
                    {f.ingredient_count} ingredients • Batch size: {f.batch_size_units} units
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ==================== DOCUMENTS TAB ====================
  function renderDocumentsTab() {
    return (
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-800">Documents & Files</h3>
            <p className="text-sm text-gray-400">{attachments.length} files uploaded</p>
          </div>
          <label className="btn btn-primary btn-sm gap-1 cursor-pointer">
            {uploading ? <span className="loading loading-spinner loading-xs" /> : <Upload size={14} />}
            Upload Files
            <input type="file" className="hidden" onChange={handleFileUpload} multiple />
          </label>
        </div>

        {attachments.length === 0 ? (
          <div className="text-center py-10">
            <FolderOpen size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="text-gray-400">No documents uploaded yet.</p>
            <p className="text-xs text-gray-400 mt-1">Upload NDAs, formulas, contracts, or any files related to this customer.</p>
            <label className="btn btn-primary btn-sm mt-3 gap-1 cursor-pointer">
              <Upload size={14} /> Upload First File
              <input type="file" className="hidden" onChange={handleFileUpload} multiple />
            </label>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {attachments.map(att => {
              const isImage = att.file_type?.startsWith('image/');
              return (
                <div key={att.id} className="bg-gray-50 rounded-xl overflow-hidden hover:bg-gray-100 transition-colors group">
                  {isImage && att.file_path && (
                    <div className="aspect-video bg-gray-200 overflow-hidden">
                      <img src={att.file_path} alt={att.file_name} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-3">
                    <div className="flex items-center gap-2">
                      {isImage ? (
                        <Image size={16} className="text-blue-500 flex-shrink-0" />
                      ) : (
                        <FileText size={16} className="text-gray-400 flex-shrink-0" />
                      )}
                      <a
                        href={att.file_path || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium hover:underline truncate flex-1"
                      >
                        {att.file_name}
                      </a>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-400">{timeAgo(att.uploaded_at)}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {att.file_path && (
                          <a href={att.file_path} download className="btn btn-ghost btn-xs">
                            <Download size={12} />
                          </a>
                        )}
                        <button className="btn btn-ghost btn-xs text-error" onClick={() => deleteAttachment(att.id)}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }
};
