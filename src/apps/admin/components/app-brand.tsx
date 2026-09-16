import kabouterLogo from '../assets/kabouter.png'

export function AppBrand() {
  return (
    <div className="ml-auto flex items-center gap-2 text-xl">
      <img src={kabouterLogo} alt="" className="h-[1em] w-[1em] shrink-0 object-contain" />
      <span className="font-[Montserrat] font-bold tracking-tight">arcanum</span>
    </div>
  )
}
