import { useEffect, useRef, useState } from 'react';

const EXPORT_PLATFORMS = [
  { id: 'shutterstock', label: 'Shutterstock', available: true },
  { id: 'adobestock', label: 'Adobe Stock', available: true },
  { id: 'freepik', label: 'Freepik', available: false },
  { id: 'dreamstime', label: 'Dreamstime', available: false },
  { id: 'pond5', label: 'Pond5', available: false },
];

export function ExportCsvMenu({
  disabled = false,
  label = '↓ Ekspor CSV',
  onExport,
  size = 'md',
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div className="export-menu" ref={menuRef}>
      <button
        type="button"
        className={`btn btn--ghost ${size === 'sm' ? 'btn--sm' : ''}`}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {label}
        <span className="export-menu__chevron" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="export-menu__list" role="menu" aria-label="Pilih format platform">
          {EXPORT_PLATFORMS.map((platform) => (
            <button
              type="button"
              role="menuitem"
              className="export-menu__item"
              key={platform.id}
              disabled={!platform.available}
              onClick={() => {
                setOpen(false);
                onExport(platform.id);
              }}
            >
              <span>{platform.label}</span>
              <small>{platform.available ? 'Tersedia' : 'Segera'}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
