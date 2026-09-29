import { useOrg } from './org-context'

// No organization yet, and this person may make (or import) its first one.
export function useNeedsFirstOrganization(): boolean {
  const { orgs, loading, capabilities } = useOrg()
  return !loading && orgs.length === 0 && !!(capabilities?.canCreateOrganization || capabilities?.canImportOrganization)
}
