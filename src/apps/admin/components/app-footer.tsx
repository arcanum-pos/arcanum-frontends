import kabouterLogo from '@/shared/assets/kabouter.png'

export function AppFooter() {
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
    </footer>
  )
}
