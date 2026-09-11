import { useEffect, useRef, useState } from 'react';
import type { PersonaCardData } from '@shared/types.js';
import { drawPersonaCard } from '../lib/persona.js';

// Persona avatars: one profession doodle per work style, vectorised to SVG.
const personaSvgs = import.meta.glob('../assets/personas/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default'
}) as Record<string, string>;

function avatarUrlFor(workStyle: string): string | null {
  const slug = workStyle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const entry = Object.entries(personaSvgs).find(([path]) => path.endsWith(`/${slug}.svg`));
  if (!entry) return null;
  // Recolour the black trace to the card's ink so it reads on the dark card.
  const svg = entry[1].replace(/#111111/gi, '#f5f5f5');
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

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
  const [avatar, setAvatar] = useState<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (open) void window.kofe.getPersona(range).then(setData);
  }, [open, range]);

  // Load the persona's avatar image when the work style changes.
  useEffect(() => {
    setAvatar(null);
    if (!data) return;
    const url = avatarUrlFor(data.workStyle);
    if (!url) return;
    const img = new Image();
    img.onload = () => setAvatar(img);
    img.src = url;
  }, [data]);

  useEffect(() => {
    if (open && data && canvasRef.current) {
      drawPersonaCard(canvasRef.current, data, avatar ?? undefined);
    }
  }, [open, data, avatar]);

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
