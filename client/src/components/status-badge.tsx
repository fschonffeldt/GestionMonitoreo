import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: string;
  size?: "default" | "sm";
}

export function StatusBadge({ status, size = "default" }: StatusBadgeProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "pending":
        return {
          label: "Pendiente",
          variant: "secondary" as const,
          className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
        };
      case "in_progress":
        return {
          label: "En Progreso",
          variant: "secondary" as const,
          className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
        };
      case "resolved":
        return {
          label: "Resuelto",
          variant: "secondary" as const,
          className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
        };
      case "operational":
        return {
          label: "Operativo",
          variant: "secondary" as const,
          className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
        };
      case "misaligned":
        return {
          label: "Desalineada",
          variant: "secondary" as const,
          className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
        };
      case "faulty":
        return {
          label: "Dañado",
          variant: "secondary" as const,
          className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
        };
      default:
        return {
          label: status,
          variant: "secondary" as const,
          className: "",
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <Badge
      variant={config.variant}
      className={`${config.className} ${size === "sm" ? "text-xs px-2 py-0.5" : ""}`}
      data-testid={`badge-status-${status}`}
    >
      {config.label}
    </Badge>
  );
}

interface EquipmentTypeBadgeProps {
  type: string;
  size?: "default" | "sm";
}

export function EquipmentTypeBadge({ type, size = "default" }: EquipmentTypeBadgeProps) {
  const getTypeConfig = (type: string) => {
    switch (type) {
      case "camera":
        return { label: "Cámara", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" };
      case "dvr":
        return { label: "DVR", className: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400" };
      case "gps":
        return { label: "GPS", className: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400" };
      case "hard_drive":
        return { label: "Disco Duro", className: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400" };
      case "cable":
        return { label: "Cable", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" };
      default:
        return { label: type, className: "" };
    }
  };

  const config = getTypeConfig(type);

  return (
    <Badge
      variant="secondary"
      className={`${config.className} ${size === "sm" ? "text-xs px-2 py-0.5" : ""}`}
      data-testid={`badge-type-${type}`}
    >
      {config.label}
    </Badge>
  );
}

interface IncidentTypeBadgeProps {
  type: string;
  size?: "default" | "sm";
}

export function IncidentTypeBadge({ type, size = "default" }: IncidentTypeBadgeProps) {
  const getTypeConfig = (type: string) => {
    switch (type) {
      case "misaligned":
        return { label: "Chueca", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" };
      case "loose_cable":
        return { label: "Cable Suelto", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" };
      case "faulty":
        return { label: "Dañado", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" };
      case "replacement":
        return { label: "Cambio", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" };
      default:
        return { label: type, className: "" };
    }
  };

  const config = getTypeConfig(type);

  return (
    <Badge
      variant="secondary"
      className={`${config.className} ${size === "sm" ? "text-xs px-2 py-0.5" : ""}`}
      data-testid={`badge-incident-${type}`}
    >
      {config.label}
    </Badge>
  );
}
