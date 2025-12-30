import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, subMonths, addMonths } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, FileText, TrendingUp, AlertTriangle, CheckCircle, Bus, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/metric-card";
import { MetricCardSkeleton, ChartSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import type { MonthlyReport as MonthlyReportType } from "@shared/schema";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";

export default function MonthlyReport() {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const monthStart = startOfMonth(currentDate);
  const monthParam = format(monthStart, "yyyy-MM");

  const { data: report, isLoading } = useQuery<MonthlyReportType>({
    queryKey: [`/api/reports/monthly?month=${monthParam}`],
  });

  const goToPrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const isCurrentMonth = format(new Date(), "yyyy-MM") === monthParam;

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

  const weeklyTrendData = report?.weeklyTrend || [];

  const colors = ["#8b5cf6", "#6366f1", "#06b6d4", "#64748b", "#f97316"];
  const incidentColors = ["#f59e0b", "#f97316", "#ef4444", "#3b82f6"];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Reporte Mensual</h1>
          <p className="text-muted-foreground">Resumen de incidencias del mes</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPrevMonth} data-testid="button-prev-month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-medium min-w-32 text-center capitalize">
            {format(monthStart, "MMMM yyyy", { locale: es })}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={goToNextMonth}
            disabled={isCurrentMonth}
            data-testid="button-next-month"
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
              subtitle="Este mes"
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
              icon={Calendar}
              title="Sin incidencias este mes"
              description="No se registraron incidencias durante este período"
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {!isLoading && weeklyTrendData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tendencia Semanal</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={weeklyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" tickFormatter={(value) => `Sem ${value}`} />
                    <YAxis />
                    <Tooltip labelFormatter={(value) => `Semana ${value}`} />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))" }}
                      name="Incidencias"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

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
                        <BarChart data={equipmentData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
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
                        <BarChart data={incidentTypeData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
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
        </>
      )}

      {!isLoading && report?.mostAffectedBuses && report.mostAffectedBuses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Buses Más Afectados del Mes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {report.mostAffectedBuses.slice(0, 6).map((bus, index) => (
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
