import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  FileText,
  Camera,
  ClipboardList,
  Calendar,
  CalendarDays,
  Bus,
  Users,
  FolderOpen,
  Settings,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Registrar Incidencia",
    url: "/register",
    icon: FileText,
  },
  {
    title: "Estado de Cámaras",
    url: "/cameras",
    icon: Camera,
  },
  {
    title: "Seguimiento de Equipos",
    url: "/equipment",
    icon: ClipboardList,
  },
  {
    title: "Gestión de Buses",
    url: "/buses",
    icon: FolderOpen,
  },
];

const reportItems = [
  {
    title: "Reporte Semanal",
    url: "/reports/weekly",
    icon: Calendar,
  },
  {
    title: "Reporte Mensual",
    url: "/reports/monthly",
    icon: CalendarDays,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { isAdmin } = useAuth();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Bus className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">FlotaControl</h1>
            <p className="text-xs text-muted-foreground">Gestion de Incidencias</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`link-${item.url.replace("/", "") || "dashboard"}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Reportes</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {reportItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`link-${item.url.replace("/reports/", "report-")}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administracion</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location === "/users"}
                    data-testid="link-users"
                  >
                    <Link href="/users">
                      <Users className="h-4 w-4" />
                      <span>Usuarios</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location === "/settings"}
                    data-testid="link-settings"
                  >
                    <Link href="/settings">
                      <Settings className="h-4 w-4" />
                      <span>Configuración</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="p-4">
        <p className="text-xs text-muted-foreground text-center">
          v1.0.0
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
