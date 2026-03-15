import { useState, useEffect } from 'react';

export default function BackupRestore() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const token = localStorage.getItem('token');

  const headers = { 'Authorization': `Bearer ${token}` };

  useEffect(() => { loadStats(); }, []);

  async function loadStats() {
    try {
      const res = await fetch('/api/backup/stats', { headers });
      const data = await res.json();
      setStats(data);
    } catch (e) { console.error(e); }
  }

  async function downloadBackup() {
    setLoading(true);
    setMessage({ type: 'info', text: 'Preparing backup...' });
    try {
      const res = await fetch('/api/backup', { headers });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pll-crm-backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: 'Backup downloaded successfully!' });
    } catch (e: any) {
      setMessage({ type: 'error', text: 'Backup failed: ' + e.message });
    }
    setLoading(false);
  }

  async function uploadRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('⚠️ This will REPLACE all current data with the backup. Are you sure?')) {
      e.target.value = '';
      return;
    }

    setLoading(true);
    setMessage({ type: 'info', text: 'Restoring data...' });
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/restore', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData });
      const data = await res.json();
      
      if (data.success) {
        const summary = data.restored.map((r: any) => `${r.table}: ${r.count}`).join(', ');
        setMessage({ type: 'success', text: `Restored successfully! ${summary}` });
        loadStats();
      } else {
        setMessage({ type: 'error', text: data.error || 'Restore failed' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Restore failed: ' + err.message });
    }
    e.target.value = '';
    setLoading(false);
  }

  async function saveSeed() {
    setLoading(true);
    setMessage({ type: 'info', text: 'Saving seed file on server...' });
    try {
      const res = await fetch('/api/backup/save-seed', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' } });
      const data = await res.json();
      setMessage({ type: data.success ? 'success' : 'error', text: data.message });
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    }
    setLoading(false);
  }

  const tableLabels: Record<string, string> = {
    customers: 'Customers',
    sales_projects: 'Sales Deals',
    production_projects: 'Production Jobs',
    inventory: 'Inventory Items',
    suppliers: 'Suppliers',
    purchase_orders: 'Purchase Orders',
    formulas: 'Formulas',
    formula_ingredients: 'Formula Ingredients',
    production_batches: 'Production Batches',
    batch_ingredients: 'Batch Ingredients',
    attachments: 'Attachments'
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        💾 Backup & Restore
      </h1>
      <p style={{ color: '#6b7280', marginBottom: '2rem', lineHeight: 1.6 }}>
        Download your data before deploying updates. Restore it after redeployment, or include the seed file to auto-restore on startup.
      </p>

      {/* Status Message */}
      {message && (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: '0.75rem',
          marginBottom: '1.5rem',
          fontSize: '0.875rem',
          fontWeight: 500,
          background: message.type === 'success' ? '#ecfdf5' : message.type === 'error' ? '#fef2f2' : '#eff6ff',
          color: message.type === 'success' ? '#065f46' : message.type === 'error' ? '#991b1b' : '#1e40af',
          border: `1px solid ${message.type === 'success' ? '#a7f3d0' : message.type === 'error' ? '#fecaca' : '#bfdbfe'}`
        }}>
          {message.text}
        </div>
      )}

      {/* Data Overview Card */}
      <div style={{
        background: 'white',
        borderRadius: '1rem',
        border: '1px solid #e5e7eb',
        padding: '1.5rem',
        marginBottom: '1.5rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          📊 Current Data Overview
          <span style={{
            background: '#dbeafe', color: '#1d4ed8', padding: '0.125rem 0.5rem',
            borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600
          }}>
            {stats?.totalRows ?? '...'} total rows
          </span>
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem' }}>
          {stats && Object.entries(stats.stats).map(([table, count]: any) => (
            <div key={table} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.5rem 0.75rem', background: '#f9fafb', borderRadius: '0.5rem', fontSize: '0.8125rem'
            }}>
              <span style={{ color: '#374151' }}>{tableLabels[table] || table}</span>
              <span style={{ fontWeight: 600, color: count > 0 ? '#059669' : '#9ca3af' }}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Action Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Download Backup */}
        <div style={{
          background: 'white', borderRadius: '1rem', border: '1px solid #e5e7eb',
          padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⬇️</div>
          <h3 style={{ fontWeight: 600, marginBottom: '0.375rem' }}>Download Backup</h3>
          <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '1rem', lineHeight: 1.5 }}>
            Save all your data as a JSON file. Do this before every deploy!
          </p>
          <button
            onClick={downloadBackup}
            disabled={loading}
            style={{
              width: '100%', padding: '0.625rem', borderRadius: '0.75rem', border: 'none',
              background: '#2563eb', color: 'white', fontWeight: 600, fontSize: '0.875rem',
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
              transition: 'all 0.2s'
            }}
          >
            {loading ? 'Working...' : 'Download Backup'}
          </button>
        </div>

        {/* Upload Restore */}
        <div style={{
          background: 'white', borderRadius: '1rem', border: '1px solid #e5e7eb',
          padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⬆️</div>
          <h3 style={{ fontWeight: 600, marginBottom: '0.375rem' }}>Restore from Backup</h3>
          <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '1rem', lineHeight: 1.5 }}>
            Upload a previously downloaded backup file to restore all data.
          </p>
          <label style={{
            display: 'block', width: '100%', padding: '0.625rem', borderRadius: '0.75rem',
            border: '2px dashed #d1d5db', background: '#f9fafb', textAlign: 'center',
            fontWeight: 600, fontSize: '0.875rem', color: '#4b5563',
            cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s'
          }}>
            {loading ? 'Working...' : 'Choose Backup File'}
            <input type="file" accept=".json" onChange={uploadRestore} disabled={loading}
              style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {/* Save Seed Card */}
      <div style={{
        background: 'linear-gradient(135deg, #fefce8, #fef9c3)', borderRadius: '1rem',
        border: '1px solid #fde68a', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        <h3 style={{ fontWeight: 600, marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          🌱 Save as Seed File
        </h3>
        <p style={{ fontSize: '0.8125rem', color: '#92400e', marginBottom: '1rem', lineHeight: 1.5 }}>
          Saves your data as <code style={{ background: '#fef3c7', padding: '0.125rem 0.375rem', borderRadius: '0.25rem' }}>data/seed-data.json</code> on the server.
          When included in your GitHub repo, the app will auto-restore this data on fresh deploys.
        </p>
        <button
          onClick={saveSeed}
          disabled={loading}
          style={{
            padding: '0.625rem 1.5rem', borderRadius: '0.75rem', border: 'none',
            background: '#d97706', color: 'white', fontWeight: 600, fontSize: '0.875rem',
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Saving...' : 'Save Seed File'}
        </button>
      </div>

      {/* How it works */}
      <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#f0fdf4', borderRadius: '1rem', border: '1px solid #bbf7d0' }}>
        <h3 style={{ fontWeight: 600, marginBottom: '0.75rem', color: '#166534' }}>🔄 How Auto-Backup Works</h3>
        <ol style={{ fontSize: '0.8125rem', color: '#15803d', lineHeight: 1.8, paddingLeft: '1.25rem', margin: 0 }}>
          <li><strong>Before deploying:</strong> Click "Download Backup" to save your data</li>
          <li><strong>Deploy your update:</strong> Push code to GitHub → Railway auto-rebuilds</li>
          <li><strong>After deploy:</strong> Upload your backup file to restore everything</li>
          <li><strong>Pro tip:</strong> Click "Save Seed File" then include <code>data/seed-data.json</code> in your GitHub push — the app will auto-restore on startup!</li>
        </ol>
      </div>
    </div>
  );
}
