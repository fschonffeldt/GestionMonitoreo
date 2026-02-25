import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
    Bus,
    FileText,
    Wrench,
    Settings,
    CreditCard,
    IdCard,
    Upload,
    Trash2,
    Download,
    ChevronRight,
    ChevronLeft,
    ChevronDown,
    Loader2,
    FolderOpen,
    Eye,
    AlertTriangle,
    CalendarClock,
    UserPlus,
    Users,
    Search,
    X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
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
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { format, differenceInDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface BusData {
    id: string;
    busNumber: string;
    plate: string | null;
}

interface BusDocument {
    id: string;
    busId: string;
    driverId: string | null;
    docType: string;
    fileName: string;
    filePath: string;
    notes: string | null;
    uploadedAt: string;
    expiresAt: string | null;
}

interface DriverData {
    id: string;
    name: string;
    rut: string;
    createdAt: string;
}

interface BusDriverData {
    id: string;
    busId: string;
    driverId: string;
    role: string;
    assignedAt: string;
    driver: DriverData;
}

interface ExpiringDoc {
    busNumber: string;
    docType: string;
    fileName: string;
    expiresAt: string;
    daysLeft: number;
}

// Only bus-level doc types (driver docs are handled separately)
const BUS_DOC_TYPES = [
    { key: "permiso_circulacion", label: "Permiso de Circulación", icon: FileText, color: "text-blue-500" },
    { key: "revision_tecnica", label: "Revisión Técnica", icon: Wrench, color: "text-green-500", hasExpiry: true, alertDays: 5 },
    { key: "chasis", label: "Información de Chasis", icon: Settings, color: "text-purple-500" },
] as const;

const DRIVER_DOC_TYPES = [
    { key: "licencia_conducir", label: "Licencia de Conducir", icon: CreditCard, color: "text-amber-500", hasExpiry: true, alertDays: 30 },
    { key: "cedula_conductor", label: "Cédula del Conductor", icon: IdCard, color: "text-rose-500", hasExpiry: true, alertDays: 30 },
] as const;

const DOC_TYPE_LABELS: Record<string, string> = {
    permiso_circulacion: "Permiso de Circulación",
    revision_tecnica: "Revisión Técnica",
    chasis: "Información de Chasis",
    licencia_conducir: "Licencia de Conducir",
    cedula_conductor: "Cédula del Conductor",
};

function isImageFile(fileName: string) {
    return /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(fileName);
}

function isPdfFile(fileName: string) {
    return /\.pdf$/i.test(fileName);
}

function getExpiryBadge(expiresAt: string | null, alertDays: number) {
    if (!expiresAt) return null;
    const daysLeft = differenceInDays(parseISO(expiresAt), new Date());

    if (daysLeft <= 0) {
        return (
            <Badge variant="destructive" className="text-[10px] gap-0.5 px-1.5 py-0">
                <AlertTriangle className="h-2.5 w-2.5" />
                Vencido
            </Badge>
        );
    }
    if (daysLeft <= alertDays) {
        return (
            <Badge className="text-[10px] gap-0.5 px-1.5 py-0 bg-amber-500 hover:bg-amber-600 text-white">
                <CalendarClock className="h-2.5 w-2.5" />
                {daysLeft}d
            </Badge>
        );
    }
    return (
        <Badge variant="outline" className="text-[10px] gap-0.5 px-1.5 py-0 text-muted-foreground">
            <CalendarClock className="h-2.5 w-2.5" />
            {daysLeft}d
        </Badge>
    );
}

// ── Document Row Component ──────────────────────────────────────────────
function DocRow({ doc, busId, onPreview, onDelete }: {
    doc: BusDocument;
    busId: string;
    onPreview: (doc: BusDocument) => void;
    onDelete: (doc: BusDocument) => void;
}) {
    return (
        <div className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1.5 hover:bg-muted/70 transition-colors">
            <div className="flex flex-col min-w-0 cursor-pointer flex-1" onClick={() => onPreview(doc)} title="Clic para previsualizar">
                <div className="flex items-center gap-1.5">
                    <span className="font-medium truncate max-w-[160px]">{doc.fileName}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                    <span>{format(new Date(doc.uploadedAt), "dd MMM yyyy", { locale: es })}</span>
                    {doc.expiresAt && (
                        <span>· Vence: {format(parseISO(doc.expiresAt), "dd MMM yyyy", { locale: es })}</span>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onPreview(doc)} title="Previsualizar">
                    <Eye className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" asChild title="Descargar">
                    <a href={`/api/buses/${busId}/documents/${doc.id}/download`} download>
                        <Download className="h-3 w-3" />
                    </a>
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => onDelete(doc)} title="Eliminar">
                    <Trash2 className="h-3 w-3" />
                </Button>
            </div>
        </div>
    );
}

// ── Doc Type Section (bus-level) ─────────────────────────────────────────
function DocTypeSection({ docTypeConfig, typeDocs, busId, isUploading, expiryDate, onExpiryChange, onUploadClick, onPreview, onDelete }: {
    docTypeConfig: (typeof BUS_DOC_TYPES)[number];
    typeDocs: BusDocument[];
    busId: string;
    isUploading: boolean;
    expiryDate: string;
    onExpiryChange: (val: string) => void;
    onUploadClick: () => void;
    onPreview: (doc: BusDocument) => void;
    onDelete: (doc: BusDocument) => void;
}) {
    const { key, label, icon: Icon, color } = docTypeConfig;
    const hasExpiry = "hasExpiry" in docTypeConfig && docTypeConfig.hasExpiry;
    const alertDays = "alertDays" in docTypeConfig ? docTypeConfig.alertDays : 0;

    return (
        <div className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${color}`} />
                    <span className="text-sm font-medium">{label}</span>
                    <Badge variant="outline" className="text-xs ml-1">{typeDocs.length}</Badge>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={isUploading} onClick={onUploadClick}>
                    {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    Subir
                </Button>
            </div>
            {hasExpiry && (
                <div className="flex items-center gap-2 text-xs">
                    <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Vencimiento:</span>
                    <input type="date" className="border rounded px-2 py-0.5 text-xs bg-background" value={expiryDate} onChange={(e) => onExpiryChange(e.target.value)} />
                </div>
            )}
            {typeDocs.length > 0 && (
                <div className="space-y-1 mt-1">
                    {typeDocs.map((doc) => (
                        <div key={doc.id} className="flex items-center gap-1.5">
                            {hasExpiry && getExpiryBadge(doc.expiresAt, alertDays)}
                            <div className="flex-1 min-w-0">
                                <DocRow doc={doc} busId={busId} onPreview={onPreview} onDelete={onDelete} />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Main Component ───────────────────────────────────────────────────────
export default function Buses() {
    const [selectedBus, setSelectedBus] = useState<BusData | null>(null);
    const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);
    const [deletingDoc, setDeletingDoc] = useState<BusDocument | null>(null);
    const [previewDoc, setPreviewDoc] = useState<BusDocument | null>(null);
    const [expiryDates, setExpiryDates] = useState<Record<string, string>>({});
    const [busPage, setBusPage] = useState(0);
    const [assignDialogOpen, setAssignDialogOpen] = useState(false);
    const [driverSearch, setDriverSearch] = useState("");
    const [newDriverName, setNewDriverName] = useState("");
    const [newDriverRut, setNewDriverRut] = useState("");
    const [selectedRole, setSelectedRole] = useState("titular");
    const [openDriverIds, setOpenDriverIds] = useState<Set<string>>(new Set());
    const BUSES_PER_PAGE = 25;
    const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
    const { toast } = useToast();

    // ── Queries ──────────────────────────────────────────────────────────
    const { data: buses, isLoading: busesLoading } = useQuery<BusData[]>({
        queryKey: ["/api/buses"],
    });

    const { data: documents, isLoading: docsLoading } = useQuery<BusDocument[]>({
        queryKey: ["/api/buses", selectedBus?.id, "documents"],
        queryFn: async () => {
            if (!selectedBus) return [];
            const res = await apiRequest("GET", `/api/buses/${selectedBus.id}/documents`);
            return res.json();
        },
        enabled: !!selectedBus,
    });

    const { data: busDriversList } = useQuery<BusDriverData[]>({
        queryKey: ["/api/buses", selectedBus?.id, "drivers"],
        queryFn: async () => {
            if (!selectedBus) return [];
            const res = await apiRequest("GET", `/api/buses/${selectedBus.id}/drivers`);
            return res.json();
        },
        enabled: !!selectedBus,
    });

    const { data: expiringDocs } = useQuery<ExpiringDoc[]>({
        queryKey: ["/api/documents/expiring"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/documents/expiring");
            return res.json();
        },
    });

    const { data: searchResults } = useQuery<DriverData[]>({
        queryKey: ["/api/drivers/search", driverSearch],
        queryFn: async () => {
            if (!driverSearch || driverSearch.length < 2) return [];
            const res = await apiRequest("GET", `/api/drivers/search?q=${encodeURIComponent(driverSearch)}`);
            return res.json();
        },
        enabled: driverSearch.length >= 2,
    });

    // ── Mutations ────────────────────────────────────────────────────────
    const uploadMutation = useMutation({
        mutationFn: async ({ busId, docType, file, expiresAt, driverId }: {
            busId: string; docType: string; file: File; expiresAt?: string; driverId?: string;
        }) => {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("docType", docType);
            if (expiresAt) formData.append("expiresAt", expiresAt);
            if (driverId) formData.append("driverId", driverId);
            const res = await fetch(`/api/buses/${busId}/documents`, {
                method: "POST", body: formData, credentials: "include",
            });
            if (!res.ok) throw new Error("Upload failed");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Documento subido", description: "El archivo se guardó correctamente." });
            queryClient.invalidateQueries({ queryKey: ["/api/buses", selectedBus?.id, "documents"] });
            queryClient.invalidateQueries({ queryKey: ["/api/documents/expiring"] });
            setUploadingDocType(null);
        },
        onError: () => {
            toast({ title: "Error", description: "No se pudo subir el archivo.", variant: "destructive" });
            setUploadingDocType(null);
        },
    });

    const deleteDocMutation = useMutation({
        mutationFn: async ({ busId, docId }: { busId: string; docId: string }) => {
            const res = await apiRequest("DELETE", `/api/buses/${busId}/documents/${docId}`);
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Documento eliminado" });
            queryClient.invalidateQueries({ queryKey: ["/api/buses", selectedBus?.id, "documents"] });
            queryClient.invalidateQueries({ queryKey: ["/api/documents/expiring"] });
            setDeletingDoc(null);
        },
        onError: () => {
            toast({ title: "Error", description: "No se pudo eliminar el documento.", variant: "destructive" });
        },
    });

    const createDriverMutation = useMutation({
        mutationFn: async (data: { name: string; rut: string }) => {
            const res = await apiRequest("POST", "/api/drivers", data);
            return res.json();
        },
        onSuccess: (driver) => {
            toast({ title: "Conductor creado", description: `${driver.name} registrado correctamente.` });
            // Auto-assign to bus
            if (selectedBus) {
                assignDriverMutation.mutate({ busId: selectedBus.id, driverId: driver.id, role: selectedRole });
            }
            setNewDriverName("");
            setNewDriverRut("");
        },
        onError: (err: any) => {
            const msg = err?.message?.includes("409") ? "Ya existe un conductor con ese RUT" : "No se pudo crear el conductor.";
            toast({ title: "Error", description: msg, variant: "destructive" });
        },
    });

    const assignDriverMutation = useMutation({
        mutationFn: async ({ busId, driverId, role }: { busId: string; driverId: string; role: string }) => {
            const res = await apiRequest("POST", `/api/buses/${busId}/drivers`, { driverId, role });
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Conductor asignado" });
            queryClient.invalidateQueries({ queryKey: ["/api/buses", selectedBus?.id, "drivers"] });
            setAssignDialogOpen(false);
            setDriverSearch("");
        },
        onError: () => {
            toast({ title: "Error", description: "No se pudo asignar el conductor.", variant: "destructive" });
        },
    });

    const removeDriverMutation = useMutation({
        mutationFn: async ({ busId, driverId }: { busId: string; driverId: string }) => {
            const res = await apiRequest("DELETE", `/api/buses/${busId}/drivers/${driverId}`);
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Conductor desasignado" });
            queryClient.invalidateQueries({ queryKey: ["/api/buses", selectedBus?.id, "drivers"] });
            queryClient.invalidateQueries({ queryKey: ["/api/buses", selectedBus?.id, "documents"] });
        },
        onError: () => {
            toast({ title: "Error", description: "No se pudo desasignar el conductor.", variant: "destructive" });
        },
    });

    // ── Handlers ─────────────────────────────────────────────────────────
    const handleFileChange = (docType: string, e: React.ChangeEvent<HTMLInputElement>, driverId?: string) => {
        const file = e.target.files?.[0];
        if (!file || !selectedBus) return;
        setUploadingDocType(docType + (driverId || ""));
        const expiryKey = driverId ? `${docType}_${driverId}` : docType;
        const expiresAt = expiryDates[expiryKey] || undefined;
        uploadMutation.mutate({ busId: selectedBus.id, docType, file, expiresAt, driverId });
        e.target.value = "";
        setExpiryDates(prev => ({ ...prev, [expiryKey]: "" }));
    };

    const busDocsForType = (docType: string) =>
        (documents ?? []).filter((d) => d.docType === docType && !d.driverId);

    const driverDocsForType = (driverId: string, docType: string) =>
        (documents ?? []).filter((d) => d.docType === docType && d.driverId === driverId);

    const docCountForBus = (busId: string) => {
        if (selectedBus?.id === busId) return documents?.length ?? "…";
        return "–";
    };

    const toggleDriverOpen = (driverId: string) => {
        setOpenDriverIds(prev => {
            const next = new Set(prev);
            if (next.has(driverId)) next.delete(driverId);
            else next.add(driverId);
            return next;
        });
    };

    const totalExpiring = expiringDocs?.length ?? 0;
    const totalBuses = buses?.length ?? 0;
    const totalPages = Math.ceil(totalBuses / BUSES_PER_PAGE);
    const pagedBuses = buses?.slice(busPage * BUSES_PER_PAGE, (busPage + 1) * BUSES_PER_PAGE) ?? [];

    // Filter out already-assigned drivers from search results
    const assignedDriverIds = new Set((busDriversList ?? []).map(bd => bd.driverId));
    const availableSearchResults = (searchResults ?? []).filter(d => !assignedDriverIds.has(d.id));

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-semibold">Gestión de Buses</h1>
                <p className="text-muted-foreground">Administra los buses, documentos y conductores</p>
            </div>

            {/* Global expiring docs alert */}
            {totalExpiring > 0 && (
                <div className="border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 rounded-lg p-3 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-medium text-amber-800 dark:text-amber-300">
                            {totalExpiring} documento{totalExpiring > 1 ? "s" : ""} por vencer o vencido{totalExpiring > 1 ? "s" : ""}
                        </p>
                        <ul className="text-sm text-amber-700 dark:text-amber-400 mt-1 space-y-0.5">
                            {expiringDocs!.slice(0, 5).map((doc, i) => (
                                <li key={i}>
                                    <strong>Bus {doc.busNumber}</strong> — {DOC_TYPE_LABELS[doc.docType] || doc.docType}:{" "}
                                    {doc.daysLeft <= 0 ? (
                                        <span className="text-red-600 font-semibold">Vencido hace {Math.abs(doc.daysLeft)} días</span>
                                    ) : (
                                        <span>vence en {doc.daysLeft} días</span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ── Left: Bus List ─────────────────────────── */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Bus className="h-4 w-4" />
                            Lista de Buses
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {busesLoading ? (
                            <div className="space-y-2 p-4">
                                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                            </div>
                        ) : !buses || buses.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground">
                                <Bus className="h-10 w-10 mx-auto mb-2 opacity-40" />
                                <p>No hay buses registrados</p>
                            </div>
                        ) : (
                            <>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>N° Bus</TableHead>
                                            <TableHead>Placa</TableHead>
                                            <TableHead className="text-center">Docs</TableHead>
                                            <TableHead className="w-8" />
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {pagedBuses.map((bus) => (
                                            <TableRow
                                                key={bus.id}
                                                className={`cursor-pointer transition-colors ${selectedBus?.id === bus.id ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/50"}`}
                                                onClick={() => setSelectedBus(bus)}
                                            >
                                                <TableCell className="font-medium">{bus.busNumber}</TableCell>
                                                <TableCell className="text-muted-foreground">{bus.plate || "–"}</TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="secondary" className="text-xs">{docCountForBus(bus.id)}</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <ChevronRight className={`h-4 w-4 transition-colors ${selectedBus?.id === bus.id ? "text-primary" : "text-muted-foreground"}`} />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between px-4 py-2 border-t">
                                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={busPage === 0} onClick={() => setBusPage(p => p - 1)}>
                                            <ChevronLeft className="h-3 w-3" /> Anterior
                                        </Button>
                                        <span className="text-xs text-muted-foreground">Página {busPage + 1} de {totalPages}</span>
                                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={busPage >= totalPages - 1} onClick={() => setBusPage(p => p + 1)}>
                                            Siguiente <ChevronRight className="h-3 w-3" />
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* ── Right: Documents Panel ──────────────────── */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <FolderOpen className="h-4 w-4" />
                            {selectedBus ? `Documentos — Bus ${selectedBus.busNumber}` : "Documentos"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {!selectedBus ? (
                            <div className="text-center py-16 text-muted-foreground">
                                <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-40" />
                                <p className="font-medium">Selecciona un bus</p>
                                <p className="text-sm">Haz clic en un bus de la lista para ver sus documentos</p>
                            </div>
                        ) : docsLoading ? (
                            <div className="space-y-3">
                                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {/* Bus-level documents */}
                                {BUS_DOC_TYPES.map((docTypeConfig) => {
                                    const { key } = docTypeConfig;
                                    const typeDocs = busDocsForType(key);
                                    const isUploading = uploadingDocType === key && uploadMutation.isPending;
                                    const refKey = `bus_${key}`;
                                    return (
                                        <div key={key}>
                                            <input
                                                ref={(el) => { fileInputRefs.current[refKey] = el; }}
                                                type="file"
                                                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                                className="hidden"
                                                onChange={(e) => handleFileChange(key, e)}
                                            />
                                            <DocTypeSection
                                                docTypeConfig={docTypeConfig}
                                                typeDocs={typeDocs}
                                                busId={selectedBus.id}
                                                isUploading={isUploading}
                                                expiryDate={expiryDates[key] || ""}
                                                onExpiryChange={(val) => setExpiryDates(prev => ({ ...prev, [key]: val }))}
                                                onUploadClick={() => fileInputRefs.current[refKey]?.click()}
                                                onPreview={setPreviewDoc}
                                                onDelete={setDeletingDoc}
                                            />
                                        </div>
                                    );
                                })}

                                {/* ── Conductores Section ──────────────────── */}
                                <div className="border rounded-lg p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Users className="h-4 w-4 text-indigo-500" />
                                            <span className="text-sm font-medium">Conductores Asignados</span>
                                            <Badge variant="outline" className="text-xs ml-1">
                                                {busDriversList?.length ?? 0}
                                            </Badge>
                                        </div>
                                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setAssignDialogOpen(true)}>
                                            <UserPlus className="h-3 w-3" />
                                            Asignar
                                        </Button>
                                    </div>

                                    {(!busDriversList || busDriversList.length === 0) && (
                                        <p className="text-xs text-muted-foreground py-2 text-center">
                                            No hay conductores asignados a este bus
                                        </p>
                                    )}

                                    {busDriversList?.map((bd) => {
                                        const isOpen = openDriverIds.has(bd.driverId);
                                        return (
                                            <Collapsible key={bd.driverId} open={isOpen} onOpenChange={() => toggleDriverOpen(bd.driverId)}>
                                                <div className="border rounded-md">
                                                    <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 hover:bg-muted/50 transition-colors text-left">
                                                        <div className="flex items-center gap-2">
                                                            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                                                            <span className="text-sm font-medium">{bd.driver.name}</span>
                                                            <Badge variant="secondary" className="text-[10px]">
                                                                {bd.role === "titular" ? "Titular" : "Relevo"}
                                                            </Badge>
                                                        </div>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                removeDriverMutation.mutate({ busId: selectedBus.id, driverId: bd.driverId });
                                                            }}
                                                            title="Desasignar conductor"
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </Button>
                                                    </CollapsibleTrigger>
                                                    <CollapsibleContent>
                                                        <div className="px-3 pb-3 space-y-2 border-t pt-2">
                                                            <p className="text-[11px] text-muted-foreground">RUT: {bd.driver.rut}</p>
                                                            {DRIVER_DOC_TYPES.map(({ key, label, icon: Icon, color, alertDays }) => {
                                                                const dDocs = driverDocsForType(bd.driverId, key);
                                                                const refKey = `driver_${key}_${bd.driverId}`;
                                                                const expiryKey = `${key}_${bd.driverId}`;
                                                                const isUp = uploadingDocType === (key + bd.driverId) && uploadMutation.isPending;

                                                                return (
                                                                    <div key={key} className="space-y-1">
                                                                        <div className="flex items-center justify-between">
                                                                            <div className="flex items-center gap-1.5">
                                                                                <Icon className={`h-3.5 w-3.5 ${color}`} />
                                                                                <span className="text-xs font-medium">{label}</span>
                                                                                <Badge variant="outline" className="text-[10px]">{dDocs.length}</Badge>
                                                                            </div>
                                                                            <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-0.5 px-1.5" disabled={isUp}
                                                                                onClick={() => fileInputRefs.current[refKey]?.click()}>
                                                                                {isUp ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Upload className="h-2.5 w-2.5" />}
                                                                                Subir
                                                                            </Button>
                                                                            <input
                                                                                ref={(el) => { fileInputRefs.current[refKey] = el; }}
                                                                                type="file"
                                                                                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                                                                className="hidden"
                                                                                onChange={(e) => handleFileChange(key, e, bd.driverId)}
                                                                            />
                                                                        </div>
                                                                        <div className="flex items-center gap-2 text-[11px]">
                                                                            <CalendarClock className="h-3 w-3 text-muted-foreground" />
                                                                            <span className="text-muted-foreground">Vencimiento:</span>
                                                                            <input type="date" className="border rounded px-1.5 py-0 text-[11px] bg-background"
                                                                                value={expiryDates[expiryKey] || ""}
                                                                                onChange={(e) => setExpiryDates(prev => ({ ...prev, [expiryKey]: e.target.value }))} />
                                                                        </div>
                                                                        {dDocs.map((doc) => (
                                                                            <div key={doc.id} className="flex items-center gap-1.5">
                                                                                {getExpiryBadge(doc.expiresAt, alertDays)}
                                                                                <div className="flex-1 min-w-0">
                                                                                    <DocRow doc={doc} busId={selectedBus.id} onPreview={setPreviewDoc} onDelete={setDeletingDoc} />
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </CollapsibleContent>
                                                </div>
                                            </Collapsible>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ── Preview Modal ──────────────────────────────── */}
            <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 pr-8">
                            <Eye className="h-4 w-4" />
                            {previewDoc?.fileName}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto min-h-0">
                        {previewDoc && selectedBus && (
                            <>
                                {isImageFile(previewDoc.fileName) && (
                                    <div className="flex items-center justify-center p-4">
                                        <img src={`/api/buses/${selectedBus.id}/documents/${previewDoc.id}/preview`}
                                            alt={previewDoc.fileName} className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg" />
                                    </div>
                                )}
                                {isPdfFile(previewDoc.fileName) && (
                                    <iframe src={`/api/buses/${selectedBus.id}/documents/${previewDoc.id}/preview`}
                                        className="w-full h-[70vh] rounded-lg border" title={previewDoc.fileName} />
                                )}
                                {!isImageFile(previewDoc.fileName) && !isPdfFile(previewDoc.fileName) && (
                                    <div className="text-center py-16 text-muted-foreground">
                                        <FileText className="h-16 w-16 mx-auto mb-4 opacity-40" />
                                        <p className="font-medium text-lg mb-2">Vista previa no disponible</p>
                                        <Button asChild>
                                            <a href={`/api/buses/${selectedBus.id}/documents/${previewDoc.id}/download`} download>
                                                <Download className="h-4 w-4 mr-2" /> Descargar archivo
                                            </a>
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    {previewDoc?.expiresAt && (
                        <div className="border-t pt-3 flex items-center gap-2 text-sm text-muted-foreground">
                            <CalendarClock className="h-4 w-4" />
                            <span>
                                Vencimiento: <strong className="text-foreground">{format(parseISO(previewDoc.expiresAt), "dd MMMM yyyy", { locale: es })}</strong>
                                {(() => {
                                    const days = differenceInDays(parseISO(previewDoc.expiresAt), new Date());
                                    if (days <= 0) return <span className="text-red-500 ml-2 font-semibold">⛔ Vencido</span>;
                                    return <span className="ml-2">({days} días restantes)</span>;
                                })()}
                            </span>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* ── Delete Confirmation ────────────────────────── */}
            <AlertDialog open={!!deletingDoc} onOpenChange={(open) => !open && setDeletingDoc(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Se eliminará <strong>{deletingDoc?.fileName}</strong>. Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deletingDoc && selectedBus && deleteDocMutation.mutate({ busId: selectedBus.id, docId: deletingDoc.id })}
                        >
                            {deleteDocMutation.isPending ? "Eliminando..." : "Eliminar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── Assign Driver Modal ────────────────────────── */}
            <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <UserPlus className="h-4 w-4" />
                            Asignar Conductor — Bus {selectedBus?.busNumber}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Search existing driver */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Buscar conductor existente</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Nombre o RUT..."
                                    value={driverSearch}
                                    onChange={(e) => setDriverSearch(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            {availableSearchResults.length > 0 && (
                                <div className="border rounded-md max-h-32 overflow-auto">
                                    {availableSearchResults.map((driver) => (
                                        <div
                                            key={driver.id}
                                            className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 cursor-pointer text-sm"
                                            onClick={() => {
                                                if (selectedBus) {
                                                    assignDriverMutation.mutate({ busId: selectedBus.id, driverId: driver.id, role: selectedRole });
                                                }
                                            }}
                                        >
                                            <div>
                                                <span className="font-medium">{driver.name}</span>
                                                <span className="text-muted-foreground ml-2">{driver.rut}</span>
                                            </div>
                                            <UserPlus className="h-3.5 w-3.5 text-primary" />
                                        </div>
                                    ))}
                                </div>
                            )}
                            {driverSearch.length >= 2 && availableSearchResults.length === 0 && (
                                <p className="text-xs text-muted-foreground">No se encontraron conductores disponibles</p>
                            )}
                        </div>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-2 text-muted-foreground">o crear nuevo</span>
                            </div>
                        </div>

                        {/* Create new driver */}
                        <div className="space-y-2">
                            <Input placeholder="Nombre completo" value={newDriverName} onChange={(e) => setNewDriverName(e.target.value)} />
                            <Input placeholder="RUT (ej: 12.345.678-9)" value={newDriverRut} onChange={(e) => setNewDriverRut(e.target.value)} />
                        </div>

                        {/* Role */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Rol</label>
                            <Select value={selectedRole} onValueChange={setSelectedRole}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="titular">Titular</SelectItem>
                                    <SelectItem value="relevo">Relevo</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancelar</Button>
                        <Button
                            disabled={!newDriverName || !newDriverRut || createDriverMutation.isPending}
                            onClick={() => createDriverMutation.mutate({ name: newDriverName, rut: newDriverRut })}
                        >
                            {createDriverMutation.isPending ? "Creando..." : "Crear y Asignar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
