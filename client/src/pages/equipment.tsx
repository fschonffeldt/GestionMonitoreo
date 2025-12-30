import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Search, Filter, ClipboardList, CheckCircle } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge, EquipmentTypeBadge, IncidentTypeBadge } from "@/components/status-badge";
import { TableSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import type { Incident, Bus } from "@shared/schema";
import { CameraChannelLabels } from "@shared/schema";

export default function Equipment() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

  const { data: incidents, isLoading: incidentsLoading } = useQuery<Incident[]>({
    queryKey: ["/api/incidents"],
  });

  const { data: buses } = useQuery<Bus[]>({
    queryKey: ["/api/buses"],
  });

  const busMap = new Map(buses?.map((b) => [b.id, b.busNumber]) || []);

  const updateIncident = useMutation({
    mutationFn: async ({ id, status, resolutionNotes }: { id: string; status: string; resolutionNotes?: string }) => {
      return apiRequest("PATCH", `/api/incidents/${id}`, { status, resolutionNotes });
    },
    onSuccess: () => {
      toast({
        title: "Incidencia actualizada",
        description: "El estado se ha actualizado correctamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/camera-status"] });
      setSelectedIncident(null);
      setResolutionNotes("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar la incidencia.",
        variant: "destructive",
      });
    },
  });

  const filteredIncidents = incidents?.filter((incident) => {
    const busNumber = busMap.get(incident.busId) || "";
    const matchesSearch = busNumber.toLowerCase().includes(search.toLowerCase()) ||
      incident.description?.toLowerCase().includes(search.toLowerCase());
    const matchesEquipment = equipmentFilter === "all" || incident.equipmentType === equipmentFilter;
    const matchesStatus = statusFilter === "all" || incident.status === statusFilter;
    return matchesSearch && matchesEquipment && matchesStatus;
  }) || [];

  const handleResolve = () => {
    if (selectedIncident) {
      updateIncident.mutate({
        id: selectedIncident.id,
        status: "resolved",
        resolutionNotes,
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Seguimiento de Equipos</h1>
        <p className="text-muted-foreground">Gestione y actualice el estado de las incidencias</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número de bus..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
            </div>
            <Select value={equipmentFilter} onValueChange={setEquipmentFilter}>
              <SelectTrigger className="w-full sm:w-40" data-testid="select-equipment-filter">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Equipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="camera">Cámara</SelectItem>
                <SelectItem value="dvr">DVR</SelectItem>
                <SelectItem value="gps">GPS</SelectItem>
                <SelectItem value="hard_drive">Disco Duro</SelectItem>
                <SelectItem value="cable">Cable</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40" data-testid="select-status-filter">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="in_progress">En Progreso</SelectItem>
                <SelectItem value="resolved">Resuelto</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Incidencias ({filteredIncidents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {incidentsLoading ? (
            <TableSkeleton rows={5} />
          ) : filteredIncidents.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Sin incidencias"
              description={search || equipmentFilter !== "all" || statusFilter !== "all"
                ? "No se encontraron incidencias con los filtros aplicados"
                : "No hay incidencias registradas"}
              actionLabel="Registrar Incidencia"
              actionHref="/register"
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bus</TableHead>
                    <TableHead>Equipo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIncidents.map((incident) => (
                    <TableRow key={incident.id} data-testid={`row-incident-${incident.id}`}>
                      <TableCell className="font-medium">
                        Bus {busMap.get(incident.busId) || incident.busId}
                      </TableCell>
                      <TableCell>
                        <EquipmentTypeBadge type={incident.equipmentType} size="sm" />
                      </TableCell>
                      <TableCell>
                        <IncidentTypeBadge type={incident.incidentType} size="sm" />
                      </TableCell>
                      <TableCell>
                        {incident.cameraChannel ? (
                          <span className="text-sm">
                            {incident.cameraChannel.toUpperCase()} - {CameraChannelLabels[incident.cameraChannel]}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={incident.status} size="sm" />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {incident.reportedAt
                          ? format(new Date(incident.reportedAt), "dd MMM yyyy", { locale: es })
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {incident.status !== "resolved" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedIncident(incident)}
                            data-testid={`button-resolve-${incident.id}`}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Resolver
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedIncident} onOpenChange={() => setSelectedIncident(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolver Incidencia</DialogTitle>
          </DialogHeader>
          {selectedIncident && (
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Bus</p>
                <p className="font-medium">Bus {busMap.get(selectedIncident.busId)}</p>
              </div>
              <div className="flex gap-2">
                <EquipmentTypeBadge type={selectedIncident.equipmentType} />
                <IncidentTypeBadge type={selectedIncident.incidentType} />
              </div>
              {selectedIncident.description && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Descripción</p>
                  <p className="text-sm">{selectedIncident.description}</p>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium">Notas de Resolución</label>
                <Textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Describa cómo se resolvió el problema..."
                  className="resize-none"
                  data-testid="textarea-resolution-notes"
                />
              </div>
              <Button
                onClick={handleResolve}
                disabled={updateIncident.isPending}
                className="w-full"
                data-testid="button-confirm-resolve"
              >
                {updateIncident.isPending ? "Guardando..." : "Marcar como Resuelto"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
