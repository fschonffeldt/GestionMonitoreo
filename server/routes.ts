import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBusSchema, incidentFormSchema } from "@shared/schema";
import { z } from "zod";
import { parseISO, startOfWeek } from "date-fns";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/buses", async (req, res) => {
    try {
      const buses = await storage.getBuses();
      res.json(buses);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener buses" });
    }
  });

  app.post("/api/buses", async (req, res) => {
    try {
      const parsed = insertBusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const bus = await storage.createBus(parsed.data);
      res.status(201).json(bus);
    } catch (error) {
      res.status(500).json({ error: "Error al crear bus" });
    }
  });

  app.get("/api/incidents", async (req, res) => {
    try {
      const { status, equipmentType, busId, limit } = req.query;
      const incidents = await storage.getIncidents({
        status: status as string | undefined,
        equipmentType: equipmentType as string | undefined,
        busId: busId as string | undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });
      res.json(incidents);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener incidencias" });
    }
  });

  app.get("/api/incidents/:id", async (req, res) => {
    try {
      const incident = await storage.getIncident(req.params.id);
      if (!incident) {
        return res.status(404).json({ error: "Incidencia no encontrada" });
      }
      res.json(incident);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener incidencia" });
    }
  });

  app.post("/api/incidents", async (req, res) => {
    try {
      const parsed = incidentFormSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      
      const { cameraChannels, ...restData } = parsed.data;
      const createdIncidents = [];
      
      if (restData.equipmentType === "camera" && cameraChannels && cameraChannels.length > 0) {
        for (const channel of cameraChannels) {
          const incident = await storage.createIncident({
            ...restData,
            cameraChannel: channel,
            status: "pending",
          });
          createdIncidents.push(incident);
        }
      } else {
        const incident = await storage.createIncident({
          ...restData,
          cameraChannel: undefined,
          status: "pending",
        });
        createdIncidents.push(incident);
      }
      
      res.status(201).json(createdIncidents.length === 1 ? createdIncidents[0] : createdIncidents);
    } catch (error) {
      res.status(500).json({ error: "Error al crear incidencia" });
    }
  });

  app.patch("/api/incidents/:id", async (req, res) => {
    try {
      const updateSchema = z.object({
        status: z.enum(["pending", "in_progress", "resolved"]).optional(),
        resolutionNotes: z.string().optional(),
      });
      
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      
      const incident = await storage.updateIncident(req.params.id, parsed.data);
      if (!incident) {
        return res.status(404).json({ error: "Incidencia no encontrada" });
      }
      res.json(incident);
    } catch (error) {
      res.status(500).json({ error: "Error al actualizar incidencia" });
    }
  });

  app.get("/api/equipment-status", async (req, res) => {
    try {
      const { busId } = req.query;
      const statuses = await storage.getEquipmentStatus(busId as string | undefined);
      res.json(statuses);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener estado de equipos" });
    }
  });

  app.get("/api/camera-status", async (req, res) => {
    try {
      const cameraStatus = await storage.getCameraStatus();
      res.json(cameraStatus);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener estado de cámaras" });
    }
  });

  app.get("/api/dashboard", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener estadísticas" });
    }
  });

  app.get("/api/reports/weekly", async (req, res) => {
    try {
      const { week } = req.query;
      let weekStart: Date;
      
      if (week && typeof week === "string") {
        const [year, weekNum] = week.split("-W");
        const date = new Date(parseInt(year), 0, 1);
        date.setDate(date.getDate() + (parseInt(weekNum) - 1) * 7);
        weekStart = startOfWeek(date, { weekStartsOn: 1 });
      } else {
        weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      }
      
      const report = await storage.getWeeklyReport(weekStart);
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: "Error al generar reporte semanal" });
    }
  });

  app.get("/api/reports/monthly", async (req, res) => {
    try {
      const { month } = req.query;
      let monthStart: Date;
      
      if (month && typeof month === "string") {
        monthStart = parseISO(`${month}-01`);
      } else {
        monthStart = new Date();
        monthStart.setDate(1);
      }
      
      const report = await storage.getMonthlyReport(monthStart);
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: "Error al generar reporte mensual" });
    }
  });

  return httpServer;
}
