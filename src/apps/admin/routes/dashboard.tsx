import { BarChart3 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Reserved space — a more elaborate sales-figures view than today's plain
// transactions list (webapp/src/pages/transactions.astro), not implemented
// yet. Layout only: KPI row + a chart placeholder, matching where real
// numbers (today/this event/by payment method) will land.
export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Verkoopcijfers voor de huidige organisatie.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {['Omzet vandaag', 'Transacties vandaag', 'Gemiddeld bonbedrag', 'Actief event'].map((label) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-2xl">—</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Verkoop over tijd</CardTitle>
          <CardDescription>Nog niet geïmplementeerd — gereserveerde ruimte.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center rounded-md border border-dashed text-muted-foreground">
            <BarChart3 className="mr-2 size-5" />
            Grafiek volgt
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
