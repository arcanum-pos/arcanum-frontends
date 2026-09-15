import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { mockPaymentCredentials, type MockPaymentCredential } from '../../lib/mock-data'

const PROVIDER_LABELS: Record<MockPaymentCredential['provider'], string> = {
  bancontact: 'Bancontact',
  sumup: 'SumUp',
}

// TODO: replace mock state with listPaymentCredentials/setPaymentCredential
// against /api/organizations/:orgId/payment-credentials/:provider (same
// endpoints webapp's admin-org.astro payment panel already uses).
export default function PaymentProvidersPage() {
  const [editing, setEditing] = useState<MockPaymentCredential['provider'] | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-medium">Payment Providers</h2>
        <p className="text-sm text-muted-foreground">Betaalproviders gekoppeld aan deze organisatie.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {mockPaymentCredentials.map((cred) => (
          <Card key={cred.provider}>
            <CardHeader className="flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>{PROVIDER_LABELS[cred.provider]}</CardTitle>
                <CardDescription>{cred.provider}</CardDescription>
              </div>
              <Badge variant={cred.configured ? 'default' : 'secondary'}>
                {cred.configured ? 'Geconfigureerd' : 'Niet geconfigureerd'}
              </Badge>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" onClick={() => setEditing(cred.provider)}>
                Sleutels instellen
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing && PROVIDER_LABELS[editing]} — sleutels</DialogTitle>
            <DialogDescription>Worden versleuteld opgeslagen (envelope encryption per organisatie).</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {editing === 'sumup' && (
              <div className="grid gap-2">
                <Label htmlFor="sumup-merchant">Merchant code</Label>
                <Input id="sumup-merchant" autoComplete="off" />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="provider-api-key">API-key</Label>
              <Input id="provider-api-key" type="password" autoComplete="new-password" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setEditing(null)}>Opslaan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
