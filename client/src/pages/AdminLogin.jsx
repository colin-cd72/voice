import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.login(password);
      navigate('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto card p-6 mt-12">
      <h1 className="h-display text-2xl mb-4">admin login</h1>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="password"
          autoFocus
          className="input"
          placeholder="admin password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <div className="text-sm text-red-400">{error}</div>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? 'signing in…' : 'sign in'}
        </button>
      </form>
    </div>
  );
}
