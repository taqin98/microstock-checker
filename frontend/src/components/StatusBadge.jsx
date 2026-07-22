export function StatusBadge({ status, size = 'md' }) {
  const config = {
    pass: { label: 'Siap dikirim', className: 'badge--pass', icon: '✓' },
    warning: { label: 'Perlu ditinjau', className: 'badge--warning', icon: '⚠' },
    fail: { label: 'Harus diperbaiki', className: 'badge--fail', icon: '✕' },
    pending: { label: 'Menunggu', className: 'badge--pending', icon: '⏳' },
    processing: { label: 'Sedang diperiksa', className: 'badge--processing', icon: '⟳' },
    error: { label: 'Error', className: 'badge--error', icon: '!' },
  };

  const c = config[status] || config.pending;

  return (
    <span className={`badge ${c.className} badge--${size}`}>
      <span className="badge__icon">{c.icon}</span>
      <span className="badge__label">{c.label}</span>
    </span>
  );
}

export function FileTypeBadge({ type }) {
  return <span className={`badge badge--filetype badge--${type}`}>{type.toUpperCase()}</span>;
}
