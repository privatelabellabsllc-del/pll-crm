import React, { useState, useEffect } from 'react';
import { PurchaseOrder, PO_STATUSES, Supplier, InventoryItem } from '../types';
import { X, Save } from 'lucide-react';

interface PurchaseOrderFormProps {
  po: PurchaseOrder | null;
  onClose: () => void;
  onSaved: () => void;
}

const esc = (val: string) => val.replace(/'/g, "''");

const PurchaseOrderForm: React.FC<PurchaseOrderFormProps> = ({ po, onClose, onSaved }) => {
  const [supplierId, setSupplierId] = useState<string>(po?.supplier_id?.toString() || '');
  const [inventoryId, setInventoryId] = useState<string>(po?.inventory_id?.toString() || '');
  const [quantityKg, setQuantityKg] = useState<string>(po?.quantity_kg?.toString() || '');
  const [price, setPrice] = useState<string>(po?.price?.toString() || '');
  const [status, setStatus] = useState<string>(po?.status || 'Draft');
  const [expectedDelivery, setExpectedDelivery] = useState<string>(po?.expected_delivery || '');
  const [carrier, setCarrier] = useState<string>(po?.carrier || '');
  const [trackingNumber, setTrackingNumber] = useState<string>(po?.tracking_number || '');
  const [eta, setEta] = useState<string>(po?.eta || '');
  const [productionProjectId, setProductionProjectId] = useState<string>(po?.production_project_id?.toString() || '');
  const [notes, setNotes] = useState<string>(po?.notes || '');

  const [suppliers, setSuppliers] = useState<{ id: number; name: string }[]>([]);
  const [items, setItems] = useState<{ id: number; ingredient_name: string }[]>([]);
  const [projects, setProjects] = useState<{ id: number; project_name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, i, p] = await Promise.all([
          window.tasklet.sqlQuery(`SELECT id, name FROM suppliers ORDER BY name`),
          window.tasklet.sqlQuery(`SELECT id, ingredient_name FROM inventory ORDER BY ingredient_name`),
          window.tasklet.sqlQuery(`SELECT id, project_name FROM production_projects WHERE production_stage != 'Completed' ORDER BY project_name`),
        ]);
        setSuppliers(s as any[]);
        setItems(i as any[]);
        setProjects(p as any[]);
      } catch (e: any) {
        setError('Failed to load dropdown data');
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!supplierId) {
      setError('Supplier is required');
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const invId = inventoryId ? inventoryId : 'NULL';
      const qty = quantityKg ? quantityKg : 'NULL';
      const pr = price ? price : 'NULL';
      const ed = expectedDelivery ? `'${esc(expectedDelivery)}'` : 'NULL';
      const car = carrier ? `'${esc(carrier)}'` : 'NULL';
      const tn = trackingNumber ? `'${esc(trackingNumber)}'` : 'NULL';
      const etaVal = eta ? `'${esc(eta)}'` : 'NULL';
      const ppId = productionProjectId ? productionProjectId : 'NULL';
      const notesVal = notes ? `'${esc(notes)}'` : 'NULL';

      if (po) {
        await window.tasklet.sqlQuery(`
          UPDATE purchase_orders SET
            supplier_id = ${supplierId},
            inventory_id = ${invId},
            quantity_kg = ${qty},
            price = ${pr},
            status = '${esc(status)}',
            expected_delivery = ${ed},
            carrier = ${car},
            tracking_number = ${tn},
            eta = ${etaVal},
            production_project_id = ${ppId},
            notes = ${notesVal},
            updated_at = datetime('now')
          WHERE id = ${po.id}
        `);
      } else {
        await window.tasklet.sqlQuery(`
          INSERT INTO purchase_orders (
            supplier_id, inventory_id, quantity_kg, price, status,
            expected_delivery, carrier, tracking_number, eta,
            production_project_id, notes, created_at, updated_at
          ) VALUES (
            ${supplierId}, ${invId}, ${qty}, ${pr}, '${esc(status)}',
            ${ed}, ${car}, ${tn}, ${etaVal},
            ${ppId}, ${notesVal}, datetime('now'), datetime('now')
          )
        `);
      }

      onSaved();
    } catch (e: any) {
      setError(e.message || 'Failed to save purchase order');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-base-100 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">
            {po ? 'Edit Purchase Order' : 'Create Purchase Order'}
          </h2>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="alert alert-error mb-4">
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <div className="space-y-4">
          {/* Row 1: Supplier + Inventory Item */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label"><span className="label-text font-medium">Supplier *</span></label>
              <select
                className="select select-bordered w-full"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                <option value="">Select supplier...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="form-control">
              <label className="label"><span className="label-text font-medium">Inventory Item</span></label>
              <select
                className="select select-bordered w-full"
                value={inventoryId}
                onChange={(e) => setInventoryId(e.target.value)}
              >
                <option value="">Select item...</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>{i.ingredient_name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Quantity + Price */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label"><span className="label-text font-medium">Quantity (kg)</span></label>
              <input
                type="number"
                className="input input-bordered w-full"
                placeholder="0.00"
                step="0.01"
                value={quantityKg}
                onChange={(e) => setQuantityKg(e.target.value)}
              />
            </div>

            <div className="form-control">
              <label className="label"><span className="label-text font-medium">Total Price ($)</span></label>
              <input
                type="number"
                className="input input-bordered w-full"
                placeholder="0.00"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          </div>

          {/* Row 3: Status + Expected Delivery */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label"><span className="label-text font-medium">Status</span></label>
              <select
                className="select select-bordered w-full"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {PO_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="form-control">
              <label className="label"><span className="label-text font-medium">Expected Delivery</span></label>
              <input
                type="date"
                className="input input-bordered w-full"
                value={expectedDelivery}
                onChange={(e) => setExpectedDelivery(e.target.value)}
              />
            </div>
          </div>

          {/* Row 4: Carrier + Tracking Number */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label"><span className="label-text font-medium">Carrier</span></label>
              <input
                type="text"
                className="input input-bordered w-full"
                placeholder="e.g. FedEx, UPS"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
              />
            </div>

            <div className="form-control">
              <label className="label"><span className="label-text font-medium">Tracking Number</span></label>
              <input
                type="text"
                className="input input-bordered w-full"
                placeholder="Tracking #"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
              />
            </div>
          </div>

          {/* Row 5: ETA + Production Project */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label"><span className="label-text font-medium">ETA</span></label>
              <input
                type="date"
                className="input input-bordered w-full"
                value={eta}
                onChange={(e) => setEta(e.target.value)}
              />
            </div>

            <div className="form-control">
              <label className="label"><span className="label-text font-medium">Production Project</span></label>
              <select
                className="select select-bordered w-full"
                value={productionProjectId}
                onChange={(e) => setProductionProjectId(e.target.value)}
              >
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.project_name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes - full width */}
          <div className="form-control">
            <label className="label"><span className="label-text font-medium">Notes</span></label>
            <textarea
              className="textarea textarea-bordered w-full"
              rows={3}
              placeholder="Additional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-base-300">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              <Save size={16} />
            )}
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrderForm;
