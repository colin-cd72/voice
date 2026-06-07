export default function VoiceCard({ voice, onPreview, onPick, picked, onAdd, isOnShortlist }) {
  const labels = voice.labels || {};
  const tags = [labels.gender, labels.age, labels.accent, labels.use_case || labels.descriptive]
    .filter(Boolean);

  return (
    <div className={`card p-4 flex flex-col gap-3 ${picked ? 'ring-2 ring-accent' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium truncate">{voice.name}</div>
          <div className="text-xs text-zinc-500 capitalize">{voice.source}</div>
        </div>
        <span className="chip capitalize">{voice.category || voice.source}</span>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((t, i) => (
            <span key={i} className="chip capitalize">{String(t).replace(/_/g, ' ')}</span>
          ))}
        </div>
      )}

      {voice.description && (
        <div className="text-xs text-zinc-400 line-clamp-3">{voice.description}</div>
      )}

      {voice.preview_url && (
        <audio controls preload="none" src={voice.preview_url} className="mt-1" />
      )}

      <div className="flex gap-2 mt-auto pt-1">
        <button onClick={() => onPick(voice)} className="btn-secondary flex-1">
          {picked ? 'selected' : 'use this voice'}
        </button>
        {onAdd && (
          <button
            onClick={() => onAdd(voice)}
            disabled={isOnShortlist}
            className="btn-ghost border border-ink-700"
            title={isOnShortlist ? 'already on shortlist' : 'add to shortlist'}
          >
            {isOnShortlist ? '✓ on list' : '+ list'}
          </button>
        )}
      </div>
    </div>
  );
}
