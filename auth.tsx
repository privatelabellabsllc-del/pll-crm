import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiRequest, apiGet, setToken } from './api';

interface User {
  id: number;
  username: string;
  display_name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, display_name: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('pll_token');
    if (token) {
      apiGet('/api/auth/me')
        .then((data) => setUser(data.user))
        .catch(() => { setToken(null); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function login(username: string, password: string) {
    const data = await apiRequest('/api/auth/login', { username, password });
    setToken(data.token);
    setUser(data.user);
  }

  async function register(username: string, password: string, display_name: string) {
    const data = await apiRequest('/api/auth/register', { username, password, display_name });
    setToken(data.token);
    setUser(data.user);
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function LoginScreen() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        await register(username, password, displayName);
      } else {
        await login(username, password);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <div className="card w-96 bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-center justify-center text-2xl mb-2">🧪 PLL CRM</h2>
          <p className="text-center text-sm opacity-70 mb-4">Private Label Labs Manufacturing</p>

          <form onSubmit={handleSubmit}>
            <div className="space-y-3">
              <div>
                <label className="label"><span className="label-text">Username</span></label>
                <input className="input input-bordered w-full" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" required />
              </div>

              {isRegister && (
                <div>
                  <label className="label"><span className="label-text">Display Name</span></label>
                  <input className="input input-bordered w-full" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
                </div>
              )}

              <div>
                <label className="label"><span className="label-text">Password</span></label>
                <input className="input input-bordered w-full" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
              </div>

              {error && <div className="alert alert-error text-sm py-2"><span>{error}</span></div>}

              <button className="btn btn-primary w-full" type="submit" disabled={loading}>
                {loading ? <span className="loading loading-spinner loading-sm" /> : (isRegister ? 'Create Account' : 'Sign In')}
              </button>
            </div>
          </form>

          <div className="text-center mt-2">
            <button className="btn btn-ghost btn-sm" onClick={() => { setIsRegister(!isRegister); setError(''); }}>
              {isRegister ? 'Already have an account? Sign in' : 'Create an account'}
            </button>
          </div>

          {!isRegister && (
            <p className="text-center text-xs opacity-50 mt-2">Default: admin / admin123</p>
          )}
        </div>
      </div>
    </div>
  );
}
