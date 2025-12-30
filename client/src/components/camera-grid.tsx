import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, Video, Users, ArrowRight } from "lucide-react";
import { CameraChannelLabels } from "@shared/schema";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CameraStatus {
  channel: string;
  status: "operational" | "misaligned" | "faulty";
}

interface CameraGridProps {
  busNumber: string;
  cameras: CameraStatus[];
}

const cameraIcons: Record<string, React.ElementType> = {
  ch1: ArrowRight,
  ch2: Camera,
  ch3: Video,
  ch4: Users,
};

const statusLabels: Record<string, string> = {
  operational: "Operativa - Funcionando correctamente",
  misaligned: "Desalineada - Requiere ajuste de posición",
  faulty: "Dañada - Requiere reparación o reemplazo",
};

export function CameraGrid({ busNumber, cameras }: CameraGridProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "operational":
        return "bg-green-500";
      case "misaligned":
        return "bg-amber-500";
      case "faulty":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case "operational":
        return "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800";
      case "misaligned":
        return "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800";
      case "faulty":
        return "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
      default:
        return "bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800";
    }
  };

  return (
    <Card data-testid={`card-camera-grid-${busNumber}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Bus {busNumber}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {cameras.map((camera) => {
            const Icon = cameraIcons[camera.channel] || Camera;
            return (
              <div
                key={camera.channel}
                className={`flex items-center gap-3 p-3 rounded-md border ${getStatusBgColor(camera.status)}`}
                data-testid={`camera-status-${busNumber}-${camera.channel}`}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-center h-8 w-8 rounded-md bg-background cursor-help">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{CameraChannelLabels[camera.channel]}</p>
                  </TooltipContent>
                </Tooltip>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {camera.channel.toUpperCase()}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {CameraChannelLabels[camera.channel]}
                  </p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`h-3 w-3 rounded-full cursor-help ${getStatusColor(camera.status)}`} />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{statusLabels[camera.status]}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
