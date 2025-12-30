import { useQuery } from "@tanstack/react-query";
import { Bus, AlertTriangle, CheckCircle, Clock, Camera, HardDrive, Radio, Cable } from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { IncidentList } from "@/components/incident-list";
import { CameraGrid } from "@/components/camera-grid";
import { MetricCardSkeleton, IncidentListSkeleton, CameraGridSkeleton } from "@/components/loading-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardStats, Incident, Bus as BusType } from "@shared/schema";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard"],
  });

  const { data: recentIncidents, isLoading: incidentsLoading } = useQuery<Incident[]>({
    queryKey: ["/api/incidents?limit=5"],
  });

  const { data: buses } = useQuery<BusType[]>({
    queryKey: ["/api/buses"],
  });

  const { data: cameraStatuses } = useQuery<Array<{ busId: string; busNumber: string; cameras: Array<{ channel: string; status: string }> }>>({
    queryKey: ["/api/camera-status"],
  });

  const busMap = new Map(buses?.map((b) => [b.id, b.busNumber]) || []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Dashboard</h1>
        <p className="text-muted-foreground">Resumen general del estado de la flota</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsLoading ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            <MetricCard
              title="Total Buses"
              value={stats?.totalBuses || 0}
              subtitle="En la flota"
              icon={Bus}
            />
            <MetricCard
              title="Incidencias Activas"
              value={stats?.activeIncidents || 0}
              subtitle="Pendientes de resolver"
              icon={AlertTriangle}
            />
            <MetricCard
              title="Resueltas Esta Semana"
              value={stats?.resolvedThisWeek || 0}
              subtitle="Incidencias cerradas"
              icon={CheckCircle}
            />
            <MetricCard
              title="Reparaciones Pendientes"
              value={stats?.pendingRepairs || 0}
              subtitle="En espera de piezas"
              icon={Clock}
            />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {incidentsLoading ? (
            <IncidentListSkeleton />
          ) : (
            <IncidentList
              incidents={recentIncidents || []}
              title="Incidencias Recientes"
              buses={busMap}
            />
          )}
        </div>
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Incidencias por Tipo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {statsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-md bg-muted animate-pulse" />
                      <div className="flex-1 h-4 bg-muted animate-pulse rounded" />
                      <div className="h-4 w-8 bg-muted animate-pulse rounded" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-md bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <Camera className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Cámaras</p>
                    </div>
                    <span className="text-sm font-semibold">{stats?.incidentsByType?.camera || 0}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-md bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                      <HardDrive className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">DVR</p>
                    </div>
                    <span className="text-sm font-semibold">{stats?.incidentsByType?.dvr || 0}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-md bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                      <Radio className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">GPS</p>
                    </div>
                    <span className="text-sm font-semibold">{stats?.incidentsByType?.gps || 0}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-md bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                      <Cable className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Cables</p>
                    </div>
                    <span className="text-sm font-semibold">{stats?.incidentsByType?.cable || 0}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Estado de Cámaras por Bus</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {!cameraStatuses ? (
            <>
              <CameraGridSkeleton />
              <CameraGridSkeleton />
              <CameraGridSkeleton />
              <CameraGridSkeleton />
            </>
          ) : cameraStatuses.length === 0 ? (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No hay buses registrados
            </div>
          ) : (
            cameraStatuses.map((bus) => (
              <CameraGrid
                key={bus.busId}
                busNumber={bus.busNumber}
                cameras={bus.cameras as Array<{ channel: string; status: "operational" | "misaligned" | "faulty" }>}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
