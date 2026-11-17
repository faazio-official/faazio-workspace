type TourControlsProps = {
  index: number;
  labels: readonly string[];
  playing: boolean;
  reduced: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSelect: (index: number) => void;
  onTogglePlay: () => void;
};

export function TourControls({
  index,
  labels,
  playing,
  reduced,
  onPrev,
  onNext,
  onSelect,
  onTogglePlay,
}: TourControlsProps) {
  const total = labels.length;
  const atEnd = index === total - 1;

  return (
    <div className="tour-controls">
      <div className="tour-controls-group">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={onPrev}
          disabled={index === 0}
        >
          Previous
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={onNext} disabled={atEnd}>
          Next
        </button>
      </div>

      <div className="tour-dots" role="group" aria-label="Walkthrough steps">
        {labels.map((label, i) => (
          <button
            key={`${i}-${label}`}
            type="button"
            className="tour-dot"
            aria-current={i === index ? "true" : undefined}
            aria-label={`Step ${i + 1}: ${label}`}
            onClick={() => onSelect(i)}
          >
            <span />
          </button>
        ))}
      </div>

      <div className="tour-controls-group">
        <span className="meta">
          Step {index + 1} of {total}
        </span>
        {!reduced ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onTogglePlay}>
            {playing ? "Pause" : atEnd ? "Replay" : "Watch"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
