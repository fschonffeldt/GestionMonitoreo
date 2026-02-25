import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Camera, HardDrive, Radio, Cable, Disc, Plus, Upload, Download, FileSpreadsheet, X, CheckCircle2, AlertCircle } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { incidentFormSchema, type IncidentFormData, type Bus, CameraChannelLabels } from "@shared/schema";
import { FormSkeleton } from "@/components/loading-skeleton";
import * as XLSX from "xlsx";

const equipmentTypes = [
  { value: "camera", label: "Cámara", icon: Camera },
  { value: "dvr", label: "DVR", icon: HardDrive },
  { value: "gps", label: "GPS", icon: Radio },
  { value: "hard_drive", label: "Disco Duro", icon: Disc },
  { value: "cable", label: "Cable", icon: Cable },
];

const incidentTypes = [
  { value: "misaligned", label: "Chueca / Desalineada" },
  { value: "loose_cable", label: "Cable Suelto" },
  { value: "faulty", label: "Dañado / No Funciona" },
  { value: "replacement", label: "Cambio / Reemplazo" },
];

const cameraChannels = [
  { value: "ch1", label: "CH1 - Frontal" },
  { value: "ch2", label: "CH2 - Puerta" },
  { value: "ch3", label: "CH3 - Camello" },
  { value: "ch4", label: "CH4 - Pasajeros" },
];

interface BusPreviewRow {
  busNumber: string;
  plate: string;
  valid: boolean;
  error?: string;
}

interface BulkResult {
  created: number;
  errors: Array<{ busNumber: string; error: string }>;
}

export default function RegisterIncident() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [newBusDialogOpen, setNewBusDialogOpen] = useState(false);
  const [newBusNumber, setNewBusNumber] = useState("");
  const [newBusPlate, setNewBusPlate] = useState("");
  const [busSearchTerm, setBusSearchTerm] = useState("");

  // Excel import state
  const [excelPreview, setExcelPreview] = useState<BusPreviewRow[]>([]);
  const [excelFileName, setExcelFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [importResult, setImportResult] = useState<BulkResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: buses, isLoading: busesLoading } = useQuery<Bus[]>({
    queryKey: ["/api/buses"],
  });

  const form = useForm<IncidentFormData>({
    resolver: zodResolver(incidentFormSchema),
    defaultValues: {
      busId: "",
      equipmentType: "camera",
      incidentType: "faulty",
      cameraChannels: [],
      description: "",
      reporter: "",
    },
  });

  const selectedEquipmentType = form.watch("equipmentType");

  const createIncident = useMutation({
    mutationFn: async (data: IncidentFormData) => {
      const response = await apiRequest("POST", "/api/incidents", data);
      const result = await response.json();
      return result;
    },
    onSuccess: (result) => {
      const count = Array.isArray(result) ? result.length : 1;
      toast({
        title: count > 1 ? "Incidencias registradas" : "Incidencia registrada",
        description: count > 1
          ? `Se han registrado ${count} incidencias correctamente.`
          : "La incidencia se ha registrado correctamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/camera-status"] });
      form.reset();
      setLocation("/");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo registrar la incidencia.",
        variant: "destructive",
      });
    },
  });

  const createBus = useMutation({
    mutationFn: async ({ busNumber, plate }: { busNumber: string; plate?: string }) => {
      return apiRequest("POST", "/api/buses", { busNumber, plate: plate || null });
    },
    onSuccess: () => {
      toast({
        title: "Bus agregado",
        description: "El bus se ha agregado correctamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/buses"] });
      setNewBusDialogOpen(false);
      setNewBusNumber("");
      setNewBusPlate("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo agregar el bus.",
        variant: "destructive",
      });
    },
  });

  const bulkImportBuses = useMutation({
    mutationFn: async (busRows: Array<{ busNumber: string; plate?: string }>) => {
      const response = await apiRequest("POST", "/api/buses/bulk", { buses: busRows });
      const result = await response.json();
      return result as BulkResult;
    },
    onSuccess: (result) => {
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ["/api/buses"] });
      if (result.created > 0) {
        toast({
          title: "Importación completada",
          description: `${result.created} bus(es) importados correctamente.${result.errors.length > 0 ? ` ${result.errors.length} omitido(s).` : ""}`,
        });
      } else {
        toast({
          title: "Sin cambios",
          description: "Todos los buses del archivo ya existían en el sistema.",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error al importar",
        description: "No se pudo procesar el archivo. Verifica el formato.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: IncidentFormData) => {
    if (data.equipmentType !== "camera") {
      data.cameraChannels = undefined;
    }
    createIncident.mutate(data);
  };

  // ─── Excel helpers ────────────────────────────────────────────────────────────

  const processExcelFile = (file: File) => {
    setImportResult(null);
    setExcelFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        // Normalizar encabezados: buscar columnas que coincidan con posibles nombres
        const preview: BusPreviewRow[] = rows.map((row, idx) => {
          const keys = Object.keys(row);

          // Buscar columna N° Bus (flexible)
          const busKey = keys.find(k =>
            /n[°o]?\s*bus|bus\s*n[°o]?|numero|number|n_bus|nbus/i.test(k)
          ) ?? keys[0];

          // Buscar columna Patente (flexible)
          const plateKey = keys.find(k =>
            /patente|plate|matricula|paten/i.test(k)
          ) ?? keys[1];

          const busNumber = String(row[busKey] ?? "").trim();
          const plate = plateKey ? String(row[plateKey] ?? "").trim() : "";

          if (!busNumber) {
            return { busNumber: `Fila ${idx + 2}`, plate, valid: false, error: "N° Bus vacío" };
          }

          return { busNumber, plate, valid: true };
        }).filter(r => r.busNumber !== "");

        setExcelPreview(preview);
      } catch {
        toast({
          title: "Error al leer el archivo",
          description: "El archivo no es un Excel válido o tiene un formato incorrecto.",
          variant: "destructive",
        });
        setExcelPreview([]);
        setExcelFileName("");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processExcelFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processExcelFile(file);
    e.target.value = "";
  };

  const handleImport = () => {
    const validRows = excelPreview.filter(r => r.valid);
    if (validRows.length === 0) return;
    bulkImportBuses.mutate(validRows.map(r => ({ busNumber: r.busNumber, plate: r.plate || undefined })));
  };

  const downloadTemplate = () => {
    const templateData = [
      { "N° Bus": "101", "Patente": "AB1234" },
      { "N° Bus": "102", "Patente": "CD5678" },
      { "N° Bus": "103", "Patente": "" },
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws["!cols"] = [{ wch: 12 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Buses");
    XLSX.writeFile(wb, "plantilla_buses.xlsx");
  };

  const clearExcel = () => {
    setExcelPreview([]);
    setExcelFileName("");
    setImportResult(null);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setNewBusDialogOpen(open);
    if (!open) {
      clearExcel();
      setNewBusNumber("");
      setNewBusPlate("");
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  if (busesLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Registrar Incidencia</CardTitle>
          </CardHeader>
          <CardContent>
            <FormSkeleton />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Registrar Incidencia</h1>
        <p className="text-muted-foreground">Complete el formulario para reportar una nueva incidencia</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nueva Incidencia</CardTitle>
          <CardDescription>
            Ingrese los detalles del problema encontrado en el equipo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="busId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bus</FormLabel>
                    <div className="flex gap-2">
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-bus">
                            <SelectValue placeholder="Seleccione un bus" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <div className="px-2 py-2 sticky top-0 bg-popover z-10 border-b">
                            <Input
                              placeholder="Buscar por N° o placa..."
                              value={busSearchTerm}
                              onChange={(e) => setBusSearchTerm(e.target.value)}
                              className="h-8 text-sm"
                              onKeyDown={(e) => e.stopPropagation()}
                            />
                          </div>
                          {buses
                            ?.filter((bus) => {
                              if (!busSearchTerm) return true;
                              const q = busSearchTerm.toLowerCase();
                              return bus.busNumber.toLowerCase().includes(q) ||
                                (bus.plate && bus.plate.toLowerCase().includes(q));
                            })
                            .map((bus) => (
                              <SelectItem key={bus.id} value={bus.id}>
                                Bus {bus.busNumber} {bus.plate && `(${bus.plate})`}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>

                      {/* ── Dialog agregar bus ── */}
                      <Dialog open={newBusDialogOpen} onOpenChange={handleDialogOpenChange}>
                        <DialogTrigger asChild>
                          <Button type="button" variant="outline" size="icon" data-testid="button-add-bus">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                          <DialogHeader>
                            <DialogTitle>Agregar Bus(es)</DialogTitle>
                          </DialogHeader>

                          <Tabs defaultValue="manual" className="w-full">
                            <TabsList className="w-full">
                              <TabsTrigger value="manual" className="flex-1">Manual</TabsTrigger>
                              <TabsTrigger value="excel" className="flex-1">
                                <FileSpreadsheet className="h-4 w-4 mr-1" />
                                Importar Excel
                              </TabsTrigger>
                            </TabsList>

                            {/* ── Tab Manual ── */}
                            <TabsContent value="manual">
                              <div className="space-y-4 pt-2">
                                <div className="space-y-2">
                                  <label className="text-sm font-medium">N° de Bus</label>
                                  <Input
                                    value={newBusNumber}
                                    onChange={(e) => setNewBusNumber(e.target.value)}
                                    placeholder="Ej: 101"
                                    data-testid="input-new-bus-number"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-sm font-medium">Patente <span className="text-muted-foreground font-normal">(Opcional)</span></label>
                                  <Input
                                    value={newBusPlate}
                                    onChange={(e) => setNewBusPlate(e.target.value)}
                                    placeholder="Ej: AB1234"
                                    data-testid="input-new-bus-plate"
                                  />
                                </div>
                                <Button
                                  onClick={() => createBus.mutate({ busNumber: newBusNumber, plate: newBusPlate })}
                                  disabled={!newBusNumber || createBus.isPending}
                                  className="w-full"
                                  data-testid="button-save-bus"
                                >
                                  {createBus.isPending ? "Guardando..." : "Guardar Bus"}
                                </Button>
                              </div>
                            </TabsContent>

                            {/* ── Tab Importar Excel ── */}
                            <TabsContent value="excel">
                              <div className="space-y-4 pt-2">

                                {/* Botón descargar plantilla */}
                                <div className="flex items-center justify-between">
                                  <p className="text-sm text-muted-foreground">
                                    Sube un Excel con las columnas <strong>N° Bus</strong> y <strong>Patente</strong>
                                  </p>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={downloadTemplate}
                                    className="shrink-0 gap-1"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                    Plantilla
                                  </Button>
                                </div>

                                {/* Zona de carga */}
                                {!excelFileName ? (
                                  <div
                                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragging
                                      ? "border-primary bg-primary/5"
                                      : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
                                      }`}
                                    onClick={() => fileInputRef.current?.click()}
                                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                    onDragLeave={() => setIsDragging(false)}
                                    onDrop={handleFileDrop}
                                  >
                                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                    <p className="text-sm font-medium">
                                      {isDragging ? "Suelta el archivo aquí" : "Arrastra tu archivo o haz clic"}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">.xlsx · .xls</p>
                                    <input
                                      ref={fileInputRef}
                                      type="file"
                                      accept=".xlsx,.xls"
                                      className="hidden"
                                      onChange={handleFileInput}
                                      data-testid="input-excel-file"
                                    />
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md text-sm">
                                    <FileSpreadsheet className="h-4 w-4 text-green-600 shrink-0" />
                                    <span className="truncate flex-1">{excelFileName}</span>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 shrink-0"
                                      onClick={clearExcel}
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                )}

                                {/* Vista previa */}
                                {excelPreview.length > 0 && !importResult && (
                                  <div className="space-y-2">
                                    <p className="text-sm font-medium">
                                      Vista previa —{" "}
                                      <span className="text-muted-foreground">
                                        {excelPreview.filter(r => r.valid).length} válidos
                                        {excelPreview.filter(r => !r.valid).length > 0 &&
                                          `, ${excelPreview.filter(r => !r.valid).length} con error`}
                                      </span>
                                    </p>
                                    <div className="max-h-48 overflow-y-auto rounded-md border">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead className="w-8"></TableHead>
                                            <TableHead>N° Bus</TableHead>
                                            <TableHead>Patente</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {excelPreview.map((row, i) => (
                                            <TableRow key={i} className={!row.valid ? "bg-destructive/5" : ""}>
                                              <TableCell className="py-1">
                                                {row.valid
                                                  ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                                                  : <AlertCircle className="h-4 w-4 text-destructive" />
                                                }
                                              </TableCell>
                                              <TableCell className="py-1 font-medium">{row.busNumber}</TableCell>
                                              <TableCell className="py-1 text-muted-foreground">
                                                {row.plate || <span className="italic text-xs">—</span>}
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>

                                    <Button
                                      type="button"
                                      className="w-full gap-2"
                                      onClick={handleImport}
                                      disabled={
                                        bulkImportBuses.isPending ||
                                        excelPreview.filter(r => r.valid).length === 0
                                      }
                                    >
                                      <Upload className="h-4 w-4" />
                                      {bulkImportBuses.isPending
                                        ? "Importando..."
                                        : `Importar ${excelPreview.filter(r => r.valid).length} bus(es)`}
                                    </Button>
                                  </div>
                                )}

                                {/* Resultado de importación */}
                                {importResult && (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                                      <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                                      <div className="text-sm">
                                        <p className="font-medium text-green-800 dark:text-green-400">
                                          {importResult.created} bus(es) importados correctamente
                                        </p>
                                        {importResult.errors.length > 0 && (
                                          <p className="text-muted-foreground">
                                            {importResult.errors.length} omitido(s) por duplicado
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    {importResult.errors.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {importResult.errors.map((e, i) => (
                                          <Badge key={i} variant="outline" className="text-xs text-muted-foreground">
                                            Bus {e.busNumber}: {e.error}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="w-full"
                                      onClick={() => { clearExcel(); handleDialogOpenChange(false); }}
                                    >
                                      Cerrar
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </TabsContent>
                          </Tabs>
                        </DialogContent>
                      </Dialog>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="equipmentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Equipo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-equipment-type">
                          <SelectValue placeholder="Seleccione el tipo de equipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {equipmentTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <type.icon className="h-4 w-4" />
                              {type.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedEquipmentType === "camera" && (
                <FormField
                  control={form.control}
                  name="cameraChannels"
                  render={() => (
                    <FormItem>
                      <FormLabel>Canales de Cámara</FormLabel>
                      <p className="text-sm text-muted-foreground mb-2">
                        Seleccione una o más cámaras afectadas
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        {cameraChannels.map((channel) => (
                          <FormField
                            key={channel.value}
                            control={form.control}
                            name="cameraChannels"
                            render={({ field }) => (
                              <FormItem className="flex items-center space-x-3 space-y-0 p-3 border rounded-md">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(channel.value)}
                                    onCheckedChange={(checked) => {
                                      const currentValue = field.value || [];
                                      if (checked) {
                                        field.onChange([...currentValue, channel.value]);
                                      } else {
                                        field.onChange(currentValue.filter((v) => v !== channel.value));
                                      }
                                    }}
                                    data-testid={`checkbox-camera-${channel.value}`}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">
                                  {channel.label}
                                </FormLabel>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="incidentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Incidencia</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-incident-type">
                          <SelectValue placeholder="Seleccione el tipo de incidencia" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {incidentTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción (Opcional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describa el problema en detalle..."
                        className="resize-none"
                        data-testid="textarea-description"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reporter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reportado por (Opcional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Nombre del técnico o conductor"
                        data-testid="input-reporter"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={createIncident.isPending}
                data-testid="button-submit-incident"
              >
                {createIncident.isPending ? "Registrando..." : "Registrar Incidencia"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
