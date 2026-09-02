/**
 * An "app icon" chip. When we have the app's real icon (extracted locally from
 * its executable — never fetched from the network) we show it; otherwise we
 * fall back to a tidy monochrome square with the app's initials. Deterministic
 * size; used in Top Activity + App Split.
 */

interface Props {
  name: string;
  iconUrl?: string | null;
  size?: number;
}

export function AppChip({ name, iconUrl, size = 30 }: Props) {
  if (iconUrl) {
    return (
      <img
        className="app-chip app-chip-img"
        src={iconUrl}
        alt={name}
        title={name}
        width={size}
        height={size}
        style={{ width: size, height: size }}
      />
    );
  }

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
