import { useNavigate } from 'react-router-dom';
import { StatusBadge, FileTypeBadge } from './StatusBadge';
import { JobProgress } from './JobProgress';

export function ResultTable({ jobs, deletingIds, selectedIds, allSelected, onToggle, onToggleAll, onDelete }) {
  const navigate = useNavigate();

  if (jobs.length === 0) {
    return (
      <div className="empty-state">
        <p>No files match the current filter</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="result-table" id="results-table">
        <thead>
          <tr>
            <th className="result-table__select">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleAll}
                aria-label="Pilih semua hasil yang terlihat"
              />
            </th>
            <th>Nama file</th>
            <th>Format</th>
            <th>Platform</th>
            <th>Hasil akhir</th>
            <th>Masalah</th>
            <th>Perhatian</th>
            <th>Analisis AI</th>
            <th><span className="sr-only">Aksi</span></th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => {
            const totalErrors = job.results?.reduce((sum, r) => sum + (r.errors?.length || 0), 0) || 0;
            const totalWarnings = job.results?.reduce((sum, r) => sum + (r.warnings?.length || 0), 0) || 0;
            const aiResult = job.results?.find((r) => r.checker_type === 'ai_content');
            const aiHasFlags = aiResult && (aiResult.errors?.length > 0 || aiResult.warnings?.length > 0);

            return (
              <tr
                key={job.id}
                className={`result-table__row ${selectedIds?.has(job.id) ? 'result-table__row--selected' : ''}`}
                onClick={() => navigate(`/results/${job.id}`)}
              >
                <td className="result-table__select" data-label="Pilih">
                  <input
                    type="checkbox"
                    checked={selectedIds?.has(job.id) || false}
                    onChange={() => onToggle(job.id)}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={`Pilih ${job.original_name}`}
                  />
                </td>
                <td className="result-table__name" title={job.original_name} data-label="File">
                  {job.original_name}
                </td>
                <td data-label="Format"><FileTypeBadge type={job.file_type} /></td>
                <td className="result-table__platform" data-label="Platform">{job.platform}</td>
                <td data-label="Hasil">
                  <StatusBadge status={job.status === 'done' ? job.overallResult : job.status} size="sm" />
                  {job.status !== 'done' && <JobProgress job={job} />}
                </td>
                <td data-label="Masalah" className={totalErrors > 0 ? 'text-error' : ''}>{totalErrors}</td>
                <td data-label="Perhatian" className={totalWarnings > 0 ? 'text-warning' : ''}>{totalWarnings}</td>
                <td data-label="Analisis AI">
                  {aiResult ? (
                    aiHasFlags ? (
                      <span className="ai-flag ai-flag--warning" title="AI flagged issues">⚠️</span>
                    ) : (
                      <span className="ai-flag ai-flag--ok" title="AI check passed">✓</span>
                    )
                  ) : job.file_type === 'jpg' ? (
                    <span className="ai-flag ai-flag--pending" title="AI check pending">…</span>
                  ) : (
                    <span className="ai-flag ai-flag--na">—</span>
                  )}
                </td>
                <td data-label="Aksi" className="result-table__actions">
                  <button
                    type="button"
                    className="btn btn--icon btn--delete"
                    title={`Hapus ${job.original_name}`}
                    aria-label={`Hapus ${job.original_name}`}
                    disabled={deletingIds?.has(job.id)}
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(job);
                    }}
                  >
                    {deletingIds?.has(job.id) ? <span className="spinner" /> : '🗑'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
