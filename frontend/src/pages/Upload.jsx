import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DropZone } from '../components/DropZone';
import { FileTypeBadge } from '../components/StatusBadge';
import { uploadFiles, getPlatforms } from '../api/client';
import { useToast } from '../components/Toast';

export default function Upload() {
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [platform, setPlatform] = useState('shutterstock');
  const [platforms, setPlatforms] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const { addToast } = useToast();

  useEffect(() => {
    getPlatforms().then(setPlatforms).catch(() => {});
  }, []);

  const handleFilesSelected = useCallback((newFiles) => {
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size));
      const unique = newFiles.filter((f) => !existing.has(f.name + f.size));
      return [...prev, ...unique];
    });
    setUploadError(null);
  }, []);

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearFiles = () => setFiles([]);

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setUploadError(null);

    try {
      await uploadFiles(files, platform);
      addToast(`${files.length} file(s) queued for checking`, 'success');
      navigate('/results');
    } catch (err) {
      setUploadError(err.message);
      addToast(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  // Group files by basename for pairing preview
  const groupedFiles = files.reduce((groups, file, index) => {
    const baseName = file.name.replace(/\.[^.]+$/, '').toLowerCase();
    if (!groups[baseName]) groups[baseName] = [];
    groups[baseName].push({ file, index });
    return groups;
  }, {});

  return (
    <div className="page upload-page">
      <div className="page__header">
        <span className="page__eyebrow">Pemeriksaan sebelum upload</span>
        <h1>Periksa file microstock</h1>
        <p className="page__subtitle">
          Temukan masalah teknis, risiko hak cipta, dan indikasi konten AI sebelum dikirim ke platform.
        </p>
      </div>

      <div className="upload-workspace">
        <aside className="upload-setup glass-card">
          <div className="setup-heading">
            <span className="step-number">1</span>
            <div>
              <h2>Pilih platform tujuan</h2>
              <p>Aturan pemeriksaan akan disesuaikan otomatis.</p>
            </div>
          </div>
          <div className="control-group control-group--stacked">
            <label htmlFor="platform-select" className="control-label">Platform microstock</label>
            <select
              id="platform-select"
              className="select"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
            >
              {platforms.map((p) => (
                <option key={p.platform} value={p.platform}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="setup-checklist">
            <span>✓ Pemeriksaan teknis file</span>
            <span>✓ Analisis risiko konten</span>
            <span>✓ Saran judul dan keyword</span>
          </div>
        </aside>

        <section className="upload-files-panel">
          <div className="setup-heading setup-heading--inline">
            <span className="step-number">2</span>
            <div>
              <h2>Tambahkan file</h2>
              <p>Bisa memilih beberapa file sekaligus.</p>
            </div>
          </div>
          <DropZone onFilesSelected={handleFilesSelected} />
        </section>
      </div>

      {files.length > 0 && (
        <div className="file-list glass-card">
          <div className="file-list__header">
            <div>
              <span className="page__eyebrow">Langkah 3</span>
              <h3>{files.length} file siap diperiksa</h3>
            </div>
            <button className="btn btn--ghost" onClick={clearFiles}>Hapus semua</button>
          </div>

          {Object.entries(groupedFiles).map(([baseName, items]) => (
            <div key={baseName} className={`file-group ${items.length > 1 ? 'file-group--paired' : ''}`}>
              {items.length > 1 && (
                <span className="file-group__pair-badge">Pasangan EPS + JPG</span>
              )}
              {items.map(({ file, index }) => {
                const ext = file.name.split('.').pop().toLowerCase();
                const type = ext === 'jpeg' ? 'jpg' : ext;
                return (
                  <div key={index} className="file-item">
                    <FileTypeBadge type={type} />
                    <span className="file-item__name">{file.name}</span>
                    <span className="file-item__size">
                      {(file.size / (1024 * 1024)).toFixed(1)} MB
                    </span>
                    <button
                      className="btn btn--icon"
                      onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                      title="Hapus file"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          ))}

          {uploadError && (
            <div className="alert alert--error">{uploadError}</div>
          )}

          <button
            className="btn btn--primary btn--lg"
            onClick={handleUpload}
            disabled={uploading}
            id="check-all-btn"
          >
            {uploading ? (
              <>
                <span className="spinner" /> Mengunggah...
              </>
            ) : (
              `Periksa ${files.length} file sekarang`
            )}
          </button>
        </div>
      )}
    </div>
  );
}
