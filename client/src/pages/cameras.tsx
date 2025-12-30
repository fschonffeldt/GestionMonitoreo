import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Camera, CheckCircle, AlertTriangle, XCircle, Search, Upload, FileSpreadsheet } from "lucide-react";
import { CameraChannelLabels } from "@shared/schema";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import * as XLSX from "xlsx";

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
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadData, setUploadData] = useState<Array<{ busNumber: string; plate: string }>>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: cameraStatuses, isLoading } = useQuery<CameraStatusData[]>({
    queryKey: ["/api/camera-status"],
  });

  const bulkUploadMutation = useMutation({
    mutationFn: async (buses: Array<{ busNumber: string; plate: string }>) => {
      const response = await apiRequest("POST", "/api/buses/bulk", { buses });
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Buses registrados",
        description: `Se registraron ${result.created} buses correctamente.${result.errors?.length > 0 ? ` ${result.errors.length} errores.` : ""}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/camera-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/buses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setUploadDialogOpen(false);
      setUploadData([]);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudieron registrar los buses.",
        variant: "destructive",
      });
    },
  });

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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

        const buses: Array<{ busNumber: string; plate: string }> = [];
        const errors: string[] = [];

        jsonData.forEach((row, index) => {
          const busNumber = String(row["N° distintivo"] || row["busNumber"] || row["numero"] || row["N°"] || "").trim();
          const plate = String(row["Placa patente"] || row["plate"] || row["placa"] || row["patente"] || "").trim();

          if (!busNumber) {
            errors.push(`Fila ${index + 2}: Falta N° distintivo`);
            return;
          }

          buses.push({ busNumber, plate });
        });

        if (errors.length > 0) {
          setUploadError(`${errors.length} filas con errores:\n${errors.slice(0, 5).join("\n")}${errors.length > 5 ? `\n... y ${errors.length - 5} más` : ""}`);
        }

        setUploadData(buses);
      } catch {
        setUploadError("Error al leer el archivo. Asegúrese de que sea un archivo Excel válido.");
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleConfirmUpload = () => {
    if (uploadData.length > 0) {
      bulkUploadMutation.mutate(uploadData);
    }
  };

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
        
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-upload-excel">
              <Upload className="h-4 w-4 mr-2" />
              Cargar Excel
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cargar Buses desde Excel</DialogTitle>
              <DialogDescription>
                Suba un archivo Excel con las columnas "N° distintivo" y "Placa patente" para registrar buses en masa.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-md p-6 text-center">
                <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="cursor-pointer"
                  data-testid="input-excel-file"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Formatos aceptados: .xlsx, .xls
                </p>
              </div>

              {uploadError && (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                  {uploadError}
                </div>
              )}

              {uploadData.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Vista previa ({uploadData.length} buses):</p>
                  <div className="max-h-48 overflow-auto border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>N° Distintivo</TableHead>
                          <TableHead>Placa</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {uploadData.slice(0, 10).map((bus, i) => (
                          <TableRow key={i}>
                            <TableCell>{bus.busNumber}</TableCell>
                            <TableCell>{bus.plate || "-"}</TableCell>
                          </TableRow>
                        ))}
                        {uploadData.length > 10 && (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center text-muted-foreground">
                              ... y {uploadData.length - 10} más
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleConfirmUpload} 
                disabled={uploadData.length === 0 || bulkUploadMutation.isPending}
                data-testid="button-confirm-upload"
              >
                {bulkUploadMutation.isPending ? "Cargando..." : `Registrar ${uploadData.length} buses`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
    </div>
  );
}
