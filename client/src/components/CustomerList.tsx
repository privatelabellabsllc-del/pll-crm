import React, { useEffect, useState } from 'react';
import { Plus, Search, Star, Mail, Phone, Building2, Users as UsersIcon } from 'lucide-react';
import CsvImport from './CsvImport';
import { Customer } from '../types';
import { formatCurrency, priorityColor, timeAgo } from '../utils/helpers';

interface CustomerListProps {
  onAddCustomer: () => void;
  onSelectCustomer: (id: number) => void;
  onEditCustomer: (customer: Customer) => void;
}

export const CustomerList: React.FC<CustomerListProps> = ({ onAddCustomer, onSelectCustomer, onEditCustomer }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    try {
      const rows = await window.tasklet.sqlQuery("SELECT * FROM customers ORDER BY updated_at DESC");
      setCustomers(rows as unknown as Customer[]);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = customers.filter((c) => {
    const matchesSearch = !search || 
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.company_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase());
    const matchesPriority = filterPriority === 'all' || c.priority === filterPriority;
    return matchesSearch && matchesPriority;
  });

  if (loading) {
    return <div className="flex items-center justify-center h-full"><span className="loading loading-spinner loading-lg text-primary" /></div>;
  }

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">Customers</h2>
          <p className="text-sm text-base-content/50">{customers.length} total contacts</p>
        </div>
        <div className="flex items-center gap-2">
          <CsvImport type="customers" onImportComplete={loadCustomers} />
          <button className="btn btn-primary btn-sm" onClick={onAddCustomer}>
            <Plus size={16} /> Add Customer
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <label className="input input-bordered input-sm flex items-center gap-2 flex-1">
          <Search className="h-[1em] opacity-50" />
          <input type="search" className="grow" placeholder="Search customers..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <select className="select select-bordered select-sm" value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
          <option value="all">All Priority</option>
          <option value="vip">VIP</option>
          <option value="high">High Priority</option>
          <option value="normal">Normal</option>
        </select>
      </div>

      {/* Customer Table */}
      <div className="overflow-x-auto overflow-y-auto flex-1">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <UsersIcon size={48} className="mx-auto opacity-20 mb-4" />
            <p className="text-base-content/50">{customers.length === 0 ? 'No customers yet. Add your first one!' : 'No customers match your search.'}</p>
          </div>
        ) : (
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Name / Company</th>
                <th>Contact</th>
                <th>Priority</th>
                <th>Revenue</th>
                <th>Orders</th>
                <th>Added</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="hover cursor-pointer" onClick={() => onSelectCustomer(c.id)}>
                  <td>
                    <div>
                      <p className="font-medium">{c.name}</p>
                      {c.company_name && (
                        <p className="text-xs text-base-content/50 flex items-center gap-1">
                          <Building2 size={10} /> {c.company_name}
                        </p>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="space-y-0.5">
                      {c.email && <p className="text-xs flex items-center gap-1"><Mail size={10} className="opacity-50" /> {c.email}</p>}
                      {c.phone && <p className="text-xs flex items-center gap-1"><Phone size={10} className="opacity-50" /> {c.phone}</p>}
                    </div>
                  </td>
                  <td>
                    {c.priority !== 'normal' && (
                      <span className={`badge badge-xs ${priorityColor(c.priority)}`}>
                        {c.priority === 'vip' ? '⭐ VIP' : '🔥 High'}
                      </span>
                    )}
                  </td>
                  <td className="text-sm">{formatCurrency(c.total_revenue)}</td>
                  <td className="text-sm">{c.order_count}</td>
                  <td className="text-xs text-base-content/50">{timeAgo(c.created_at)}</td>
                  <td>
                    <button className="btn btn-ghost btn-xs" onClick={(e) => { e.stopPropagation(); onEditCustomer(c); }}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};


