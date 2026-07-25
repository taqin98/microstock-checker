import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { StatusBadge, FileTypeBadge } from '../components/StatusBadge';
import { JobProgress } from '../components/JobProgress';
import { IssueExplanation } from '../components/IssueExplanation';
import {
  getJobDetail,
  getPreviewUrl,
  deleteJob,
  recheckJob,
  updateMetadataCategories,
} from '../api/client';
import { CategorySettings } from '../components/CategorySettings';

const CHECKER_LABELS = {
  svg: { label: 'SVG Check', icon: '📐' },
  jpg: { label: 'JPG Check', icon: '🖼️' },
  eps: { label: 'EPS Check', icon: '📎' },
  ai_content: { label: 'AI Content Analysis', icon: '🤖' },
  cross_check: { label: 'EPS↔JPG Cross-Check', icon: '🔗' },
};

function AssetPreview({ src, alt }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="detail-preview detail-preview--empty">
        <span>Preview belum tersedia</span>
        <small>Jalankan periksa ulang</small>
      </div>
    );
  }

  return (
    <div className="detail-preview">
      <a href={src} target="_blank" rel="noreferrer" title="Buka preview ukuran penuh">
        <img src={src} alt={alt} className="detail-preview__img" onError={() => setFailed(true)} />
      </a>
    </div>
  );
}

function InfoGrid({ info }) {
  const entries = Object.entries(info).filter(([key]) =>
    !['suggestedTitle', 'suggestedDescription', 'suggestedKeywords', 'suggestedCategories', 'fromCache', 'skipped', 'reason', 'previewPath'].includes(key)
  );
  if (entries.length === 0) return null;

  return (
    <div className="info-grid">
      {entries.map(([key, value]) => (
        <div key={key} className="info-grid__item">
          <span className="info-grid__label">{formatInfoKey(key)}</span>
          <span className="info-grid__value">{formatInfoValue(value)}</span>
        </div>
      ))}
    </div>
  );
}

function formatInfoKey(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
}

function formatInfoValue(value) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function KeywordChips({ keywords }) {
  const [copied, setCopied] = useState(null);

  const copyKeyword = (kw) => {
    navigator.clipboard.writeText(kw);
    setCopied(kw);
    setTimeout(() => setCopied(null), 1500);
  };

  const copyAll = () => {
    navigator.clipboard.writeText(keywords.join(', '));
    setCopied('__all__');
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="keywords-section">
      <div className="keywords-header">
        <span className="keywords-count">{keywords.length} keywords</span>
        <button className="btn btn--sm btn--ghost" onClick={copyAll}>
          {copied === '__all__' ? '✓ Copied!' : 'Copy All'}
        </button>
      </div>
      <div className="keyword-chips">
        {keywords.map((kw) => (
          <button
            key={kw}
            className={`keyword-chip ${copied === kw ? 'keyword-chip--copied' : ''}`}
            onClick={() => copyKeyword(kw)}
            title="Click to copy"
          >
            {kw}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Detail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openSections, setOpenSections] = useState({});
  const initializedSections = useRef(new Set());

  useEffect(() => {
    let interval;
    const fetchData = async () => {
      try {
        const data = await getJobDetail(id);
        setJob(data);
        
        // Auto-open sections with issues ONLY when they first appear
        if (data.results) {
          setOpenSections((prev) => {
            const next = { ...prev };
            let changed = false;
            
            data.results.forEach((r) => {
              if (!initializedSections.current.has(r.checker_type)) {
                initializedSections.current.add(r.checker_type);
                next[r.checker_type] = r.errors?.length > 0 || r.warnings?.length > 0;
                changed = true;
              }
            });
            
            return changed ? next : prev;
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [id]);

  const toggleSection = (type) => {
    setOpenSections((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this job?')) return;
    try {
      await deleteJob(id);
      navigate('/');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRecheck = async () => {
    try {
      setLoading(true);
      initializedSections.current.clear(); // Reset auto-open memory
      await recheckJob(id);
      const data = await getJobDetail(id);
      setJob(data);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCategories = async (categories) => {
    const result = await updateMetadataCategories(id, categories);
    setJob((current) => ({
      ...current,
      metadata_categories: result.categories,
    }));
  };

  if (loading) {
    return (
      <div className="page">
        <div className="loading-skeleton">
          <div className="skeleton-row skeleton-row--wide" />
          <div className="skeleton-row" />
          <div className="skeleton-row" />
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="page">
        <div className="empty-state glass-card">
          <h3>Job not found</h3>
          <button className="btn btn--primary" onClick={() => navigate('/results')}>
            Back to Results
          </button>
        </div>
      </div>
    );
  }

  const isPreviewable = ['jpg', 'svg', 'eps'].includes(job.file_type);
  const previewUrl = getPreviewUrl(job.id);
  const totalErrors = job.results?.reduce((sum, result) => sum + (result.errors?.length || 0), 0) || 0;
  const totalWarnings = job.results?.reduce((sum, result) => sum + (result.warnings?.length || 0), 0) || 0;
  const resultStatus = job.overallResult || job.status;
  const statusGuidance = {
    pass: 'Tidak ada masalah yang terdeteksi. File siap dipertimbangkan untuk dikirim.',
    warning: 'File dapat dilanjutkan setelah poin perhatian ditinjau secara manual.',
    fail: 'Perbaiki alasan penolakan di bawah, lalu jalankan pemeriksaan ulang.',
    pending: 'File sedang menunggu giliran pemeriksaan.',
    processing: 'Pemeriksaan sedang berjalan. Hasil akan diperbarui otomatis.',
    error: 'Pemeriksaan berhenti karena kendala teknis. Periksa aktivitas lalu jalankan pemeriksaan ulang.',
  }[resultStatus];
  const aiResult = job.results?.find((result) => result.checker_type === 'ai_content');
  const categoryOptions = job.metadata_options?.image_categories || [];

  return (
    <div className="page detail-page">
      <button className="btn btn--ghost back-btn" onClick={() => navigate('/results')}>
        ← Kembali ke hasil
      </button>

      <div className="detail-header glass-card">
        <div className="detail-header__main">
          <div className="detail-header__info">
            <span className="page__eyebrow">Detail pemeriksaan</span>
            <div className="detail-header__title-row">
              <FileTypeBadge type={job.file_type} />
              <h1>{job.original_name}</h1>
            </div>
            <div className="detail-header__meta">
              <span>Platform <strong>{job.platform}</strong></span>
              <span>Ukuran <strong>{(job.file_size / (1024 * 1024)).toFixed(2)} MB</strong></span>
            </div>
          </div>

          <div className="detail-header__actions">
            <button className="btn btn--ghost" onClick={handleRecheck} disabled={job.status === 'processing'}>
              ↻ Periksa ulang
            </button>
            <button className="btn btn--danger" onClick={handleDelete}>
              Hapus
            </button>
          </div>
        </div>

        <div className="detail-overview">
          {isPreviewable && (
            <AssetPreview src={previewUrl} alt={job.original_name} />
          )}
          <div className={`result-callout result-callout--${resultStatus}`}>
            <span className="result-callout__label">Hasil akhir</span>
            <StatusBadge status={resultStatus} />
            <p>{statusGuidance}</p>
            <div className="result-callout__counts">
              <span><strong>{totalErrors}</strong> masalah wajib diperbaiki</span>
              <span><strong>{totalWarnings}</strong> poin perhatian</span>
            </div>
            {job.status !== 'done' && <JobProgress job={job} detailed />}
          </div>
        </div>
      </div>

      {job.process_logs && job.process_logs.length > 0 && (
        <details className="glass-card process-logs" open={job.status !== 'done'}>
          <summary className="process-logs__title">Aktivitas pemeriksaan ({job.process_logs.length})</summary>
          <div className="process-logs__terminal">
            {job.process_logs.map((log, i) => (
              <div key={i} className="process-logs__entry">
                <span className="process-logs__time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                <span className="process-logs__message">{log.message}</span>
              </div>
            ))}
            {job.status !== 'done' && (
              <div className="process-logs__entry process-logs__entry--running">
                <span className="process-logs__time">{new Date().toLocaleTimeString()}</span>
                <span className="process-logs__message">
                  <span className="spinner" style={{ width: '10px', height: '10px', marginRight: '6px', borderWidth: '1px' }} />
                  Sedang diproses...
                </span>
              </div>
            )}
          </div>
        </details>
      )}

      {job.file_type === 'eps' && job.status === 'done' && categoryOptions.length > 0 && (
        <CategorySettings
          categories={categoryOptions}
          savedCategories={job.metadata_categories || []}
          suggestedCategories={aiResult?.info?.suggestedCategories || []}
          onSave={handleSaveCategories}
        />
      )}

      <div className="check-results">
        {job.results?.map((result) => {
          const config = CHECKER_LABELS[result.checker_type] || { label: result.checker_type, icon: '🔍' };
          const isOpen = openSections[result.checker_type];
          const hasErrors = result.errors?.length > 0;
          const hasWarnings = result.warnings?.length > 0;

          return (
            <div
              key={result.id}
              className={`check-section glass-card ${hasErrors ? 'check-section--error' : hasWarnings ? 'check-section--warning' : 'check-section--pass'}`}
            >
              <button
                className="check-section__header"
                onClick={() => toggleSection(result.checker_type)}
              >
                <div className="check-section__title">
                  <span className="check-section__icon">{config.icon}</span>
                  <span>{config.label}</span>
                  <StatusBadge
                    status={hasErrors ? 'fail' : hasWarnings ? 'warning' : 'pass'}
                    size="sm"
                  />
                </div>
                <span className={`check-section__chevron ${isOpen ? 'check-section__chevron--open' : ''}`}>
                  ▸
                </span>
              </button>

              {isOpen && (
                <div className="check-section__body">
                  {result.errors?.length > 0 && (
                    <div className="issue-list">
                      <h4 className="issue-list__title issue-list__title--error">Harus diperbaiki</h4>
                      {result.errors.map((err, i) => (
                        <IssueExplanation key={`${err.code}-${i}`} issue={err} severity="error" />
                      ))}
                    </div>
                  )}

                  {result.warnings?.length > 0 && (
                    <div className="issue-list">
                      <h4 className="issue-list__title issue-list__title--warning">Perlu ditinjau</h4>
                      {result.warnings.map((warn, i) => (
                        <IssueExplanation key={`${warn.code}-${i}`} issue={warn} severity="warning" />
                      ))}
                    </div>
                  )}

                  {result.info && <InfoGrid info={result.info} />}

                  {/* AI-specific sections */}
                  {result.checker_type === 'ai_content' && result.info?.suggestedTitle && (
                    <div className="ai-suggestions">
                      <div className="ai-title-suggestion">
                        <span className="ai-suggestions__label">Saran judul</span>
                        <p className="ai-suggestions__value">{result.info.suggestedTitle}</p>
                      </div>
                      {result.info.suggestedDescription && (
                        <div className="ai-title-suggestion">
                          <span className="ai-suggestions__label">Deskripsi Shutterstock</span>
                          <p className="ai-suggestions__value">{result.info.suggestedDescription}</p>
                        </div>
                      )}
                      {result.info.suggestedCategories?.length > 0 && (
                        <div className="ai-title-suggestion">
                          <span className="ai-suggestions__label">Kategori Shutterstock</span>
                          <p className="ai-suggestions__value">{result.info.suggestedCategories.join(', ')}</p>
                        </div>
                      )}
                      {result.info.suggestedKeywords?.length > 0 && (
                        <KeywordChips keywords={result.info.suggestedKeywords} />
                      )}
                    </div>
                  )}

                  {result.errors?.length === 0 && result.warnings?.length === 0 && (
                    <p className="check-section__all-pass">Pemeriksaan ini lolos ✓</p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {job.results?.length === 0 && job.status === 'done' && (
          <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
            <p>No checks were run for this file.</p>
          </div>
        )}
      </div>
    </div>
  );
}
