import kabouterLogo from '@/shared/assets/kabouter.png'
import { useMessages } from '@/shared/i18n'
import { useVersionInfo, versionLabel } from '@/shared/source-url'
import { ADMIN_SHELL_MESSAGES } from '../messages/shell'

export function AppFooter() {
  const m = useMessages(ADMIN_SHELL_MESSAGES)
  const info = useVersionInfo()
  const sourceUrl = info.sourceUrl
  const version = versionLabel(info)
  return (
    <footer className="flex items-center justify-center gap-2 border-t px-6 py-3 text-xs text-muted-foreground">
      <img src={kabouterLogo} alt="" className="h-5 w-5 shrink-0 dark:invert" />
      <a
        href="https://kaboutersoft.be"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-foreground hover:underline"
      >
        {m.servedBy}
      </a>
      <span aria-hidden="true">·</span>
      <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:text-foreground hover:underline" title={m.freeSoftware}>
        {m.sourceCode}
      </a>
      {version && (
        <>
          <span aria-hidden="true">·</span>
          <span data-testid="app-version" title={m.installedVersion}>
            {version}
          </span>
        </>
      )}
    </footer>
  )
}
