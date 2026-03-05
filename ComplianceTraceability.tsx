import React, { useEffect, useState } from 'react';
import { Shield, Plus, ChevronDown, ChevronRight, FileText, Trash2, Search, ClipboardList } from 'lucide-react';
import { ProductionBatch, BatchIngredientRecord } from '../types';
import { formatDate, escSql } from '../utils/helpers';

interface ComplianceProps {
  onRefresh: () => void;
}

interface BatchWithIngredients extends ProductionBatch {
  ingredients: BatchIngredientRecord[];
  expanded?: boolean;
}

interface AttachmentRecord {
  id: number;
  entity_type: string;
  entity_id: number;
  file_name: string;
  file_type: string;
  uploaded_at: string;
  entity_label?: string;
}

type TabType = 'batches' | 'documents';

export const ComplianceTraceability: React.FC<ComplianceProps> = ({ onRefresh }) => {
  const [tab, setTab] = useState<TabType>('batches');
  const [batches, setBatches] = useState<BatchWithIngredients[]>([]);
  const [attachments, setAttachments] = useState<AttachmentRecord[]>([]);
  const [projects, setProjects] = useState<{ id: number; project_name: string }[]>([]);
  const [inventoryItems, setInventoryItems] = useState<{ id: number; ingredient_name: string; lot_number: string | null; supplier_name: string | null }[]>([]);
  const [search, setSearch] = useState('');
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [showDocForm, setShowDocForm] = useState(false);
  const [loading, setLoading] = useState(true);

  // Batch form state
  const [batchProjectId, setBatchProjectId] = useState<number>(0);
  const [batchNumber, setBatchNumber] = useState('');
  const [batchDate, setBatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [batchNotes, setBatchNotes] = useState('');
  const [batchIngredients, setBatchIngredients] = useState<{ inventory_id: number; lot_number: string; supplier_lot: string; amount_grams: number }[]>([]);

  // Doc form state
  const [docEntityType, setDocEntityType] = useState('inventory');
  const [docEntityId, setDocEntityId] = useState<number>(0);
  const [docFileName, setDocFileName] = useState('');
  const [docFileType, setDocFileType] = useState('coa');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [batchRows, projRows, invRows, attRows] = await Promise.all([
        window.tasklet.sqlQuery(
          `SELECT pb.*, pp.project_name, c.name as customer_name
           FROM production_batches pb
           LEFT JOIN production_projects pp ON pb.production_project_id = pp.id
           LEFT JOIN customers c ON pp.customer_id = c.id
           ORDER BY pb.created_at DESC`
        ),
        window.tasklet.sqlQuery("SELECT id, project_name FROM production_projects ORDER BY project_name"),
        window.tasklet.sqlQuery(
          `SELECT i.id, i.ingredient_name, i.lot_number, s.name as supplier_name
           FROM inventory i LEFT JOIN suppliers s ON i.supplier_id = s.id ORDER BY i.ingredient_name`
        ),
        window.tasklet.sqlQuery(
          `SELECT a.*, 
           CASE 
             WHEN a.entity_type = 'inventory' THEN (SELECT ingredient_name FROM inventory WHERE id = a.entity_id)
             WHEN a.entity_type = 'supplier' THEN (SELECT name FROM suppliers WHERE id = a.entity_id)
             WHEN a.entity_type = 'batch' THEN (SELECT batch_number FROM production_batches WHERE id = a.entity_id)
             WHEN a.entity_type = 'production_project' THEN (SELECT project_name FROM production_projects WHERE id = a.entity_id)
             ELSE 'Unknown'
           END as entity_label
           FROM attachments a ORDER BY a.uploaded_at DESC`
        ),
      ]);

      const batchData = batchRows as unknown as ProductionBatch[];
      const batchesWithIng: BatchWithIngredients[] = [];
      for (const b of batchData) {
        const ingRows = await window.tasklet.sqlQuery(
          `SELECT bi.*, i.ingredient_name, s.name as supplier_name
           FROM batch_ingredients bi
           JOIN inventory i ON bi.inventory_id = i.id
           LEFT JOIN suppliers s ON i.supplier_id = s.id
           WHERE bi.batch_id = ${b.id}`
        );
        batchesWithIng.push({ ...b, ingredients: ingRows as unknown as BatchIngredientRecord[], expanded: false });
      }
      setBatches(batchesWithIng);
      setProjects(projRows as unknown as { id: number; project_name: string }[]);
      setInventoryItems(invRows as unknown as { id: number; ingredient_name: string; lot_number: string | null; supplier_name: string | null }[]);
      setAttachments(attRows as unknown as AttachmentRecord[]);
    } catch (err) {
      console.error('Failed to load compliance data:', err);
    } finally {
      setLoading(false);
    }
  }

  function toggleBatch(id: number) {
    setBatches(prev => prev.map(b => b.id === id ? { ...b, expanded: !b.expanded } : b));
  }

  function addBatchIngredient() {
    setBatchIngredients(prev => [...prev, { inventory_id: 0, lot_number: '', supplier_lot: '', amount_grams: 0 }]);
  }

  function removeBatchIngredient(idx: number) {
    setBatchIngredients(prev => prev.filter((_, i) => i !== idx));
  }

  function updateBatchIngredient(idx: number, field: string, val: any) {
    setBatchIngredients(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  }

  async function saveBatch() {
    if (!batchProjectId || !batchNumber) return;
    try {
      await window.tasklet.sqlQuery(
        `INSERT INTO production_batches (production_project_id, batch_number, production_date, notes)
         VALUES (${batchProjectId}, ${escSql(batchNumber)}, ${escSql(batchDate)}, ${escSql(batchNotes)})`
      );
      const idRows = await window.tasklet.sqlQuery("SELECT last_insert_rowid() as id");
      const batchId = (idRows[0] as any).id;

      for (const ing of batchIngredients) {
        if (!ing.inventory_id) continue;
        await window.tasklet.sqlQuery(
          `INSERT INTO batch_ingredients (batch_id, inventory_id, lot_number, supplier_lot_number, amount_used_grams)
           VALUES (${batchId}, ${ing.inventory_id}, ${escSql(ing.lot_number)}, ${escSql(ing.supplier_lot)}, ${ing.amount_grams})`
        );
        // Deduct from inventory
        if (ing.amount_grams > 0) {
          await window.tasklet.sqlQuery(
            `UPDATE inventory SET current_stock_kg = MAX(0, current_stock_kg - ${ing.amount_grams / 1000}),
             status = CASE
               WHEN (current_stock_kg - ${ing.amount_grams / 1000}) <= 0 THEN 'Out of Stock'
               WHEN (current_stock_kg - ${ing.amount_grams / 1000}) <= low_stock_threshold_kg THEN 'Low Stock'
               ELSE 'In Stock'
             END,
             updated_at = datetime('now')
             WHERE id = ${ing.inventory_id}`
          );
        }
      }

      setShowBatchForm(false);
      setBatchProjectId(0); setBatchNumber(''); setBatchNotes(''); setBatchIngredients([]);
      loadData();
      onRefresh();
    } catch (err) {
      console.error('Failed to save batch:', err);
    }
  }

  async function saveDocument() {
    if (!docEntityId || !docFileName) return;
    try {
      await window.tasklet.sqlQuery(
        `INSERT INTO attachments (entity_type, entity_id, file_name, file_type)
         VALUES (${escSql(docEntityType)}, ${docEntityId}, ${escSql(docFileName)}, ${escSql(docFileType)})`
      );
      setShowDocForm(false);
      setDocFileName(''); setDocEntityId(0);
      loadData();
    } catch (err) {
      console.error('Failed to save document:', err);
    }
  }

  async function deleteAttachment(id: number) {
    try {
      await window.tasklet.sqlQuery(`DELETE FROM attachments WHERE id = ${id}`);
      loadData();
    } catch (err) {
      console.error('Failed to delete attachment:', err);
    }
  }

  const filteredBatches = batches.filter(b =>
    !search || b.batch_number.toLowerCase().includes(search.toLowerCase()) ||
    (b.project_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const filteredDocs = attachments.filter(a =>
    !search || a.file_name.toLowerCase().includes(search.toLowerCase()) ||
    (a.entity_label || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center h-full"><span className="loading loading-spinner loading-lg text-primary" /></div>;

  const docTypeLabels: Record<string, string> = {
    coa: 'Certificate of Analysis', sds: 'Safety Data Sheet', spec_sheet: 'Spec Sheet',
    test_report: 'Test Report', certificate: 'Certificate', formula_doc: 'Formula Doc', contract: 'Contract',
  };

  const entityTypeOptions = [
    { value: 'inventory', label: 'Ingredient' },
    { value: 'supplier', label: 'Supplier' },
    { value: 'batch', label: 'Batch' },
    { value: 'production_project', label: 'Production Project' },
  ];

  function getEntityOptions() {
    if (docEntityType === 'inventory') return inventoryItems.map(i => ({ id: i.id, label: i.ingredient_name }));
    if (docEntityType === 'supplier') return [];  // Would need supplier list
    if (docEntityType === 'batch') return batches.map(b => ({ id: b.id, label: b.batch_number }));
    if (docEntityType === 'production_project') return projects.map(p => ({ id: p.id, label: p.project_name }));
    return [];
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><Shield size={24} className="text-primary" /> Compliance & Traceability</h2>
          <p className="text-sm text-base-content/50">Track batches, lot numbers, and compliance documents</p>
        </div>
      </div>

      {/* Tabs and Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="tabs tabs-boxed">
          <a className={`tab ${tab === 'batches' ? 'tab-active' : ''}`} onClick={() => setTab('batches')}>
            <ClipboardList size={14} className="mr-1" /> Production Batches ({batches.length})
          </a>
          <a className={`tab ${tab === 'documents' ? 'tab-active' : ''}`} onClick={() => setTab('documents')}>
            <FileText size={14} className="mr-1" /> Documents ({attachments.length})
          </a>
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30" />
          <input className="input input-sm input-bordered pl-8 w-48" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {tab === 'batches' && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowBatchForm(true)}><Plus size={14} /> Record Batch</button>
        )}
        {tab === 'documents' && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowDocForm(true)}><Plus size={14} /> Add Document</button>
        )}
      </div>

      {/* Batches Tab */}
      {tab === 'batches' && (
        <div className="space-y-3">
          {filteredBatches.length === 0 ? (
            <div className="text-center py-16 card bg-base-200">
              <ClipboardList size={48} className="mx-auto text-base-content/20 mb-3" />
              <p className="text-base-content/50">No production batches recorded yet.</p>
              <p className="text-xs text-base-content/30 mt-1">Record batches to track ingredient lot numbers and traceability.</p>
            </div>
          ) : filteredBatches.map(batch => (
            <div key={batch.id} className="card bg-base-200">
              <div className="card-body p-4">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggleBatch(batch.id)}>
                  {batch.expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{batch.batch_number}</span>
                      <span className="badge badge-sm badge-primary">{batch.project_name}</span>
                    </div>
                    <p className="text-xs text-base-content/50">
                      {batch.customer_name} · Produced: {formatDate(batch.production_date)} · {batch.ingredients.length} ingredients
                    </p>
                  </div>
                </div>

                {batch.expanded && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="table table-xs">
                      <thead>
                        <tr>
                          <th>Ingredient</th>
                          <th>Supplier</th>
                          <th>Our Lot #</th>
                          <th>Supplier Lot #</th>
                          <th className="text-right">Amount (g)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batch.ingredients.map(ing => (
                          <tr key={ing.id}>
                            <td className="font-medium">{ing.ingredient_name}</td>
                            <td className="text-base-content/60">{ing.supplier_name || '—'}</td>
                            <td><span className="badge badge-xs badge-ghost">{ing.lot_number || '—'}</span></td>
                            <td><span className="badge badge-xs badge-ghost">{ing.supplier_lot_number || '—'}</span></td>
                            <td className="text-right">{Number(ing.amount_used_grams || 0).toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {batch.notes && <p className="text-xs text-base-content/50 mt-2 italic">{batch.notes}</p>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Documents Tab */}
      {tab === 'documents' && (
        <div className="card bg-base-200">
          <div className="card-body p-4">
            {filteredDocs.length === 0 ? (
              <div className="text-center py-16">
                <FileText size={48} className="mx-auto text-base-content/20 mb-3" />
                <p className="text-base-content/50">No compliance documents attached yet.</p>
                <p className="text-xs text-base-content/30 mt-1">Attach COA, SDS, spec sheets, and test reports to ingredients, suppliers, or batches.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Type</th>
                      <th>Linked To</th>
                      <th>Entity</th>
                      <th>Date</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocs.map(doc => (
                      <tr key={doc.id} className="hover">
                        <td className="font-medium flex items-center gap-2"><FileText size={14} className="text-primary" /> {doc.file_name}</td>
                        <td><span className="badge badge-sm badge-info">{docTypeLabels[doc.file_type] || doc.file_type}</span></td>
                        <td className="text-base-content/60 capitalize">{doc.entity_type.replace('_', ' ')}</td>
                        <td>{doc.entity_label || '—'}</td>
                        <td className="text-base-content/50">{formatDate(doc.uploaded_at)}</td>
                        <td>
                          <button className="btn btn-ghost btn-xs text-error" onClick={() => deleteAttachment(doc.id)}><Trash2 size={12} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Batch Form Modal */}
      {showBatchForm && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg mb-4">Record Production Batch</h3>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="form-control">
                <label className="label"><span className="label-text text-xs">Production Project *</span></label>
                <select className="select select-bordered select-sm" value={batchProjectId} onChange={e => setBatchProjectId(Number(e.target.value))}>
                  <option value={0}>Select project...</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                </select>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text text-xs">Batch Number *</span></label>
                <input className="input input-bordered input-sm" placeholder="e.g. BATCH-2026-001" value={batchNumber} onChange={e => setBatchNumber(e.target.value)} />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text text-xs">Production Date</span></label>
                <input type="date" className="input input-bordered input-sm" value={batchDate} onChange={e => setBatchDate(e.target.value)} />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text text-xs">Notes</span></label>
                <input className="input input-bordered input-sm" value={batchNotes} onChange={e => setBatchNotes(e.target.value)} />
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">Ingredients Used</span>
                <button className="btn btn-ghost btn-xs" onClick={addBatchIngredient}><Plus size={12} /> Add Ingredient</button>
              </div>
              {batchIngredients.length === 0 && <p className="text-xs text-base-content/40">No ingredients added. Click "Add Ingredient" to track lot traceability.</p>}
              {batchIngredients.map((ing, idx) => (
                <div key={idx} className="grid grid-cols-5 gap-2 mb-2 items-end">
                  <div className="form-control">
                    {idx === 0 && <label className="label"><span className="label-text text-xs">Ingredient</span></label>}
                    <select className="select select-bordered select-xs" value={ing.inventory_id} onChange={e => updateBatchIngredient(idx, 'inventory_id', Number(e.target.value))}>
                      <option value={0}>Select...</option>
                      {inventoryItems.map(i => <option key={i.id} value={i.id}>{i.ingredient_name}</option>)}
                    </select>
                  </div>
                  <div className="form-control">
                    {idx === 0 && <label className="label"><span className="label-text text-xs">Our Lot #</span></label>}
                    <input className="input input-bordered input-xs" placeholder="Lot #" value={ing.lot_number} onChange={e => updateBatchIngredient(idx, 'lot_number', e.target.value)} />
                  </div>
                  <div className="form-control">
                    {idx === 0 && <label className="label"><span className="label-text text-xs">Supplier Lot #</span></label>}
                    <input className="input input-bordered input-xs" placeholder="Supplier lot" value={ing.supplier_lot} onChange={e => updateBatchIngredient(idx, 'supplier_lot', e.target.value)} />
                  </div>
                  <div className="form-control">
                    {idx === 0 && <label className="label"><span className="label-text text-xs">Amount (g)</span></label>}
                    <input type="number" className="input input-bordered input-xs" value={ing.amount_grams || ''} onChange={e => updateBatchIngredient(idx, 'amount_grams', Number(e.target.value))} />
                  </div>
                  <button className="btn btn-ghost btn-xs text-error" onClick={() => removeBatchIngredient(idx)}><Trash2 size={12} /></button>
                </div>
              ))}
            </div>

            <div className="modal-action">
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowBatchForm(false); setBatchIngredients([]); }}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={saveBatch} disabled={!batchProjectId || !batchNumber}>Save Batch</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowBatchForm(false)} />
        </div>
      )}

      {/* Document Form Modal */}
      {showDocForm && (
        <div className="modal modal-open">
          <div className="modal-box max-w-md">
            <h3 className="font-bold text-lg mb-4">Add Compliance Document</h3>
            <div className="space-y-3">
              <div className="form-control">
                <label className="label"><span className="label-text text-xs">Document Name *</span></label>
                <input className="input input-bordered input-sm" placeholder="e.g. Hyaluronic Acid COA Batch 2026-01" value={docFileName} onChange={e => setDocFileName(e.target.value)} />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text text-xs">Document Type</span></label>
                <select className="select select-bordered select-sm" value={docFileType} onChange={e => setDocFileType(e.target.value)}>
                  {Object.entries(docTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="form-control">
                  <label className="label"><span className="label-text text-xs">Link To *</span></label>
                  <select className="select select-bordered select-sm" value={docEntityType} onChange={e => { setDocEntityType(e.target.value); setDocEntityId(0); }}>
                    {entityTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text text-xs">Entity *</span></label>
                  <select className="select select-bordered select-sm" value={docEntityId} onChange={e => setDocEntityId(Number(e.target.value))}>
                    <option value={0}>Select...</option>
                    {getEntityOptions().map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost btn-sm" onClick={() => setShowDocForm(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={saveDocument} disabled={!docEntityId || !docFileName}>Save Document</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowDocForm(false)} />
        </div>
      )}
    </div>
  );
};
