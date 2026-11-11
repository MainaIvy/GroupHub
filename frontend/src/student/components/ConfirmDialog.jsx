import React, { useEffect } from 'react';
import { btnDanger, btnSecondary } from '../design';

const ConfirmDialog = ({ open, title, message, confirmLabel = 'Confirm', busy = false, onConfirm, onCancel }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F2D3D]/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 id="confirm-title" className="text-lg font-bold text-[#1F2D3D]">{title}</h2>
        <p className="mt-2 text-sm text-[#33445A]">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className={btnSecondary}>Cancel</button>
          <button type="button" onClick={onConfirm} disabled={busy} className={btnDanger}>{busy ? 'Working…' : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
