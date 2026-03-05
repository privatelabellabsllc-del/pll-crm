import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { ProductionProject, Customer, Formula, PRODUCTION_STAGES } from '../types';
import { escSql, productionProgress } from '../utils/helpers';

interface ProductionFormProps {
  project?: ProductionProject | null;
  onClose: () => void;
  onSaved: () => void;
}

export const ProductionForm: React.FC<ProductionFormProps> = ({ project, onClose, onSaved }) => {
  const isEdit = !!project;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [form, setForm] = useState({
    customer_id: 0,
    project_name: '',
    production_stage: 'Deposit Received' as string,
    assigned_to: '',
    expected_completion: '',
    total_value: '',
    deposit_paid: '',
    balance_remaining: '',
    payment_status: 'Deposit Pending',
    profit_estimate: '',
    formula_id: '0',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCustomers();
    loadFormulas();
    if (project) {
      setForm({
        customer_id: project.customer_id,
        project_name: project.project_name || '',
        production_stage: project.production_stage,
        assigned_to: project.assigned_to || '',
        expected_completion: project.expected_completion || '',
        total_value: project.total_value?.toString() || '',
        deposit_paid: project.deposit_paid?.toString() || '',
        balance_remaining: project.balance_remaining?.toString() || '',
        payment_status: project.payment_status || 'Deposit Pending',
        profit_estimate: project.profit_estimate?.toString() || '',
        formula_id: project.formula_id?.toString() || '0',
        notes: project.notes || '',
      });
    }
  }, [project]);

  async function loadFormulas() {
    try {
      const rows = await window.tasklet.sqlQuery("SELECT id, formula_name, product_type FROM formulas ORDER BY formula_name");
      setFormulas(rows as unknown as Formula[]);
    } catch (err) {
      console.error('Failed to load formulas:', err);
    }
  }

  async function loadCustomers() {
    try {
      const rows = await window.tasklet.sqlQuery("SELECT id, name, company_name FROM customers ORDER BY name");
      setCustomers(rows as unknown as Customer[]);
    } catch (err) {
      console.error('Failed to load customers:', err);
    }
  }

  function updateField(field: string, value: string) {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'total_value' || field === 'deposit_paid') {
        const total = parseFloat(field === 'total_value' ? value : prev.total_value) || 0;
        const deposit = parseFloat(field === 'deposit_paid' ? value : prev.deposit_paid) || 0;
        updated.balance_remaining = (total - deposit).toString();
      }
      return updated;
    });
  }

  async function handleSave() {
    if (!form.project_name.trim() || !form.customer_id) return;
    setSaving(true);
    try {
      const progress = productionProgress(form.production_stage as any);
      const totalVal = form.total_value ? parseFloat(form.total_value) : 0;
      const depositVal = form.deposit_paid ? parseFloat(form.deposit_paid) : 0;
      const balanceVal = form.balance_remaining ? parseFloat(form.balance_remaining) : 0;
      const profitVal = form.profit_estimate ? parseFloat(form.profit_estimate) : 0;

      const formulaId = form.formula_id && form.formula_id !== '0' ? parseInt(form.formula_id) : null;
      const formulaSql = formulaId ? `${formulaId}` : 'NULL';

      if (isEdit && project) {
        await window.tasklet.sqlExec(
          `UPDATE production_projects SET customer_id=${form.customer_id}, project_name=${escSql(form.project_name)}, production_stage=${escSql(form.production_stage)}, assigned_to=${escSql(form.assigned_to)}, expected_completion=${escSql(form.expected_completion || null)}, progress_percent=${progress}, total_value=${totalVal}, deposit_paid=${depositVal}, balance_remaining=${balanceVal}, payment_status=${escSql(form.payment_status)}, profit_estimate=${profitVal}, formula_id=${formulaSql}, notes=${escSql(form.notes)}, updated_at=datetime('now') WHERE id=${project.id}`
        );
      } else {
        await window.tasklet.sqlExec(
          `INSERT INTO production_projects (customer_id, project_name, production_stage, assigned_to, expected_completion, progress_percent, total_value, deposit_paid, balance_remaining, payment_status, profit_estimate, formula_id, notes) VALUES (${form.customer_id}, ${escSql(form.project_name)}, ${escSql(form.production_stage)}, ${escSql(form.assigned_to)}, ${escSql(form.expected_completion || null)}, ${progress}, ${totalVal}, ${depositVal}, ${balanceVal}, ${escSql(form.payment_status)}, ${profitVal}, ${formulaSql}, ${escSql(form.notes)})`
        );
      }
      onSaved();
    } catch (err) {
      console.error('Failed to save production project:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!project) return;
    try {
      await window.tasklet.sqlExec(`DELETE FROM production_projects WHERE id=${project.id}`);
      onSaved();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">{isEdit ? 'Edit Production Project' : 'New Production Project'}</h3>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label"><span className="label-text text-xs">Customer *</span></label>
            <select className="select select-bordered select-sm w-full" value={form.customer_id} onChange={(e) => updateField('customer_id', e.target.value)}>
              <option value={0} disabled>Select customer...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.company_name ? ` (${c.company_name})` : ''}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label"><span className="label-text text-xs">Project Name *</span></label>
              <input className="input input-bordered input-sm w-full" value={form.project_name} onChange={(e) => updateField('project_name', e.target.value)} />
            </div>
            <div>
              <label className="label"><span className="label-text text-xs">Stage</span></label>
              <select className="select select-bordered select-sm w-full" value={form.production_stage} onChange={(e) => updateField('production_stage', e.target.value)}>
                {PRODUCTION_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label"><span className="label-text text-xs">Formula (for Production Planning)</span></label>
            <select className="select select-bordered select-sm w-full" value={form.formula_id} onChange={(e) => updateField('formula_id', e.target.value)}>
              <option value="0">No formula linked</option>
              {formulas.map((f) => (
                <option key={f.id} value={f.id}>{f.formula_name}{f.product_type ? ` (${f.product_type})` : ''}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label"><span className="label-text text-xs">Assigned To</span></label>
              <input className="input input-bordered input-sm w-full" value={form.assigned_to} onChange={(e) => updateField('assigned_to', e.target.value)} placeholder="Team member" />
            </div>
            <div>
              <label className="label"><span className="label-text text-xs">Expected Completion</span></label>
              <input className="input input-bordered input-sm w-full" type="date" value={form.expected_completion} onChange={(e) => updateField('expected_completion', e.target.value)} />
            </div>
          </div>

          <div className="divider text-xs text-base-content/40">Financials</div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label"><span className="label-text text-xs">Total Value ($)</span></label>
              <input className="input input-bordered input-sm w-full" type="number" step="0.01" value={form.total_value} onChange={(e) => updateField('total_value', e.target.value)} />
            </div>
            <div>
              <label className="label"><span className="label-text text-xs">Deposit Paid ($)</span></label>
              <input className="input input-bordered input-sm w-full" type="number" step="0.01" value={form.deposit_paid} onChange={(e) => updateField('deposit_paid', e.target.value)} />
            </div>
            <div>
              <label className="label"><span className="label-text text-xs">Balance</span></label>
              <input className="input input-bordered input-sm w-full bg-base-200" type="number" value={form.balance_remaining} readOnly />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label"><span className="label-text text-xs">Payment Status</span></label>
              <select className="select select-bordered select-sm w-full" value={form.payment_status} onChange={(e) => updateField('payment_status', e.target.value)}>
                <option value="Deposit Pending">Deposit Pending</option>
                <option value="Deposit Paid">Deposit Paid</option>
                <option value="Balance Due">Balance Due</option>
                <option value="Paid in Full">Paid in Full</option>
              </select>
            </div>
            <div>
              <label className="label"><span className="label-text text-xs">Profit Estimate ($)</span></label>
              <input className="input input-bordered input-sm w-full" type="number" step="0.01" value={form.profit_estimate} onChange={(e) => updateField('profit_estimate', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label"><span className="label-text text-xs">Notes</span></label>
            <textarea className="textarea textarea-bordered w-full text-sm" rows={3} value={form.notes} onChange={(e) => updateField('notes', e.target.value)} placeholder="Production notes, ingredient status, quality notes..." />
          </div>
        </div>

        <div className="modal-action">
          {isEdit && (
            <button className="btn btn-error btn-sm btn-outline mr-auto" onClick={handleDelete}>Delete</button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !form.project_name.trim() || !form.customer_id}>
            {saving ? <span className="loading loading-spinner loading-xs" /> : <Save size={16} />}
            {isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
};
