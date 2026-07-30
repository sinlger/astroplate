import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { GridSplitOptions } from '@/lib/imageProcessor';
import {
  loadImage,
  splitImageIntoGrid,
  downloadCanvas,
  createZipDownload,
} from '@/lib/imageProcessor';

export interface GridSplitterProps {
  // No extra props needed
}

const GRID_PRESETS = [
  { label: '3x1 (Banner)', rows: 1, cols: 3 },
  { label: '3x2', rows: 2, cols: 3 },
  { label: '3x3 (Classic Grid)', rows: 3, cols: 3 },
];

const GridSplitter: React.FC<GridSplitterProps> = () => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [tiles, setTiles] = useState<HTMLCanvasElement[]>([]);
  const [outputFormat, setOutputFormat] = useState<'png' | 'jpeg' | 'webp'>('png');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const updatePreview = useCallback(() => {
    if (!image || !previewCanvasRef.current) return;

    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d')!;

    // Fit preview to container
    const maxSize = 500;
    const scale = Math.min(maxSize / image.width, maxSize / image.height);
    canvas.width = image.width * scale;
    canvas.height = image.height * scale;

    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
    ctx.lineWidth = 2;

    for (let i = 1; i < cols; i++) {
      const x = (canvas.width * i) / cols;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    for (let i = 1; i < rows; i++) {
      const y = (canvas.height * i) / rows;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  }, [image, rows, cols]);

  useEffect(() => {
    updatePreview();
    if (image) {
      const newTiles = splitImageIntoGrid(image, rows, cols, 1080);
      setTiles(newTiles);
    }
  }, [image, rows, cols, updatePreview]);

  // Handle file upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const loadedImage = await loadImage(file);
      setImage(loadedImage);
      setImageLoaded(true);
      const newTiles = splitImageIntoGrid(loadedImage, rows, cols, 1080);
      setTiles(newTiles);
    } catch (err) {
      console.error('Failed to load image:', err);
      alert('Failed to load image. Please try another file.');
    }
  };

  // Download a single tile
  const handleDownloadTile = async (index: number) => {
    if (!tiles[index]) return;
    await downloadCanvas(tiles[index], `tile-${index + 1}`, outputFormat, 0.95);
  };

  // Download all tiles as ZIP
  const handleDownloadZip = async () => {
    if (tiles.length === 0) return;
    await createZipDownload(tiles, 'photocroply-grid', outputFormat, 0.95);
  };

  return (
    <div className="w-full">
      {/* Upload Area */}
      {!imageLoaded && (
        <div
          className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-12 text-center cursor-pointer hover:border-primary dark:hover:border-darkmode-primary transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
          <svg
            className="mx-auto h-12 w-12 text-gray-400 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
            Click to upload your image
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            For best results, use a high-resolution square image
          </p>
        </div>
      )}

      {imageLoaded && (
        <div className="space-y-6">
          {/* Grid Preset Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Choose Grid Layout
            </label>
            <div className="flex flex-wrap gap-3">
              {GRID_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => {
                    setRows(preset.rows);
                    setCols(preset.cols);
                  }}
                  className={`px-4 py-2 rounded-md border ${
                    rows === preset.rows && cols === preset.cols
                      ? 'bg-primary text-white border-primary dark:bg-darkmode-primary dark:text-text-dark dark:border-darkmode-primary'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preview with grid lines */}
          <div className="flex justify-center">
            <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden shadow-lg inline-block">
              <canvas ref={previewCanvasRef} className="max-w-full h-auto" />
            </div>
          </div>

          {/* Preview Tiles with download buttons */}
          <div>
            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-4">
              Tiles Preview
            </h3>
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                maxWidth: `${cols * 150}px`,
                margin: '0 auto',
              }}
            >
              {tiles.map((canvas, index) => (
                <div key={index} className="relative group">
                  <div className="relative border border-gray-200 dark:border-gray-700 rounded overflow-hidden shadow">
                    <canvas
                      width={1080}
                      height={1080}
                      style={{ width: '100%', height: 'auto' }}
                      ref={(el) => {
                        if (el) {
                          const ctx = el.getContext('2d')!;
                          ctx.drawImage(canvas, 0, 0, 1080, 1080);
                        }
                      }}
                    />
                    <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                      #{index + 1}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownloadTile(index)}
                    className="mt-2 w-full px-3 py-2 text-sm bg-primary text-white hover:opacity-90 dark:bg-darkmode-primary dark:text-text-dark rounded transition-colors"
                  >
                    Download #{index + 1}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 space-y-4">
            {/* Export Format */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Export Format
              </label>
              <div className="flex flex-wrap gap-3">
                {(['png', 'jpeg', 'webp'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setOutputFormat(fmt)}
                    className={`px-4 py-2 rounded-md border ${
                      outputFormat === fmt
                        ? 'bg-primary text-white border-primary dark:bg-darkmode-primary dark:text-text-dark dark:border-darkmode-primary'
                        : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-4 pt-4">
              <button
                onClick={handleDownloadZip}
                className="px-6 py-3 bg-primary text-white hover:opacity-90 dark:bg-darkmode-primary dark:text-text-dark font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Download All (ZIP)
              </button>
              <button
                onClick={() => {
                  setImageLoaded(false);
                  setImage(null);
                  setTiles([]);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="px-6 py-3 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors"
              >
                Upload New Image
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GridSplitter;

