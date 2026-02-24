import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Camera, CheckCircle, AlertTriangle, XCircle, Search, Pencil, Trash2 } from "lucide-react";
import { CameraChannelLabels } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";


interface CameraStatusData {
  busId: string;
  busNumber: string;
  plate?: string;
  cameras: Array<{ channel: string; status: "operational" | "misaligned" | "faulty" }>;
}

const statusLabels: Record<string, string> = {
  operational: "Operativa",
  misaligned: "Desalineada",
  faulty: "Dañada",
};

const statusColors: Record<string, string> = {
  operational: "bg-green-500",
  misaligned: "bg-amber-500",
  faulty: "bg-red-500",
};

const ITEMS_PER_PAGE = 20;

export default function Cameras() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [editingBus, setEditingBus] = useState<{ id: string; busNumber: string; plate: string } | null>(null);
  const [editPlate, setEditPlate] = useState("");
  const [deletingBus, setDeletingBus] = useState<{ id: string; busNumber: string } | null>(null);
  const { toast } = useToast();

  const { data: cameraStatuses, isLoading } = useQuery<CameraStatusData[]>({
    queryKey: ["/api/camera-status"],
  });


  const updatePlateMutation = useMutation({
    mutationFn: async ({ busId, plate }: { busId: string; plate: string }) => {
      const response = await apiRequest("PATCH", `/api/buses/${busId}`, { plate });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Placa actualizada",
        description: "La placa se actualizó correctamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/camera-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/buses"] });
      setEditingBus(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar la placa.",
        variant: "destructive",
      });
    },
  });

  const deleteBusMutation = useMutation({
    mutationFn: async (busId: string) => {
      const response = await apiRequest("DELETE", `/api/buses/${busId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Bus eliminado",
        description: "El bus y todos sus datos han sido eliminados.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/camera-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/buses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setDeletingBus(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar el bus.",
        variant: "destructive",
      });
    },
  });

  const handleEditPlate = (bus: CameraStatusData) => {
    setEditingBus({ id: bus.busId, busNumber: bus.busNumber, plate: bus.plate || "" });
    setEditPlate(bus.plate || "");
  };

  const handleSavePlate = () => {
    if (editingBus) {
      updatePlateMutation.mutate({ busId: editingBus.id, plate: editPlate });
    }
  };

  const stats = useMemo(() => {
    if (!cameraStatuses) return { total: 0, operational: 0, misaligned: 0, faulty: 0 };
    return cameraStatuses.reduce(
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
    );
  }, [cameraStatuses]);

  const filteredData = useMemo(() => {
    if (!cameraStatuses) return [];

    return cameraStatuses.filter((bus) => {
      const matchesSearch = bus.busNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (bus.plate && bus.plate.toLowerCase().includes(searchTerm.toLowerCase()));

      if (statusFilter === "all") return matchesSearch;

      const hasStatusIssue = bus.cameras.some((cam) => {
        if (statusFilter === "issues") return cam.status !== "operational";
        return cam.status === statusFilter;
      });

      return matchesSearch && hasStatusIssue;
    });
  }, [cameraStatuses, searchTerm, statusFilter]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredData, currentPage]);

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);


  const renderCameraCell = (busNumber: string, camera: { channel: string; status: string }) => (
    <Tooltip key={camera.channel}>
      <TooltipTrigger asChild>
        <div
          className={`h-4 w-4 rounded-full cursor-help ${statusColors[camera.status] || "bg-gray-500"}`}
          data-testid={`camera-dot-${busNumber}-${camera.channel}`}
        />
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">{CameraChannelLabels[camera.channel]}</p>
        <p className="text-xs text-muted-foreground">{statusLabels[camera.status]}</p>
      </TooltipContent>
    </Tooltip>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Estado de Cámaras</h1>
          <p className="text-muted-foreground">Vista general del estado de todas las cámaras de la flota</p>
        </div>

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

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle className="text-lg">Detalle por Bus</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por N° o placa..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9 w-[200px]"
                  data-testid="input-search-bus"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
                  <SelectValue placeholder="Filtrar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="issues">Con problemas</SelectItem>
                  <SelectItem value="misaligned">Desalineadas</SelectItem>
                  <SelectItem value="faulty">Dañadas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No se encontraron buses</p>
              {searchTerm && <p className="text-sm">Intente con otro término de búsqueda</p>}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Bus</TableHead>
                    <TableHead>Placa</TableHead>
                    <TableHead className="text-center">CH1</TableHead>
                    <TableHead className="text-center">CH2</TableHead>
                    <TableHead className="text-center">CH3</TableHead>
                    <TableHead className="text-center">CH4</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((bus) => {
                    const issueCount = bus.cameras.filter((c) => c.status !== "operational").length;
                    return (
                      <TableRow key={bus.busId} data-testid={`row-bus-${bus.busNumber}`}>
                        <TableCell className="font-medium">{bus.busNumber}</TableCell>
                        <TableCell className="text-muted-foreground">{bus.plate || "-"}</TableCell>
                        {bus.cameras.map((camera) => (
                          <TableCell key={camera.channel} className="text-center">
                            <div className="flex justify-center">
                              {renderCameraCell(bus.busNumber, camera)}
                            </div>
                          </TableCell>
                        ))}
                        <TableCell className="text-center">
                          {issueCount === 0 ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                              OK
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
                              {issueCount} problema{issueCount > 1 ? "s" : ""}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEditPlate(bus)}
                              data-testid={`button-edit-plate-${bus.busNumber}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeletingBus({ id: bus.busId, busNumber: bus.busNumber })}
                              data-testid={`button-delete-bus-${bus.busNumber}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredData.length)} de {filteredData.length}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      data-testid="button-prev-page"
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      data-testid="button-next-page"
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

      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-green-500" />
          <span>Operativa</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-amber-500" />
          <span>Desalineada</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-red-500" />
          <span>Dañada</span>
        </div>
      </div>

      <AlertDialog open={!!deletingBus} onOpenChange={(open) => !open && setDeletingBus(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar Bus {deletingBus?.busNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el bus y todos sus datos asociados (incidencias, estado de cámaras y documentos). Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingBus && deleteBusMutation.mutate(deletingBus.id)}
              data-testid="button-confirm-delete-bus"
            >
              {deleteBusMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editingBus} onOpenChange={(open) => !open && setEditingBus(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Placa - Bus {editingBus?.busNumber}</DialogTitle>
            <DialogDescription>
              Modifique la placa patente de este bus.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={editPlate}
              onChange={(e) => setEditPlate(e.target.value)}
              placeholder="Ingrese placa patente"
              data-testid="input-edit-plate"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingBus(null)}
              data-testid="button-cancel-edit"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSavePlate}
              disabled={updatePlateMutation.isPending}
              data-testid="button-save-plate"
            >
              {updatePlateMutation.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
