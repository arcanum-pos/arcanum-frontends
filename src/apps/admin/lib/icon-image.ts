// An uploaded image as app icons: a PNG per size the browsers ask for (96 the
// tab, 180 iOS, 192 and 512 Android and computers), drawn here — a Worker
// can't resize images. On white (iOS turns transparency black), the image
// fitted in whole: a wide logo gets white above and below.
export const ICON_SIZES = [96, 180, 192, 512] as const

async function load(file: Blob): Promise<HTMLImageElement> {
  const img = new Image()
  img.src = URL.createObjectURL(file)
  try {
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(img.src)
  }
}

export async function iconSizes(file: Blob): Promise<Record<number, string>> {
  const img = await load(file)
  // An SVG without its own size: drawn square.
  const width = img.naturalWidth || 512
  const height = img.naturalHeight || 512
  const out: Record<number, string> = {}
  for (const size of ICON_SIZES) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size, size)
    const scale = Math.min(size / width, size / height)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, (size - width * scale) / 2, (size - height * scale) / 2, width * scale, height * scale)
    out[size] = canvas.toDataURL('image/png').split(',')[1]
  }
  return out
}

// The customer display's logo (Weergave → Klantscherm): the image as a PNG of
// at most 512 px a side, its own shape kept and its transparency too — drawn
// here, so whatever was uploaded (an SVG too) arrives as a plain PNG.
export const LOGO_MAX_SIDE = 512

export async function logoPng(file: Blob): Promise<string> {
  const img = await load(file)
  const width = img.naturalWidth || LOGO_MAX_SIDE
  const height = img.naturalHeight || LOGO_MAX_SIDE
  const scale = Math.min(1, LOGO_MAX_SIDE / width, LOGO_MAX_SIDE / height)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png').split(',')[1]
}
