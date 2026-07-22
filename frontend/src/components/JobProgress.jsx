function getJobProgress(job) {
  const results = job.results || [];
  const technicalComplete = results.some((result) => ['svg', 'jpg', 'eps'].includes(result.checker_type));
  const aiComplete = results.some((result) => result.checker_type === 'ai_content');

  if (job.status === 'error') {
    return { percent: 100, label: 'Pemeriksaan gagal', stage: 'error' };
  }

  if (job.status === 'done') {
    return { percent: 100, label: 'Pemeriksaan selesai', stage: 'done' };
  }

  if (job.status === 'pending') {
    return { percent: 12, label: 'Menunggu giliran', stage: 'pending' };
  }

  if (aiComplete) {
    return { percent: 90, label: 'Menyelesaikan hasil', stage: 'finalizing' };
  }

  if (technicalComplete) {
    return { percent: 65, label: 'Analisis konten AI', stage: 'ai' };
  }

  return { percent: 35, label: 'Pemeriksaan teknis', stage: 'technical' };
}

export function JobProgress({ job, detailed = false }) {
  const progress = getJobProgress(job);

  if (!detailed) {
    return (
      <div className="job-progress job-progress--compact" aria-label={`${progress.label}, ${progress.percent}%`}>
        <div className="job-progress__track">
          <span style={{ width: `${progress.percent}%` }} />
        </div>
        {job.status !== 'done' && <small>{progress.label}</small>}
      </div>
    );
  }

  const stages = [
    { key: 'pending', label: 'Masuk antrean', complete: progress.percent > 12 },
    { key: 'technical', label: 'Pemeriksaan teknis', complete: progress.percent > 35 },
    { key: 'ai', label: 'Analisis konten AI', complete: progress.percent > 65 },
    { key: 'done', label: 'Hasil akhir', complete: progress.percent === 100 && progress.stage === 'done' },
  ];

  return (
    <div className="job-progress job-progress--detailed">
      <div className="job-progress__header">
        <span>{progress.label}</span>
        <strong>{progress.percent}%</strong>
      </div>
      <div className="job-progress__track">
        <span style={{ width: `${progress.percent}%` }} />
      </div>
      <div className="job-progress__steps">
        {stages.map((stage) => (
          <span
            key={stage.key}
            className={stage.complete ? 'job-progress__step job-progress__step--complete' : 'job-progress__step'}
          >
            <i>{stage.complete ? '✓' : ''}</i>
            {stage.label}
          </span>
        ))}
      </div>
    </div>
  );
}
