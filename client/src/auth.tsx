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
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f5f5f7' }}>
      <div className="animate-in w-full max-w-sm mx-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mx-auto mb-4" style={{ boxShadow: '0 8px 24px rgba(0, 122, 255, 0.3)' }}>
            <span className="text-white text-2xl font-bold">P</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ letterSpacing: '-0.03em' }}>PLL CRM</h1>
          <p className="text-sm text-gray-400 mt-1">Private Label Labs Manufacturing</p>
        </div>

        {/* Card */}
        <div className="glass-card p-8" style={{ background: 'rgba(255,255,255,0.9)' }}>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1">Username</label>
                <input
                  className="input input-bordered w-full h-11"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  required
                />
              </div>

              {isRegister && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1">Display Name</label>
                  <input
                    className="input input-bordered w-full h-11"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1">Password</label>
                <input
                  className="input input-bordered w-full h-11"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                />
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm py-2.5 px-4 rounded-xl">
                  {error}
                </div>
              )}

              <button
                className="btn btn-primary w-full h-11 text-white font-medium"
                type="submit"
                disabled={loading}
              >
                {loading ? <span className="loading loading-spinner loading-sm" /> : (isRegister ? 'Create Account' : 'Sign In')}
              </button>
            </div>
          </form>

          <div className="text-center mt-4">
            <button
              className="text-sm text-blue-500 hover:text-blue-600 font-medium transition-colors"
              onClick={() => { setIsRegister(!isRegister); setError(''); }}
            >
              {isRegister ? 'Already have an account? Sign in' : 'Create an account'}
            </button>
          </div>
        </div>

        {!isRegister && (
          <p className="text-center text-xs text-gray-300 mt-4">Default: admin / admin123</p>
        )}
      </div>
    </div>
  );
}
