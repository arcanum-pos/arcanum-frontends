import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { mockWhoami } from '../../lib/mock-data'

function initials(name: string): string {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

// TODO: source from questo-bff's /whoami once this app runs behind it with
// a real session, instead of mockWhoami.
export default function ProfilePage() {
  const user = mockWhoami

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-medium">Profile</h2>
        <p className="text-sm text-muted-foreground">Je identiteit, zoals bevestigd door je identity provider.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Wie ben ik</CardTitle>
          <CardDescription>Alleen-lezen — wijzig dit bij je identity provider zelf.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="size-14">
            <AvatarFallback className="text-lg">{initials(user.name)}</AvatarFallback>
          </Avatar>
          <dl className="grid gap-1 text-sm">
            <div className="flex gap-2">
              <dt className="w-20 text-muted-foreground">Naam</dt>
              <dd className="font-medium">{user.name}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-20 text-muted-foreground">E-mail</dt>
              <dd className="font-medium">{user.email}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-20 text-muted-foreground">Sub</dt>
              <dd className="font-mono text-xs text-muted-foreground">{user.sub}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
