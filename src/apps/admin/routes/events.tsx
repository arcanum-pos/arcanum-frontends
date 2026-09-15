import { TicketCheck } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// Doesn't exist as a backend concept yet. Once it does: events will hold
// their own menu/catalogue, and drive what a kassa for that event shows.
export default function EventsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
          <p className="text-muted-foreground">Beheer menu's/catalogi per event — bepaalt wat de kassa toont.</p>
        </div>
        <Button disabled>Nieuw event</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nog niet beschikbaar</CardTitle>
          <CardDescription>Events bestaan nog niet als backend-concept.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-md border border-dashed text-muted-foreground">
            <TicketCheck className="size-6" />
            <p className="text-sm">Zodra events bestaan, komt hier het overzicht.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
