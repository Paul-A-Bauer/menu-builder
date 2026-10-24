// Downscale uploads so the database stays small. WebP keeps transparency for cut-out photos.
export async function shrinkImage(file, max = 900) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res) => canvas.toBlob((b) => res(b || file), 'image/webp', 0.9));
}
