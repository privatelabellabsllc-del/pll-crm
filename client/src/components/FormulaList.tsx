import React, { useState, useEffect } from 'react';
import { Formula, PRODUCT_TYPES } from '../types';
import { Plus, FlaskConical, Search, Trash2, Edit, Copy } from 'lucide-react';
import { formatCurrency } from '../utils/helpers';

interface Props {
  onAddFormula: () => void;
  onEditFormula: (f: Formula) => void;
}

export const FormulaList: React.FC<Props> = ({ onAddFormula, onEditFormula }) => {
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');

  useEffect(() => { loadFormulas(); }, []);

  async function loadFormulas() {
    const rows = await window.tasklet.sqlQuery(`
      SELECT f.*, 
        COUNT(fi.id) as ingredient_count,
        COALESCE(SUM(fi.cost_per_batch), 0) as total_ingredient_cost
      FROM formulas f
      LEFT JOIN formula_ingredients fi ON fi.formula_id = f.id
      GROUP BY f.id
      ORDER BY f.updated_at DESC
    `);
    setFormulas(rows as unknown as Formula[]);
  }

  async function deleteFormula(id: number) {
    if (!confirm('Delete this formula and all its ingredients?')) return;
    await window.tasklet.sqlQuery(`DELETE FROM formula_ingredients WHERE formula_id = ${id}`);
    await window.tasklet.sqlQuery(`DELETE FROM formulas WHERE id = ${id}`);
    loadFormulas();
  }

  async function duplicateFormula(f: Formula) {
    const res = await window.tasklet.sqlQuery(`
      INSERT INTO formulas (formula_name, product_type, packaging_cost, labor_cost, overhead_cost, total_cost_per_unit, suggested_price, profit_margin, batch_size_units, notes)
      VALUES ('${f.formula_name.replace(/'/g, "''")} (Copy)', ${f.product_type ? `'${f.product_type}'` : 'NULL'}, ${f.packaging_cost}, ${f.labor_cost}, ${f.overhead_cost}, ${f.total_cost_per_unit}, ${f.suggested_price}, ${f.profit_margin}, ${f.batch_size_units}, ${f.notes ? `'${f.notes.replace(/'/g, "''")}'` : 'NULL'})
    `);
    const newId = (res as any[])[0]?.id ?? (await window.tasklet.sqlQuery("SELECT last_insert_rowid() as id") as any[])[0]?.id;
    if (newId) {
      await window.tasklet.sqlQuery(`
        INSERT INTO formula_ingredients (formula_id, inventory_id, amount_grams, cost_per_batch, cost_per_unit)
        SELECT ${newId}, inventory_id, amount_grams, cost_per_batch, cost_per_unit FROM formula_ingredients WHERE formula_id = ${f.id}
      `);
    }
    loadFormulas();
  }

  const filtered = formulas.filter(f => {
    if (search && !f.formula_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType && f.product_type !== filterType) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-base-300 bg-base-100">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FlaskConical size={22} className="text-secondary" /> Formulas
            </h2>
            <p className="text-sm opacity-60">{formulas.length} formulas · Build recipes and auto-calculate costs</p>
          </div>
          <button className="btn btn-primary btn-sm gap-1" onClick={onAddFormula}>
            <Plus size={16} /> New Formula
          </button>
        </div>
        <div className="flex gap-2">
          <label className="input input-sm input-bordered flex items-center gap-2 flex-1">
            <Search size={14} />
            <input type="text" placeholder="Search formulas..." value={search} onChange={e => setSearch(e.target.value)} className="grow" />
          </label>
          <select className="select select-sm select-bordered" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">All Types</option>
            {PRODUCT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {filtered.length === 0 ? (
          <div className="text-center py-16 opacity-50">
            <FlaskConical size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No formulas yet</p>
            <p className="text-sm">Create your first formula to start calculating costs</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map(f => {
              const ingredientCost = (f.total_ingredient_cost || 0) / Math.max(f.batch_size_units, 1);
              const totalCostPerUnit = ingredientCost + f.packaging_cost + f.labor_cost + f.overhead_cost;
              const margin = f.suggested_price > 0 ? ((f.suggested_price - totalCostPerUnit) / f.suggested_price * 100) : 0;
              return (
                <div key={f.id} className="card bg-base-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => onEditFormula(f)}>
                  <div className="card-body p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-sm">{f.formula_name}</h3>
                        {f.product_type && <span className="badge badge-sm badge-outline mt-1">{f.product_type}</span>}
                      </div>
                      <div className="flex gap-1">
                        <button className="btn btn-ghost btn-xs" onClick={e => { e.stopPropagation(); duplicateFormula(f); }} title="Duplicate">
                          <Copy size={13} />
                        </button>
                        <button className="btn btn-ghost btn-xs text-error" onClick={e => { e.stopPropagation(); deleteFormula(f.id); }} title="Delete">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                      <div>
                        <span className="opacity-50">Ingredients</span>
                        <p className="font-semibold">{f.ingredient_count || 0}</p>
                      </div>
                      <div>
                        <span className="opacity-50">Batch Size</span>
                        <p className="font-semibold">{f.batch_size_units} units</p>
                      </div>
                      <div>
                        <span className="opacity-50">Cost/Unit</span>
                        <p className="font-semibold text-error">{formatCurrency(totalCostPerUnit)}</p>
                      </div>
                      <div>
                        <span className="opacity-50">Sell Price</span>
                        <p className="font-semibold text-success">{formatCurrency(f.suggested_price)}</p>
                      </div>
                    </div>

                    {f.suggested_price > 0 && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="opacity-50">Profit Margin</span>
                          <span className={`font-bold ${margin >= 50 ? 'text-success' : margin >= 30 ? 'text-warning' : 'text-error'}`}>
                            {margin.toFixed(1)}%
                          </span>
                        </div>
                        <progress className={`progress w-full h-1.5 ${margin >= 50 ? 'progress-success' : margin >= 30 ? 'progress-warning' : 'progress-error'}`} value={margin} max={100} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
