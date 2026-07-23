import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { PresetSize, ProcessingOptions } from '@/lib/imageProcessor';
import {
  loadImage,
  drawWithPadding,
  cropImage,
  checkImageQuality,
  downloadCanvas
} from '@/lib/imageProcessor';

export interface ImageEditorProps {
  preset?: PresetSize;
  allowPadding?: boolean;
  defaultPadding?: ProcessingOptions['padding'];
  showAvatarOverlay?: boolean;
}

const ImageEditor: React.FC<ImageEditorProps> = ({
  preset,
  allowPadding = false,
  defaultPadding = 'none',
  showAvatarOverlay = false,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [quality, setQuality] = useState<'low' | 'good' | 'perfect'>('low');
  const [padding, setPadding] = useState<ProcessingOptions['padding']>(defaultPadding);
  const [fillColor, setFillColor] = useState('#ffffff');
  const [outputFormat, setOutputFormat] = useState<'png' | 'jpeg' | 'webp'>('png');

  // Active preset can be updated at runtime by the page's preset buttons
  // (via the `socialcrop:preset-change` window event), so switching a preset
  // re-renders the already-uploaded image in the new aspect ratio.
  const [activePreset, setActivePreset] = useState<PresetSize | undefined>(preset);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const outputCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Crop selection state
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const targetWidth = activePreset?.width || preset?.width || 800;
  const targetHeight = activePreset?.height || preset?.height || 600;
  const aspectRatio = activePreset?.aspectRatio || preset?.aspectRatio || targetWidth / targetHeight;

  // Listen for preset changes dispatched from the page's preset buttons
  useEffect(() => {
    const handlePresetChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as PresetSize | undefined;
      if (detail && typeof detail.width === 'number' && typeof detail.height === 'number') {
        setActivePreset({
          name: detail.name ?? '',
          width: detail.width,
          height: detail.height,
          aspectRatio: detail.aspectRatio ?? detail.width / detail.height,
        });
      }
    };
    window.addEventListener('socialcrop:preset-change', handlePresetChange);
    return () => window.removeEventListener('socialcrop:preset-change', handlePresetChange);
  }, []);

  // Initialize crop when image loads
  useEffect(() => {
    if (!image) return;

    const q = checkImageQuality(image.width, image.height, targetWidth, targetHeight);
    setQuality(q);

    // Center crop by default
    let cropW: number;
    let cropH: number;

    const imgRatio = image.width / image.height;

    if (imgRatio > aspectRatio) {
      cropH = image.height;
      cropW = cropH * aspectRatio;
    } else {
      cropW = image.width;
      cropH = cropW / aspectRatio;
    }

    setCrop({
      x: (image.width - cropW) / 2,
      y: (image.height - cropH) / 2,
      width: cropW,
      height: cropH,
    });
  }, [image, targetWidth, targetHeight, aspectRatio]);

  // Update preview canvas
  const updatePreview = useCallback(() => {
    if (!image || !previewCanvasRef.current) return;

    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d')!;

    if (padding !== 'none' && allowPadding) {
      drawWithPadding(canvas, ctx, image, {
        targetWidth,
        targetHeight,
        padding,
        fillColor,
      });
    } else if (image && crop.width > 0) {
      cropImage(canvas, ctx, image, crop.x, crop.y, crop.width, crop.height, targetWidth, targetHeight);
    }
  }, [image, crop, targetWidth, targetHeight, padding, allowPadding, fillColor]);

  useEffect(() => {
    updatePreview();
  }, [updatePreview]);

  // Handle file upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const loadedImage = await loadImage(file);
      setImage(loadedImage);
      setImageLoaded(true);
    } catch (err) {
      console.error('Failed to load image:', err);
      alert('Failed to load image. Please try another file.');
    }
  };

  // Mouse event handlers for dragging crop
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!image || !containerRef.current) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !image || !containerRef.current) return;

    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;

    setDragStart({ x: e.clientX, y: e.clientY });
    setCrop(prev => ({
      ...prev,
      x: Math.max(0, Math.min(image.width - prev.width, prev.x + dx)),
      y: Math.max(0, Math.min(image.height - prev.height, prev.y + dy)),
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Download processed image
  const handleDownload = async () => {
    if (!previewCanvasRef.current) return;
    await downloadCanvas(previewCanvasRef.current, 'socialcrop', outputFormat, 0.95);
  };

  // Get quality indicator text and color
  const getQualityInfo = () => {
    switch (quality) {
      case 'low':
        return { text: 'Low Resolution Warning', color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-200' };
      case 'good':
        return { text: 'Good Quality', color: 'text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-200' };
      case 'perfect':
        return { text: 'Perfect HD Quality', color: 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-200' };
    }
  };

  const qualityInfo = getQualityInfo();

  return (
    <div className="w-full" ref={containerRef}>
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
            Click to upload an image
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            or drag and drop (PNG, JPG, WebP up to 10MB)
          </p>
        </div>
      )}

      {/* Editor Area */}
      {imageLoaded && (
        <div className="space-y-6">
          {/* Quality Indicator */}
          {activePreset && (
            <div className="flex items-center justify-center">
              <span className={`px-4 py-2 rounded-full text-sm font-medium ${qualityInfo.color}`}>
                {qualityInfo.text}
              </span>
            </div>
          )}

          {/* Preview Canvas */}
          <div className="flex justify-center">
            <div className="relative inline-block border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden shadow-lg">
              <canvas
                ref={previewCanvasRef}
                width={targetWidth}
                height={targetHeight}
                className={`max-w-full h-auto cursor-move ${isDragging ? 'cursor-grabbing' : ''}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              />
              {/* Avatar Overlay for Twitter Header */}
              {showAvatarOverlay && (
                <div className="absolute bottom-0 left-0 w-1/4 h-1/3 pointer-events-none">
                  <div className="absolute bottom-4 left-4 w-20 h-20 md:w-32 md:h-32 border-2 border-dashed border-red-500 rounded-full bg-red-500/10"></div>
                  <div className="absolute bottom-0 left-0 bg-red-500 text-white text-xs px-2 py-1 rounded-tr">
                    Avoid placing text here
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 space-y-4">
            {/* Padding Options */}
            {allowPadding && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Background Padding
                </label>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setPadding('none')}
                    className={`px-4 py-2 rounded-md border ${
                      padding === 'none'
                        ? 'bg-primary text-white border-primary dark:bg-darkmode-primary dark:text-text-dark dark:border-darkmode-primary'
                        : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Crop
                  </button>
                  <button
                    onClick={() => setPadding('blur')}
                    className={`px-4 py-2 rounded-md border ${
                      padding === 'blur'
                        ? 'bg-primary text-white border-primary dark:bg-darkmode-primary dark:text-text-dark dark:border-darkmode-primary'
                        : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Blur Background
                  </button>
                  <button
                    onClick={() => setPadding('color')}
                    className={`px-4 py-2 rounded-md border ${
                      padding === 'color'
                        ? 'bg-primary text-white border-primary dark:bg-darkmode-primary dark:text-text-dark dark:border-darkmode-primary'
                        : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Solid Color
                  </button>
                </div>
                {padding === 'color' && (
                  <div className="mt-3">
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Select Color
                    </label>
                    <input
                      type="color"
                      value={fillColor}
                      onChange={(e) => setFillColor(e.target.value)}
                      className="h-10 w-20 rounded border border-gray-300 dark:border-gray-700"
                    />
                  </div>
                )}
              </div>
            )}

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
                onClick={handleDownload}
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
                Download Image
              </button>
              <button
                onClick={() => {
                  setImageLoaded(false);
                  setImage(null);
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

export default ImageEditor;


