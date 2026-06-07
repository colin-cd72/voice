import { useState } from 'react';
import { api } from '../api.js';

export default function GenerateBox({ slug, picked, script, setScript, onAddToShortlist, isOnShortlist }) {
  const [audioUrl, setAudioUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function generate() {
    if (!picked) {
      setError('pick a voice first');
      return;
    }
    if (!script.trim()) {
      setError('script is empty');
      return;
    }
    setBusy(true);
    setError('');
    setAudioUrl(null);
    try {
      const { audio_url } = await api.generate(slug, picked.voice_id, script);
      setAudioUrl(audio_url + '?t=' + Date.now());
    } catch (err) {
      setError(err.message + (err.detail ? ` — ${err.detail}` : ''));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="h-display text-xl">generate sample</h2>
          <p className="text-xs text-zinc-500 mt-1">
            {picked ? (
              <>using <span className="text-accent">{picked.name}</span> · {picked.source}</>
            ) : (
              'pick a voice below first'
            )}
          </p>
        </div>
        {picked && onAddToShortlist && (
          <button
            onClick={() => onAddToShortlist(picked)}
            disabled={isOnShortlist}
            className="btn-ghost border border-ink-700 whitespace-nowrap"
          >
            {isOnShortlist ? '✓ on shortlist' : '+ add to shortlist'}
          </button>
        )}
      </div>

      <textarea
        className="input min-h-[110px]"
        placeholder="paste or edit the voiceover script…"
        value={script}
        onChange={(e) => setScript(e.target.value)}
      />

      <div className="flex items-center gap-3">
        <button onClick={generate} disabled={busy || !picked} className="btn-primary">
          {busy ? 'generating…' : 'generate'}
        </button>
        <span className="text-xs text-zinc-500">{script.length}/1000 chars</span>
      </div>

      {error && <div className="text-sm text-red-400">{error}</div>}

      {audioUrl && (
        <div className="space-y-2">
          <audio key={audioUrl} controls autoPlay src={audioUrl} />
          <a href={audioUrl} download className="text-xs text-zinc-400 hover:text-zinc-100 underline">
            download mp3
          </a>
        </div>
      )}
    </div>
  );
}
