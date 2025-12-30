import { useQuery } from "@tanstack/react-query";
import { Camera, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { CameraGrid } from "@/components/camera-grid";
import { CameraGridSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CameraStatusData {
  busId: string;
  busNumber: string;
  cameras: Array<{ channel: string; status: "operational" | "misaligned" | "faulty" }>;
}

export default function Cameras() {
  const { data: cameraStatuses, isLoading } = useQuery<CameraStatusData[]>({
    queryKey: ["/api/camera-status"],
  });

  const stats = cameraStatuses?.reduce(
    (acc, bus) => {
      bus.cameras.forEach((cam) => {
        if (cam.status === "operational") acc.operational++;
        else if (cam.status === "misaligned") acc.misaligned++;
        else if (cam.status === "faulty") acc.faulty++;
        acc.total++;
      });
      return acc;
    },
    { total: 0, operational: 0, misaligned: 0, faulty: 0 }
  ) || { total: 0, operational: 0, misaligned: 0, faulty: 0 };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Estado de Cámaras</h1>
        <p className="text-muted-foreground">Vista general del estado de todas las cámaras de la flota</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Cámaras</CardTitle>
            <Camera className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">En {cameraStatuses?.length || 0} buses</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Operativas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.operational}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.operational / stats.total) * 100) : 0}% del total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Desalineadas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.misaligned}</div>
            <p className="text-xs text-muted-foreground">Requieren ajuste</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Dañadas</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.faulty}</div>
            <p className="text-xs text-muted-foreground">Requieren reemplazo</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Detalle por Bus</h2>
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <CameraGridSkeleton />
            <CameraGridSkeleton />
            <CameraGridSkeleton />
            <CameraGridSkeleton />
          </div>
        ) : !cameraStatuses || cameraStatuses.length === 0 ? (
          <EmptyState
            icon={Camera}
            title="Sin buses registrados"
            description="Agregue buses para ver el estado de sus cámaras"
            actionLabel="Registrar Incidencia"
            actionHref="/register"
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cameraStatuses.map((bus) => (
              <CameraGrid
                key={bus.busId}
                busNumber={bus.busNumber}
                cameras={bus.cameras}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
