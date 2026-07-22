import { useState, useRef, useCallback } from 'react';

export function DropZone({ onFilesSelected, acceptedTypes = '.svg,.eps,.jpg,.jpeg' }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [, setDragCount] = useState(0);
  const fileInputRef = useRef(null);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCount((c) => c + 1);
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCount((c) => {
      const next = c - 1;
      if (next === 0) setIsDragOver(false);
      return next;
    });
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setDragCount(0);

    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter((f) => {
      const ext = '.' + f.name.split('.').pop().toLowerCase();
      return acceptedTypes.split(',').includes(ext);
    });

    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  }, [onFilesSelected, acceptedTypes]);

  const handleClick = () => fileInputRef.current?.click();

  const handleInputChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      onFilesSelected(files);
    }
    e.target.value = '';
  };

  return (
    <div
      className={`dropzone ${isDragOver ? 'dropzone--active' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      id="file-dropzone"
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptedTypes}
        onChange={handleInputChange}
        className="dropzone__input"
      />
      <div className="dropzone__content">
        <div className="dropzone__icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <p className="dropzone__title">Tarik file ke sini atau klik untuk memilih</p>
        <p className="dropzone__subtitle">Mendukung SVG, EPS, JPG/JPEG · maksimal 200 MB per file</p>
      </div>
    </div>
  );
}
