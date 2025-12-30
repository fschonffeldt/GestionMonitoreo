import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Camera, HardDrive, Radio, Cable, Disc, Plus } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { incidentFormSchema, type IncidentFormData, type Bus, CameraChannelLabels } from "@shared/schema";
import { FormSkeleton } from "@/components/loading-skeleton";

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

export default function RegisterIncident() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [newBusDialogOpen, setNewBusDialogOpen] = useState(false);
  const [newBusNumber, setNewBusNumber] = useState("");

  const { data: buses, isLoading: busesLoading } = useQuery<Bus[]>({
    queryKey: ["/api/buses"],
  });

  const form = useForm<IncidentFormData>({
    resolver: zodResolver(incidentFormSchema),
    defaultValues: {
      busId: "",
      equipmentType: "camera",
      incidentType: "faulty",
      cameraChannel: "",
      description: "",
      reporter: "",
    },
  });

  const selectedEquipmentType = form.watch("equipmentType");

  const createIncident = useMutation({
    mutationFn: async (data: IncidentFormData) => {
      return apiRequest("POST", "/api/incidents", data);
    },
    onSuccess: () => {
      toast({
        title: "Incidencia registrada",
        description: "La incidencia se ha registrado correctamente.",
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
    mutationFn: async (busNumber: string) => {
      return apiRequest("POST", "/api/buses", { busNumber });
    },
    onSuccess: () => {
      toast({
        title: "Bus agregado",
        description: "El bus se ha agregado correctamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/buses"] });
      setNewBusDialogOpen(false);
      setNewBusNumber("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo agregar el bus.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: IncidentFormData) => {
    if (data.equipmentType !== "camera") {
      data.cameraChannel = undefined;
    }
    createIncident.mutate(data);
  };

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
                          {buses?.map((bus) => (
                            <SelectItem key={bus.id} value={bus.id}>
                              Bus {bus.busNumber} {bus.plate && `(${bus.plate})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Dialog open={newBusDialogOpen} onOpenChange={setNewBusDialogOpen}>
                        <DialogTrigger asChild>
                          <Button type="button" variant="outline" size="icon" data-testid="button-add-bus">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Agregar Nuevo Bus</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 pt-4">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Número de Bus</label>
                              <Input
                                value={newBusNumber}
                                onChange={(e) => setNewBusNumber(e.target.value)}
                                placeholder="Ej: 101"
                                data-testid="input-new-bus-number"
                              />
                            </div>
                            <Button
                              onClick={() => createBus.mutate(newBusNumber)}
                              disabled={!newBusNumber || createBus.isPending}
                              className="w-full"
                              data-testid="button-save-bus"
                            >
                              {createBus.isPending ? "Guardando..." : "Guardar Bus"}
                            </Button>
                          </div>
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
                  name="cameraChannel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Canal de Cámara</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-camera-channel">
                            <SelectValue placeholder="Seleccione el canal" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {cameraChannels.map((channel) => (
                            <SelectItem key={channel.value} value={channel.value}>
                              {channel.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
