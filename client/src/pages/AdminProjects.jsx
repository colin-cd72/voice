import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function AdminProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [script, setScript] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    try {
      const { admin } = await api.me();
      if (!admin) {
        navigate('/admin/login');
        return;
      }
      const data = await api.adminListProjects();
      setProjects(data.projects);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e) {
    e.preventDefault();
    setError('');
    try {
      const { project } = await api.adminCreateProject(name, script);
      setProjects((p) => [project, ...p]);
      setName('');
      setScript('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(slug) {
    if (!confirm(`Delete project ${slug}? This removes the shortlist too.`)) return;
    await api.adminDeleteProject(slug);
    setProjects((p) => p.filter((x) => x.slug !== slug));
  }

  async function logout() {
    await api.logout();
    navigate('/admin/login');
  }

  if (loading) return <div className="text-zinc-400">loading…</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="h-display text-3xl">projects</h1>
        <button onClick={logout} className="btn-ghost">log out</button>
      </div>

      <section className="card p-5 space-y-3">
        <h2 className="h-display text-lg">new project</h2>
        <form onSubmit={create} className="space-y-3">
          <input
            className="input"
            placeholder="project name (e.g. Acme Annual Summit)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <textarea
            className="input min-h-[100px]"
            placeholder="default script (the voiceover text — clients can still edit per-generation)"
            value={script}
            onChange={(e) => setScript(e.target.value)}
          />
          {error && <div className="text-sm text-red-400">{error}</div>}
          <button className="btn-primary">create project</button>
        </form>
      </section>

      <section className="space-y-2">
        <h2 className="h-display text-lg">existing</h2>
        {projects.length === 0 && <div className="text-zinc-500 text-sm">no projects yet</div>}
        <ul className="space-y-2">
          {projects.map((p) => (
            <li key={p.id} className="card p-4 flex items-center justify-between">
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-zinc-500">/c/{p.slug}</div>
              </div>
              <div className="flex gap-2">
                <Link to={`/c/${p.slug}`} className="btn-secondary">open</Link>
                <button onClick={() => remove(p.slug)} className="btn-ghost text-red-400 hover:bg-red-500/10">delete</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
