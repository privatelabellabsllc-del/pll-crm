import React, { useEffect, useState } from 'react';
import { Plus, ChevronRight, DollarSign, User, Calendar, Search } from 'lucide-react';
import { SalesProject, SalesStage, SALES_STAGES } from '../types';
import { formatCurrency, salesStageColor, timeAgo } from '../utils/helpers';

interface SalesPipelineProps {
  onAddProject: () => void;
  onEditProject: (project: SalesProject) => void;
}

export const SalesPipeline: React.FC<SalesPipelineProps> = ({ onAddProject, onEditProject }) => {
  const [projects, setProjects] = useState<SalesProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const rows = await window.tasklet.sqlQuery(
        "SELECT sp.*, c.name as customer_name, c.company_name FROM sales_projects sp LEFT JOIN customers c ON sp.customer_id = c.id ORDER BY sp.updated_at DESC"
      );
      setProjects(rows as unknown as SalesProject[]);
    } catch (err) {
      console.error('Failed to load sales projects:', err);
    } finally {
      setLoading(false);
    }
  }

  async function moveToStage(projectId: number, newStage: SalesStage) {
    setProjects((prev) => prev.map((p) => p.id === projectId ? { ...p, sales_stage: newStage } : p));
    try {
      await window.tasklet.sqlExec(`UPDATE sales_projects SET sales_stage='${newStage}', updated_at=datetime('now') WHERE id=${projectId}`);

      // Auto-create production plan when deal is Won
      if (newStage === 'Won') {
        const project = projects.find(p => p.id === projectId);
        if (project) {
          // Check if production plan doesn't already exist
          const existing = await window.tasklet.sqlQuery(`SELECT id FROM production_projects WHERE sales_project_id=${projectId}`);
          if ((existing as any[]).length === 0) {
            await window.tasklet.sqlExec(
              `INSERT INTO production_projects (sales_project_id, customer_id, project_name, production_stage, total_value, notes) VALUES (${projectId}, ${project.customer_id}, '${(project.project_name || '').replace(/'/g, "''")} - Production', 'Deposit Received', ${project.estimated_revenue || 0}, 'Auto-created from won deal: ${(project.project_name || '').replace(/'/g, "''")}')`
            );
            setToast('✅ Production plan auto-created!');
            setTimeout(() => setToast(''), 3000);
          }
        }
      }
    } catch (err) {
      console.error('Failed to update stage:', err);
      loadProjects();
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><span className="loading loading-spinner loading-lg text-primary" /></div>;
  }

  const filteredProjects = projects.filter((p) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.project_name.toLowerCase().includes(term) ||
      (p.customer_name || '').toLowerCase().includes(term) ||
      (p.company_name || '').toLowerCase().includes(term) ||
      (p.sales_stage || '').toLowerCase().includes(term) ||
      (p.product_type || '').toLowerCase().includes(term)
    );
  });

  const stageValue = (stage: SalesStage) => filteredProjects.filter((p) => p.sales_stage === stage).reduce((sum, p) => sum + (p.estimated_revenue || 0), 0);

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">Sales Pipeline</h2>
          <p className="text-sm text-base-content/50">{projects.length} projects • {formatCurrency(projects.reduce((s, p) => s + (p.estimated_revenue || 0), 0))} total value</p>
        </div>
        <div className="flex gap-2">
          <div className="tabs tabs-boxed tabs-xs">
            <a className={`tab ${viewMode === 'board' ? 'tab-active' : ''}`} onClick={() => setViewMode('board')}>Board</a>
            <a className={`tab ${viewMode === 'list' ? 'tab-active' : ''}`} onClick={() => setViewMode('list')}>List</a>
          </div>
          <button className="btn btn-primary btn-sm" onClick={onAddProject}>
            <Plus size={16} /> New Deal
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <label className="input input-bordered input-sm flex items-center gap-2 max-w-md">
          <Search className="h-[1em] opacity-50" />
          <input type="search" className="grow" placeholder="Search deals..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </label>
      </div>

      {viewMode === 'board' ? (
        <div className="flex gap-3 overflow-x-auto flex-1 pb-4">
          {SALES_STAGES.map((stage) => {
            const stageProjects = filteredProjects.filter((p) => p.sales_stage === stage);
            return (
              <div key={stage} className="min-w-[220px] w-[220px] flex flex-col bg-base-200 rounded-lg">
                <div className="p-3 border-b border-base-300">
                  <div className="flex items-center justify-between">
                    <span className={`badge badge-sm ${salesStageColor(stage)}`}>{stage}</span>
                    <span className="text-xs text-base-content/50">{stageProjects.length}</span>
                  </div>
                  <p className="text-xs text-base-content/40 mt-1">{formatCurrency(stageValue(stage))}</p>
                </div>
                <div className="p-2 space-y-2 overflow-y-auto flex-1">
                  {stageProjects.map((proj) => (
                    <div key={proj.id} className="card bg-base-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => onEditProject(proj)}>
                      <div className="card-body p-3">
                        <p className="text-sm font-medium leading-tight">{proj.project_name}</p>
                        <p className="text-xs text-base-content/50">{proj.company_name || proj.customer_name}</p>
                        {proj.product_type && <span className="badge badge-xs badge-ghost">{proj.product_type}</span>}
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs font-medium text-success">{formatCurrency(proj.estimated_revenue)}</span>
                          <span className="text-xs text-base-content/40">{timeAgo(proj.updated_at)}</span>
                        </div>
                        {/* Stage navigation arrows */}
                        <div className="flex justify-between mt-1">
                          {SALES_STAGES.indexOf(stage) > 0 && (
                            <button className="btn btn-ghost btn-xs px-1" onClick={(e) => { e.stopPropagation(); moveToStage(proj.id, SALES_STAGES[SALES_STAGES.indexOf(stage) - 1]); }}>
                              ← Back
                            </button>
                          )}
                          <div className="flex-1" />
                          {SALES_STAGES.indexOf(stage) < SALES_STAGES.length - 1 && (
                            <button className="btn btn-ghost btn-xs px-1 text-primary" onClick={(e) => { e.stopPropagation(); moveToStage(proj.id, SALES_STAGES[SALES_STAGES.indexOf(stage) + 1]); }}>
                              Next →
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto overflow-y-auto flex-1">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Project</th>
                <th>Customer</th>
                <th>Type</th>
                <th>Units</th>
                <th>Value</th>
                <th>Stage</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((p) => (
                <tr key={p.id} className="hover cursor-pointer" onClick={() => onEditProject(p)}>
                  <td className="font-medium">{p.project_name}</td>
                  <td className="text-sm">{p.company_name || p.customer_name}</td>
                  <td><span className="badge badge-xs badge-ghost">{p.product_type || '—'}</span></td>
                  <td className="text-sm">{p.estimated_units?.toLocaleString() || '—'}</td>
                  <td className="text-sm text-success">{formatCurrency(p.estimated_revenue)}</td>
                  <td><span className={`badge badge-xs ${salesStageColor(p.sales_stage)}`}>{p.sales_stage}</span></td>
                  <td className="text-xs text-base-content/50">{timeAgo(p.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toast && (
        <div className="toast toast-end toast-bottom z-50">
          <div className="alert alert-success shadow-lg">
            <span>{toast}</span>
          </div>
        </div>
      )}
    </div>
  );
};
