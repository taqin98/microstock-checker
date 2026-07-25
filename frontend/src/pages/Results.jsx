import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ResultTable } from '../components/ResultTable';
import { usePolling } from '../hooks/usePolling';
import { deleteAllJobs, deleteJob, getJobs } from '../api/client';
import { useToast } from '../components/Toast';
import { ExportCsvMenu } from '../components/ExportCsvMenu';
import {
  countJobsWithIncompleteMetadata,
  createShutterstockCsv,
} from '../utils/shutterstockCsv';
import {
  countAdobeStockJobsWithIncompleteMetadata,
  createAdobeStockCsv,
} from '../utils/adobeStockCsv';

const FILTERS = ['all', 'pass', 'warning', 'fail', 'pending'];
const FILTER_LABELS = {
  all: 'Semua',
  pass: 'Siap dikirim',
  warning: 'Perlu ditinjau',
  fail: 'Harus diperbaiki',
  pending: 'Diproses',
};
const CSV_EXPORTERS = {
  shutterstock: {
    createCsv: createShutterstockCsv,
    countIncomplete: countJobsWithIncompleteMetadata,
    filename: 'shutterstock_content_upload.csv',
    label: 'Shutterstock',
  },
  adobestock: {
    createCsv: createAdobeStockCsv,
    countIncomplete: countAdobeStockJobsWithIncompleteMetadata,
    filename: 'adobe_stock_content_upload.csv',
    label: 'Adobe Stock',
  },
};

export default function Results() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [deletingAll, setDeletingAll] = useState(false);
  const [deletingIds, setDeletingIds] = useState(() => new Set());
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const { addToast } = useToast();

  const fetchJobs = useCallback(() => getJobs(), []);

  const { data: jobs, loading, error, refetch } = usePolling(fetchJobs, 3000, true);

  const handleDeleteJob = async (job) => {
    const confirmed = window.confirm(`Hapus hasil pemeriksaan “${job.original_name}”? File yang diunggah juga akan dihapus.`);
    if (!confirmed) return;

    setDeletingIds((current) => new Set(current).add(job.id));
    try {
      await deleteJob(job.id);
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(job.id);
        return next;
      });
      await refetch();
      addToast(`${job.original_name} berhasil dihapus`, 'success');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setDeletingIds((current) => {
        const next = new Set(current);
        next.delete(job.id);
        return next;
      });
    }
  };

  const handleDeleteAll = async () => {
    const total = jobs?.length || 0;
    if (total === 0) return;

    const confirmed = window.confirm(`Hapus seluruh ${total} hasil pemeriksaan? Semua file upload dan preview terkait juga akan dihapus. Tindakan ini tidak dapat dibatalkan.`);
    if (!confirmed) return;

    setDeletingAll(true);
    try {
      const result = await deleteAllJobs();
      setSelectedIds(new Set());
      await refetch();
      addToast(`${result.deletedCount} hasil pemeriksaan berhasil dihapus`, 'success');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setDeletingAll(false);
    }
  };

  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    let filtered = jobs;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((j) => j.original_name.toLowerCase().includes(q));
    }
    return filtered;
  }, [jobs, search]);

  const visibleJobs = useMemo(() => filteredJobs.filter((job) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return job.status === 'pending' || job.status === 'processing';
    return job.overallResult === filter;
  }), [filteredJobs, filter]);

  const selectedJobs = useMemo(() => (jobs || []).filter((job) => selectedIds.has(job.id)), [jobs, selectedIds]);
  const allVisibleSelected = visibleJobs.length > 0 && visibleJobs.every((job) => selectedIds.has(job.id));

  const toggleSelection = (id) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visibleJobs.forEach((job) => next.delete(job.id));
      else visibleJobs.forEach((job) => next.add(job.id));
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedJobs.length === 0) return;
    const confirmed = window.confirm(`Hapus ${selectedJobs.length} hasil yang dipilih? File upload dan preview terkait juga akan dihapus.`);
    if (!confirmed) return;

    const ids = selectedJobs.map((job) => job.id);
    setDeletingIds((current) => new Set([...current, ...ids]));
    const results = await Promise.allSettled(ids.map((id) => deleteJob(id)));
    const deletedIds = ids.filter((_, index) => results[index].status === 'fulfilled');
    const failedCount = results.length - deletedIds.length;

    setSelectedIds((current) => {
      const next = new Set(current);
      deletedIds.forEach((id) => next.delete(id));
      return next;
    });
    setDeletingIds((current) => {
      const next = new Set(current);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    await refetch();
    addToast(`${deletedIds.length} hasil berhasil dihapus${failedCount ? `, ${failedCount} gagal` : ''}`, failedCount ? 'warning' : 'success');
  };

  const counts = useMemo(() => {
    if (!jobs) return {};
    return {
      all: jobs.length,
      pass: jobs.filter((j) => j.overallResult === 'pass').length,
      warning: jobs.filter((j) => j.overallResult === 'warning').length,
      fail: jobs.filter((j) => j.overallResult === 'fail').length,
      pending: jobs.filter((j) => j.status === 'pending' || j.status === 'processing').length,
    };
  }, [jobs]);

  const exportCsv = (platform, jobsToExport = visibleJobs) => {
    if (jobsToExport.length === 0) {
      addToast('Tidak ada hasil untuk diekspor', 'warning');
      return;
    }

    const exporter = CSV_EXPORTERS[platform];
    if (!exporter) {
      addToast('Format CSV platform belum tersedia', 'warning');
      return;
    }

    const platformJobs = jobsToExport.filter((job) => job.platform === platform);
    if (platformJobs.length === 0) {
      addToast(`Tidak ada hasil ${platform} untuk diekspor`, 'warning');
      return;
    }

    const csv = exporter.createCsv(platformJobs);
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = exporter.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);

    const incompleteCount = exporter.countIncomplete(platformJobs);
    if (incompleteCount > 0) {
      addToast(
        `CSV ${exporter.label} diekspor; ${incompleteCount} file belum memiliki metadata lengkap`,
        'warning',
      );
      return;
    }

    addToast(`${platformJobs.length} metadata ${exporter.label} berhasil diekspor`, 'success');
  };

  if (loading && !jobs) {
    return (
      <div className="page">
        <div className="loading-skeleton">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton-row" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page results-page">
      <div className="page__header">
        <div className="page__header-row">
          <div>
            <span className="page__eyebrow">Ringkasan pemeriksaan</span>
            <h1>Hasil pemeriksaan</h1>
            <p className="page__subtitle">
              {jobs?.length || 0} file diperiksa
              {counts.pending > 0 && (
                <span className="processing-indicator"> · {counts.pending} sedang diproses</span>
              )}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              className="btn btn--danger"
              onClick={handleDeleteAll}
              disabled={!jobs?.length || deletingAll}
            >
              {deletingAll ? <><span className="spinner" /> Menghapus...</> : 'Hapus semua'}
            </button>
            <ExportCsvMenu
              disabled={visibleJobs.length === 0}
              onExport={(platform) => exportCsv(platform)}
            />
            <button className="btn btn--primary" onClick={() => navigate('/')}>
              + Periksa file lain
            </button>
          </div>
        </div>
      </div>

      <div className="result-summary" aria-label="Ringkasan status file">
        <div className="summary-card summary-card--total"><span>Total file</span><strong>{counts.all || 0}</strong></div>
        <div className="summary-card summary-card--pass"><span>Siap dikirim</span><strong>{counts.pass || 0}</strong></div>
        <div className="summary-card summary-card--warning"><span>Perlu ditinjau</span><strong>{counts.warning || 0}</strong></div>
        <div className="summary-card summary-card--fail"><span>Harus diperbaiki</span><strong>{counts.fail || 0}</strong></div>
      </div>

      <div className="results-toolbar">
        <div className="filter-tabs">
          {FILTERS.map((f) => (
            <button
              key={f}
              className={`filter-tab ${filter === f ? 'filter-tab--active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {FILTER_LABELS[f]}
              {counts[f] > 0 && <span className="filter-tab__count">{counts[f]}</span>}
            </button>
          ))}
        </div>

        <div className="results-toolbar__tools">
          <button className="btn btn--ghost btn--sm" onClick={toggleAllVisible} disabled={visibleJobs.length === 0}>
            {allVisibleSelected ? 'Batalkan semua' : 'Pilih semua terlihat'}
          </button>
          <div className="search-box">
            <input
              type="text"
              placeholder="Cari nama file..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input"
              id="search-input"
            />
          </div>
        </div>
      </div>

      {selectedJobs.length > 0 && (
        <div className="bulk-action-bar" role="toolbar" aria-label="Aksi untuk hasil yang dipilih">
          <div>
            <strong>{selectedJobs.length} dipilih</strong>
            <button className="bulk-action-bar__clear" onClick={() => setSelectedIds(new Set())}>Batalkan pilihan</button>
          </div>
          <div>
            <ExportCsvMenu
              label="↓ Ekspor pilihan"
              size="sm"
              onExport={(platform) => exportCsv(platform, selectedJobs)}
            />
            <button className="btn btn--danger btn--sm" onClick={handleDeleteSelected}>Hapus pilihan</button>
          </div>
        </div>
      )}

      {error && <div className="alert alert--error">{error}</div>}

      {visibleJobs.length === 0 && !loading ? (
        <div className="empty-state glass-card">
          <div className="empty-state__icon">📋</div>
          <h3>No results yet</h3>
          <p>Upload some files to start checking</p>
          <button className="btn btn--primary" onClick={() => navigate('/')}>
            Upload Files
          </button>
        </div>
      ) : (
        <ResultTable
          jobs={visibleJobs}
          deletingIds={deletingIds}
          selectedIds={selectedIds}
          allSelected={allVisibleSelected}
          onToggle={toggleSelection}
          onToggleAll={toggleAllVisible}
          onDelete={handleDeleteJob}
        />
      )}
    </div>
  );
}
