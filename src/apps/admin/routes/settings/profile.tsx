import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { whoami } from '../../lib/api'
import { useAsync } from '../../lib/use-async'

function initials(name: string): string {
  return name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

export default function ProfilePage() {
  const { data: user, loading, error } = useAsync(whoami, [])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-medium">Profile</h2>
        <p className="text-sm text-muted-foreground">Je identiteit, zoals bevestigd door je identity provider.</p>
      </div>

      {error && <p className="text-sm text-destructive">Kon profiel niet laden: {error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Wie ben ik</CardTitle>
          <CardDescription>Alleen-lezen — wijzig dit bij je identity provider zelf.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          {loading || !user ? (
            <>
              <Skeleton className="size-14 rounded-full" />
              <div className="grid gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-48" />
              </div>
            </>
          ) : (
            <>
              <Avatar className="size-14">
                <AvatarFallback className="text-lg">{initials(user.name || user.email)}</AvatarFallback>
              </Avatar>
              <dl className="grid gap-1 text-sm">
                <div className="flex gap-2">
                  <dt className="w-20 text-muted-foreground">Naam</dt>
                  <dd className="font-medium">{user.name || '—'}</dd>
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
