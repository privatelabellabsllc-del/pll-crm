import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { Customer } from '../types';
import { escSql } from '../utils/helpers';

interface CustomerFormProps {
  customer?: Customer | null;
  onClose: () => void;
  onSaved: () => void;
}

export const CustomerForm: React.FC<CustomerFormProps> = ({ customer, onClose, onSaved }) => {
  const isEdit = !!customer;
  const [form, setForm] = useState({
    name: '',
    company_name: '',
    phone: '',
    email: '',
    address: '',
    website: '',
    sales_rep: '',
    priority: 'normal',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (customer) {
      setForm({
        name: customer.name || '',
        company_name: customer.company_name || '',
        phone: customer.phone || '',
        email: customer.email || '',
        address: customer.address || '',
        website: customer.website || '',
        sales_rep: customer.sales_rep || '',
        priority: customer.priority || 'normal',
        notes: customer.notes || '',
      });
    }
  }, [customer]);

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (isEdit && customer) {
        await window.tasklet.sqlExec(
          `UPDATE customers SET name=${escSql(form.name)}, company_name=${escSql(form.company_name)}, phone=${escSql(form.phone)}, email=${escSql(form.email)}, address=${escSql(form.address)}, website=${escSql(form.website)}, sales_rep=${escSql(form.sales_rep)}, priority=${escSql(form.priority)}, notes=${escSql(form.notes)}, updated_at=datetime('now') WHERE id=${customer.id}`
        );
      } else {
        await window.tasklet.sqlExec(
          `INSERT INTO customers (name, company_name, phone, email, address, website, sales_rep, priority, notes) VALUES (${escSql(form.name)}, ${escSql(form.company_name)}, ${escSql(form.phone)}, ${escSql(form.email)}, ${escSql(form.address)}, ${escSql(form.website)}, ${escSql(form.sales_rep)}, ${escSql(form.priority)}, ${escSql(form.notes)})`
        );
      }
      onSaved();
    } catch (err) {
      console.error('Failed to save customer:', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">{isEdit ? 'Edit Customer' : 'New Customer'}</h3>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label"><span className="label-text text-xs">Name *</span></label>
              <input className="input input-bordered input-sm w-full" value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Contact name" />
            </div>
            <div>
              <label className="label"><span className="label-text text-xs">Company</span></label>
              <input className="input input-bordered input-sm w-full" value={form.company_name} onChange={(e) => updateField('company_name', e.target.value)} placeholder="Company name" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label"><span className="label-text text-xs">Email</span></label>
              <input className="input input-bordered input-sm w-full" type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} placeholder="email@example.com" />
            </div>
            <div>
              <label className="label"><span className="label-text text-xs">Phone</span></label>
              <input className="input input-bordered input-sm w-full" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} placeholder="(555) 123-4567" />
            </div>
          </div>

          <div>
            <label className="label"><span className="label-text text-xs">Address</span></label>
            <input className="input input-bordered input-sm w-full" value={form.address} onChange={(e) => updateField('address', e.target.value)} placeholder="Full address" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label"><span className="label-text text-xs">Website</span></label>
              <input className="input input-bordered input-sm w-full" value={form.website} onChange={(e) => updateField('website', e.target.value)} placeholder="www.example.com" />
            </div>
            <div>
              <label className="label"><span className="label-text text-xs">Sales Rep</span></label>
              <input className="input input-bordered input-sm w-full" value={form.sales_rep} onChange={(e) => updateField('sales_rep', e.target.value)} placeholder="Kenne, Mark..." />
            </div>
          </div>

          <div>
            <label className="label"><span className="label-text text-xs">Account Priority</span></label>
            <select className="select select-bordered select-sm w-full" value={form.priority} onChange={(e) => updateField('priority', e.target.value)}>
              <option value="normal">Normal</option>
              <option value="high">High Priority</option>
              <option value="vip">VIP Account ⭐</option>
            </select>
          </div>

          <div>
            <label className="label"><span className="label-text text-xs">Notes</span></label>
            <textarea className="textarea textarea-bordered w-full text-sm" rows={3} value={form.notes} onChange={(e) => updateField('notes', e.target.value)} placeholder="Communication history, custom requirements, packaging notes..." />
          </div>
        </div>

        <div className="modal-action">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !form.name.trim()}>
            {saving ? <span className="loading loading-spinner loading-xs" /> : <Save size={16} />}
            {isEdit ? 'Update' : 'Add Customer'}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
};
