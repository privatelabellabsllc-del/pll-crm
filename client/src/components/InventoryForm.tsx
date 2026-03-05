import React, { useState, useEffect } from 'react';
import { InventoryItem, Supplier, ITEM_TYPES } from '../types';
import { X, Save } from 'lucide-react';

interface InventoryFormProps {
  item: InventoryItem | null;
  onClose: () => void;
  onSaved: () => void;
}

const InventoryForm: React.FC<InventoryFormProps> = ({ item, onClose, onSaved }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [saving, setSaving] = useState(false);

  const [ingredientName, setIngredientName] = useState(item?.ingredient_name || '');
  const [itemType, setItemType] = useState(item?.item_type || ITEM_TYPES[0] || '');
  const [supplierId, setSupplierId] = useState<string>(item?.supplier_id?.toString() || '');
  const [costPerKg, setCostPerKg] = useState(item?.cost_per_kg?.toString() || '');
  const [moqKg, setMoqKg] = useState(item?.moq_kg?.toString() || '');
  const [currentStockKg, setCurrentStockKg] = useState(item?.current_stock_kg?.toString() || '0');
  const [lowStockThresholdKg, setLowStockThresholdKg] = useState(item?.low_stock_threshold_kg?.toString() || '1.0');
  const [lotNumber, setLotNumber] = useState(item?.lot_number || '');
  const [warehouseAisle, setWarehouseAisle] = useState(item?.warehouse_aisle || '');
  const [warehouseShelf, setWarehouseShelf] = useState(item?.warehouse_shelf || '');
  const [warehouseBin, setWarehouseBin] = useState(item?.warehouse_bin || '');
  const [notes, setNotes] = useState(item?.notes || '');

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      const rows = await window.tasklet.sqlQuery('SELECT id, name FROM suppliers ORDER BY name');
      setSuppliers(rows as unknown as Supplier[]);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
    }
  };

  const esc = (val: string) => val.replace(/'/g, "''");

  const handleSave = async () => {
    if (!ingredientName.trim()) return;
    setSaving(true);

    try {
      const stock = parseFloat(currentStockKg) || 0;
      const threshold = parseFloat(lowStockThresholdKg) || 1.0;
      let status = 'In Stock';
      if (stock === 0) {
        status = 'Out of Stock';
      } else if (stock <= threshold) {
        status = 'Low Stock';
      }

      const supplierVal = supplierId ? supplierId : 'NULL';
      const costVal = costPerKg ? parseFloat(costPerKg) : 'NULL';
      const moqVal = moqKg ? parseFloat(moqKg) : 'NULL';

      if (item) {
        const sql = `UPDATE inventory SET
          ingredient_name = '${esc(ingredientName.trim())}',
          item_type = '${esc(itemType)}',
          supplier_id = ${supplierVal},
          cost_per_kg = ${costVal},
          moq_kg = ${moqVal},
          current_stock_kg = ${stock},
          low_stock_threshold_kg = ${threshold},
          lot_number = '${esc(lotNumber.trim())}',
          warehouse_aisle = '${esc(warehouseAisle.trim())}',
          warehouse_shelf = '${esc(warehouseShelf.trim())}',
          warehouse_bin = '${esc(warehouseBin.trim())}',
          status = '${esc(status)}',
          notes = '${esc(notes.trim())}'
          WHERE id = ${item.id}`;
        await window.tasklet.sqlQuery(sql);
      } else {
        const sql = `INSERT INTO inventory (ingredient_name, item_type, supplier_id, cost_per_kg, moq_kg, current_stock_kg, low_stock_threshold_kg, lot_number, warehouse_aisle, warehouse_shelf, warehouse_bin, status, notes)
          VALUES ('${esc(ingredientName.trim())}', '${esc(itemType)}', ${supplierVal}, ${costVal}, ${moqVal}, ${stock}, ${threshold}, '${esc(lotNumber.trim())}', '${esc(warehouseAisle.trim())}', '${esc(warehouseShelf.trim())}', '${esc(warehouseBin.trim())}', '${esc(status)}', '${esc(notes.trim())}')`;
        await window.tasklet.sqlQuery(sql);
      }

      onSaved();
    } catch (err) {
      console.error('Failed to save inventory item:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-base-100 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">{item ? 'Edit Inventory Item' : 'Add Inventory Item'}</h2>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Row: Name + Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label"><span className="label-text font-medium">Ingredient Name *</span></label>
              <input
                type="text"
                className="input input-bordered w-full"
                value={ingredientName}
                onChange={(e) => setIngredientName(e.target.value)}
                placeholder="e.g. Vitamin C Powder"
              />
            </div>
            <div>
              <label className="label"><span className="label-text font-medium">Item Type</span></label>
              <select
                className="select select-bordered w-full"
                value={itemType}
                onChange={(e) => setItemType(e.target.value)}
              >
                {ITEM_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row: Supplier + Cost */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label"><span className="label-text font-medium">Supplier</span></label>
              <select
                className="select select-bordered w-full"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                <option value="">-- No Supplier --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label"><span className="label-text font-medium">Cost per kg ($)</span></label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input input-bordered w-full"
                value={costPerKg}
                onChange={(e) => setCostPerKg(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Row: MOQ + Current Stock */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label"><span className="label-text font-medium">MOQ (kg)</span></label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input input-bordered w-full"
                value={moqKg}
                onChange={(e) => setMoqKg(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="label"><span className="label-text font-medium">Current Stock (kg)</span></label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input input-bordered w-full"
                value={currentStockKg}
                onChange={(e) => setCurrentStockKg(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Row: Threshold + Lot Number */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label"><span className="label-text font-medium">Low Stock Threshold (kg)</span></label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input input-bordered w-full"
                value={lowStockThresholdKg}
                onChange={(e) => setLowStockThresholdKg(e.target.value)}
                placeholder="1.00"
              />
            </div>
            <div>
              <label className="label"><span className="label-text font-medium">Lot Number</span></label>
              <input
                type="text"
                className="input input-bordered w-full"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                placeholder="e.g. LOT-2026-001"
              />
            </div>
          </div>

          {/* Warehouse Location */}
          <div>
            <label className="label"><span className="label-text font-medium">Warehouse Location</span></label>
            <div className="grid grid-cols-3 gap-3">
              <input
                type="text"
                className="input input-bordered w-full"
                value={warehouseAisle}
                onChange={(e) => setWarehouseAisle(e.target.value)}
                placeholder="Aisle"
              />
              <input
                type="text"
                className="input input-bordered w-full"
                value={warehouseShelf}
                onChange={(e) => setWarehouseShelf(e.target.value)}
                placeholder="Shelf"
              />
              <input
                type="text"
                className="input input-bordered w-full"
                value={warehouseBin}
                onChange={(e) => setWarehouseBin(e.target.value)}
                placeholder="Bin"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label"><span className="label-text font-medium">Notes</span></label>
            <textarea
              className="textarea textarea-bordered w-full"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
            />
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-base-300">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !ingredientName.trim()}
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InventoryForm;
