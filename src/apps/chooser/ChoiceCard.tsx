export function ChoiceCard({ title, hint, onClick }: { title: string; hint?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col items-start gap-1 rounded-xl bg-card px-4 py-4 text-left text-sm text-card-foreground ring-1 ring-foreground/10 transition-colors hover:bg-muted/50"
    >
      <span className="font-heading text-base font-semibold">{title}</span>
      {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
    </button>
  )
}
