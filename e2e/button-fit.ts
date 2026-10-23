import type { Page } from '@playwright/test'

// Buttons whose text doesn't fit: their content is taller or wider than the
// button itself (it runs over the edge). Text that is deliberately cut off
// with an ellipsis (`truncate`) fits by definition; switches aren't text.
export async function overflowingButtons(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const found: string[] = []
    const candidates = document.querySelectorAll<HTMLElement>('button, [role="button"], a[data-slot="button"], label:has(> input[type="radio"])')
    for (const el of candidates) {
      const rect = el.getBoundingClientRect()
      // A switch's larger tap area isn't text running over.
      if (el.getAttribute('role') === 'switch' || el.dataset.slot === 'switch') continue
      if (!rect.width || !rect.height || getComputedStyle(el).visibility === 'hidden') continue
      const ellipsis = [el, ...el.querySelectorAll<HTMLElement>('*')].some((e) => getComputedStyle(e).textOverflow === 'ellipsis')
      const tall = el.scrollHeight > el.clientHeight + 1
      const wide = !ellipsis && el.scrollWidth > el.clientWidth + 1
      if (tall || wide) found.push(`"${(el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 60)}" ${el.clientWidth}×${el.clientHeight} needs ${el.scrollWidth}×${el.scrollHeight}`)
    }
    return found
  })
}
