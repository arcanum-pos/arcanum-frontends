import kabouterLogo from '@/shared/assets/kabouter.png'
import { useSourceUrl } from '@/shared/source-url'

export function AppFooter() {
  const sourceUrl = useSourceUrl()
  return (
    <footer className="flex items-center justify-center gap-2 border-t px-6 py-3 text-xs text-muted-foreground">
      <img src={kabouterLogo} alt="" className="h-5 w-5 shrink-0 dark:invert" />
      <a
        href="https://kaboutersoft.be"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-foreground hover:underline"
      >
        Voor u geserveerd door kaboutersoft.be
      </a>
      <span aria-hidden="true">·</span>
      <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:text-foreground hover:underline" title="Arcanum is vrije software (AGPL-3.0)">
        Broncode
      </a>
    </footer>
  )
}
