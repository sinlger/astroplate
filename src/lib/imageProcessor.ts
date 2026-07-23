/**
 * SocialCrop - Image Processor Utilities
 * All image processing happens client-side using Canvas API
 */

export interface PresetSize {
  name: string;
  width: number;
  height: number;
  aspectRatio: number;
}

export interface ProcessingOptions {
  targetWidth: number;
  targetHeight: number;
  padding?: 'none' | 'blur' | 'color';
  fillColor?: string;
  quality?: number;
  format?: 'png' | 'jpeg' | 'webp';
}

export interface GridSplitOptions {
  rows: number;
  cols: number;
}

// Common platform presets
export const PRESETS = {
  youtube: {
    thumbnail: { name: 'YouTube Thumbnail', width: 1280, height: 720, aspectRatio: 16/9 }
  },
  instagram: {
    square: { name: 'Square Post', width: 1080, height: 1080, aspectRatio: 1/1 },
    portrait: { name: 'Portrait Post', width: 1080, height: 1350, aspectRatio: 4/5 },
    story: { name: 'Story/Reels', width: 1080, height: 1920, aspectRatio: 9/16 }
  },
  twitter: {
    header: { name: 'Twitter Header', width: 1500, height: 500, aspectRatio: 3/1 }
  },
  common: {
    '1:1': { name: 'Square 1:1', width: 1080, height: 1080, aspectRatio: 1 },
    '4:5': { name: 'Portrait 4:5', width: 1080, height: 1350, aspectRatio: 4/5 },
    '16:9': { name: 'Landscape 16:9', width: 1280, height: 720, aspectRatio: 16/9 },
    '9:16': { name: 'Vertical 9:16', width: 1080, height: 1920, aspectRatio: 9/16 }
  }
};

/**
 * Load image from File object
 */
export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve(img);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Draw image with smart padding (blur or color fill)
 */
export function drawWithPadding(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  options: ProcessingOptions
): void {
  const { targetWidth, targetHeight, padding = 'blur', fillColor = '#ffffff' } = options;

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  // Calculate scale to fit the entire image within target bounds
  const imgRatio = img.width / img.height;
  const targetRatio = targetWidth / targetHeight;

  let drawWidth: number;
  let drawHeight: number;
  let offsetX: number;
  let offsetY: number;

  if (imgRatio > targetRatio) {
    // Image is wider than target - fit width
    drawWidth = targetWidth;
    drawHeight = targetWidth / imgRatio;
    offsetY = (targetHeight - drawHeight) / 2;
    offsetX = 0;
  } else {
    // Image is taller than target - fit height
    drawHeight = targetHeight;
    drawWidth = targetHeight * imgRatio;
    offsetX = (targetWidth - drawWidth) / 2;
    offsetY = 0;
  }

  if (padding === 'blur') {
    // Create blurred background from scaled image
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCanvas.width = targetWidth;
    tempCanvas.height = targetHeight;

    // Draw scaled image to temp canvas for blur effect
    tempCtx.drawImage(img, 0, 0, targetWidth, targetHeight);
    ctx.filter = 'blur(20px)';
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.filter = 'none';
  } else if (padding === 'color') {
    ctx.fillStyle = fillColor;
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  }

  // Draw the main image centered
  ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
}

/**
 * Crop image to exact dimensions
 */
export function cropImage(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cropX: number,
  cropY: number,
  cropWidth: number,
  cropHeight: number,
  targetWidth: number,
  targetHeight: number
): void {
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  ctx.drawImage(
    img,
    cropX, cropY, cropWidth, cropHeight,
    0, 0, targetWidth, targetHeight
  );
}

/**
 * Split image into grid
 */
export function splitImageIntoGrid(
  img: HTMLImageElement,
  rows: number,
  cols: number,
  targetSize: number = 1080
): HTMLCanvasElement[] {
  const result: HTMLCanvasElement[] = [];
  const tileWidth = img.width / cols;
  const tileHeight = img.height / rows;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = targetSize;
      canvas.height = targetSize;

      const sourceX = col * tileWidth;
      const sourceY = row * tileHeight;

      ctx.drawImage(
        img,
        sourceX, sourceY, tileWidth, tileHeight,
        0, 0, targetSize, targetSize
      );

      result.push(canvas);
    }
  }

  return result;
}

/**
 * Extract dominant color from image (for color fill)
 */
export function extractDominantColor(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement
): string {
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCanvas.width = 10;
  tempCanvas.height = 10;
  tempCtx.drawImage(img, 0, 0, 10, 10);

  const imageData = tempCtx.getImageData(0, 0, 10, 10);
  const data = imageData.data;

  let r = 0, g = 0, b = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }

  const count = data.length / 4;
  r = Math.round(r / count);
  g = Math.round(g / count);
  b = Math.round(b / count);

  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Check image quality against target dimensions
 */
export function checkImageQuality(
  imgWidth: number,
  imgHeight: number,
  targetWidth: number,
  targetHeight: number
): 'low' | 'good' | 'perfect' {
  const imgArea = imgWidth * imgHeight;
  const targetArea = targetWidth * targetHeight;

  if (imgArea < targetArea * 0.8) {
    return 'low';
  } else if (imgArea < targetArea * 1.2) {
    return 'good';
  } else {
    return 'perfect';
  }
}

/**
 * Export canvas to Blob/File
 */
export function exportCanvas(
  canvas: HTMLCanvasElement,
  format: 'png' | 'jpeg' | 'webp' = 'png',
  quality: number = 0.9
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const mimeType = {
      png: 'image/png',
      jpeg: 'image/jpeg',
      webp: 'image/webp'
    }[format];

    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob'));
        }
      },
      mimeType,
      quality
    );
  });
}

/**
 * Download canvas as file
 */
export async function downloadCanvas(
  canvas: HTMLCanvasElement,
  filename: string,
  format: 'png' | 'jpeg' | 'webp' = 'png',
  quality: number = 0.9
): Promise<void> {
  const blob = await exportCanvas(canvas, format, quality);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Create ZIP of multiple canvases using JSZip
 */
export async function createZipDownload(
  canvases: HTMLCanvasElement[],
  baseName: string,
  format: 'png' | 'jpeg' | 'webp' = 'png',
  quality: number = 0.9
): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  for (let i = 0; i < canvases.length; i++) {
    const blob = await exportCanvas(canvases[i], format, quality);
    zip.file(`${baseName}-${i + 1}.${format}`, blob);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

