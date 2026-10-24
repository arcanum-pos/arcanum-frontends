// The design review pack, again and again (npm run review-pack): the screens
// of screenshots/review-pack.spec.ts written to ../design-review/<date>/,
// with the brief (screenshots/review-brief.md) and pack.json (when and from
// which commit). Prints what changed since the previous pack, the commits and
// the releases, as the input for its CHANGES.md. A rerun on the same day
// replaces the screens and keeps CHANGES.md and feedback/.
//
//   npm run review-pack                 the screens, the brief, what changed
//   npm run review-pack -- --zip        the folder as one zip beside it, for upload
//   npm run review-pack -- --out DIR    another folder
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const reviews = path.resolve(repo, '../design-review')
const releases = path.resolve(repo, '../arcanum-releases')
const AREAS = ['kassa', 'cfd', 'console']

const args = process.argv.slice(2)
const today = new Date().toISOString().slice(0, 10)
const outAt = args.indexOf('--out')
const out = outAt >= 0 ? path.resolve(args[outAt + 1]) : path.join(reviews, today)
const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8' }).trim()

if (args.includes('--zip')) {
  if (!existsSync(path.join(out, 'pack.json'))) throw new Error(`no pack in ${out}`)
  const zip = path.join(path.dirname(out), `arcanum-design-review-${path.basename(out)}.zip`)
  rmSync(zip, { force: true })
  execFileSync('zip', ['-qrX', zip, path.basename(out), '-x', '*/feedback/*', '*.DS_Store'], { cwd: path.dirname(out), stdio: 'inherit' })
  console.log(zip)
  process.exit(0)
}

// The previous pack: the latest other dated folder with a pack.json.
const previous = existsSync(reviews)
  ? readdirSync(reviews)
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && path.join(reviews, d) !== out && existsSync(path.join(reviews, d, 'pack.json')))
      .sort()
      .map((d) => ({ dir: d, ...JSON.parse(readFileSync(path.join(reviews, d, 'pack.json'), 'utf8')) }))
      .at(-1)
  : undefined

for (const area of AREAS) rmSync(path.join(out, area), { recursive: true, force: true })
mkdirSync(out, { recursive: true })
execFileSync('npx', ['playwright', 'test', '-c', 'playwright.screenshots.config.ts', 'review-pack.spec.ts'], {
  cwd: repo,
  stdio: 'inherit',
  env: { ...process.env, REVIEW_DIR: out },
})
copyFileSync(path.join(repo, 'screenshots/review-brief.md'), path.join(out, 'BRIEF.md'))
mkdirSync(path.join(out, 'feedback'), { recursive: true })

const screens = AREAS.flatMap((a) => (existsSync(path.join(out, a)) ? readdirSync(path.join(out, a)).filter((f) => f.endsWith('.png')).map((f) => `${a}/${f.slice(0, -4)}`) : [])).sort()
const commit = git('rev-parse', 'HEAD')
const dirty = git('status', '--porcelain', '--', 'src', 'screenshots') !== ''
writeFileSync(path.join(out, 'pack.json'), JSON.stringify({ madeAt: new Date().toISOString(), frontendsCommit: commit, uncommittedChanges: dirty, screens }, null, 2) + '\n')

console.log(`\nThe pack: ${out} (${screens.length} screens)`)
if (!previous) process.exit(0)
console.log(`\n== Since the previous pack (${previous.dir}, ${previous.frontendsCommit.slice(0, 7)})`)
const added = screens.filter((s) => !previous.screens.includes(s))
const gone = previous.screens.filter((s) => !screens.includes(s))
if (added.length) console.log(`New screens: ${added.join(', ')}`)
if (gone.length) console.log(`Screens gone: ${gone.join(', ')}`)
console.log('\nCommits (arcanum-frontends):')
console.log(git('log', '--reverse', '--format=- %s', `${previous.frontendsCommit}..HEAD`) || '(none)')
if (existsSync(path.join(releases, 'releases.json'))) {
  const index = JSON.parse(readFileSync(path.join(releases, 'releases.json'), 'utf8'))
  const since = index.releases.filter((r) => r.released_at > previous.madeAt).reverse()
  for (const r of since) {
    const notes = path.join(releases, 'notes', `${r.version}.md`)
    if (existsSync(notes)) console.log(`\n-- Release ${r.version}\n${readFileSync(notes, 'utf8').trim()}`)
  }
}
