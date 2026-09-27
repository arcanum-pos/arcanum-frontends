import { BarChart3 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useMessages } from '@/shared/i18n'
import { ADMIN_SHELL_MESSAGES } from '../messages/shell'

// Reserved space — a more elaborate sales-figures view than today's plain
// transactions list (webapp/src/pages/transactions.astro), not implemented
// yet. Layout only: KPI row + a chart placeholder, matching where real
// numbers (today/this event/by payment method) will land.
export default function DashboardPage() {
  const m = useMessages(ADMIN_SHELL_MESSAGES)
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{m.nav.dashboard}</h1>
        <p className="text-muted-foreground">{m.dashboardSubtitle}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(m.kpis).map(([key, label]) => (
          <Card key={key}>
            <CardHeader className="pb-2">
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-2xl">—</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{m.salesOverTime}</CardTitle>
          <CardDescription>{m.notImplemented}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center rounded-md border border-dashed text-muted-foreground">
            <BarChart3 className="mr-2 size-5" />
            {m.chartComing}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
