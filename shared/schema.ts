import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const UserRole = {
  ADMIN: "admin",
  TECHNICIAN: "technician",
} as const;

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("technician"),
  active: text("active").notNull().default("true"),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });

export const loginSchema = z.object({
  username: z.string().min(1, "Usuario requerido"),
  password: z.string().min(1, "Contraseña requerida"),
});

export const createUserSchema = z.object({
  username: z.string().min(3, "Usuario debe tener al menos 3 caracteres"),
  password: z.string().min(4, "Contraseña debe tener al menos 4 caracteres"),
  name: z.string().min(1, "Nombre requerido"),
  role: z.enum(["admin", "technician"]),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type LoginData = z.infer<typeof loginSchema>;
export type CreateUserData = z.infer<typeof createUserSchema>;

export const EquipmentType = {
  CAMERA: "camera",
  DVR: "dvr",
  GPS: "gps",
  HARD_DRIVE: "hard_drive",
  CABLE: "cable",
} as const;

export const CameraChannel = {
  CH1: "ch1",
  CH2: "ch2",
  CH3: "ch3",
  CH4: "ch4",
} as const;

export const CameraChannelLabels: Record<string, string> = {
  ch1: "Frontal",
  ch2: "Puerta",
  ch3: "Camello",
  ch4: "Pasajeros",
};

export const IncidentType = {
  MISALIGNED: "misaligned",
  LOOSE_CABLE: "loose_cable",
  FAULTY: "faulty",
  REPLACEMENT: "replacement",
} as const;

export const IncidentStatus = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  RESOLVED: "resolved",
} as const;

export const buses = pgTable("buses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  busNumber: text("bus_number").notNull().unique(),
  plate: text("plate"),
});

export const incidents = pgTable("incidents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  busId: varchar("bus_id").notNull(),
  equipmentType: text("equipment_type").notNull(),
  incidentType: text("incident_type").notNull(),
  cameraChannel: text("camera_channel"),
  status: text("status").notNull().default("pending"),
  description: text("description"),
  resolutionNotes: text("resolution_notes"),
  reportedAt: timestamp("reported_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  reporter: text("reporter"),
});

export const equipmentStatus = pgTable("equipment_status", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  busId: varchar("bus_id").notNull(),
  equipmentType: text("equipment_type").notNull(),
  cameraChannel: text("camera_channel"),
  status: text("status").notNull().default("operational"),
  lastIncidentId: varchar("last_incident_id"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBusSchema = createInsertSchema(buses).omit({ id: true });
export const insertIncidentSchema = createInsertSchema(incidents).omit({ id: true, reportedAt: true, resolvedAt: true });
export const insertEquipmentStatusSchema = createInsertSchema(equipmentStatus).omit({ id: true, updatedAt: true });

export type InsertBus = z.infer<typeof insertBusSchema>;
export type Bus = typeof buses.$inferSelect;

export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type Incident = typeof incidents.$inferSelect;

export type InsertEquipmentStatus = z.infer<typeof insertEquipmentStatusSchema>;
export type EquipmentStatus = typeof equipmentStatus.$inferSelect;

export const incidentFormSchema = z.object({
  busId: z.string().min(1, "Seleccione un bus"),
  equipmentType: z.enum(["camera", "dvr", "gps", "hard_drive", "cable"]),
  incidentType: z.enum(["misaligned", "loose_cable", "faulty", "replacement"]),
  cameraChannels: z.array(z.string()).optional(),
  description: z.string().optional(),
  reporter: z.string().optional(),
});

export type IncidentFormData = z.infer<typeof incidentFormSchema>;

export interface DashboardStats {
  totalBuses: number;
  activeIncidents: number;
  resolvedThisWeek: number;
  pendingRepairs: number;
  incidentsByType: Record<string, number>;
}

export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  totalIncidents: number;
  resolvedIncidents: number;
  incidentsByType: Record<string, number>;
  incidentsByEquipment: Record<string, number>;
  mostAffectedBuses: Array<{ busNumber: string; count: number }>;
}

export interface MonthlyReport {
  month: string;
  year: number;
  totalIncidents: number;
  resolvedIncidents: number;
  incidentsByType: Record<string, number>;
  incidentsByEquipment: Record<string, number>;
  weeklyTrend: Array<{ week: number; count: number }>;
  mostAffectedBuses: Array<{ busNumber: string; count: number }>;
}
