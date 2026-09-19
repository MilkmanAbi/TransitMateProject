import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-[#1f1c17]/40" onClick={onClose}>
      <div
        className="max-h-[88dvh] w-full max-w-md animate-rise overflow-y-auto rounded-t border-t border-surface-border bg-surface-raised px-4 pt-2 shadow-xl"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 24px)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-slate-600" />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-[1.25rem] font-semibold">{title}</h2>
          <button onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full active:bg-white/10" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
