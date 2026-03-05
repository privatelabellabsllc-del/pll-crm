const API_URL = import.meta.env.VITE_API_URL || '';

function getToken(): string | null {
  return localStorage.getItem('pll_token');
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem('pll_token', token);
  } else {
    localStorage.removeItem('pll_token');
  }
}

export async function apiRequest(endpoint: string, body?: any) {
  const token = getToken();
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export async function apiGet(endpoint: string) {
  const token = getToken();
  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

// This replaces window.tasklet.sqlQuery - returns array of rows
async function sqlQuery(query: string, params: any[] = []): Promise<any[]> {
  const data = await apiRequest('/api/sql', { query, params });
  return data.rows || [];
}

// This replaces window.tasklet.sqlExec - executes write operations
async function sqlExec(query: string, params: any[] = []): Promise<{ lastInsertRowid?: number; changes?: number }> {
  const data = await apiRequest('/api/sql', { query, params });
  return { lastInsertRowid: data.lastInsertRowid, changes: data.changes };
}

// Install on window.tasklet so components work without changes
(window as any).tasklet = {
  sqlQuery,
  sqlExec,
};

export { sqlQuery, sqlExec };
