import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek, subWeeks, addWeeks } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, FileText, TrendingUp, AlertTriangle, CheckCircle, Bus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/metric-card";
import { EquipmentTypeBadge, IncidentTypeBadge } from "@/components/status-badge";
import { MetricCardSkeleton, ChartSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import type { WeeklyReport as WeeklyReportType } from "@shared/schema";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export default function WeeklyReport() {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekParam = format(weekStart, "yyyy-'W'ww");

  const { data: report, isLoading } = useQuery<WeeklyReportType>({
    queryKey: [`/api/reports/weekly?week=${weekParam}`],
  });

  const goToPrevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const goToNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
  const isCurrentWeek = format(new Date(), "yyyy-'W'ww") === weekParam;

  const equipmentData = report?.incidentsByEquipment
    ? Object.entries(report.incidentsByEquipment).map(([key, value]) => ({
        name: key === "camera" ? "Cámara" : key === "dvr" ? "DVR" : key === "gps" ? "GPS" : key === "hard_drive" ? "Disco" : "Cable",
        value,
        key,
      }))
    : [];

  const incidentTypeData = report?.incidentsByType
    ? Object.entries(report.incidentsByType).map(([key, value]) => ({
        name: key === "misaligned" ? "Chueca" : key === "loose_cable" ? "Cable Suelto" : key === "faulty" ? "Dañado" : "Cambio",
        value,
        key,
      }))
    : [];

  const colors = ["#8b5cf6", "#6366f1", "#06b6d4", "#64748b", "#f97316"];
  const incidentColors = ["#f59e0b", "#f97316", "#ef4444", "#3b82f6"];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Reporte Semanal</h1>
          <p className="text-muted-foreground">Resumen de incidencias de la semana</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPrevWeek} data-testid="button-prev-week">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-medium min-w-48 text-center">
            {format(weekStart, "d MMM", { locale: es })} - {format(weekEnd, "d MMM yyyy", { locale: es })}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={goToNextWeek}
            disabled={isCurrentWeek}
            data-testid="button-next-week"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {isLoading ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            <MetricCard
              title="Total Incidencias"
              value={report?.totalIncidents || 0}
              subtitle="Esta semana"
              icon={FileText}
            />
            <MetricCard
              title="Resueltas"
              value={report?.resolvedIncidents || 0}
              subtitle={`${report?.totalIncidents ? Math.round((report.resolvedIncidents / report.totalIncidents) * 100) : 0}% del total`}
              icon={CheckCircle}
            />
            <MetricCard
              title="Pendientes"
              value={(report?.totalIncidents || 0) - (report?.resolvedIncidents || 0)}
              subtitle="Por resolver"
              icon={AlertTriangle}
            />
            <MetricCard
              title="Buses Afectados"
              value={report?.mostAffectedBuses?.length || 0}
              subtitle="Con incidencias"
              icon={Bus}
            />
          </>
        )}
      </div>

      {!isLoading && report?.totalIncidents === 0 ? (
        <Card>
          <CardContent className="py-8">
            <EmptyState
              icon={FileText}
              title="Sin incidencias esta semana"
              description="No se registraron incidencias durante este período"
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {isLoading ? (
            <>
              <ChartSkeleton />
              <ChartSkeleton />
            </>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Incidencias por Equipo</CardTitle>
                </CardHeader>
                <CardContent>
                  {equipmentData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={equipmentData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={60} />
                        <Tooltip />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {equipmentData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-muted-foreground">
                      Sin datos
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Incidencias por Tipo</CardTitle>
                </CardHeader>
                <CardContent>
                  {incidentTypeData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={incidentTypeData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={80} />
                        <Tooltip />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {incidentTypeData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={incidentColors[index % incidentColors.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-muted-foreground">
                      Sin datos
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {!isLoading && report?.mostAffectedBuses && report.mostAffectedBuses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Buses Más Afectados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {report.mostAffectedBuses.slice(0, 5).map((bus, index) => (
                <div
                  key={bus.busNumber}
                  className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                  data-testid={`bus-affected-${bus.busNumber}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
                      {index + 1}
                    </span>
                    <span className="font-medium">Bus {bus.busNumber}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{bus.count} incidencias</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
