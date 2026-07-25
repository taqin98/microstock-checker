import fs from 'fs';
import path from 'path';

export function getEpsPreviewPath(filePath) {
  return `${filePath}.preview.jpg`;
}

export function getIllustratorExportCandidates(previewPath) {
  const directory = path.dirname(previewPath);
  const filename = path.basename(previewPath, '.jpg');
  const normalizedFilename = filename.replace(/ /g, '-');
  const baseNames = [...new Set([filename, normalizedFilename])];

  return baseNames.flatMap((baseName) => [
    path.join(directory, `${baseName}.jpg`),
    path.join(directory, `${baseName}-01.jpg`),
    path.join(directory, `${baseName}_01.jpg`),
  ]);
}

export function findIllustratorExportPath(previewPath) {
  return getIllustratorExportCandidates(previewPath)
    .find((candidate) => fs.existsSync(candidate)) || null;
}

export function getEpsPreviewCandidates(filePath) {
  return getIllustratorExportCandidates(getEpsPreviewPath(filePath));
}

export function findEpsPreviewPath(filePath) {
  return findIllustratorExportPath(getEpsPreviewPath(filePath));
}
