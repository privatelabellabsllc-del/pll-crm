import React, { useState, useEffect } from 'react';
import { CalendarClock, AlertTriangle, CheckCircle2, Clock, Package, ShoppingCart, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency } from '../utils/helpers';

interface ProjectWithFormula {
  id: number;
  project_name: string;
  customer_name: string;
  production_stage: string;
  formula_id: number | null;
  formula_name: string | null;
  batch_size_units: number;
  expected_completion: string | null;
  total_value: number;
  deposit_paid: number;
  balance_remaining: number;
  payment_status: string;
  progress_percent: number;
  assigned_to: string | null;
}

interface IngredientNeed {
  inventory_id: number;
  ingredient_name: string;
  amount_grams: number;
  current_stock_kg: number;
  cost_per_kg: number;
  supplier_id: number | null;
  supplier_name: string | null;
  needed_kg: number;
  available: boolean;
  shortfall_kg: number;
}

interface ExpandedProject {
  project: ProjectWithFormula;
  ingredients: IngredientNeed[];
  readiness: 'ready' | 'partial' | 'waiting' | 'no_formula';
}

interface Props {
  onNavigate: (view: string) => void;
}

export const ProductionPlanning: React.FC<Props> = ({ onNavigate }) => {
  const [projects, setProjects] = useState<ExpandedProject[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'ready' | 'partial' | 'waiting' | 'no_formula'>('all');
  const [loading, setLoading] = useState(true);
  const [paymentAlerts, setPaymentAlerts] = useState<ProjectWithFormula[]>([]);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const rows = await window.tasklet.sqlQuery(`
        SELECT pp.*, c.name as customer_name, f.formula_name, f.batch_size_units
        FROM production_projects pp
        LEFT JOIN customers c ON c.id = pp.customer_id
        LEFT JOIN formulas f ON f.id = pp.formula_id
        WHERE pp.production_stage != 'Completed' AND pp.production_stage != 'Shipped'
        ORDER BY 
          CASE pp.production_stage
            WHEN 'Production Scheduled' THEN 1
            WHEN 'Purchasing Ingredients' THEN 2
            WHEN 'Ingredients Ordered' THEN 3
            WHEN 'Deposit Received' THEN 4
            WHEN 'Ingredients Received' THEN 5
            WHEN 'Sample Batching' THEN 6
            WHEN 'Production In Progress' THEN 7
            ELSE 8
          END
      `) as unknown as ProjectWithFormula[];

      const expanded: ExpandedProject[] = [];
      for (const proj of rows) {
        if (!proj.formula_id) {
          expanded.push({ project: proj, ingredients: [], readiness: 'no_formula' });
          continue;
        }
        const ings = await window.tasklet.sqlQuery(`
          SELECT fi.inventory_id, fi.amount_grams, i.ingredient_name, i.current_stock_kg, i.cost_per_kg, i.supplier_id, s.name as supplier_name
          FROM formula_ingredients fi
          JOIN inventory i ON i.id = fi.inventory_id
          LEFT JOIN suppliers s ON s.id = i.supplier_id
          WHERE fi.formula_id = ${proj.formula_id}
        `) as unknown as IngredientNeed[];

        const needs = ings.map(ing => {
          const neededKg = ing.amount_grams / 1000;
          return {
            ...ing,
            needed_kg: neededKg,
            available: ing.current_stock_kg >= neededKg,
            shortfall_kg: Math.max(0, neededKg - ing.current_stock_kg),
          };
        });

        const allAvailable = needs.every(n => n.available);
        const someAvailable = needs.some(n => n.available);
        const readiness = allAvailable ? 'ready' : someAvailable ? 'partial' : 'waiting';
        expanded.push({ project: proj, ingredients: needs, readiness });
      }

      setProjects(expanded);

      // Payment alerts
      const alerts = rows.filter(p =>
        ['Ready to Ship', 'Payment Pending', 'Packaging'].includes(p.production_stage) &&
        p.balance_remaining > 0
      );
      setPaymentAlerts(alerts);
    } finally {
      setLoading(false);
    }
  }

  const filtered = projects.filter(p => filter === 'all' || p.readiness === filter);
  const readyCt = projects.filter(p => p.readiness === 'ready').length;
  const partialCt = projects.filter(p => p.readiness === 'partial').length;
  const waitingCt = projects.filter(p => p.readiness === 'waiting').length;
  const noFormulaCt = projects.filter(p => p.readiness === 'no_formula').length;

  const readinessIcon = (r: string) => {
    switch (r) {
      case 'ready': return <CheckCircle2 size={16} className="text-success" />;
      case 'partial': return <Clock size={16} className="text-warning" />;
      case 'waiting': return <AlertTriangle size={16} className="text-error" />;
      default: return <Package size={16} className="opacity-40" />;
    }
  };

  const readinessLabel = (r: string) => {
    switch (r) {
      case 'ready': return <span className="badge badge-sm badge-success">Ready to Produce</span>;
      case 'partial': return <span className="badge badge-sm badge-warning">Partial Stock</span>;
      case 'waiting': return <span className="badge badge-sm badge-error">Waiting on Materials</span>;
      default: return <span className="badge badge-sm badge-ghost">No Formula Linked</span>;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-base-300 bg-base-100">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <CalendarClock size={22} className="text-accent" /> Production Planning
            </h2>
            <p className="text-sm opacity-60">Smart view of active projects, ingredient readiness, and alerts</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-2 mb-3">
          <button className={`btn btn-sm ${filter === 'all' ? 'btn-neutral' : 'btn-outline'}`} onClick={() => setFilter('all')}>
            All ({projects.length})
          </button>
          <button className={`btn btn-sm ${filter === 'ready' ? 'btn-success' : 'btn-outline btn-success'}`} onClick={() => setFilter('ready')}>
            ✅ Ready ({readyCt})
          </button>
          <button className={`btn btn-sm ${filter === 'partial' ? 'btn-warning' : 'btn-outline btn-warning'}`} onClick={() => setFilter('partial')}>
            ⏳ Partial ({partialCt})
          </button>
          <button className={`btn btn-sm ${filter === 'waiting' ? 'btn-error' : 'btn-outline btn-error'}`} onClick={() => setFilter('waiting')}>
            ⚠️ Waiting ({waitingCt})
          </button>
          <button className={`btn btn-sm ${filter === 'no_formula' ? 'btn-ghost' : 'btn-outline'}`} onClick={() => setFilter('no_formula')}>
            📋 No Formula ({noFormulaCt})
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {/* Payment Alerts */}
        {paymentAlerts.length > 0 && (
          <div className="alert alert-warning mb-4 shadow-sm">
            <AlertTriangle size={18} />
            <div>
              <h4 className="font-bold text-sm">⚠️ Payment Required Before Shipment</h4>
              {paymentAlerts.map(p => (
                <p key={p.id} className="text-xs">
                  <strong>{p.project_name}</strong> ({p.customer_name}) — Balance: <strong>{formatCurrency(p.balance_remaining)}</strong>
                </p>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><span className="loading loading-spinner loading-lg" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 opacity-50">
            <CalendarClock size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No active production projects</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(({ project: p, ingredients, readiness }) => {
              const isExpanded = expandedId === p.id;
              const missingCount = ingredients.filter(i => !i.available).length;
              return (
                <div key={p.id} className="bg-base-200 rounded-xl overflow-hidden shadow-sm">
                  {/* Project Header */}
                  <div
                    className="p-4 flex items-center gap-3 cursor-pointer hover:bg-base-300 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  >
                    {readinessIcon(readiness)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm truncate">{p.project_name}</h3>
                        {readinessLabel(readiness)}
                        <span className="badge badge-sm badge-outline">{p.production_stage}</span>
                      </div>
                      <div className="flex gap-3 text-xs opacity-60 mt-0.5">
                        <span>{p.customer_name}</span>
                        {p.formula_name && <span>📋 {p.formula_name}</span>}
                        {p.assigned_to && <span>👤 {p.assigned_to}</span>}
                        {p.expected_completion && <span>📅 {p.expected_completion}</span>}
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <p className="font-semibold">{formatCurrency(p.total_value)}</p>
                      {p.balance_remaining > 0 && (
                        <p className="text-error">Due: {formatCurrency(p.balance_remaining)}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {missingCount > 0 && (
                        <span className="badge badge-sm badge-error">{missingCount} missing</span>
                      )}
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>

                  {/* Expanded Ingredients */}
                  {isExpanded && (
                    <div className="border-t border-base-300 p-4 bg-base-100">
                      {readiness === 'no_formula' ? (
                        <div className="text-center py-4 text-sm opacity-50">
                          <p>No formula linked to this project.</p>
                          <button className="btn btn-sm btn-outline mt-2" onClick={() => onNavigate('formulas')}>
                            Go to Formulas →
                          </button>
                        </div>
                      ) : ingredients.length === 0 ? (
                        <p className="text-sm opacity-50 text-center py-4">Formula has no ingredients listed.</p>
                      ) : (
                        <table className="table table-xs">
                          <thead>
                            <tr>
                              <th>Ingredient</th>
                              <th>Needed (g)</th>
                              <th>In Stock (kg)</th>
                              <th>Status</th>
                              <th>Shortfall</th>
                              <th>Supplier</th>
                              <th>Est. Cost</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ingredients.map((ing, idx) => (
                              <tr key={idx} className={!ing.available ? 'bg-error/5' : ''}>
                                <td className="font-medium text-xs">{ing.ingredient_name}</td>
                                <td className="text-xs">{ing.amount_grams.toFixed(1)}</td>
                                <td className="text-xs">{ing.current_stock_kg.toFixed(3)}</td>
                                <td>
                                  {ing.available ? (
                                    <span className="badge badge-xs badge-success">✓ In Stock</span>
                                  ) : (
                                    <span className="badge badge-xs badge-error">✗ Short</span>
                                  )}
                                </td>
                                <td className="text-xs">
                                  {!ing.available && (
                                    <span className="text-error font-semibold">{ing.shortfall_kg.toFixed(3)} kg</span>
                                  )}
                                </td>
                                <td className="text-xs opacity-60">{ing.supplier_name || '—'}</td>
                                <td className="text-xs">
                                  {!ing.available && (
                                    <span>{formatCurrency(ing.shortfall_kg * ing.cost_per_kg)}</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      {/* Quick Actions */}
                      {missingCount > 0 && (
                        <div className="mt-3 flex gap-2 justify-end">
                          <button className="btn btn-sm btn-outline btn-error gap-1" onClick={() => onNavigate('purchase_orders')}>
                            <ShoppingCart size={14} /> Create PO for Missing Items
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
