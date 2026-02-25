import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
    Mail,
    Plus,
    Trash2,
    Send,
    ToggleLeft,
    ToggleRight,
    Loader2,
    AlertTriangle,
    CheckCircle2,
    Settings,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface EmailRecipient {
    id: string;
    email: string;
    name: string;
    active: string;
    createdAt: string;
}

export default function SettingsPage() {
    const [newEmail, setNewEmail] = useState("");
    const [newName, setNewName] = useState("");
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const { toast } = useToast();

    const { data: recipients, isLoading } = useQuery<EmailRecipient[]>({
        queryKey: ["/api/email-recipients"],
    });

    const createMutation = useMutation({
        mutationFn: async (data: { email: string; name: string }) => {
            const res = await apiRequest("POST", "/api/email-recipients", data);
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Destinatario agregado" });
            queryClient.invalidateQueries({ queryKey: ["/api/email-recipients"] });
            setNewEmail("");
            setNewName("");
        },
        onError: () => {
            toast({ title: "Error", description: "No se pudo agregar. Puede que el correo ya exista.", variant: "destructive" });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await apiRequest("DELETE", `/api/email-recipients/${id}`);
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Destinatario eliminado" });
            queryClient.invalidateQueries({ queryKey: ["/api/email-recipients"] });
            setDeletingId(null);
        },
        onError: () => {
            toast({ title: "Error", description: "No se pudo eliminar.", variant: "destructive" });
        },
    });

    const toggleMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await apiRequest("PATCH", `/api/email-recipients/${id}/toggle`);
            return res.json();
        },
        onSuccess: (data) => {
            toast({ title: data.active === "true" ? "Activado" : "Desactivado" });
            queryClient.invalidateQueries({ queryKey: ["/api/email-recipients"] });
        },
        onError: () => {
            toast({ title: "Error", variant: "destructive" });
        },
    });

    const testEmailMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest("POST", "/api/email-test");
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error");
            return data;
        },
        onSuccess: (data) => {
            toast({ title: "✅ Email enviado", description: data.message });
        },
        onError: (err: any) => {
            toast({ title: "Error", description: err.message || "No se pudo enviar el email de prueba.", variant: "destructive" });
        },
    });

    const activeCount = recipients?.filter(r => r.active === "true").length ?? 0;

    return (
        <div className="p-6 max-w-3xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-semibold flex items-center gap-2">
                    <Settings className="h-6 w-6" />
                    Configuración
                </h1>
                <p className="text-muted-foreground">Administra las notificaciones por correo para documentos por vencer</p>
            </div>

            {/* Recipients Card */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Mail className="h-4 w-4" />
                                Destinatarios de Alertas
                            </CardTitle>
                            <CardDescription className="mt-1">
                                {activeCount} destinatario{activeCount !== 1 ? "s" : ""} activo{activeCount !== 1 ? "s" : ""}
                            </CardDescription>
                        </div>
                        <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => testEmailMutation.mutate()}
                            disabled={testEmailMutation.isPending || activeCount === 0}
                        >
                            {testEmailMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Send className="h-3.5 w-3.5" />
                            )}
                            Enviar Prueba
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Add recipient form */}
                    <div className="flex gap-2">
                        <Input
                            placeholder="Nombre"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="flex-1"
                        />
                        <Input
                            placeholder="correo@ejemplo.com"
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            className="flex-1"
                        />
                        <Button
                            size="sm"
                            className="gap-1 shrink-0"
                            disabled={!newEmail || !newName || createMutation.isPending}
                            onClick={() => createMutation.mutate({ email: newEmail, name: newName })}
                        >
                            {createMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Plus className="h-3.5 w-3.5" />
                            )}
                            Agregar
                        </Button>
                    </div>

                    {/* Recipients list */}
                    {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                            <p className="text-sm">Cargando destinatarios...</p>
                        </div>
                    ) : !recipients || recipients.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                            <Mail className="h-8 w-8 mx-auto mb-2 opacity-40" />
                            <p className="font-medium">No hay destinatarios</p>
                            <p className="text-sm">Agrega un correo para recibir alertas de vencimiento</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {recipients.map((recipient) => (
                                <div
                                    key={recipient.id}
                                    className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${recipient.active === "true"
                                        ? "bg-background hover:bg-muted/50"
                                        : "bg-muted/30 opacity-60"
                                        }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold ${recipient.active === "true"
                                            ? "bg-primary/10 text-primary"
                                            : "bg-muted text-muted-foreground"
                                            }`}>
                                            {recipient.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium text-sm truncate">{recipient.name}</p>
                                                {recipient.active === "true" ? (
                                                    <Badge variant="outline" className="text-[10px] text-green-600 border-green-300">Activo</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-[10px] text-muted-foreground">Inactivo</Badge>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground truncate">{recipient.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8"
                                            onClick={() => toggleMutation.mutate(recipient.id)}
                                            title={recipient.active === "true" ? "Desactivar" : "Activar"}
                                        >
                                            {recipient.active === "true" ? (
                                                <ToggleRight className="h-5 w-5 text-green-600" />
                                            ) : (
                                                <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                                            )}
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => setDeletingId(recipient.id)}
                                            title="Eliminar"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Info box */}
                    <div className="border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 rounded-lg p-3 flex items-start gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                        <div className="text-blue-800 dark:text-blue-300">
                            <p className="font-medium">¿Cómo funciona?</p>
                            <p className="text-xs mt-1">
                                El sistema verifica cada 24 horas si hay documentos por vencer. Si hay documentos que necesitan atención,
                                se envía un correo a todos los destinatarios <strong>activos</strong> con el N° de bus, tipo de documento y fecha de vencimiento.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Delete confirmation */}
            <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar destinatario?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Este destinatario dejará de recibir alertas de vencimiento de documentos.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deletingId && deleteMutation.mutate(deletingId)}
                        >
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
