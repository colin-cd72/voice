import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';

const MAX_LEN = 5000;

export default function ScriptPage() {
  const { slug, voice_id } = useParams();
  const [project, setProject] = useState(null);
  const [voice, setVoice] = useState(null);
  const [script, setScript] = useState('');
  const [audioUrl, setAudioUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.getProject(slug), api.getVoice(slug, voice_id)])
      .then(([p, v]) => {
        setProject(p.project);
        setVoice(v.voice);
        setScript(p.project.default_script || '');
      })
      .catch((err) => setError(err.message));
  }, [slug, voice_id]);

  async function generate() {
    if (!script.trim()) {
      setError('script is empty');
      return;
    }
    setBusy(true);
    setError('');
    setAudioUrl(null);
    try {
      const { audio_url } = await api.generate(slug, voice_id, script);
      setAudioUrl(audio_url + '?t=' + Date.now());
    } catch (err) {
      setError(err.message + (err.detail ? ` — ${err.detail}` : ''));
    } finally {
      setBusy(false);
    }
  }

  if (error && !project) {
    return (
      <div className="card p-6">
        <div className="text-red-400 mb-2">error: {error}</div>
        <Link to={`/c/${slug}`} className="text-zinc-400 hover:text-zinc-100 underline text-sm">back to project</Link>
      </div>
    );
  }
  if (!project || !voice) return <div className="text-zinc-400">loading…</div>;

  const tags = [voice.labels?.gender, voice.labels?.age, voice.labels?.accent, voice.labels?.use_case]
    .filter(Boolean);

  const downloadName = `${project.slug}-${voice.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.mp3`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link to={`/c/${slug}`} className="text-xs text-zinc-500 hover:text-zinc-100">
            ← {project.name}
          </Link>
          <h1 className="h-display text-3xl mt-1">final script</h1>
        </div>
      </div>

      <div className="card p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-zinc-500 uppercase tracking-wider">voice</div>
            <div className="font-medium text-lg mt-1">{voice.name}</div>
            <div className="text-xs text-zinc-500 capitalize mt-0.5">{voice.source}</div>
          </div>
          {voice.preview_url && (
            <div className="w-72 max-w-full">
              <div className="text-xs text-zinc-500 mb-1">voice preview</div>
              <audio controls preload="none" src={voice.preview_url} />
            </div>
          )}
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((t, i) => (
              <span key={i} className="chip capitalize">{String(t).replace(/_/g, ' ')}</span>
            ))}
          </div>
        )}
      </div>

      <div className="card p-5 space-y-4">
        <div>
          <h2 className="h-display text-xl">script</h2>
          <p className="text-xs text-zinc-500 mt-1">
            paste the full voiceover copy below — up to {MAX_LEN.toLocaleString()} characters
          </p>
        </div>

        <textarea
          className="input min-h-[260px] font-mono text-sm leading-relaxed"
          placeholder="paste or type the final script…"
          value={script}
          onChange={(e) => setScript(e.target.value.slice(0, MAX_LEN))}
        />

        <div className="flex items-center justify-between flex-wrap gap-3">
          <span className="text-xs text-zinc-500">
            {script.length.toLocaleString()} / {MAX_LEN.toLocaleString()} chars
          </span>
          <button onClick={generate} disabled={busy} className="btn-primary">
            {busy ? 'generating…' : audioUrl ? 'regenerate' : 'generate mp3'}
          </button>
        </div>

        {error && <div className="text-sm text-red-400">{error}</div>}

        {audioUrl && (
          <div className="space-y-3 pt-2 border-t border-ink-700">
            <audio key={audioUrl} controls autoPlay src={audioUrl} />
            <a
              href={audioUrl}
              download={downloadName}
              className="btn-primary w-full justify-center"
            >
              ⬇ download {downloadName}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
