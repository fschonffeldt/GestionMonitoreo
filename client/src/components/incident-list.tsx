import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusBadge, EquipmentTypeBadge } from "@/components/status-badge";
import { CameraChannelLabels, type Incident } from "@shared/schema";
import { Bus } from "lucide-react";

interface IncidentListProps {
  incidents: Incident[];
  title?: string;
  maxHeight?: string;
  showBusNumber?: boolean;
  buses?: Map<string, string>;
}

export function IncidentList({ 
  incidents, 
  title = "Incidencias Recientes", 
  maxHeight = "400px",
  showBusNumber = true,
  buses = new Map()
}: IncidentListProps) {
  if (incidents.length === 0) {
    return (
      <Card data-testid="card-incident-list">
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Bus className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No hay incidencias registradas</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-incident-list">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea style={{ maxHeight }}>
          <div className="divide-y">
            {incidents.map((incident) => (
              <div
                key={incident.id}
                className="flex items-start gap-4 p-4 hover-elevate"
                data-testid={`incident-item-${incident.id}`}
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {showBusNumber && (
                      <span className="text-sm font-medium">
                        Bus {buses.get(incident.busId) || incident.busId}
                      </span>
                    )}
                    <EquipmentTypeBadge type={incident.equipmentType} size="sm" />
                    {incident.cameraChannel && (
                      <span className="text-xs text-muted-foreground">
                        {incident.cameraChannel.toUpperCase()} - {CameraChannelLabels[incident.cameraChannel]}
                      </span>
                    )}
                  </div>
                  {incident.description && (
                    <p className="text-sm text-muted-foreground truncate">
                      {incident.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {incident.reportedAt
                        ? formatDistanceToNow(new Date(incident.reportedAt), {
                            addSuffix: true,
                            locale: es,
                          })
                        : "Fecha desconocida"}
                    </span>
                    {incident.reporter && (
                      <>
                        <span>•</span>
                        <span>{incident.reporter}</span>
                      </>
                    )}
                  </div>
                </div>
                <StatusBadge status={incident.status} size="sm" />
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
