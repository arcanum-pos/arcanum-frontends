import kabouterLogo from './assets/kabouter.png'
import { cn } from 'cn'

export function AppBrand({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2 text-xl', className)}>
      <img src={kabouterLogo} alt="" className="h-[1em] w-[1em] shrink-0 object-contain dark:invert" />
      <span className="font-[Montserrat] font-bold tracking-tight">arcanum</span>
    </div>
  )
}
