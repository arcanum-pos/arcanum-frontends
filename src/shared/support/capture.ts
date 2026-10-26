// The screenshot: drawn from the page itself (modern-screenshot), so there's
// no "share this tab?" prompt and it works on iPad too. Close to the real
// thing, not pixel-exact: an image from another site without CORS is left
// out. JPEG, about 1x: a few hundred KB. Whatever carries
// data-support-ignore (the ? button, its dialog) isn't in it.
export async function captureScreenshot(): Promise<Blob | null> {
  try {
    const { domToBlob } = await import('modern-screenshot')
    const scale = Math.min(devicePixelRatio || 1, 1.5, 2000 / Math.max(1, innerWidth))
    const background = getComputedStyle(document.body).backgroundColor
    const blob = await domToBlob(document.body, {
      type: 'image/jpeg',
      quality: 0.8,
      scale,
      backgroundColor: background && background !== 'rgba(0, 0, 0, 0)' ? background : '#ffffff',
      timeout: 3000,
      filter: (node) => !(node instanceof Element && node.hasAttribute('data-support-ignore')),
    })
    return blob.size > 0 && blob.size <= 5 * 1024 * 1024 ? blob : null
  } catch (err) {
    console.warn('screenshot failed', err)
    return null
  }
}
