import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { SalesProject, Customer, SALES_STAGES, PRODUCT_TYPES } from '../types';
import { escSql } from '../utils/helpers';

interface ProjectFormProps {
  project?: SalesProject | null;
  preselectedCustomerId?: number;
  onClose: () => void;
  onSaved: () => void;
}

export const ProjectForm: React.FC<ProjectFormProps> = ({ project, preselectedCustomerId, onClose, onSaved }) => {
  const isEdit = !!project;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState({
    customer_id: preselectedCustomerId || 0,
    project_name: '',
    product_type: '',
    estimated_units: '',
    quoted_price_per_unit: '',
    estimated_revenue: '',
    scope_description: '',
    sales_stage: 'New Lead' as string,
    assigned_to: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCustomers();
    if (project) {
      setForm({
        customer_id: project.customer_id,
        project_name: project.project_name || '',
        product_type: project.product_type || '',
        estimated_units: project.estimated_units?.toString() || '',
        quoted_price_per_unit: project.quoted_price_per_unit?.toString() || '',
        estimated_revenue: project.estimated_revenue?.toString() || '',
        scope_description: project.scope_description || '',
        sales_stage: project.sales_stage,
        assigned_to: project.assigned_to || '',
        notes: project.notes || '',
      });
    }
  }, [project]);

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
      // Auto-calculate revenue
      if (field === 'estimated_units' || field === 'quoted_price_per_unit') {
        const units = parseFloat(field === 'estimated_units' ? value : prev.estimated_units) || 0;
        const price = parseFloat(field === 'quoted_price_per_unit' ? value : prev.quoted_price_per_unit) || 0;
        updated.estimated_revenue = (units * price).toString();
      }
      return updated;
    });
  }

  async function handleSave() {
    if (!form.project_name.trim() || !form.customer_id) return;
    setSaving(true);
    try {
      const units = form.estimated_units ? parseInt(form.estimated_units) : 'NULL';
      const price = form.quoted_price_per_unit ? parseFloat(form.quoted_price_per_unit) : 'NULL';
      const revenue = form.estimated_revenue ? parseFloat(form.estimated_revenue) : 'NULL';

      if (isEdit && project) {
        await window.tasklet.sqlExec(
          `UPDATE sales_projects SET customer_id=${form.customer_id}, project_name=${escSql(form.project_name)}, product_type=${escSql(form.product_type)}, estimated_units=${units}, quoted_price_per_unit=${price}, estimated_revenue=${revenue}, scope_description=${escSql(form.scope_description)}, sales_stage=${escSql(form.sales_stage)}, assigned_to=${escSql(form.assigned_to)}, notes=${escSql(form.notes)}, updated_at=datetime('now') WHERE id=${project.id}`
        );
      } else {
        await window.tasklet.sqlExec(
          `INSERT INTO sales_projects (customer_id, project_name, product_type, estimated_units, quoted_price_per_unit, estimated_revenue, scope_description, sales_stage, assigned_to, notes) VALUES (${form.customer_id}, ${escSql(form.project_name)}, ${escSql(form.product_type)}, ${units}, ${price}, ${revenue}, ${escSql(form.scope_description)}, ${escSql(form.sales_stage)}, ${escSql(form.assigned_to)}, ${escSql(form.notes)})`
        );
      }
      onSaved();
    } catch (err) {
      console.error('Failed to save project:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!project) return;
    try {
      await window.tasklet.sqlExec(`DELETE FROM sales_projects WHERE id=${project.id}`);
      onSaved();
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">{isEdit ? 'Edit Deal' : 'New Deal'}</h3>
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
              <input className="input input-bordered input-sm w-full" value={form.project_name} onChange={(e) => updateField('project_name', e.target.value)} placeholder="e.g. Custom Serum Line" />
            </div>
            <div>
              <label className="label"><span className="label-text text-xs">Product Type</span></label>
              <select className="select select-bordered select-sm w-full" value={form.product_type} onChange={(e) => updateField('product_type', e.target.value)}>
                <option value="">Select type...</option>
                {PRODUCT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label"><span className="label-text text-xs">Est. Units</span></label>
              <input className="input input-bordered input-sm w-full" type="number" value={form.estimated_units} onChange={(e) => updateField('estimated_units', e.target.value)} placeholder="1000" />
            </div>
            <div>
              <label className="label"><span className="label-text text-xs">Price/Unit ($)</span></label>
              <input className="input input-bordered input-sm w-full" type="number" step="0.01" value={form.quoted_price_per_unit} onChange={(e) => updateField('quoted_price_per_unit', e.target.value)} placeholder="5.00" />
            </div>
            <div>
              <label className="label"><span className="label-text text-xs">Revenue</span></label>
              <input className="input input-bordered input-sm w-full bg-base-200" type="number" value={form.estimated_revenue} readOnly />
            </div>
          </div>

          <div>
            <label className="label"><span className="label-text text-xs">Stage</span></label>
            <select className="select select-bordered select-sm w-full" value={form.sales_stage} onChange={(e) => updateField('sales_stage', e.target.value)}>
              {SALES_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="label"><span className="label-text text-xs">Assigned To</span></label>
            <input className="input input-bordered input-sm w-full" value={form.assigned_to} onChange={(e) => updateField('assigned_to', e.target.value)} placeholder="Kenne, Mark..." />
          </div>

          <div>
            <label className="label"><span className="label-text text-xs">Scope / Description</span></label>
            <textarea className="textarea textarea-bordered w-full text-sm" rows={2} value={form.scope_description} onChange={(e) => updateField('scope_description', e.target.value)} placeholder="Custom formula requirements, packaging options..." />
          </div>

          <div>
            <label className="label"><span className="label-text text-xs">Notes</span></label>
            <textarea className="textarea textarea-bordered w-full text-sm" rows={2} value={form.notes} onChange={(e) => updateField('notes', e.target.value)} placeholder="Communication history, pricing negotiations..." />
          </div>
        </div>

        <div className="modal-action">
          {isEdit && (
            <button className="btn btn-error btn-sm btn-outline mr-auto" onClick={handleDelete}>Delete</button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !form.project_name.trim() || !form.customer_id}>
            {saving ? <span className="loading loading-spinner loading-xs" /> : <Save size={16} />}
            {isEdit ? 'Update' : 'Create Deal'}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
};
