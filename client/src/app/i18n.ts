export const messages = {
  "app.name": "MooNsEstate",
  "app.loading": "Loading workspace…",
  "nav.dashboard": "Dashboard",
  "nav.pipeline": "Deal pipeline",
  "nav.collapse": "Collapse navigation",
  "nav.expand": "Expand sidebar",
  "workspace.label": "Workspace",
  "workspace.switch": "Switch workspace",
  "workspace.current": "Current workspace",
  "notifications.label": "Notifications",
  "notifications.empty": "You are all caught up.",
  "notifications.openInbox": "Open conversations inbox",
  "search.workspace": "Search workspace",
  "search.pages": "Search pages and modules…",
  "account.menu": "Account menu",
  "account.profile": "Profile",
  "account.signOut": "Sign out",
} as const

export type MessageKey = keyof typeof messages

export const t = (key: MessageKey) => messages[key]
