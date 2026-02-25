import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBusSchema, incidentFormSchema, loginSchema, createUserSchema } from "@shared/schema";
import { z } from "zod";
import { parseISO, startOfWeek } from "date-fns";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";

console.log("SERVER INDEX LOADED ✅");

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

interface AuthRequest extends Request {
  session: Request["session"] & { userId?: string };
}

const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "No autorizado" });
  }
  next();
};

const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "No autorizado" });
  }
  const user = await storage.getUser(req.session.userId);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Acceso denegado" });
  }
  next();
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/auth/login", async (req: AuthRequest, res) => {
    try {
      console.log("🔐 Login attempt for user:", req.body.username);

      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        console.log("❌ Invalid login data:", parsed.error.errors);
        return res.status(400).json({ error: parsed.error.errors });
      }

      const user = await storage.getUserByUsername(parsed.data.username);
      if (!user) {
        console.log("❌ User not found:", parsed.data.username);
        return res.status(401).json({ error: "Usuario o contrasena incorrectos" });
      }

      console.log("✅ User found:", user.username, "- Checking password...");
      const passwordMatch = await bcrypt.compare(parsed.data.password, user.password);
      if (!passwordMatch) {
        console.log("❌ Password mismatch for user:", user.username);
        return res.status(401).json({ error: "Usuario o contrasena incorrectos" });
      }

      console.log("✅ Password correct - Checking active status:", user.active);
      if (user.active !== "true") {
        console.log("❌ Account inactive for user:", user.username);
        return res.status(401).json({ error: "Cuenta desactivada" });
      }

      req.session.userId = user.id;
      const { password, ...userWithoutPassword } = user;
      console.log("✅ Login successful for user:", user.username, "- Role:", user.role);
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("❌ Login error:", error);
      res.status(500).json({ error: "Error al iniciar sesión" });
    }
  });

  app.post("/api/auth/logout", (req: AuthRequest, res) => {
    req.session.destroy((err: Error | null) => {
      if (err) {
        return res.status(500).json({ error: "Error al cerrar sesión" });
      }
      res.json({ message: "Sesión cerrada" });
    });
  });

  app.get("/api/auth/me", async (req: AuthRequest, res) => {
    // 🔍 LOGS DE DEPURACIÓN
    console.log("=== /api/auth/me ===");
    console.log("Cookie header:", req.headers.cookie);
    console.log("Session object:", req.session);
    console.log("Session userId:", req.session?.userId);

    if (!req.session?.userId) {
      console.log("❌ No hay userId en sesión");
      return res.status(401).json({ error: "No autorizado" });
    }

    const user = await storage.getUser(req.session.userId);

    if (!user) {
      console.log("❌ Usuario no encontrado en DB");
      return res.status(401).json({ error: "No autorizado" });
    }

    const { password, ...userWithoutPassword } = user;

    console.log("✅ Usuario autenticado:", userWithoutPassword.username);
    res.json(userWithoutPassword);
  });

  app.get("/api/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getUsers();
      const usersWithoutPasswords = users.map(({ password, ...rest }) => rest);
      res.json(usersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener usuarios" });
    }
  });

  app.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const parsed = createUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }

      const existing = await storage.getUserByUsername(parsed.data.username);
      if (existing) {
        return res.status(400).json({ error: "El usuario ya existe" });
      }

      const user = await storage.createUser({
        ...parsed.data,
        active: "true",
      });
      const { password, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: "Error al crear usuario" });
    }
  });

  app.patch("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updateSchema = z.object({
        name: z.string().optional(),
        role: z.enum(["admin", "technician"]).optional(),
        active: z.enum(["true", "false"]).optional(),
        password: z.string().min(4).optional(),
      });

      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }

      const user = await storage.updateUser(id, parsed.data);
      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: "Error al actualizar usuario" });
    }
  });

  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      if (req.session.userId === id) {
        return res.status(400).json({ error: "No puede eliminar su propia cuenta" });
      }

      const deleted = await storage.deleteUser(id);
      if (!deleted) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }
      res.json({ message: "Usuario eliminado" });
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar usuario" });
    }
  });

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

  app.patch("/api/buses/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateSchema = z.object({
        plate: z.string(),
      });

      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }

      const bus = await storage.updateBus(id, parsed.data);
      if (!bus) {
        return res.status(404).json({ error: "Bus no encontrado" });
      }

      res.json(bus);
    } catch (error) {
      res.status(500).json({ error: "Error al actualizar bus" });
    }
  });

  app.post("/api/buses/bulk", async (req, res) => {
    try {
      const bulkSchema = z.object({
        buses: z.array(z.object({
          busNumber: z.string().min(1, "N° distintivo requerido"),
          plate: z.string().optional(),
        })),
      });

      const parsed = bulkSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }

      const existingBuses = await storage.getBuses();
      const existingNumbers = new Set(existingBuses.map(b => b.busNumber));

      const created: Array<{ busNumber: string; plate: string | null }> = [];
      const errors: Array<{ busNumber: string; error: string }> = [];

      for (const busData of parsed.data.buses) {
        if (existingNumbers.has(busData.busNumber)) {
          errors.push({ busNumber: busData.busNumber, error: "Ya existe" });
          continue;
        }

        try {
          const bus = await storage.createBus({
            busNumber: busData.busNumber,
            plate: busData.plate || null,
          });
          created.push({ busNumber: bus.busNumber, plate: bus.plate });
          existingNumbers.add(bus.busNumber);
        } catch {
          errors.push({ busNumber: busData.busNumber, error: "Error al crear" });
        }
      }

      res.status(201).json({ created: created.length, errors });
    } catch (error) {
      res.status(500).json({ error: "Error al crear buses en masa" });
    }
  });

  app.delete("/api/buses/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteBus(id);
      if (!deleted) {
        return res.status(404).json({ error: "Bus no encontrado" });
      }
      res.json({ message: "Bus eliminado" });
    } catch (error) {
      console.error("❌ Error al eliminar bus:", error);
      res.status(500).json({ error: "Error al eliminar bus" });
    }
  });

  // ── Bus documents (multer upload) ──────────────────────────────────────────
  const uploadsDir = path.join(process.cwd(), "uploads", "bus-docs");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const fileStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}-${file.originalname}`);
    },
  });
  const upload = multer({ storage: fileStorage, limits: { fileSize: 20 * 1024 * 1024 } });

  app.get("/api/buses/:id/documents", async (req, res) => {
    try {
      const docs = await storage.getBusDocuments(req.params.id);
      res.json(docs);
    } catch (error) {
      console.error("❌ Error al obtener documentos:", error);
      res.status(500).json({ error: "Error al obtener documentos" });
    }
  });

  app.post("/api/buses/:id/documents", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "Archivo requerido" });
      const docSchema = z.object({
        docType: z.string().min(1),
        notes: z.string().optional(),
        expiresAt: z.string().optional(),
        driverId: z.string().optional(),
      });
      const parsed = docSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

      const doc = await storage.createBusDocument({
        busId: req.params.id,
        docType: parsed.data.docType,
        fileName: req.file.originalname,
        filePath: req.file.filename,
        notes: parsed.data.notes || null,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        driverId: parsed.data.driverId || null,
      });
      res.status(201).json(doc);
    } catch (error) {
      console.error("❌ Error al guardar documento:", error);
      res.status(500).json({ error: "Error al guardar documento" });
    }
  });

  app.delete("/api/buses/:busId/documents/:docId", async (req, res) => {
    try {
      const doc = await storage.deleteBusDocument(req.params.docId);
      if (!doc) return res.status(404).json({ error: "Documento no encontrado" });
      // Remove from disk
      const filePath = path.join(uploadsDir, doc.filePath);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      res.json({ message: "Documento eliminado" });
    } catch {
      res.status(500).json({ error: "Error al eliminar documento" });
    }
  });

  app.get("/api/buses/:busId/documents/:docId/download", async (req, res) => {
    try {
      const docs = await storage.getBusDocuments(req.params.busId);
      const doc = docs.find(d => d.id === req.params.docId);
      if (!doc) return res.status(404).json({ error: "Documento no encontrado" });
      const filePath = path.join(uploadsDir, doc.filePath);
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Archivo no encontrado" });
      res.download(filePath, doc.fileName);
    } catch {
      res.status(500).json({ error: "Error al descargar documento" });
    }
  });

  // Preview endpoint — serves file inline
  app.get("/api/buses/:busId/documents/:docId/preview", async (req, res) => {
    try {
      const docs = await storage.getBusDocuments(req.params.busId);
      const doc = docs.find(d => d.id === req.params.docId);
      if (!doc) return res.status(404).json({ error: "Documento no encontrado" });
      const filePath = path.join(uploadsDir, doc.filePath);
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Archivo no encontrado" });

      const ext = path.extname(doc.fileName).toLowerCase();
      const mimeTypes: Record<string, string> = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".pdf": "application/pdf",
        ".doc": "application/msword",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      };
      const contentType = mimeTypes[ext] || "application/octet-stream";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `inline; filename="${doc.fileName}"`);
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch {
      res.status(500).json({ error: "Error al previsualizar documento" });
    }
  });

  // Expiring documents endpoint
  app.get("/api/documents/expiring", async (req, res) => {
    try {
      const expiring = await storage.getExpiringDocuments();
      res.json(expiring);
    } catch (error) {
      console.error("❌ Error al obtener documentos por vencer:", error);
      res.status(500).json({ error: "Error al obtener documentos por vencer" });
    }
  });

  // ── Drivers ───────────────────────────────────────────────────────────

  app.get("/api/drivers", async (_req, res) => {
    try {
      const allDrivers = await storage.getDrivers();
      res.json(allDrivers);
    } catch (error) {
      console.error("❌ Error al obtener conductores:", error);
      res.status(500).json({ error: "Error al obtener conductores" });
    }
  });

  app.get("/api/drivers/search", async (req, res) => {
    try {
      const query = (req.query.q as string) || "";
      const results = await storage.searchDrivers(query);
      res.json(results);
    } catch (error) {
      console.error("❌ Error al buscar conductores:", error);
      res.status(500).json({ error: "Error al buscar conductores" });
    }
  });

  app.post("/api/drivers", async (req, res) => {
    try {
      const schema = z.object({
        name: z.string().min(1),
        rut: z.string().min(1),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
      const driver = await storage.createDriver(parsed.data);
      res.status(201).json(driver);
    } catch (error: any) {
      if (error?.code === "23505") {
        return res.status(409).json({ error: "Ya existe un conductor con ese RUT" });
      }
      console.error("❌ Error al crear conductor:", error);
      res.status(500).json({ error: "Error al crear conductor" });
    }
  });

  app.get("/api/buses/:id/drivers", async (req, res) => {
    try {
      const busDriversList = await storage.getBusDrivers(req.params.id);
      res.json(busDriversList);
    } catch (error) {
      console.error("❌ Error al obtener conductores del bus:", error);
      res.status(500).json({ error: "Error al obtener conductores" });
    }
  });

  app.post("/api/buses/:id/drivers", async (req, res) => {
    try {
      const schema = z.object({
        driverId: z.string().min(1),
        role: z.string().default("titular"),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
      const result = await storage.assignDriverToBus(req.params.id, parsed.data.driverId, parsed.data.role);
      res.status(201).json(result);
    } catch (error) {
      console.error("❌ Error al asignar conductor:", error);
      res.status(500).json({ error: "Error al asignar conductor" });
    }
  });

  app.delete("/api/buses/:busId/drivers/:driverId", async (req, res) => {
    try {
      const ok = await storage.removeDriverFromBus(req.params.busId, req.params.driverId);
      if (!ok) return res.status(404).json({ error: "Asignación no encontrada" });
      res.json({ message: "Conductor desasignado" });
    } catch (error) {
      console.error("❌ Error al desasignar conductor:", error);
      res.status(500).json({ error: "Error al desasignar conductor" });
    }
  });

  // ── Email Recipients ─────────────────────────────────────────────────

  app.get("/api/email-recipients", async (_req, res) => {
    try {
      const recipients = await storage.getEmailRecipients();
      res.json(recipients);
    } catch (error) {
      console.error("❌ Error al obtener destinatarios:", error);
      res.status(500).json({ error: "Error al obtener destinatarios" });
    }
  });

  app.post("/api/email-recipients", async (req, res) => {
    try {
      const schema = z.object({
        email: z.string().email(),
        name: z.string().min(1),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
      const recipient = await storage.createEmailRecipient(parsed.data.email, parsed.data.name);
      res.status(201).json(recipient);
    } catch (error: any) {
      if (error?.code === "23505") {
        return res.status(409).json({ error: "Ese correo ya está registrado" });
      }
      console.error("❌ Error al crear destinatario:", error);
      res.status(500).json({ error: "Error al crear destinatario" });
    }
  });

  app.delete("/api/email-recipients/:id", async (req, res) => {
    try {
      const ok = await storage.deleteEmailRecipient(req.params.id);
      if (!ok) return res.status(404).json({ error: "Destinatario no encontrado" });
      res.json({ message: "Destinatario eliminado" });
    } catch (error) {
      console.error("❌ Error al eliminar destinatario:", error);
      res.status(500).json({ error: "Error al eliminar destinatario" });
    }
  });

  app.patch("/api/email-recipients/:id/toggle", async (req, res) => {
    try {
      const updated = await storage.toggleEmailRecipient(req.params.id);
      if (!updated) return res.status(404).json({ error: "Destinatario no encontrado" });
      res.json(updated);
    } catch (error) {
      console.error("❌ Error al actualizar destinatario:", error);
      res.status(500).json({ error: "Error al actualizar destinatario" });
    }
  });

  app.post("/api/email-test", async (_req, res) => {
    try {
      const expiring = await storage.getExpiringDocuments();
      const recipients = await storage.getEmailRecipients();
      const activeEmails = recipients.filter(r => r.active === "true").map(r => r.email);
      if (activeEmails.length === 0) {
        return res.status(400).json({ error: "No hay destinatarios activos" });
      }
      if (expiring.length === 0) {
        return res.json({ message: "No hay documentos por vencer actualmente" });
      }
      const { sendExpirationAlert } = await import("./email");
      const sent = await sendExpirationAlert(expiring, activeEmails);
      if (sent) {
        res.json({ message: `Email enviado a ${activeEmails.join(", ")}` });
      } else {
        res.status(500).json({ error: "No se pudo enviar el email. Verifica la configuración SMTP." });
      }
    } catch (error) {
      console.error("❌ Error al enviar email de prueba:", error);
      res.status(500).json({ error: "Error al enviar email de prueba" });
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
