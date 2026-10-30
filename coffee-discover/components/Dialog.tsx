"use client";

import { useEffect, useRef } from "react";

// Native <dialog> gives us focus trapping, Escape-to-close and a backdrop for free.
export function Dialog({ open, onClose, title, children, footer }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
    >
      <div className="dialog-head">
        <h2>{title}</h2>
        <button type="button" className="btn btn-ghost icon-btn" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="dialog-body">{open && children}</div>
      {footer && <div className="dialog-foot">{footer}</div>}
    </dialog>
  );
}
