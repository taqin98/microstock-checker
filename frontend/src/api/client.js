const API_BASE = 'http://localhost:3001/api';

async function request(url, options = {}) {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

export async function healthCheck() {
  return request('/health');
}

export async function getPlatforms() {
  return request('/platforms');
}

export async function uploadFiles(files, platform) {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  formData.append('platform', platform);

  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || 'Upload failed');
  }

  return response.json();
}

export async function getJobs() {
  return request('/jobs');
}

export async function getJobDetail(id) {
  return request(`/jobs/${id}`);
}

export async function deleteJob(id) {
  const res = await fetch(`${API_BASE}/jobs/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete job');
  return res.json();
}

export async function deleteAllJobs() {
  const res = await fetch(`${API_BASE}/jobs`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Gagal menghapus seluruh hasil pemeriksaan');
  return res.json();
}

export async function recheckJob(id) {
  const res = await fetch(`${API_BASE}/jobs/${id}/recheck`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to recheck job');
  return res.json();
}

export function getFileUrl(id) {
  return `${API_BASE}/jobs/${id}/file`;
}

export function getPreviewUrl(id) {
  return `${API_BASE}/jobs/${id}/preview`;
}
