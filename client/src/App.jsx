import { Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home.jsx';
import ProjectPage from './pages/ProjectPage.jsx';
import ScriptPage from './pages/ScriptPage.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import AdminProjects from './pages/AdminProjects.jsx';

export default function App() {
  return (
    <div className="min-h-full">
      <header className="border-b border-ink-800 bg-ink-950/70 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="h-display text-xl font-semibold text-zinc-100">
            voice<span className="text-accent">.</span>
          </Link>
          <Link to="/admin" className="text-sm text-zinc-400 hover:text-zinc-100">
            admin
          </Link>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/c/:slug" element={<ProjectPage />} />
          <Route path="/c/:slug/script/:voice_id" element={<ScriptPage />} />
          <Route path="/admin" element={<AdminProjects />} />
          <Route path="/admin/login" element={<AdminLogin />} />
        </Routes>
      </main>
      <footer className="max-w-6xl mx-auto px-6 py-6 text-xs text-zinc-500">
        powered by elevenlabs · voice.co-l.in
      </footer>
    </div>
  );
}
