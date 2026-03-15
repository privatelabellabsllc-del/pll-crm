import React, { useEffect, useState } from 'react';
import { Plus, AlertTriangle, DollarSign, Clock, ChevronRight, Search } from 'lucide-react';
import { ProductionProject, ProductionStage, PRODUCTION_STAGES } from '../types';
import { formatCurrency, productionStageColor, productionProgress, timeAgo } from '../utils/helpers';

interface ProductionPipelineProps {
  onAddProduction: () => void;
  onEditProduction: (project: ProductionProject) => void;
}

export const ProductionPipeline: React.FC<ProductionPipelineProps> = ({ onAddProduction, onEditProduction }) => {
  const [projects, setProjects] = useState<ProductionProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStage, setFilterStage] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const rows = await window.tasklet.sqlQuery(
        "SELECT pp.*, c.name as customer_name, c.company_name FROM production_projects pp LEFT JOIN customers c ON pp.customer_id = c.id ORDER BY pp.updated_at DESC"
      );
      setProjects(rows as unknown as ProductionProject[]);
    } catch (err) {
      console.error('Failed to load production projects:', err);
    } finally {
      setLoading(false);
    }
  }

  async function autoDeductInventory(projectId: number) {
    try {
      const project = await window.tasklet.sqlQuery(`SELECT formula_id FROM production_projects WHERE id=${projectId}`);
      const formulaId = (project as any[])[0]?.formula_id;
      if (!formulaId) return false;

      const ingredients = await window.tasklet.sqlQuery(
        `SELECT fi.inventory_id, fi.amount_grams FROM formula_ingredients fi WHERE fi.formula_id=${formulaId}`
      );

      let deducted = false;
      for (const ing of ingredients as any[]) {
        if (ing.inventory_id && ing.amount_grams) {
          const amountKg = ing.amount_grams / 1000;
          await window.tasklet.sqlExec(
            `UPDATE inventory SET current_stock_kg = MAX(0, current_stock_kg - ${amountKg}), updated_at=datetime('now') WHERE id=${ing.inventory_id}`
          );
          deducted = true;
        }
      }
      return deducted;
    } catch (err) {
      console.error('Failed to auto-deduct inventory:', err);
      return false;
    }
  }

  async function advanceStage(proj: ProductionProject) {
    const idx = PRODUCTION_STAGES.indexOf(proj.production_stage);
    if (idx >= PRODUCTION_STAGES.length - 1) return;
    const newStage = PRODUCTION_STAGES[idx + 1];
    const newProgress = productionProgress(newStage);

    setProjects((prev) => prev.map((p) => p.id === proj.id ? { ...p, production_stage: newStage, progress_percent: newProgress } : p));
    try {
      await window.tasklet.sqlExec(`UPDATE production_projects SET production_stage='${newStage}', progress_percent=${newProgress}, updated_at=datetime('now') WHERE id=${proj.id}`);

      // Auto-deduct inventory when moving to Completed or Shipped
      if (newStage === 'Completed' || newStage === 'Shipped') {
        const deducted = await autoDeductInventory(proj.id);
        if (deducted) {
          setToast('📦 Inventory auto-deducted based on formula');
          setTimeout(() => setToast(''), 3000);
        }
      }
    } catch (err) {
      console.error('Failed to advance stage:', err);
      loadProjects();
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><span className="loading loading-spinner loading-lg text-primary" /></div>;
  }

  const searchFiltered = projects.filter((p) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.project_name.toLowerCase().includes(term) ||
      (p.customer_name || '').toLowerCase().includes(term) ||
      (p.company_name || '').toLowerCase().includes(term) ||
      (p.production_stage || '').toLowerCase().includes(term) ||
      (p.assigned_to || '').toLowerCase().includes(term)
    );
  });
  const filtered = filterStage === 'all' ? searchFiltered : searchFiltered.filter((p) => p.production_stage === filterStage);
  const paymentAlerts = projects.filter((p) => p.payment_status !== 'Paid in Full' && ['Ready to Ship', 'Payment Pending', 'Shipped'].includes(p.production_stage));

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">Production Pipeline</h2>
          <p className="text-sm text-base-content/50">{projects.length} projects • {formatCurrency(projects.reduce((s, p) => s + p.total_value, 0))} total</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={onAddProduction}>
          <Plus size={16} /> New Project
        </button>
      </div>

      {/* Payment Alerts */}
      {paymentAlerts.length > 0 && (
        <div className="alert alert-warning mb-4 py-2">
          <AlertTriangle size={16} />
          <span className="text-sm">{paymentAlerts.length} project(s) have pending payments — shipment should not be approved until payment is received.</span>
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <label className="input input-bordered input-sm flex items-center gap-2 max-w-md">
          <Search className="h-[1em] opacity-50" />
          <input type="search" className="grow" placeholder="Search production jobs..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </label>
      </div>

      {/* Stage Filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        <button className={`btn btn-xs ${filterStage === 'all' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilterStage('all')}>All ({projects.length})</button>
        {PRODUCTION_STAGES.map((stage) => {
          const count = projects.filter((p) => p.production_stage === stage).length;
          if (count === 0) return null;
          return (
            <button key={stage} className={`btn btn-xs ${filterStage === stage ? 'btn-primary' : 'btn-ghost'} whitespace-nowrap`} onClick={() => setFilterStage(stage)}>
              {stage} ({count})
            </button>
          );
        })}
      </div>

      {/* Projects List */}
      <div className="overflow-y-auto flex-1 space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-base-content/50">No production projects{filterStage !== 'all' ? ' in this stage' : ''}.</p>
          </div>
        ) : (
          filtered.map((proj) => (
            <div key={proj.id} className="card bg-base-200 cursor-pointer hover:bg-base-300/80 transition-colors" onClick={() => onEditProduction(proj)}>
              <div className="card-body p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{proj.project_name}</h3>
                      <span className={`badge badge-xs ${productionStageColor(proj.production_stage)}`}>{proj.production_stage}</span>
                      {proj.payment_status !== 'Paid in Full' && ['Ready to Ship', 'Payment Pending'].includes(proj.production_stage) && (
                        <span className="badge badge-xs badge-error">$ Due</span>
                      )}
                    </div>
                    <p className="text-sm text-base-content/50">{proj.company_name || proj.customer_name}</p>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); advanceStage(proj); }}>
                    Next <ChevronRight size={14} />
                  </button>
                </div>

                <div className="flex items-center gap-4 mt-2">
                  <progress className="progress progress-primary flex-1" value={proj.progress_percent} max={100} />
                  <span className="text-xs text-base-content/50">{proj.progress_percent}%</span>
                </div>

                <div className="flex gap-4 mt-2 text-xs text-base-content/50">
                  <span className="flex items-center gap-1"><DollarSign size={12} /> Total: {formatCurrency(proj.total_value)}</span>
                  <span className="flex items-center gap-1"><DollarSign size={12} /> Deposit: {formatCurrency(proj.deposit_paid)}</span>
                  <span className="flex items-center gap-1"><DollarSign size={12} /> Balance: {formatCurrency(proj.balance_remaining)}</span>
                  {proj.assigned_to && <span>👤 {proj.assigned_to}</span>}
                  {proj.expected_completion && <span className="flex items-center gap-1"><Clock size={12} /> {proj.expected_completion}</span>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {toast && (
        <div className="toast toast-end toast-bottom z-50">
          <div className="alert alert-info shadow-lg">
            <span>{toast}</span>
          </div>
        </div>
      )}
    </div>
  );
};
