import type { Access, PayloadRequest } from 'payload'

type Role = 'admin' | 'editor' | 'viewer'
type WithRole = { role?: Role | null } | null | undefined

export const roleOf = (user: WithRole): Role | undefined => user?.role ?? undefined

export const isAdmin: Access = ({ req: { user } }) => roleOf(user) === 'admin'
export const isEditorOrAdmin: Access = ({ req: { user } }) => {
  const role = roleOf(user)
  return role === 'admin' || role === 'editor'
}
export const isPublic: Access = () => true

/** Admins manage every user; everyone else can only reach their own record. */
export const isAdminOrSelf: Access = ({ req: { user } }) => {
  if (!user) return false
  if (roleOf(user) === 'admin') return true
  return { id: { equals: user.id } }
}

/** Standard content access: public read, editors write, admins delete. */
export const contentAccess = {
  create: isEditorOrAdmin,
  read: isPublic,
  update: isEditorOrAdmin,
  delete: isAdmin,
}

export const hasRole = (req: PayloadRequest, ...roles: Role[]): boolean => {
  const role = roleOf(req.user as WithRole)
  return !!role && roles.includes(role)
}
