import {
  type User,
  type InsertUser,
  type Bus,
  type InsertBus,
  type Incident,
  type InsertIncident,
  type EquipmentStatus,
  type InsertEquipmentStatus,
  type DashboardStats,
  type WeeklyReport,
  type MonthlyReport,
  users,
  buses,
  incidents,
  equipmentStatus
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, lt, gte, lte, sql } from "drizzle-orm";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, getWeek, format } from "date-fns";
import bcrypt from "bcryptjs";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;

  getBuses(): Promise<Bus[]>;
  getBus(id: string): Promise<Bus | undefined>;
  createBus(bus: InsertBus): Promise<Bus>;
  updateBus(id: string, updates: Partial<Bus>): Promise<Bus | undefined>;

  getIncidents(filters?: { status?: string; equipmentType?: string; busId?: string; limit?: number }): Promise<Incident[]>;
  getIncident(id: string): Promise<Incident | undefined>;
  createIncident(incident: InsertIncident): Promise<Incident>;
  updateIncident(id: string, updates: Partial<Incident>): Promise<Incident | undefined>;

  getEquipmentStatus(busId?: string): Promise<EquipmentStatus[]>;
  updateEquipmentStatus(status: InsertEquipmentStatus): Promise<EquipmentStatus>;

  getDashboardStats(): Promise<DashboardStats>;
  getWeeklyReport(weekStart: Date): Promise<WeeklyReport>;
  getMonthlyReport(monthStart: Date): Promise<MonthlyReport>;
  getCameraStatus(): Promise<Array<{ busId: string; busNumber: string; plate: string | null; cameras: Array<{ channel: string; status: string }> }>>;
}

export class DatabaseStorage implements IStorage {
  private isInitialized = false;

  constructor() {
    // Don't auto-initialize, let the caller do it explicitly
  }

  async initialize() {
    if (this.isInitialized) {
      console.log("✅ Storage already initialized");
      return;
    }

    console.log("🔍 Checking for Galaxias user...");

    try {
      // Ensure Galaxias user exists
      const [existing] = await db.select().from(users).where(eq(users.username, "Galaxias"));
      if (!existing) {
        console.log("📝 Seeding Galaxias user...");
        const hashedPassword = await bcrypt.hash("G4l4x", 10);
        await db.insert(users).values({
          username: "Galaxias",
          password: hashedPassword,
          name: "Admin Galaxias",
          role: "admin",
          active: "true",
        });
        console.log("✅ Galaxias user seeded successfully.");
      } else {
        console.log("✅ Galaxias user already exists.");
      }

      this.isInitialized = true;
    } catch (error) {
      console.error("❌ Error initializing storage:", error);
      throw error;
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const [user] = await db.insert(users).values({
      ...insertUser,
      password: hashedPassword,
      role: insertUser.role || "technician",
      active: insertUser.active || "true",
    }).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    let processedUpdates = { ...updates };
    if (updates.password) {
      processedUpdates.password = await bcrypt.hash(updates.password, 10);
    }

    const [updatedUser] = await db
      .update(users)
      .set(processedUpdates)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async deleteUser(id: string): Promise<boolean> {
    const [deleted] = await db.delete(users).where(eq(users.id, id)).returning();
    return !!deleted;
  }

  async getBuses(): Promise<Bus[]> {
    return db.select().from(buses).orderBy(buses.busNumber);
  }

  async getBus(id: string): Promise<Bus | undefined> {
    const [bus] = await db.select().from(buses).where(eq(buses.id, id));
    return bus;
  }

  async createBus(insertBus: InsertBus): Promise<Bus> {
    const [bus] = await db.insert(buses).values({
      ...insertBus,
      plate: insertBus.plate || null,
    }).returning();

    // Create default equipment status for cameras
    const channels = ["ch1", "ch2", "ch3", "ch4"];
    for (const channel of channels) {
      await db.insert(equipmentStatus).values({
        busId: bus.id,
        equipmentType: "camera",
        cameraChannel: channel,
        status: "operational",
        updatedAt: new Date(),
      });
    }

    return bus;
  }

  async updateBus(id: string, updates: Partial<Bus>): Promise<Bus | undefined> {
    const [updatedBus] = await db
      .update(buses)
      .set(updates)
      .where(eq(buses.id, id))
      .returning();
    return updatedBus;
  }

  async getIncidents(filters?: { status?: string; equipmentType?: string; busId?: string; limit?: number }): Promise<Incident[]> {
    let query = db.select().from(incidents).orderBy(desc(incidents.reportedAt));

    const conditions = [];
    if (filters?.status) conditions.push(eq(incidents.status, filters.status));
    if (filters?.equipmentType) conditions.push(eq(incidents.equipmentType, filters.equipmentType));
    if (filters?.busId) conditions.push(eq(incidents.busId, filters.busId));

    let finalQuery = db.select().from(incidents);
    if (conditions.length > 0) {
      finalQuery = finalQuery.where(and(...conditions));
    }

    finalQuery = finalQuery.orderBy(desc(incidents.reportedAt));

    if (filters?.limit) {
      finalQuery = finalQuery.limit(filters.limit);
    }

    return finalQuery;
  }

  async getIncident(id: string): Promise<Incident | undefined> {
    const [incident] = await db.select().from(incidents).where(eq(incidents.id, id));
    return incident;
  }

  async createIncident(insertIncident: InsertIncident): Promise<Incident> {
    const [incident] = await db.insert(incidents).values({
      ...insertIncident,
      reportedAt: new Date(),
      resolvedAt: null,
      cameraChannel: insertIncident.cameraChannel || null,
      description: insertIncident.description || null,
      resolutionNotes: insertIncident.resolutionNotes || null,
      reporter: insertIncident.reporter || null,
    }).returning();

    if (insertIncident.equipmentType === "camera" && insertIncident.cameraChannel) {
      const [existing] = await db.select().from(equipmentStatus).where(and(
        eq(equipmentStatus.busId, insertIncident.busId),
        eq(equipmentStatus.cameraChannel, insertIncident.cameraChannel)
      ));

      if (existing) {
        await db.update(equipmentStatus)
          .set({
            status: insertIncident.incidentType === "faulty" ? "faulty" : "misaligned",
            lastIncidentId: incident.id,
            updatedAt: new Date()
          })
          .where(eq(equipmentStatus.id, existing.id));
      }
    }

    return incident;
  }

  async updateIncident(id: string, updates: Partial<Incident>): Promise<Incident | undefined> {
    let resolveUpdate: Partial<Incident> = { ...updates };

    const [current] = await db.select().from(incidents).where(eq(incidents.id, id));
    if (!current) return undefined;

    if (updates.status === "resolved" && !current.resolvedAt) {
      resolveUpdate.resolvedAt = new Date();

      if (current.equipmentType === "camera" && current.cameraChannel) {
        const [existing] = await db.select().from(equipmentStatus).where(and(
          eq(equipmentStatus.busId, current.busId),
          eq(equipmentStatus.cameraChannel, current.cameraChannel)
        ));

        if (existing) {
          await db.update(equipmentStatus)
            .set({ status: "operational", updatedAt: new Date() })
            .where(eq(equipmentStatus.id, existing.id));
        }
      }
    }

    const [updated] = await db.update(incidents).set(resolveUpdate).where(eq(incidents.id, id)).returning();
    return updated;
  }

  async getEquipmentStatus(busId?: string): Promise<EquipmentStatus[]> {
    if (busId) {
      return db.select().from(equipmentStatus).where(eq(equipmentStatus.busId, busId));
    }
    return db.select().from(equipmentStatus);
  }

  async updateEquipmentStatus(insertStatus: InsertEquipmentStatus): Promise<EquipmentStatus> {
    const [existing] = await db.select().from(equipmentStatus).where(and(
      eq(equipmentStatus.busId, insertStatus.busId),
      eq(equipmentStatus.equipmentType, insertStatus.equipmentType),
      insertStatus.cameraChannel
        ? eq(equipmentStatus.cameraChannel, insertStatus.cameraChannel)
        : sql`${equipmentStatus.cameraChannel} IS NULL`
    ));

    if (existing) {
      const [updated] = await db.update(equipmentStatus)
        .set({
          status: insertStatus.status,
          lastIncidentId: insertStatus.lastIncidentId || null,
          updatedAt: new Date()
        })
        .where(eq(equipmentStatus.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(equipmentStatus).values({
      ...insertStatus,
      cameraChannel: insertStatus.cameraChannel || null,
      lastIncidentId: insertStatus.lastIncidentId || null,
      updatedAt: new Date()
    }).returning();
    return created;
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const totalBusesResult = await db.select({ count: sql<number>`count(*)` }).from(buses);
    const activeIncidentsResult = await db.select({ count: sql<number>`count(*)` }).from(incidents).where(sql`${incidents.status} != 'resolved'`);
    const pendingRepairsResult = await db.select({ count: sql<number>`count(*)` }).from(incidents).where(eq(incidents.status, 'pending'));

    // Resolved this week
    const resolvedResult = await db.select({ count: sql<number>`count(*)` }).from(incidents)
      .where(and(
        eq(incidents.status, 'resolved'),
        gte(incidents.resolvedAt, weekStart),
        lte(incidents.resolvedAt, weekEnd)
      ));

    // Incidents by type (active)
    const typeStats = await db.select({
      type: incidents.equipmentType,
      count: sql<number>`count(*)`
    })
      .from(incidents)
      .where(sql`${incidents.status} != 'resolved'`)
      .groupBy(incidents.equipmentType);

    const incidentsByType: Record<string, number> = {};
    typeStats.forEach(stat => {
      incidentsByType[stat.type] = Number(stat.count);
    });

    return {
      totalBuses: Number(totalBusesResult[0]?.count || 0),
      activeIncidents: Number(activeIncidentsResult[0]?.count || 0),
      resolvedThisWeek: Number(resolvedResult[0]?.count || 0),
      pendingRepairs: Number(pendingRepairsResult[0]?.count || 0),
      incidentsByType,
    };
  }

  async getWeeklyReport(weekStartDate: Date): Promise<WeeklyReport> {
    const weekStart = startOfWeek(weekStartDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(weekStartDate, { weekStartsOn: 1 });

    const weekIncidents = await db.select().from(incidents)
      .where(and(
        gte(incidents.reportedAt, weekStart),
        lte(incidents.reportedAt, weekEnd)
      ));

    const incidentsByType: Record<string, number> = {};
    const incidentsByEquipment: Record<string, number> = {};
    const busCounts: Record<string, number> = {};

    weekIncidents.forEach(i => {
      incidentsByType[i.incidentType] = (incidentsByType[i.incidentType] || 0) + 1;
      incidentsByEquipment[i.equipmentType] = (incidentsByEquipment[i.equipmentType] || 0) + 1;
      busCounts[i.busId] = (busCounts[i.busId] || 0) + 1;
    });

    const affectedBusIds = Object.keys(busCounts);
    let busMap: Record<string, string> = {};

    if (affectedBusIds.length > 0) {
      // Drizzle 'IN' clause
      const busDetails = await db.select().from(buses).where(sql`${buses.id} IN ${affectedBusIds}`);
      busDetails.forEach(b => busMap[b.id] = b.busNumber);
    }

    const mostAffectedBuses = Object.entries(busCounts)
      .map(([busId, count]) => ({
        busNumber: busMap[busId] || busId,
        count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      totalIncidents: weekIncidents.length,
      resolvedIncidents: weekIncidents.filter(i => i.status === "resolved").length,
      incidentsByType,
      incidentsByEquipment,
      mostAffectedBuses
    };
  }

  async getMonthlyReport(monthStartDate: Date): Promise<MonthlyReport> {
    const monthStart = startOfMonth(monthStartDate);
    const monthEnd = endOfMonth(monthStartDate);

    const monthIncidents = await db.select().from(incidents)
      .where(and(
        gte(incidents.reportedAt, monthStart),
        lte(incidents.reportedAt, monthEnd)
      ));

    const incidentsByType: Record<string, number> = {};
    const incidentsByEquipment: Record<string, number> = {};
    const busCounts: Record<string, number> = {};
    const weeklyTrendMap: Record<number, number> = {};

    monthIncidents.forEach(i => {
      incidentsByType[i.incidentType] = (incidentsByType[i.incidentType] || 0) + 1;
      incidentsByEquipment[i.equipmentType] = (incidentsByEquipment[i.equipmentType] || 0) + 1;
      busCounts[i.busId] = (busCounts[i.busId] || 0) + 1;

      if (i.reportedAt) {
        const week = getWeek(new Date(i.reportedAt));
        weeklyTrendMap[week] = (weeklyTrendMap[week] || 0) + 1;
      }
    });

    const affectedBusIds = Object.keys(busCounts);
    let busMap: Record<string, string> = {};

    if (affectedBusIds.length > 0) {
      const busDetails = await db.select().from(buses).where(sql`${buses.id} IN ${affectedBusIds}`);
      busDetails.forEach(b => busMap[b.id] = b.busNumber);
    }

    const mostAffectedBuses = Object.entries(busCounts)
      .map(([busId, count]) => ({
        busNumber: busMap[busId] || busId,
        count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const weeklyTrend = Object.entries(weeklyTrendMap)
      .map(([week, count]) => ({ week: parseInt(week), count }))
      .sort((a, b) => a.week - b.week);

    return {
      month: format(monthStart, "MMMM"),
      year: monthStart.getFullYear(),
      totalIncidents: monthIncidents.length,
      resolvedIncidents: monthIncidents.filter(i => i.status === "resolved").length,
      incidentsByType,
      incidentsByEquipment,
      weeklyTrend,
      mostAffectedBuses
    };
  }

  async getCameraStatus(): Promise<Array<{ busId: string; busNumber: string; plate: string | null; cameras: Array<{ channel: string; status: string }> }>> {
    const allBuses = await db.select().from(buses);
    const cameraStatuses = await db.select().from(equipmentStatus).where(eq(equipmentStatus.equipmentType, "camera"));

    return allBuses.map(bus => {
      const busStatuses = cameraStatuses.filter(s => s.busId === bus.id);
      const cameras = ["ch1", "ch2", "ch3", "ch4"].map(channel => {
        const status = busStatuses.find(s => s.cameraChannel === channel);
        return {
          channel,
          status: status?.status || "operational"
        };
      });

      return {
        busId: bus.id,
        busNumber: bus.busNumber,
        plate: bus.plate,
        cameras
      };
    }).sort((a, b) => {
      const numA = parseInt(a.busNumber, 10);
      const numB = parseInt(b.busNumber, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.busNumber.localeCompare(b.busNumber);
    });
  }
}

export const storage = new DatabaseStorage();
