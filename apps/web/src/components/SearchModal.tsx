import { useEffect, useRef } from 'react';
import { SearchPanel } from '../features/search/SearchPanel';

type SearchModalProps = {
  open: boolean;
  onClose: () => void;
};

export function SearchModal({ open, onClose }: SearchModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="search-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="search-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-modal-title"
        ref={dialogRef}
      >
        <div className="search-modal-head">
          <div>
            <h2 id="search-modal-title">Universal Search</h2>
            <p className="lede">Search users, forms, grids, and workspace data.</p>
          </div>
          <button type="button" className="btn ghost sm" onClick={onClose} aria-label="Close search">
            Close
          </button>
        </div>
        <div className="search-modal-body">
          <SearchPanel autoFocus onNavigate={onClose} />
        </div>
      </div>
    </div>
  );
}
