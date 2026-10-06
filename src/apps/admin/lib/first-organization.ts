import { useOrg } from './org-context'

// No organization yet, and this person may make (or import) its first one.
export function useNeedsFirstOrganization(): boolean {
  const { orgs, loading, capabilities } = useOrg()
  return !loading && orgs.length === 0 && !!(capabilities?.canCreateOrganization || capabilities?.canImportOrganization)
}

// No organization, and no way to make one here (not an instance admin, a
// demo instance, or an own instance that already has its org): not a member.
export function useNoMembership(): boolean {
  const { orgs, loading, capabilities } = useOrg()
  return !loading && orgs.length === 0 && !!capabilities && !capabilities.canCreateOrganization && !capabilities.canImportOrganization
}
