import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Camera } from 'lucide-react';
import { Customer } from '../types';
import { escSql } from '../utils/helpers';
import { apiUpload } from '../api';

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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

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

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  }

  async function uploadPhoto(customerId: number) {
    if (!photoFile) return;
    const fd = new FormData();
    fd.append('photo', photoFile);
    await apiUpload(`/api/customers/${customerId}/photo`, fd);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (isEdit && customer) {
        await window.tasklet.sqlExec(
          `UPDATE customers SET name=${escSql(form.name)}, company_name=${escSql(form.company_name)}, phone=${escSql(form.phone)}, email=${escSql(form.email)}, address=${escSql(form.address)}, website=${escSql(form.website)}, sales_rep=${escSql(form.sales_rep)}, priority=${escSql(form.priority)}, notes=${escSql(form.notes)}, updated_at=datetime('now') WHERE id=${customer.id}`
        );
        if (photoFile) await uploadPhoto(customer.id);
      } else {
        const result = await window.tasklet.sqlExec(
          `INSERT INTO customers (name, company_name, phone, email, address, website, sales_rep, priority, notes) VALUES (${escSql(form.name)}, ${escSql(form.company_name)}, ${escSql(form.phone)}, ${escSql(form.email)}, ${escSql(form.address)}, ${escSql(form.website)}, ${escSql(form.sales_rep)}, ${escSql(form.priority)}, ${escSql(form.notes)})`
        );
        if (photoFile && result.lastInsertRowid) {
          await uploadPhoto(result.lastInsertRowid);
        }
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

        {/* Photo Upload */}
        <div className="flex justify-center mb-4">
          <div className="relative group cursor-pointer" onClick={() => photoRef.current?.click()}>
            <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-200 flex items-center justify-center">
              {photoPreview || customer?.photo_url ? (
                <img src={photoPreview || customer?.photo_url} alt="Customer" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl text-gray-400">{form.name ? form.name.charAt(0).toUpperCase() : '?'}</span>
              )}
            </div>
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera size={20} className="text-white" />
            </div>
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
          </div>
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
