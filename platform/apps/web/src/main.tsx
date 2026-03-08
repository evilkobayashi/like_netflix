import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import './styles.css';

type AuthState = { accessToken: string; tenantId: string };
const AUTH_KEY = 'platform_auth';
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:3000';

const pages = ['Dashboard', 'Users', 'Roles', 'Permissions', 'Groups', 'Workflow Templates', 'Workflow Executions', 'Approval Requests', 'Automation Rules', 'Automation Executions', 'Notifications', 'Audit Logs', 'Reports', 'Settings'];
const client = new QueryClient();

function readAuth(): AuthState | null {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthState;
  } catch {
    return null;
  }
}

function saveAuth(state: AuthState): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(state));
}

function clearAuth(): void {
  localStorage.removeItem(AUTH_KEY);
}

function LoginPage({ onAuth }: { onAuth: (auth: AuthState) => void }): React.ReactElement {
  const navigate = useNavigate();
  const [tenantId, setTenantId] = useState('demo-tenant');
  const [email, setEmail] = useState('admin@demo.local');
  const [password, setPassword] = useState('Password123!');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tenantId, email, password })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? 'Login failed');
      }
      const payload = (await response.json()) as { accessToken: string };
      const auth = { accessToken: payload.accessToken, tenantId };
      saveAuth(auth);
      onAuth(auth);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className='login-card'>
      <h1>Login</h1>
      <p className='hint'>Demo credentials are pre-filled for local development.</p>
      <form onSubmit={onSubmit} className='form-grid'>
        <label>Tenant ID<input value={tenantId} onChange={(e) => setTenantId(e.target.value)} required /></label>
        <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Password<input type='password' value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error ? <p className='error'>{error}</p> : null}
        <button type='submit' disabled={submitting}>{submitting ? 'Signing in...' : 'Sign in'}</button>
      </form>
    </div>
  );
}

function DashboardOverview({ auth }: { auth: AuthState }): React.ReactElement {
  const overview = useQuery({
    queryKey: ['overview'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/dashboard/overview`, {
        headers: { authorization: `Bearer ${auth.accessToken}` }
      });
      if (!response.ok) throw new Error('Unable to load dashboard overview');
      return (await response.json()) as { activeUsers: number; pendingApprovals: number; automationSuccessRate: number };
    }
  });

  const chartData = useMemo(() => {
    const v = overview.data;
    if (!v) return [{ name: 'Active Users', value: 0 }, { name: 'Pending Approvals', value: 0 }, { name: 'Automation', value: 0 }];
    return [
      { name: 'Active Users', value: v.activeUsers },
      { name: 'Pending Approvals', value: v.pendingApprovals },
      { name: 'Automation', value: v.automationSuccessRate }
    ];
  }, [overview.data]);

  if (overview.isLoading) return <p>Loading dashboard...</p>;
  if (overview.isError) return <p className='error'>Failed to load dashboard.</p>;

  return (
    <>
      <div className='kpis'>
        <div><h3>Active Users</h3><strong>{overview.data?.activeUsers ?? 0}</strong></div>
        <div><h3>Pending Approvals</h3><strong>{overview.data?.pendingApprovals ?? 0}</strong></div>
        <div><h3>Automation Success</h3><strong>{overview.data?.automationSuccessRate ?? 0}</strong></div>
      </div>
      <div style={{ width: 560, height: 260 }}>
        <ResponsiveContainer>
          <LineChart data={chartData}>
            <XAxis dataKey='name' />
            <YAxis />
            <Tooltip />
            <Line type='monotone' dataKey='value' stroke='#4f46e5' />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

function Page({ title, auth }: { title: string; auth: AuthState }): React.ReactElement {
  if (title === 'Dashboard') return <div><h1>Dashboard</h1><DashboardOverview auth={auth} /></div>;
  return <div><h1>{title}</h1></div>;
}

function Shell({ auth, onLogout }: { auth: AuthState; onLogout: () => void }): React.ReactElement {
  return (
    <div className='layout'>
      <aside>
        <div className='aside-top'>
          <h2>Ops Console</h2>
          <p>{auth.tenantId}</p>
        </div>
        {pages.map((p) => <Link key={p} to={p === 'Dashboard' ? '/' : `/${p.toLowerCase().replace(/ /g, '-')}`}>{p}</Link>)}
        <button className='ghost' onClick={onLogout}>Logout</button>
      </aside>
      <main>
        <Routes>
          {pages.map((p) => <Route key={p} path={p === 'Dashboard' ? '/' : `/${p.toLowerCase().replace(/ /g, '-')}`} element={<Page title={p} auth={auth} />} />)}
          <Route path='*' element={<Navigate to='/' replace />} />
        </Routes>
      </main>
    </div>
  );
}

function App(): React.ReactElement {
  const [auth, setAuth] = useState<AuthState | null>(readAuth());
  const logout = (): void => {
    clearAuth();
    setAuth(null);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path='/login' element={auth ? <Navigate to='/' replace /> : <LoginPage onAuth={setAuth} />} />
        <Route path='/*' element={auth ? <Shell auth={auth} onLogout={logout} /> : <Navigate to='/login' replace />} />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={client}>
    <App />
  </QueryClientProvider>
);
