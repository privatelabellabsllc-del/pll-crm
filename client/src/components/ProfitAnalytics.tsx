import React, { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, TrendingDown, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { ProjectProfit } from '../types';
import { formatCurrency, productionStageColor } from '../utils/helpers';

interface ProfitSummary {
  totalRevenue: number;
  totalCosts: number;
  totalProfit: number;
  avgMargin: number;
  bestProject: string;
  bestMargin: number;
  projectCount: number;
}

export const ProfitAnalytics: React.FC = () => {
  const [projects, setProjects] = useState<ProjectProfit[]>([]);
  const [summary, setSummary] = useState<ProfitSummary>({ totalRevenue: 0, totalCosts: 0, totalProfit: 0, avgMargin: 0, bestProject: '-', bestMargin: 0, projectCount: 0 });
  const [sortBy, setSortBy] = useState<'profit' | 'margin' | 'revenue'>('profit');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadProfitData(); }, []);

  async function loadProfitData() {
    try {
      const rows = await window.tasklet.sqlQuery(
        `SELECT pp.id, pp.project_name, pp.total_value, pp.deposit_paid, pp.balance_remaining,
         pp.profit_estimate, pp.production_stage,
         c.name as customer_name, c.company_name,
         f.formula_name, f.total_cost_per_unit as formula_cost_per_unit, f.batch_size_units
         FROM production_projects pp
         LEFT JOIN customers c ON pp.customer_id = c.id
         LEFT JOIN formulas f ON pp.formula_id = f.id
         ORDER BY pp.profit_estimate DESC`
      );
      const data = rows as unknown as ProjectProfit[];
      setProjects(data);

      if (data.length > 0) {
        const totalRev = data.reduce((s, p) => s + Number(p.total_value || 0), 0);
        const totalProfit = data.reduce((s, p) => s + Number(p.profit_estimate || 0), 0);
        const totalCosts = totalRev - totalProfit;
        const margins = data.filter(p => p.total_value > 0).map(p => (Number(p.profit_estimate) / Number(p.total_value)) * 100);
        const avgMargin = margins.length > 0 ? margins.reduce((a, b) => a + b, 0) / margins.length : 0;
        const best = data.reduce((best, p) => {
          const m = p.total_value > 0 ? (Number(p.profit_estimate) / Number(p.total_value)) * 100 : 0;
          return m > best.margin ? { name: p.project_name, margin: m } : best;
        }, { name: '-', margin: 0 });

        setSummary({ totalRevenue: totalRev, totalCosts, totalProfit, avgMargin, bestProject: best.name, bestMargin: best.margin, projectCount: data.length });
      }
    } catch (err) {
      console.error('Failed to load profit data:', err);
    } finally {
      setLoading(false);
    }
  }

  const sorted = [...projects].sort((a, b) => {
    if (sortBy === 'profit') return Number(b.profit_estimate) - Number(a.profit_estimate);
    if (sortBy === 'revenue') return Number(b.total_value) - Number(a.total_value);
    const mA = a.total_value > 0 ? Number(a.profit_estimate) / Number(a.total_value) : 0;
    const mB = b.total_value > 0 ? Number(b.profit_estimate) / Number(b.total_value) : 0;
    return mB - mA;
  });

  if (loading) return <div className="flex items-center justify-center h-full"><span className="loading loading-spinner loading-lg text-primary" /></div>;

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2"><TrendingUp size={24} className="text-success" /> Profit Analytics</h2>
        <p className="text-sm text-base-content/50">Track revenue, costs, and margins across all projects</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card bg-base-200">
          <div className="card-body p-4">
            <div className="flex items-center gap-2 text-success"><DollarSign size={18} /><span className="text-xs text-base-content/50">Total Revenue</span></div>
            <p className="text-xl font-bold">{formatCurrency(summary.totalRevenue)}</p>
            <p className="text-xs text-base-content/40">{summary.projectCount} projects</p>
          </div>
        </div>
        <div className="card bg-base-200">
          <div className="card-body p-4">
            <div className="flex items-center gap-2 text-error"><TrendingDown size={18} /><span className="text-xs text-base-content/50">Total Costs</span></div>
            <p className="text-xl font-bold">{formatCurrency(summary.totalCosts)}</p>
            <p className="text-xs text-base-content/40">ingredients + labor + overhead</p>
          </div>
        </div>
        <div className="card bg-base-200">
          <div className="card-body p-4">
            <div className="flex items-center gap-2 text-primary"><BarChart3 size={18} /><span className="text-xs text-base-content/50">Total Profit</span></div>
            <p className={`text-xl font-bold ${summary.totalProfit >= 0 ? 'text-success' : 'text-error'}`}>{formatCurrency(summary.totalProfit)}</p>
            <p className="text-xs text-base-content/40">Avg margin: {summary.avgMargin.toFixed(1)}%</p>
          </div>
        </div>
        <div className="card bg-base-200">
          <div className="card-body p-4">
            <div className="flex items-center gap-2 text-warning"><ArrowUpRight size={18} /><span className="text-xs text-base-content/50">Best Margin</span></div>
            <p className="text-xl font-bold">{summary.bestMargin.toFixed(1)}%</p>
            <p className="text-xs text-base-content/40 truncate">{summary.bestProject}</p>
          </div>
        </div>
      </div>

      {/* Profit Table */}
      <div className="card bg-base-200">
        <div className="card-body p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="card-title text-sm">Project Profitability</h3>
            <div className="join">
              {(['profit', 'margin', 'revenue'] as const).map(s => (
                <button key={s} className={`join-item btn btn-xs ${sortBy === s ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSortBy(s)}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {projects.length === 0 ? (
            <div className="text-center py-12">
              <BarChart3 size={48} className="mx-auto text-base-content/20 mb-3" />
              <p className="text-base-content/50">No projects yet. Start adding production projects to track profitability!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Customer</th>
                    <th>Stage</th>
                    <th>Formula</th>
                    <th className="text-right">Revenue</th>
                    <th className="text-right">Deposit</th>
                    <th className="text-right">Est. Profit</th>
                    <th className="text-right">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p) => {
                    const margin = p.total_value > 0 ? (Number(p.profit_estimate) / Number(p.total_value)) * 100 : 0;
                    const isPositive = Number(p.profit_estimate) >= 0;
                    return (
                      <tr key={p.id} className="hover">
                        <td className="font-medium">{p.project_name}</td>
                        <td className="text-base-content/60">{p.company_name || p.customer_name}</td>
                        <td><span className={`badge badge-xs ${productionStageColor(p.production_stage as any)}`}>{p.production_stage}</span></td>
                        <td className="text-base-content/60">{p.formula_name || <span className="text-base-content/30">—</span>}</td>
                        <td className="text-right font-semibold">{formatCurrency(p.total_value)}</td>
                        <td className="text-right">{formatCurrency(p.deposit_paid)}</td>
                        <td className={`text-right font-semibold ${isPositive ? 'text-success' : 'text-error'}`}>
                          <span className="flex items-center justify-end gap-1">
                            {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                            {formatCurrency(p.profit_estimate)}
                          </span>
                        </td>
                        <td className="text-right">
                          <span className={`badge badge-sm ${margin >= 30 ? 'badge-success' : margin >= 15 ? 'badge-warning' : 'badge-error'}`}>
                            {margin.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
