import { useEffect, useState } from 'react';
import { api } from '../api.js';
import VoiceCard from './VoiceCard.jsx';

const FILTERS = {
  gender: ['', 'male', 'female', 'neutral'],
  age: ['', 'young', 'middle_aged', 'old'],
  accent: ['', 'american', 'british', 'australian', 'indian', 'irish', 'canadian'],
  use_case: ['', 'narrative_story', 'conversational', 'characters_animation', 'social_media', 'news', 'informative_educational'],
};

export default function VoiceSearch({ slug, mode, onPick, picked, onAddToShortlist, shortlistVoiceIds }) {
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState({ gender: '', age: '', accent: '', use_case: '' });
  const [voices, setVoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function runSearch() {
    setLoading(true);
    setError('');
    try {
      if (mode === 'account') {
        const data = await api.accountVoices(slug);
        setVoices(data.voices);
      } else {
        const data = await api.searchVoices(slug, { q, ...filters, page_size: 24 });
        setVoices(data.voices);
      }
    } catch (err) {
      setError(err.message);
      setVoices([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (mode === 'account') runSearch();
  }, [mode]);

  return (
    <div className="space-y-4">
      {mode === 'library' && (
        <div className="card p-4 space-y-3">
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="search the voice library (e.g. 'warm narrator', 'energetic young female')"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            />
            <button onClick={runSearch} className="btn-primary">search</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.keys(FILTERS).map((key) => (
              <select
                key={key}
                className="input"
                value={filters[key]}
                onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))}
              >
                {FILTERS[key].map((v) => (
                  <option key={v} value={v}>
                    {v ? v.replace(/_/g, ' ') : `any ${key.replace('_', ' ')}`}
                  </option>
                ))}
              </select>
            ))}
          </div>
        </div>
      )}

      {error && <div className="text-sm text-red-400">{error}</div>}
      {loading && <div className="text-sm text-zinc-400">loading…</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {voices.map((v) => (
          <VoiceCard
            key={v.voice_id + ':' + v.source}
            voice={v}
            onPick={onPick}
            picked={picked && picked.voice_id === v.voice_id}
            onAdd={onAddToShortlist}
            isOnShortlist={shortlistVoiceIds.has(v.voice_id)}
          />
        ))}
      </div>

      {!loading && voices.length === 0 && mode === 'library' && (
        <div className="text-sm text-zinc-500 text-center py-8">
          search above to browse voices
        </div>
      )}
    </div>
  );
}
