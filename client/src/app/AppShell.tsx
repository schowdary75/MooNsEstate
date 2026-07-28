import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router"
import {
  Bell,
  Building2,
  Check,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  Command as CommandIcon,
  CircleDollarSign,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  type LucideIcon,
  UserRound,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { useAuth } from "./auth"
import { api, errorMessage } from "./api"
import { t } from "./i18n"
import { modules } from "./modules"

type NavigationSection = {
  label: string
  keys: readonly string[]
  links?: readonly {
    path: string
    label: string
    icon: LucideIcon
    end?: boolean
  }[]
}

const navigationSections: readonly NavigationSection[] = [
  {
    label: "Overview",
    keys: ["reports"],
    links: [
      { path: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
      { path: "/management", label: "Management intelligence", icon: LayoutDashboard },
    ],
  },
  {
    label: "Sales",
    keys: ["opportunities", "meta-acquisition"],
    links: [
      { path: "/sales", label: "Sales desk", icon: CircleDollarSign },
      { path: "/pipeline", label: "Deal pipeline", icon: Columns3 },
    ],
  },
  {
    label: "Inventory",
    keys: [],
    links: [
      { path: "/inventory", label: "Project cockpit", icon: Building2 },
      { path: "/properties", label: "Properties", icon: Building2 },
      { path: "/developers", label: "Builders & developers", icon: Building2 },
    ],
  },
  { label: "Customers", keys: ["leads", "contacts", "accounts"], links: [] },
  { label: "Activities", keys: ["followups", "tasks", "meetings", "calls", "calendar"] },
  { label: "Communications", keys: ["conversations", "emails", "email-templates"] },
  { label: "Finance", keys: ["invoices", "payments", "documents", "billing"] },
] as const

const administrationModuleKeys = [
  "users",
  "roles",
  "custom-fields",
  "validation",
  "table-fields",
  "modules",
  "images",
  "integrations",
  "settings",
] as const

type Workspace = {
  id: string
  name: string
  membershipRole?: string
  active: boolean
}

type UnreadConversation = {
  id: string
  channel: string
  unreadCount: number
  lead?: { leadName?: string } | null
}

function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link className="flex items-center gap-3 overflow-hidden" to="/">
      <div className="grid size-9 shrink-0 place-items-center rounded-full bg-black text-white">
        <span className="font-display text-lg">M</span>
      </div>
      {!collapsed && (
        <div className="min-w-0">
          <p className="truncate text-sm font-bold tracking-[0.2em]">MOON</p>
          <p className="truncate text-[9px] tracking-[0.16em] text-muted-foreground">ESTATE INTELLIGENCE</p>
        </div>
      )}
    </Link>
  )
}

function NavContent({ collapsed = false, close }: { collapsed?: boolean; close?: () => void }) {
  const { user } = useAuth()
  const location = useLocation()
  const isAdmin = ["platform_owner", "organization_owner", "organization_admin"].includes(user?.role || "")
  const visibleModules = modules.filter((item) => !item.adminOnly || isAdmin)
  const activeSection = navigationSections.find((section) =>
    (section.links?.some((item) =>
      item.end ? location.pathname === item.path : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`),
    ) || false) ||
    visibleModules.some((item) =>
      (section.keys as readonly string[]).includes(item.key) &&
      (location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)),
    ),
  )?.label
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(["Overview", activeSection].filter(Boolean) as string[]),
  )

  useEffect(() => {
    if (!activeSection) return
    setOpenSections((current) => {
      if (current.has(activeSection)) return current
      const next = new Set(current)
      next.add(activeSection)
      return next
    })
  }, [activeSection])

  const navItem = (to: string, label: string, icon: ReactNode, end = false) => (
    <NavLink
      key={to}
      end={end}
      to={to}
      onClick={close}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors",
          collapsed && "justify-center px-0",
          isActive
            ? "bg-black text-white hover:bg-black hover:text-white"
            : "text-black/70 hover:bg-black/5 hover:text-black",
        )
      }
    >
      {icon}
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  )

  return (
    <nav aria-label="Primary navigation" className="space-y-2">
      {navigationSections.map((section) => {
        const configuredLinks = section.links || []
        const moduleItems = visibleModules
          .filter((item) => (section.keys as readonly string[]).includes(item.key))
          .sort((left, right) =>
            (section.keys as readonly string[]).indexOf(left.key) -
            (section.keys as readonly string[]).indexOf(right.key),
          )
        const items = [
          ...configuredLinks.map((item) => ({
            path: item.path,
            label: item.label,
            icon: item.icon,
            end: "end" in item ? item.end : false,
          })),
          ...moduleItems.map((item) => ({
            path: item.path,
            label: item.label,
            icon: item.icon,
            end: false,
          })),
        ]
        if (!items.length) return null
        const isOpen = collapsed || openSections.has(section.label)
        const isActive = activeSection === section.label
        return (
          <div key={section.label} className={cn("rounded-xl", isActive && !collapsed && "bg-black/[0.025]")}>
            {!collapsed && (
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpenSections((current) => {
                  const next = new Set(current)
                  if (next.has(section.label)) next.delete(section.label)
                  else next.add(section.label)
                  return next
                })}
                className={cn(
                  "flex h-9 w-full items-center justify-between rounded-lg px-3 text-left text-[10px] font-bold uppercase tracking-[0.18em] transition-colors",
                  isActive ? "text-black" : "text-muted-foreground hover:bg-black/5 hover:text-black",
                )}
              >
                <span>{section.label}</span>
                <ChevronDown className={cn("size-3.5 transition-transform", !isOpen && "-rotate-90")} />
              </button>
            )}
            <div className={cn("space-y-1", !collapsed && "px-1 pb-1", !isOpen && "hidden")}>
              {items.map((item) => navItem(
                item.path,
                item.label,
                <item.icon className="size-4 shrink-0" />,
                item.end,
              ))}
            </div>
          </div>
        )
      })}
    </nav>
  )
}

export function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, logout } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const workspaces = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const response = await api.get<{ data: Workspace[] }>("/v1/organizations")
      return response.data.data
    },
  })
  const unreadConversations = useQuery({
    queryKey: ["conversations", "unread"],
    queryFn: async () => {
      const response = await api.get<{ data: UnreadConversation[] }>("/v1/conversations", {
        params: { unread: true },
      })
      return response.data.data
    },
    refetchInterval: 30_000,
  })
  const switchWorkspace = useMutation({
    mutationFn: async (organizationId: string) => {
      await api.post(`/v1/organizations/${organizationId}/switch`)
    },
    onSuccess: async () => {
      await queryClient.clear()
      window.location.assign("/")
    },
  })

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setCommandOpen((value) => !value)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  const current = useMemo(
    () => modules.find((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)),
    [location.pathname],
  )
  const currentLabel = location.pathname === "/pipeline"
    ? "Deal pipeline"
    : location.pathname === "/management"
      ? "Management intelligence"
      : location.pathname === "/developers"
        ? "Builders & developers"
      : location.pathname === "/inventory"
        ? "Project cockpit"
    : location.pathname === "/sales"
      ? "Sales desk"
      : current?.label || "Dashboard"
  const activeWorkspace = workspaces.data?.find((workspace) => workspace.active)
  const unreadCount = unreadConversations.data?.reduce(
    (sum, conversation) => sum + conversation.unreadCount,
    0,
  ) || 0
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || "MooN user"
  const initials = name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()
  const isAdmin = ["platform_owner", "organization_owner", "organization_admin"].includes(user?.role || "")
  const administrationModules = isAdmin
    ? modules.filter((item) => (administrationModuleKeys as readonly string[]).includes(item.key))
    : []

  const runCommand = (path: string) => {
    navigate(path)
    setCommandOpen(false)
  }

  return (
    <div className="min-h-screen bg-transparent">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r border-black/10 bg-white transition-[width] duration-200 lg:flex lg:flex-col",
          collapsed ? "w-[76px]" : "w-[252px]",
        )}
      >
        <div className={cn("flex h-[72px] items-center border-b border-black/10 px-5", collapsed && "justify-center px-0")}>
          <Brand collapsed={collapsed} />
        </div>
        <ScrollArea className="flex-1">
          <div className={cn("p-4", collapsed && "px-3")}>
            <NavContent collapsed={collapsed} />
          </div>
        </ScrollArea>
        <div className="border-t border-black/10 p-3">
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "default"}
            className={cn(!collapsed && "w-full justify-start")}
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRight /> : <ChevronsLeft />}
            {!collapsed && "Collapse navigation"}
          </Button>
        </div>
      </aside>

      <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-[76px]" : "lg:pl-[252px]")}>
        <header className="sticky top-0 z-30 flex h-[72px] items-center gap-3 border-b border-black/10 bg-white/95 px-4 backdrop-blur sm:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open navigation">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[290px] p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex h-[72px] items-center border-b px-5"><Brand /></div>
              <ScrollArea className="h-[calc(100vh-72px)] p-4">
                <NavContent close={() => setMobileOpen(false)} />
              </ScrollArea>
            </SheetContent>
          </Sheet>

          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">MooNsEstate</p>
            <h1 className="truncate font-display text-xl">{currentLabel}</h1>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              className="hidden min-w-56 justify-between text-muted-foreground md:flex"
              onClick={() => setCommandOpen(true)}
            >
              <span className="flex items-center gap-2"><Search />{t("search.workspace")}</span>
              <kbd className="rounded border bg-muted px-1.5 text-[10px]">⌘K</kbd>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="hidden max-w-56 gap-2 xl:flex" aria-label={t("workspace.switch")}>
                  <Building2 className="size-4" />
                  <span className="truncate">{activeWorkspace?.name || t("workspace.label")}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>{t("workspace.switch")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {workspaces.data?.map((workspace) => (
                  <DropdownMenuItem
                    key={workspace.id}
                    disabled={workspace.active || switchWorkspace.isPending}
                    onSelect={() => switchWorkspace.mutate(workspace.id)}
                  >
                    <Building2 />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{workspace.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{workspace.membershipRole}</span>
                    </span>
                    {workspace.active && <Check className="text-emerald-600" />}
                  </DropdownMenuItem>
                ))}
                {switchWorkspace.error && (
                  <p className="px-2 py-1.5 text-xs text-destructive">{errorMessage(switchWorkspace.error)}</p>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label={t("notifications.label")}>
                  <Bell />
                  {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-4 text-white">
                      {Math.min(unreadCount, 99)}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>{t("notifications.label")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {!unreadConversations.data?.length && (
                  <p className="px-2 py-4 text-center text-sm text-muted-foreground">{t("notifications.empty")}</p>
                )}
                {unreadConversations.data?.slice(0, 5).map((conversation) => (
                  <DropdownMenuItem
                    key={conversation.id}
                    onSelect={() => navigate(`/conversations?conversation=${conversation.id}`)}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{conversation.lead?.leadName || "Unmatched customer"}</span>
                      <span className="block text-xs capitalize text-muted-foreground">
                        {conversation.channel} · {conversation.unreadCount} unread
                      </span>
                    </span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate("/conversations")}>
                  {t("notifications.openInbox")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-10 gap-2 px-2" aria-label={t("account.menu")}>
                  <Avatar className="size-8 border border-black/15">
                    <AvatarFallback className="bg-black text-xs text-white">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-32 truncate text-sm sm:block">{name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>
                  <p className="truncate">{name}</p>
                  <p className="truncate text-xs font-normal text-muted-foreground">{user?.username}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate("/users")}>
                  <UserRound /> {t("account.profile")}
                </DropdownMenuItem>
                {administrationModules.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      Administration
                    </DropdownMenuLabel>
                    <div className="max-h-[min(52vh,420px)] overflow-y-auto p-1">
                      {administrationModules.map((item) => (
                        <DropdownMenuItem
                          key={item.path}
                          onSelect={() => navigate(item.path)}
                          className={cn(location.pathname === item.path && "bg-accent font-semibold")}
                        >
                          <item.icon />
                          <span>{item.label}</span>
                        </DropdownMenuItem>
                      ))}
                    </div>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  onSelect={() => {
                    logout()
                    navigate("/sign-in")
                  }}
                >
                  <LogOut /> {t("account.signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="w-full min-w-0 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder={t("search.pages")} />
        <CommandList>
          <CommandEmpty>No matching page.</CommandEmpty>
          <CommandGroup heading="Navigate">
            <CommandItem onSelect={() => runCommand("/")}>
              <LayoutDashboard /> Dashboard
            </CommandItem>
            <CommandItem onSelect={() => runCommand("/pipeline")}>
              <Columns3 /> Deal pipeline
            </CommandItem>
            {modules
              .filter((item) => !item.adminOnly || ["platform_owner", "organization_owner", "organization_admin"].includes(user?.role || ""))
              .map((item) => (
                <CommandItem key={item.path} value={`${item.label} ${item.group}`} onSelect={() => runCommand(item.path)}>
                  <item.icon /> {item.label}
                </CommandItem>
              ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <div className="grid min-h-[65vh] place-items-center text-center">
      <div>
        <p className="font-display text-8xl">404</p>
        <h2 className="mt-3 text-xl font-semibold">This page is not in the portfolio.</h2>
        <p className="mt-2 text-muted-foreground">The address may have changed or the module is unavailable.</p>
        <Button asChild className="mt-6"><Link to="/">Return to dashboard</Link></Button>
      </div>
    </div>
  )
}
