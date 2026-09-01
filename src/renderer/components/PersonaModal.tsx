import { useEffect, useRef, useState } from 'react';
import type { PersonaCardData } from '@shared/types.js';
import { drawPersonaCard } from '../lib/persona.js';

interface Props {
  open: boolean;
  onClose: () => void;
  onToast: (msg: string) => void;
}

/**
 * The shareable "focus persona" card, shown as a modal overlay (opened from the
 * Timer/Stats views). Renders the monochrome card to a canvas and offers
 * copy-to-clipboard / save-as-PNG. "Share it — or keep it for yourself."
 */
export function PersonaModal({ open, onClose, onToast }: Props) {
  const [range, setRange] = useState<'today' | 'week'>('today');
  const [data, setData] = useState<PersonaCardData | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (open) void window.kofe.getPersona(range).then(setData);
  }, [open, range]);

  useEffect(() => {
    if (open && data && canvasRef.current) drawPersonaCard(canvasRef.current, data);
  }, [open, data]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const copy = async () => {
    const url = canvasRef.current?.toDataURL('image/png');
    if (!url) return;
    const res = await window.kofe.copyImageToClipboard(url);
    onToast(res.ok ? 'Copied to clipboard' : 'Copy failed');
  };

  const save = async () => {
    const url = canvasRef.current?.toDataURL('image/png');
    if (!url) return;
    const name = `deepbrew-${range}-${new Date().toISOString().slice(0, 10)}.png`;
    const res = await window.kofe.savePng(url, name);
    if (res.ok) onToast('Saved focus card');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>Focus Persona</h2>
            <p className="sub">Share it — or keep it for yourself.</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="persona-toggle">
          <button className={range === 'today' ? 'active' : ''} onClick={() => setRange('today')}>
            Today
          </button>
          <button className={range === 'week' ? 'active' : ''} onClick={() => setRange('week')}>
            This week
          </button>
        </div>

        <canvas ref={canvasRef} className="persona-canvas" />

        <div className="persona-actions">
          <button className="btn" onClick={() => void copy()}>
            Copy to clipboard
          </button>
          <button className="btn ghost" onClick={() => void save()}>
            Save as PNG…
          </button>
        </div>
      </div>
    </div>
  );
}
