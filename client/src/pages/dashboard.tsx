import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bus, AlertTriangle, CheckCircle, Clock, Camera, HardDrive, Radio, Cable, Search } from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { IncidentList } from "@/components/incident-list";
import { MetricCardSkeleton, IncidentListSkeleton } from "@/components/loading-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { CameraChannelLabels } from "@shared/schema";
import type { DashboardStats, Incident, Bus as BusType } from "@shared/schema";

const CAMERAS_PER_PAGE = 10;

const camStatusColors: Record<string, string> = {
  operational: "bg-green-500",
  misaligned: "bg-amber-500",
  faulty: "bg-red-500",
};
const camStatusLabels: Record<string, string> = {
  operational: "Operativa",
  misaligned: "Desalineada",
  faulty: "Dañada",
};

export default function Dashboard() {
  const [camSearch, setCamSearch] = useState("");
  const [camPage, setCamPage] = useState(1);

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

  const filteredCameras = useMemo(() => {
    if (!cameraStatuses) return [];
    if (!camSearch.trim()) return cameraStatuses;
    return cameraStatuses.filter((b) =>
      b.busNumber.toLowerCase().includes(camSearch.toLowerCase())
    );
  }, [cameraStatuses, camSearch]);

  const camTotalPages = Math.ceil(filteredCameras.length / CAMERAS_PER_PAGE);
  const pagedCameras = filteredCameras.slice(
    (camPage - 1) * CAMERAS_PER_PAGE,
    camPage * CAMERAS_PER_PAGE
  );

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

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-lg">Estado de Cámaras por Bus</CardTitle>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar N° bus..."
                value={camSearch}
                onChange={(e) => { setCamSearch(e.target.value); setCamPage(1); }}
                className="pl-8 w-[160px] h-8 text-sm"
                data-testid="input-cam-search"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!cameraStatuses ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filteredCameras.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              No se encontraron buses
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">N° Bus</TableHead>
                    <TableHead className="text-center w-12">CH1</TableHead>
                    <TableHead className="text-center w-12">CH2</TableHead>
                    <TableHead className="text-center w-12">CH3</TableHead>
                    <TableHead className="text-center w-12">CH4</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedCameras.map((bus) => {
                    const issues = bus.cameras.filter((c) => c.status !== "operational").length;
                    return (
                      <TableRow key={bus.busId}>
                        <TableCell className="font-medium">{bus.busNumber}</TableCell>
                        {bus.cameras.map((cam) => (
                          <TableCell key={cam.channel} className="text-center">
                            <div className="flex justify-center">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className={`h-3.5 w-3.5 rounded-full cursor-help ${camStatusColors[cam.status] || "bg-gray-500"}`} />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="font-medium">{CameraChannelLabels[cam.channel]}</p>
                                  <p className="text-xs text-muted-foreground">{camStatusLabels[cam.status]}</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                        ))}
                        <TableCell className="text-center">
                          {issues === 0 ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 text-xs">
                              OK
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800 text-xs">
                              {issues} problema{issues > 1 ? "s" : ""}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {camTotalPages > 1 && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                  <p className="text-xs text-muted-foreground">
                    {((camPage - 1) * CAMERAS_PER_PAGE) + 1}–{Math.min(camPage * CAMERAS_PER_PAGE, filteredCameras.length)} de {filteredCameras.length}
                  </p>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setCamPage((p) => Math.max(1, p - 1))}
                      disabled={camPage === 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setCamPage((p) => Math.min(camTotalPages, p + 1))}
                      disabled={camPage === camTotalPages}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
