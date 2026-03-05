import React, { useState, useEffect, useMemo } from 'react';
import { Formula, FormulaIngredient, InventoryItem, PRODUCT_TYPES } from '../types';
import { X, Plus, Trash2, FlaskConical, DollarSign, Calculator } from 'lucide-react';
import { formatCurrency } from '../utils/helpers';

interface Props {
  formula: Formula | null;
  onClose: () => void;
  onSaved: () => void;
}

interface IngredientRow {
  id?: number;
  inventory_id: number;
  amount_grams: number;
  ingredient_name?: string;
  cost_per_kg?: number;
  current_stock_kg?: number;
}

export const FormulaForm: React.FC<Props> = ({ formula, onClose, onSaved }) => {
  const [name, setName] = useState(formula?.formula_name || '');
  const [productType, setProductType] = useState(formula?.product_type || '');
  const [batchSize, setBatchSize] = useState(formula?.batch_size_units || 100);
  const [packagingCost, setPackagingCost] = useState(formula?.packaging_cost || 0);
  const [laborCost, setLaborCost] = useState(formula?.labor_cost || 0);
  const [overheadCost, setOverheadCost] = useState(formula?.overhead_cost || 0);
  const [suggestedPrice, setSuggestedPrice] = useState(formula?.suggested_price || 0);
  const [notes, setNotes] = useState(formula?.notes || '');
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [inventoryOptions, setInventoryOptions] = useState<InventoryItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [markupPercent, setMarkupPercent] = useState(50);

  useEffect(() => {
    loadInventory();
    if (formula) loadIngredients();
  }, []);

  async function loadInventory() {
    const rows = await window.tasklet.sqlQuery(`SELECT id, ingredient_name, cost_per_kg, current_stock_kg FROM inventory ORDER BY ingredient_name`);
    setInventoryOptions(rows as unknown as InventoryItem[]);
  }

  async function loadIngredients() {
    if (!formula) return;
    const rows = await window.tasklet.sqlQuery(`
      SELECT fi.*, i.ingredient_name, i.cost_per_kg, i.current_stock_kg
      FROM formula_ingredients fi
      JOIN inventory i ON i.id = fi.inventory_id
      WHERE fi.formula_id = ${formula.id}
    `);
    setIngredients((rows as unknown as FormulaIngredient[]).map(r => ({
      id: r.id,
      inventory_id: r.inventory_id,
      amount_grams: r.amount_grams,
      ingredient_name: r.ingredient_name,
      cost_per_kg: r.cost_per_kg || 0,
      current_stock_kg: r.current_stock_kg || 0,
    })));
  }

  const calculations = useMemo(() => {
    let totalIngredientCostPerBatch = 0;
    const ingredientDetails = ingredients.map(ing => {
      const costPerKg = ing.cost_per_kg || 0;
      const costPerGram = costPerKg / 1000;
      const costForAmount = costPerGram * ing.amount_grams;
      totalIngredientCostPerBatch += costForAmount;
      return { ...ing, costForAmount };
    });

    const ingredientCostPerUnit = totalIngredientCostPerBatch / Math.max(batchSize, 1);
    const totalCostPerUnit = ingredientCostPerUnit + packagingCost + laborCost + overheadCost;
    const suggestedSellPrice = totalCostPerUnit * (1 + markupPercent / 100);
    const profitPerUnit = (suggestedPrice || suggestedSellPrice) - totalCostPerUnit;
    const profitMargin = (suggestedPrice || suggestedSellPrice) > 0
      ? (profitPerUnit / (suggestedPrice || suggestedSellPrice)) * 100
      : 0;
    const totalBatchRevenue = (suggestedPrice || suggestedSellPrice) * batchSize;
    const totalBatchCost = totalCostPerUnit * batchSize;
    const totalBatchProfit = totalBatchRevenue - totalBatchCost;

    return {
      ingredientDetails,
      totalIngredientCostPerBatch,
      ingredientCostPerUnit,
      totalCostPerUnit,
      suggestedSellPrice,
      profitPerUnit,
      profitMargin,
      totalBatchRevenue,
      totalBatchCost,
      totalBatchProfit,
    };
  }, [ingredients, batchSize, packagingCost, laborCost, overheadCost, suggestedPrice, markupPercent]);

  function addIngredientRow() {
    setIngredients([...ingredients, { inventory_id: 0, amount_grams: 0 }]);
  }

  function updateIngredient(index: number, field: string, value: any) {
    const updated = [...ingredients];
    (updated[index] as any)[field] = value;
    if (field === 'inventory_id') {
      const inv = inventoryOptions.find(i => i.id === Number(value));
      if (inv) {
        updated[index].ingredient_name = inv.ingredient_name;
        updated[index].cost_per_kg = inv.cost_per_kg || 0;
        updated[index].current_stock_kg = inv.current_stock_kg || 0;
      }
    }
    setIngredients(updated);
  }

  function removeIngredient(index: number) {
    setIngredients(ingredients.filter((_, i) => i !== index));
  }

  function applyCalculatedPrice() {
    setSuggestedPrice(Number(calculations.suggestedSellPrice.toFixed(2)));
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const esc = (s: string) => s.replace(/'/g, "''");
      const totalCost = calculations.totalCostPerUnit;
      const margin = calculations.profitMargin;
      const finalPrice = suggestedPrice || calculations.suggestedSellPrice;

      if (formula) {
        await window.tasklet.sqlQuery(`
          UPDATE formulas SET 
            formula_name='${esc(name)}', product_type=${productType ? `'${esc(productType)}'` : 'NULL'},
            packaging_cost=${packagingCost}, labor_cost=${laborCost}, overhead_cost=${overheadCost},
            total_cost_per_unit=${totalCost.toFixed(4)}, suggested_price=${finalPrice.toFixed(2)},
            profit_margin=${margin.toFixed(2)}, batch_size_units=${batchSize},
            notes=${notes ? `'${esc(notes)}'` : 'NULL'}, updated_at=datetime('now')
          WHERE id=${formula.id}
        `);
        await window.tasklet.sqlQuery(`DELETE FROM formula_ingredients WHERE formula_id = ${formula.id}`);
        for (const ing of ingredients) {
          if (!ing.inventory_id) continue;
          const costPerBatch = ((ing.cost_per_kg || 0) / 1000) * ing.amount_grams;
          const costPerUnit = costPerBatch / Math.max(batchSize, 1);
          await window.tasklet.sqlQuery(`
            INSERT INTO formula_ingredients (formula_id, inventory_id, amount_grams, cost_per_batch, cost_per_unit)
            VALUES (${formula.id}, ${ing.inventory_id}, ${ing.amount_grams}, ${costPerBatch.toFixed(4)}, ${costPerUnit.toFixed(4)})
          `);
        }
      } else {
        await window.tasklet.sqlQuery(`
          INSERT INTO formulas (formula_name, product_type, packaging_cost, labor_cost, overhead_cost, total_cost_per_unit, suggested_price, profit_margin, batch_size_units, notes)
          VALUES ('${esc(name)}', ${productType ? `'${esc(productType)}'` : 'NULL'}, ${packagingCost}, ${laborCost}, ${overheadCost}, ${totalCost.toFixed(4)}, ${finalPrice.toFixed(2)}, ${margin.toFixed(2)}, ${batchSize}, ${notes ? `'${esc(notes)}'` : 'NULL'})
        `);
        const idRes = await window.tasklet.sqlQuery("SELECT last_insert_rowid() as id") as any[];
        const newId = idRes[0]?.id;
        for (const ing of ingredients) {
          if (!ing.inventory_id) continue;
          const costPerBatch = ((ing.cost_per_kg || 0) / 1000) * ing.amount_grams;
          const costPerUnit = costPerBatch / Math.max(batchSize, 1);
          await window.tasklet.sqlQuery(`
            INSERT INTO formula_ingredients (formula_id, inventory_id, amount_grams, cost_per_batch, cost_per_unit)
            VALUES (${newId}, ${ing.inventory_id}, ${ing.amount_grams}, ${costPerBatch.toFixed(4)}, ${costPerUnit.toFixed(4)})
          `);
        }
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const totalGrams = ingredients.reduce((sum, i) => sum + (i.amount_grams || 0), 0);

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-5xl max-h-[90vh] overflow-y-auto">
        <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={onClose}><X size={16} /></button>
        <h3 className="font-bold text-lg flex items-center gap-2 mb-4">
          <FlaskConical size={20} className="text-secondary" />
          {formula ? 'Edit Formula' : 'New Formula'}
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Form */}
          <div className="lg:col-span-2 space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-3 gap-3">
              <div className="form-control col-span-1">
                <label className="label label-text text-xs font-semibold">Formula Name *</label>
                <input className="input input-bordered input-sm" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Anti-Aging Serum v2" />
              </div>
              <div className="form-control">
                <label className="label label-text text-xs font-semibold">Product Type</label>
                <select className="select select-bordered select-sm" value={productType} onChange={e => setProductType(e.target.value)}>
                  <option value="">Select...</option>
                  {PRODUCT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-control">
                <label className="label label-text text-xs font-semibold">Batch Size (units)</label>
                <input type="number" className="input input-bordered input-sm" value={batchSize} onChange={e => setBatchSize(Number(e.target.value))} min={1} />
              </div>
            </div>

            {/* Ingredients Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm">Ingredients ({ingredients.length}) · {totalGrams.toFixed(1)}g total</h4>
                <button className="btn btn-outline btn-xs gap-1" onClick={addIngredientRow}><Plus size={13} /> Add Ingredient</button>
              </div>
              
              {ingredients.length === 0 ? (
                <div className="bg-base-200 rounded-lg p-6 text-center text-sm opacity-50">
                  No ingredients yet. Click "Add Ingredient" to build your formula.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table table-xs table-zebra">
                    <thead>
                      <tr>
                        <th className="w-2/5">Ingredient</th>
                        <th>Amount (g)</th>
                        <th>Cost/KG</th>
                        <th>Cost/Batch</th>
                        <th>Cost/Unit</th>
                        <th>Stock</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {ingredients.map((ing, idx) => {
                        const detail = calculations.ingredientDetails[idx];
                        const costPerUnit = (detail?.costForAmount || 0) / Math.max(batchSize, 1);
                        const neededKg = (ing.amount_grams || 0) / 1000;
                        const hasStock = (ing.current_stock_kg || 0) >= neededKg;
                        return (
                          <tr key={idx}>
                            <td>
                              <select className="select select-bordered select-xs w-full" value={ing.inventory_id} onChange={e => updateIngredient(idx, 'inventory_id', Number(e.target.value))}>
                                <option value={0}>Select ingredient...</option>
                                {inventoryOptions.map(inv => (
                                  <option key={inv.id} value={inv.id}>{inv.ingredient_name}</option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input type="number" className="input input-bordered input-xs w-20" value={ing.amount_grams || ''} onChange={e => updateIngredient(idx, 'amount_grams', Number(e.target.value))} min={0} step={0.1} />
                            </td>
                            <td className="text-xs opacity-70">{formatCurrency(ing.cost_per_kg || 0)}</td>
                            <td className="text-xs font-semibold">{formatCurrency(detail?.costForAmount || 0)}</td>
                            <td className="text-xs">{formatCurrency(costPerUnit)}</td>
                            <td>
                              <span className={`badge badge-xs ${hasStock ? 'badge-success' : 'badge-error'}`}>
                                {(ing.current_stock_kg || 0).toFixed(2)} kg
                              </span>
                            </td>
                            <td>
                              <button className="btn btn-ghost btn-xs text-error" onClick={() => removeIngredient(idx)}>
                                <Trash2 size={12} />
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

            {/* Additional Costs */}
            <div>
              <h4 className="font-semibold text-sm mb-2">Additional Costs (per unit)</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="form-control">
                  <label className="label label-text text-xs">Packaging</label>
                  <input type="number" className="input input-bordered input-sm" value={packagingCost || ''} onChange={e => setPackagingCost(Number(e.target.value))} min={0} step={0.01} placeholder="0.00" />
                </div>
                <div className="form-control">
                  <label className="label label-text text-xs">Labor</label>
                  <input type="number" className="input input-bordered input-sm" value={laborCost || ''} onChange={e => setLaborCost(Number(e.target.value))} min={0} step={0.01} placeholder="0.00" />
                </div>
                <div className="form-control">
                  <label className="label label-text text-xs">Overhead</label>
                  <input type="number" className="input input-bordered input-sm" value={overheadCost || ''} onChange={e => setOverheadCost(Number(e.target.value))} min={0} step={0.01} placeholder="0.00" />
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div>
              <h4 className="font-semibold text-sm mb-2">Pricing</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="form-control">
                  <label className="label label-text text-xs">Markup %</label>
                  <div className="flex items-center gap-2">
                    <input type="range" className="range range-sm range-primary flex-1" min={10} max={200} value={markupPercent} onChange={e => setMarkupPercent(Number(e.target.value))} />
                    <span className="text-sm font-bold w-12 text-right">{markupPercent}%</span>
                  </div>
                  <p className="text-xs opacity-50 mt-1">Suggested: {formatCurrency(calculations.suggestedSellPrice)}</p>
                </div>
                <div className="form-control">
                  <label className="label label-text text-xs">Sell Price (override)</label>
                  <div className="flex gap-1">
                    <input type="number" className="input input-bordered input-sm flex-1" value={suggestedPrice || ''} onChange={e => setSuggestedPrice(Number(e.target.value))} min={0} step={0.01} placeholder="Auto from markup" />
                    <button className="btn btn-outline btn-sm btn-xs" onClick={applyCalculatedPrice} title="Use calculated price">
                      <Calculator size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="form-control">
              <label className="label label-text text-xs font-semibold">Notes</label>
              <textarea className="textarea textarea-bordered textarea-sm" value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Formula notes, instructions..." />
            </div>
          </div>

          {/* Right: Cost Summary */}
          <div className="space-y-3">
            <div className="bg-base-200 rounded-xl p-4">
              <h4 className="font-bold text-sm flex items-center gap-1 mb-3">
                <DollarSign size={16} className="text-primary" /> Cost Breakdown
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="opacity-60">Ingredients/batch</span>
                  <span className="font-semibold">{formatCurrency(calculations.totalIngredientCostPerBatch)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-60">Ingredients/unit</span>
                  <span>{formatCurrency(calculations.ingredientCostPerUnit)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-60">+ Packaging</span>
                  <span>{formatCurrency(packagingCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-60">+ Labor</span>
                  <span>{formatCurrency(laborCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-60">+ Overhead</span>
                  <span>{formatCurrency(overheadCost)}</span>
                </div>
                <div className="divider my-1"></div>
                <div className="flex justify-between text-base font-bold">
                  <span>Total Cost/Unit</span>
                  <span className="text-error">{formatCurrency(calculations.totalCostPerUnit)}</span>
                </div>
                <div className="flex justify-between text-base font-bold">
                  <span>Sell Price</span>
                  <span className="text-success">{formatCurrency(suggestedPrice || calculations.suggestedSellPrice)}</span>
                </div>
              </div>
            </div>

            <div className="bg-base-200 rounded-xl p-4">
              <h4 className="font-bold text-sm mb-3">📊 Profit Analysis</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="opacity-60">Profit/Unit</span>
                  <span className={`font-bold ${calculations.profitPerUnit >= 0 ? 'text-success' : 'text-error'}`}>
                    {formatCurrency(calculations.profitPerUnit)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-60">Margin</span>
                  <span className={`font-bold ${calculations.profitMargin >= 50 ? 'text-success' : calculations.profitMargin >= 30 ? 'text-warning' : 'text-error'}`}>
                    {calculations.profitMargin.toFixed(1)}%
                  </span>
                </div>
                <div className="divider my-1"></div>
                <div className="flex justify-between">
                  <span className="opacity-60">Batch Revenue</span>
                  <span className="font-semibold">{formatCurrency(calculations.totalBatchRevenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-60">Batch Cost</span>
                  <span>{formatCurrency(calculations.totalBatchCost)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Batch Profit</span>
                  <span className={calculations.totalBatchProfit >= 0 ? 'text-success' : 'text-error'}>
                    {formatCurrency(calculations.totalBatchProfit)}
                  </span>
                </div>
              </div>
            </div>

            <progress
              className={`progress w-full h-3 ${calculations.profitMargin >= 50 ? 'progress-success' : calculations.profitMargin >= 30 ? 'progress-warning' : 'progress-error'}`}
              value={Math.max(calculations.profitMargin, 0)}
              max={100}
            />
            <p className="text-center text-xs opacity-50">
              {calculations.profitMargin >= 50 ? '🎉 Great margin!' : calculations.profitMargin >= 30 ? '👍 Decent margin' : '⚠️ Low margin'}
            </p>
          </div>
        </div>

        <div className="modal-action">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? <span className="loading loading-spinner loading-xs" /> : null}
            {formula ? 'Update Formula' : 'Create Formula'}
          </button>
        </div>
      </div>
    </div>
  );
};
