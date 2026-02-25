import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

import Dashboard from "@/pages/dashboard";
import RegisterIncident from "@/pages/register-incident";
import Cameras from "@/pages/cameras";
import Equipment from "@/pages/equipment";
import WeeklyReport from "@/pages/weekly-report";
import MonthlyReport from "@/pages/monthly-report";
import Login from "@/pages/login";
import Users from "@/pages/users";
import Buses from "@/pages/buses";
import SettingsPage from "@/pages/settings";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAdmin } = useAuth();

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/register" component={RegisterIncident} />
      <Route path="/cameras" component={Cameras} />
      <Route path="/equipment" component={Equipment} />
      <Route path="/reports/weekly" component={WeeklyReport} />
      <Route path="/reports/monthly" component={MonthlyReport} />
      <Route path="/buses" component={Buses} />
      {isAdmin && <Route path="/users" component={Users} />}
      {isAdmin && <Route path="/settings" component={SettingsPage} />}
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApp() {
  const { user, logout, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  const handleLogout = async () => {
    await logout();
    setLocation("/login");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex h-14 items-center justify-between gap-4 border-b px-4 bg-background sticky top-0 z-50">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {user?.name}
              </span>
              <ThemeToggle />
              <Button
                size="icon"
                variant="ghost"
                onClick={handleLogout}
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
