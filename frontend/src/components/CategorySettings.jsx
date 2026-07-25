import { useEffect, useRef, useState } from 'react';

export function CategorySettings({
  categories,
  savedCategories,
  suggestedCategories,
  onSave,
}) {
  const [primaryCategory, setPrimaryCategory] = useState('');
  const [secondaryCategory, setSecondaryCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const lastSavedKey = useRef(null);

  useEffect(() => {
    const savedKey = JSON.stringify(savedCategories || []);
    if (lastSavedKey.current === savedKey) return;

    lastSavedKey.current = savedKey;
    const defaults = savedCategories?.length > 0
      ? savedCategories
      : (suggestedCategories || []).filter((category) => categories.includes(category));

    setPrimaryCategory(defaults[0] || '');
    setSecondaryCategory(defaults[1] || '');
  }, [categories, savedCategories, suggestedCategories]);

  const handleSave = async () => {
    const selectedCategories = [primaryCategory, secondaryCategory].filter(Boolean);
    setSaving(true);
    setMessage('');

    try {
      await onSave(selectedCategories);
      setMessage('Pilihan kategori berhasil disimpan.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="category-settings glass-card" aria-labelledby="category-settings-title">
      <div className="category-settings__header">
        <div>
          <span className="page__eyebrow">Metadata Shutterstock</span>
          <h2 id="category-settings-title">Pilih kategori</h2>
          <p>Kategori pertama wajib. Kategori kedua opsional.</p>
        </div>
        {savedCategories?.length > 0 && (
          <span className="category-settings__saved">Tersimpan</span>
        )}
      </div>

      <div className="category-settings__fields">
        <label>
          <span>Kategori 1 <strong>*</strong></span>
          <select
            className="input"
            value={primaryCategory}
            onChange={(event) => {
              const value = event.target.value;
              setPrimaryCategory(value);
              if (value === secondaryCategory) setSecondaryCategory('');
              setMessage('');
            }}
          >
            <option value="">Pilih kategori utama</option>
            {categories.map((category) => (
              <option value={category} key={category}>{category}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Kategori 2 <small>(opsional)</small></span>
          <select
            className="input"
            value={secondaryCategory}
            onChange={(event) => {
              setSecondaryCategory(event.target.value);
              setMessage('');
            }}
          >
            <option value="">Tanpa kategori kedua</option>
            {categories
              .filter((category) => category !== primaryCategory)
              .map((category) => (
                <option value={category} key={category}>{category}</option>
              ))}
          </select>
        </label>
      </div>

      <div className="category-settings__footer">
        {message && <p role="status">{message}</p>}
        <button
          type="button"
          className="btn btn--primary"
          disabled={!primaryCategory || saving}
          onClick={handleSave}
        >
          {saving ? <><span className="spinner" /> Menyimpan...</> : 'Simpan kategori'}
        </button>
      </div>
    </section>
  );
}
