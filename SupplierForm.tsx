import React, { useState, useEffect } from 'react';
import { Supplier } from '../types';
import { X, Save } from 'lucide-react';

interface SupplierFormProps {
  supplier: Supplier | null;
  onClose: () => void;
  onSaved: () => void;
}

const SupplierForm: React.FC<SupplierFormProps> = ({ supplier, onClose, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    contact_name: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    lead_time_days: '',
    notes: '',
  });

  useEffect(() => {
    if (supplier) {
      setForm({
        name: supplier.name || '',
        contact_name: supplier.contact_name || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        website: supplier.website || '',
        address: supplier.address || '',
        lead_time_days: supplier.lead_time_days != null ? String(supplier.lead_time_days) : '',
        notes: supplier.notes || '',
      });
    }
  }, [supplier]);

  const esc = (val: string) => val.replace(/'/g, "''");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      const name = esc(form.name.trim());
      const contact_name = esc(form.contact_name.trim());
      const email = esc(form.email.trim());
      const phone = esc(form.phone.trim());
      const website = esc(form.website.trim());
      const address = esc(form.address.trim());
      const lead_time_days = form.lead_time_days.trim() ? parseInt(form.lead_time_days.trim(), 10) : null;
      const notes = esc(form.notes.trim());

      if (supplier) {
        await window.tasklet.sqlQuery(
          `UPDATE suppliers SET name='${name}', contact_name='${contact_name}', email='${email}', phone='${phone}', website='${website}', address='${address}', lead_time_days=${lead_time_days === null ? 'NULL' : lead_time_days}, notes='${notes}', updated_at=datetime('now') WHERE id=${supplier.id}`
        );
      } else {
        await window.tasklet.sqlQuery(
          `INSERT INTO suppliers (name, contact_name, email, phone, website, address, lead_time_days, notes, created_at, updated_at) VALUES ('${name}', '${contact_name}', '${email}', '${phone}', '${website}', '${address}', ${lead_time_days === null ? 'NULL' : lead_time_days}, '${notes}', datetime('now'), datetime('now'))`
        );
      }
      onSaved();
    } catch (err) {
      console.error('Failed to save supplier:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-base-100 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">{supplier ? 'Edit Supplier' : 'Add Supplier'}</h2>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-control">
            <label className="label"><span className="label-text font-medium">Name *</span></label>
            <input type="text" name="name" value={form.name} onChange={handleChange} className="input input-bordered w-full" placeholder="Supplier name" required />
          </div>

          <div className="form-control">
            <label className="label"><span className="label-text font-medium">Contact Name</span></label>
            <input type="text" name="contact_name" value={form.contact_name} onChange={handleChange} className="input input-bordered w-full" placeholder="Contact person" />
          </div>

          <div className="form-control">
            <label className="label"><span className="label-text font-medium">Email</span></label>
            <input type="text" name="email" value={form.email} onChange={handleChange} className="input input-bordered w-full" placeholder="email@example.com" />
          </div>

          <div className="form-control">
            <label className="label"><span className="label-text font-medium">Phone</span></label>
            <input type="text" name="phone" value={form.phone} onChange={handleChange} className="input input-bordered w-full" placeholder="Phone number" />
          </div>

          <div className="form-control">
            <label className="label"><span className="label-text font-medium">Website</span></label>
            <input type="text" name="website" value={form.website} onChange={handleChange} className="input input-bordered w-full" placeholder="https://..." />
          </div>

          <div className="form-control">
            <label className="label"><span className="label-text font-medium">Lead Time (days)</span></label>
            <input type="number" name="lead_time_days" value={form.lead_time_days} onChange={handleChange} className="input input-bordered w-full" placeholder="0" min="0" />
          </div>

          <div className="form-control md:col-span-2">
            <label className="label"><span className="label-text font-medium">Address</span></label>
            <textarea name="address" value={form.address} onChange={handleChange} className="textarea textarea-bordered w-full" rows={2} placeholder="Supplier address" />
          </div>

          <div className="form-control md:col-span-2">
            <label className="label"><span className="label-text font-medium">Notes</span></label>
            <textarea name="notes" value={form.notes} onChange={handleChange} className="textarea textarea-bordered w-full" rows={3} placeholder="Additional notes..." />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading || !form.name.trim()}>
            {loading ? <span className="loading loading-spinner loading-sm"></span> : <Save size={16} />}
            {loading ? 'Saving...' : 'Save Supplier'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SupplierForm;
