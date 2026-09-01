/**
 * A monochrome "app icon" chip. Since the app tracks only app *names* (never
 * fetches real icons or URLs — privacy-first), we render a tidy rounded square
 * with the app's initials. Deterministic size; used in Top Activity + App Split.
 */

interface Props {
  name: string;
  size?: number;
}

export function AppChip({ name, size = 30 }: Props) {
  const initials = toInitials(name);
  return (
    <span
      className="app-chip"
      title={name}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </span>
  );
}

function toInitials(name: string): string {
  const cleaned = name.replace(/\.(app|exe)$/i, '').trim();
  const parts = cleaned.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
