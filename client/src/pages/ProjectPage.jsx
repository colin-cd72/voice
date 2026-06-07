import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import VoiceSearch from '../components/VoiceSearch.jsx';
import GenerateBox from '../components/GenerateBox.jsx';
import Shortlist from '../components/Shortlist.jsx';

export default function ProjectPage() {
  const { slug } = useParams();
  const [project, setProject] = useState(null);
  const [shortlist, setShortlist] = useState([]);
  const [script, setScript] = useState('');
  const [picked, setPicked] = useState(null);
  const [mode, setMode] = useState('library');
  const [error, setError] = useState('');

  useEffect(() => {
    api.getProject(slug)
      .then((data) => {
        setProject(data.project);
        setShortlist(data.shortlist);
        setScript(data.project.default_script || '');
      })
      .catch((err) => setError(err.message));
  }, [slug]);

  const shortlistVoiceIds = useMemo(() => new Set(shortlist.map((x) => x.voice_id)), [shortlist]);

  async function handleAdd(voice) {
    try {
      const { shortlist: updated } = await api.addToShortlist(slug, {
        voice_id: voice.voice_id,
        voice_name: voice.name,
        voice_source: voice.source,
        voice_meta: voice.labels || null,
      });
      setShortlist(updated);
    } catch (err) {
      if (err.status === 409) return;
      setError(err.message);
    }
  }

  if (error) {
    return (
      <div className="card p-6 text-zinc-300">
        <div className="text-red-400 mb-2">error: {error}</div>
        <p className="text-sm text-zinc-500">double-check the project link</p>
      </div>
    );
  }
  if (!project) return <div className="text-zinc-400">loading…</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="h-display text-3xl">{project.name}</h1>
          <p className="text-sm text-zinc-500">voice samples · {slug}</p>
        </div>
        <Link to={`/c/${slug}/script`} className="btn-primary">
          final script page →
        </Link>
      </div>

      <GenerateBox
        slug={slug}
        picked={picked}
        script={script}
        setScript={setScript}
        onAddToShortlist={handleAdd}
        isOnShortlist={picked && shortlistVoiceIds.has(picked.voice_id)}
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="h-display text-xl">shortlist</h2>
          <span className="text-xs text-zinc-500">{shortlist.length} voice{shortlist.length === 1 ? '' : 's'}</span>
        </div>
        <Shortlist
          slug={slug}
          items={shortlist}
          script={script}
          onChange={setShortlist}
          onPick={(v) => setPicked({ voice_id: v.voice_id, name: v.name, source: v.source })}
          picked={picked}
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="h-display text-xl">find voices</h2>
          <div className="flex gap-1 bg-ink-800 rounded-lg p-1 border border-ink-700">
            <button
              onClick={() => setMode('library')}
              className={`px-3 py-1 text-sm rounded ${mode === 'library' ? 'bg-ink-700 text-zinc-100' : 'text-zinc-400'}`}
            >
              public library
            </button>
            <button
              onClick={() => setMode('account')}
              className={`px-3 py-1 text-sm rounded ${mode === 'account' ? 'bg-ink-700 text-zinc-100' : 'text-zinc-400'}`}
            >
              my voices
            </button>
          </div>
        </div>
        <VoiceSearch
          slug={slug}
          mode={mode}
          onPick={(v) => setPicked({ voice_id: v.voice_id, name: v.name, source: v.source })}
          picked={picked}
          onAddToShortlist={handleAdd}
          shortlistVoiceIds={shortlistVoiceIds}
        />
      </section>
    </div>
  );
}
