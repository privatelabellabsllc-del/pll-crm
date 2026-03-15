import { useState, useRef } from 'react';

interface CsvImportProps {
  type: 'inventory' | 'customers' | 'suppliers';
  onImportComplete: () => void;
}

export default function CsvImport({ type, onImportComplete }: CsvImportProps) {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ inserted: number; errors: string[]; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/import/${type}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
      onImportComplete();
    } catch (err: any) {
      setResult({ inserted: 0, errors: [err.message], total: 0 });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const downloadTemplate = () => {
    const token = localStorage.getItem('token');
    fetch(`/api/templates/${type}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}_template.csv`;
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  return (
    <div className="flex items-center gap-2">
      <button className="btn btn-outline btn-sm gap-1" onClick={downloadTemplate}>
        📥 Template
      </button>
      <label className={`btn btn-outline btn-sm gap-1 ${importing ? 'loading' : ''}`}>
        📤 Import CSV
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleImport}
          disabled={importing}
        />
      </label>
      {result && (
        <div className={`text-sm ${result.errors.length > 0 ? 'text-warning' : 'text-success'}`}>
          ✅ {result.inserted}/{result.total} imported
          {result.errors.length > 0 && (
            <span className="ml-1 tooltip tooltip-bottom" data-tip={result.errors.join('\n')}>
              ⚠️ {result.errors.length} errors
            </span>
          )}
        </div>
      )}
    </div>
  );
}
