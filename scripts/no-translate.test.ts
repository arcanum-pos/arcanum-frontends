// The staff screens are never machine-translated: they come in nl, fr and
// en already, a browser translating behind React's back breaks the screen,
// and Edge offers it by the page's lang="nl" before the screen's own
// language is set. Self-ordering may be: a guest's phone, the menu's names.
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.resolve(import.meta.dirname, '..')
const pages = readdirSync(root).filter((f) => f.endsWith('.html'))
const TRANSLATABLE = ['selforder.html']

describe('no translation offer on the staff screens', () => {
  it.each(pages.filter((p) => !TRANSLATABLE.includes(p)))('%s', (page) => {
    const html = readFileSync(path.join(root, page), 'utf8')
    expect(html).toMatch(/<html lang="[a-z]{2}" translate="no">/)
    expect(html).toContain('<meta name="google" content="notranslate" />')
  })

  it('self-ordering may be translated', () => {
    expect(readFileSync(path.join(root, 'selforder.html'), 'utf8')).not.toContain('notranslate')
  })
})
