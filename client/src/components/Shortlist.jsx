import { useState } from 'react';
import { api } from '../api.js';

function ShortlistItem({ slug, item, script, onRemove, onUpdate, onPick, picked }) {
  const [note, setNote] = useState(item.note || '');
  const [audioUrl, setAudioUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function play() {
    setBusy(true);
    setError('');
    try {
      const { audio_url } = await api.generate(slug, item.voice_id, script);
      setAudioUrl(audio_url + '?t=' + Date.now());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveNote() {
    if (note === item.note) return;
    await api.updateShortlist(slug, item.id, { note });
    onUpdate({ ...item, note });
  }

  const tags = item.voice_meta
    ? [item.voice_meta.gender, item.voice_meta.age, item.voice_meta.accent].filter(Boolean)
    : [];

  return (
    <div className={`card p-4 space-y-3 ${picked ? 'ring-2 ring-accent' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium">{item.voice_name}</div>
          <div className="text-xs text-zinc-500 capitalize">{item.voice_source}</div>
        </div>
        <button onClick={() => onRemove(item.id)} className="text-xs text-zinc-500 hover:text-red-400">
          remove
        </button>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((t, i) => (
            <span key={i} className="chip capitalize">{String(t).replace(/_/g, ' ')}</span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={play} disabled={busy} className="btn-secondary flex-1">
          {busy ? 'generating…' : audioUrl ? 'regenerate' : 'play with current script'}
        </button>
        <button onClick={() => onPick(item)} className="btn-ghost border border-ink-700" title="use in generator above">
          ↑
        </button>
      </div>

      {error && <div className="text-xs text-red-400">{error}</div>}

      {audioUrl && <audio key={audioUrl} controls autoPlay src={audioUrl} />}

      <textarea
        className="input text-sm min-h-[60px]"
        placeholder="notes (client feedback, why we like it, etc.)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={saveNote}
      />
    </div>
  );
}

export default function Shortlist({ slug, items, script, onChange, onPick, picked }) {
  async function remove(id) {
    await api.removeFromShortlist(slug, id);
    onChange(items.filter((x) => x.id !== id));
  }

  function update(updated) {
    onChange(items.map((x) => (x.id === updated.id ? updated : x)));
  }

  if (items.length === 0) {
    return (
      <div className="text-center text-zinc-500 text-sm py-8 border border-dashed border-ink-700 rounded-xl">
        no voices on the shortlist yet · search and add candidates
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {items.map((item) => (
        <ShortlistItem
          key={item.id}
          slug={slug}
          item={item}
          script={script}
          onRemove={remove}
          onUpdate={update}
          onPick={(it) => onPick({ voice_id: it.voice_id, name: it.voice_name, source: it.voice_source })}
          picked={picked && picked.voice_id === item.voice_id}
        />
      ))}
    </div>
  );
}
