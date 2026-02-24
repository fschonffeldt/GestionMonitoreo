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
    Loader2,
    FolderOpen,
    Eye,
    AlertTriangle,
    CalendarClock,
    X,
    ChevronLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "@/components/ui/dialog";
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
    docType: string;
    fileName: string;
    filePath: string;
    notes: string | null;
    uploadedAt: string;
    expiresAt: string | null;
}

interface ExpiringDoc {
    busNumber: string;
    docType: string;
    fileName: string;
    expiresAt: string;
    daysLeft: number;
}

const DOC_TYPES = [
    { key: "permiso_circulacion", label: "Permiso de Circulación", icon: FileText, color: "text-blue-500" },
    { key: "revision_tecnica", label: "Revisión Técnica", icon: Wrench, color: "text-green-500", hasExpiry: true, alertDays: 5 },
    { key: "chasis", label: "Información de Chasis", icon: Settings, color: "text-purple-500" },
    { key: "licencia_conducir", label: "Licencia de Conducir", icon: CreditCard, color: "text-amber-500", hasExpiry: true, alertDays: 30 },
    { key: "cedula_conductor", label: "Cédula del Conductor", icon: IdCard, color: "text-rose-500", hasExpiry: true, alertDays: 30 },
] as const;

const DOC_TYPE_LABELS: Record<string, string> = Object.fromEntries(DOC_TYPES.map(d => [d.key, d.label]));

function isImageFile(fileName: string) {
    return /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(fileName);
}

function isPdfFile(fileName: string) {
    return /\.pdf$/i.test(fileName);
}

function getExpiryBadge(doc: BusDocument, docTypeConfig: (typeof DOC_TYPES)[number]) {
    if (!doc.expiresAt || !("hasExpiry" in docTypeConfig) || !docTypeConfig.hasExpiry) return null;

    const daysLeft = differenceInDays(parseISO(doc.expiresAt), new Date());
    const alertDays = docTypeConfig.alertDays;

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

export default function Buses() {
    const [selectedBus, setSelectedBus] = useState<BusData | null>(null);
    const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);
    const [deletingDoc, setDeletingDoc] = useState<BusDocument | null>(null);
    const [previewDoc, setPreviewDoc] = useState<BusDocument | null>(null);
    const [expiryDates, setExpiryDates] = useState<Record<string, string>>({});
    const [busPage, setBusPage] = useState(0);
    const BUSES_PER_PAGE = 25;
    const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
    const { toast } = useToast();

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

    const { data: expiringDocs } = useQuery<ExpiringDoc[]>({
        queryKey: ["/api/documents/expiring"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/documents/expiring");
            return res.json();
        },
    });

    const uploadMutation = useMutation({
        mutationFn: async ({ busId, docType, file, expiresAt }: { busId: string; docType: string; file: File; expiresAt?: string }) => {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("docType", docType);
            if (expiresAt) formData.append("expiresAt", expiresAt);
            const res = await fetch(`/api/buses/${busId}/documents`, {
                method: "POST",
                body: formData,
                credentials: "include",
            });
            if (!res.ok) throw new Error("Upload failed");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Documento subido", description: "El archivo se guardó correctamente." });
            queryClient.invalidateQueries({ queryKey: ["/api/buses", selectedBus?.id, "documents"] });
            queryClient.invalidateQueries({ queryKey: ["/api/buses"] });
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
            toast({ title: "Documento eliminado", description: "El archivo fue eliminado correctamente." });
            queryClient.invalidateQueries({ queryKey: ["/api/buses", selectedBus?.id, "documents"] });
            queryClient.invalidateQueries({ queryKey: ["/api/documents/expiring"] });
            setDeletingDoc(null);
        },
        onError: () => {
            toast({ title: "Error", description: "No se pudo eliminar el documento.", variant: "destructive" });
        },
    });

    const handleFileChange = (docType: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedBus) return;
        setUploadingDocType(docType);
        const expiresAt = expiryDates[docType] || undefined;
        uploadMutation.mutate({ busId: selectedBus.id, docType, file, expiresAt });
        // Reset input & expiry
        e.target.value = "";
        setExpiryDates(prev => ({ ...prev, [docType]: "" }));
    };

    const docsForType = (docType: string) =>
        (documents ?? []).filter((d) => d.docType === docType);

    const docCountForBus = (busId: string) => {
        if (selectedBus?.id === busId) return documents?.length ?? "…";
        return "–";
    };

    const totalExpiring = expiringDocs?.length ?? 0;

    const totalBuses = buses?.length ?? 0;
    const totalPages = Math.ceil(totalBuses / BUSES_PER_PAGE);
    const pagedBuses = buses?.slice(busPage * BUSES_PER_PAGE, (busPage + 1) * BUSES_PER_PAGE) ?? [];

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-semibold" data-testid="text-page-title">Gestión de Buses</h1>
                <p className="text-muted-foreground">Administra los buses y sus documentos importantes</p>
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
                            {totalExpiring > 5 && (
                                <li className="text-muted-foreground">...y {totalExpiring - 5} más</li>
                            )}
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
                                {[...Array(5)].map((_, i) => (
                                    <Skeleton key={i} className="h-10 w-full" />
                                ))}
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
                                                className={`cursor-pointer transition-colors ${selectedBus?.id === bus.id
                                                    ? "bg-primary/10 hover:bg-primary/15"
                                                    : "hover:bg-muted/50"
                                                    }`}
                                                onClick={() => setSelectedBus(bus)}
                                                data-testid={`row-bus-${bus.busNumber}`}
                                            >
                                                <TableCell className="font-medium">{bus.busNumber}</TableCell>
                                                <TableCell className="text-muted-foreground">{bus.plate || "–"}</TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="secondary" className="text-xs">
                                                        {docCountForBus(bus.id)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <ChevronRight
                                                        className={`h-4 w-4 transition-colors ${selectedBus?.id === bus.id ? "text-primary" : "text-muted-foreground"
                                                            }`}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between px-4 py-2 border-t">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs gap-1"
                                            disabled={busPage === 0}
                                            onClick={() => setBusPage(p => p - 1)}
                                        >
                                            <ChevronLeft className="h-3 w-3" />
                                            Anterior
                                        </Button>
                                        <span className="text-xs text-muted-foreground">
                                            Página {busPage + 1} de {totalPages}
                                        </span>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs gap-1"
                                            disabled={busPage >= totalPages - 1}
                                            onClick={() => setBusPage(p => p + 1)}
                                        >
                                            Siguiente
                                            <ChevronRight className="h-3 w-3" />
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
                            {selectedBus
                                ? `Documentos — Bus ${selectedBus.busNumber}`
                                : "Documentos"}
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
                                {[...Array(4)].map((_, i) => (
                                    <Skeleton key={i} className="h-20 w-full rounded-lg" />
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {DOC_TYPES.map((docTypeConfig) => {
                                    const { key, label, icon: Icon, color } = docTypeConfig;
                                    const typeDocs = docsForType(key);
                                    const isUploading = uploadingDocType === key && uploadMutation.isPending;
                                    const hasExpiry = "hasExpiry" in docTypeConfig && docTypeConfig.hasExpiry;
                                    return (
                                        <div
                                            key={key}
                                            className="border rounded-lg p-3 space-y-2"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Icon className={`h-4 w-4 ${color}`} />
                                                    <span className="text-sm font-medium">{label}</span>
                                                    <Badge variant="outline" className="text-xs ml-1">
                                                        {typeDocs.length}
                                                    </Badge>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 text-xs gap-1"
                                                    disabled={isUploading}
                                                    onClick={() => fileInputRefs.current[key]?.click()}
                                                    data-testid={`button-upload-${key}`}
                                                >
                                                    {isUploading ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                    ) : (
                                                        <Upload className="h-3 w-3" />
                                                    )}
                                                    Subir
                                                </Button>
                                                <input
                                                    ref={(el) => { fileInputRefs.current[key] = el; }}
                                                    type="file"
                                                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                                    className="hidden"
                                                    onChange={(e) => handleFileChange(key, e)}
                                                    data-testid={`input-file-${key}`}
                                                />
                                            </div>

                                            {/* Expiry date picker for applicable doc types */}
                                            {hasExpiry && (
                                                <div className="flex items-center gap-2 text-xs">
                                                    <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                                                    <span className="text-muted-foreground">Vencimiento:</span>
                                                    <input
                                                        type="date"
                                                        className="border rounded px-2 py-0.5 text-xs bg-background"
                                                        value={expiryDates[key] || ""}
                                                        onChange={(e) => setExpiryDates(prev => ({ ...prev, [key]: e.target.value }))}
                                                        data-testid={`input-expiry-${key}`}
                                                    />
                                                    {expiryDates[key] && (
                                                        <span className="text-muted-foreground">
                                                            (se usará al subir)
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {typeDocs.length > 0 && (
                                                <div className="space-y-1 mt-1">
                                                    {typeDocs.map((doc) => (
                                                        <div
                                                            key={doc.id}
                                                            className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1.5 hover:bg-muted/70 transition-colors"
                                                        >
                                                            <div
                                                                className="flex flex-col min-w-0 cursor-pointer flex-1"
                                                                onClick={() => setPreviewDoc(doc)}
                                                                title="Clic para previsualizar"
                                                            >
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="font-medium truncate max-w-[160px]">{doc.fileName}</span>
                                                                    {getExpiryBadge(doc, docTypeConfig)}
                                                                </div>
                                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                                    <span>
                                                                        {format(new Date(doc.uploadedAt), "dd MMM yyyy", { locale: es })}
                                                                    </span>
                                                                    {doc.expiresAt && (
                                                                        <span>
                                                                            · Vence: {format(parseISO(doc.expiresAt), "dd MMM yyyy", { locale: es })}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-1 shrink-0">
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-6 w-6"
                                                                    onClick={() => setPreviewDoc(doc)}
                                                                    title="Previsualizar"
                                                                >
                                                                    <Eye className="h-3 w-3" />
                                                                </Button>
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-6 w-6"
                                                                    asChild
                                                                    title="Descargar"
                                                                >
                                                                    <a
                                                                        href={`/api/buses/${selectedBus.id}/documents/${doc.id}/download`}
                                                                        download
                                                                        data-testid={`button-download-${doc.id}`}
                                                                    >
                                                                        <Download className="h-3 w-3" />
                                                                    </a>
                                                                </Button>
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                    onClick={() => setDeletingDoc(doc)}
                                                                    title="Eliminar"
                                                                    data-testid={`button-delete-doc-${doc.id}`}
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Preview document modal */}
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
                                        <img
                                            src={`/api/buses/${selectedBus.id}/documents/${previewDoc.id}/preview`}
                                            alt={previewDoc.fileName}
                                            className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
                                        />
                                    </div>
                                )}
                                {isPdfFile(previewDoc.fileName) && (
                                    <iframe
                                        src={`/api/buses/${selectedBus.id}/documents/${previewDoc.id}/preview`}
                                        className="w-full h-[70vh] rounded-lg border"
                                        title={previewDoc.fileName}
                                    />
                                )}
                                {!isImageFile(previewDoc.fileName) && !isPdfFile(previewDoc.fileName) && (
                                    <div className="text-center py-16 text-muted-foreground">
                                        <FileText className="h-16 w-16 mx-auto mb-4 opacity-40" />
                                        <p className="font-medium text-lg mb-2">Vista previa no disponible</p>
                                        <p className="text-sm mb-4">
                                            Este tipo de archivo ({previewDoc.fileName.split('.').pop()?.toUpperCase()}) no se puede previsualizar.
                                        </p>
                                        <Button asChild>
                                            <a
                                                href={`/api/buses/${selectedBus.id}/documents/${previewDoc.id}/download`}
                                                download
                                            >
                                                <Download className="h-4 w-4 mr-2" />
                                                Descargar archivo
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
                                    if (days <= 30) return <span className="text-amber-500 ml-2">({days} días restantes)</span>;
                                    return <span className="ml-2">({days} días restantes)</span>;
                                })()}
                            </span>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Delete document confirmation */}
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
                            onClick={() =>
                                deletingDoc &&
                                selectedBus &&
                                deleteDocMutation.mutate({ busId: selectedBus.id, docId: deletingDoc.id })
                            }
                            data-testid="button-confirm-delete-doc"
                        >
                            {deleteDocMutation.isPending ? "Eliminando..." : "Eliminar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
