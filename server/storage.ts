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
  type MonthlyReport
} from "@shared/schema";
import { randomUUID } from "crypto";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, getWeek, parseISO, isWithinInterval, format } from "date-fns";

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

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private buses: Map<string, Bus>;
  private incidents: Map<string, Incident>;
  private equipmentStatuses: Map<string, EquipmentStatus>;

  constructor() {
    this.users = new Map();
    this.buses = new Map();
    this.incidents = new Map();
    this.equipmentStatuses = new Map();
    
    this.seedData();
  }

  private seedData() {
    const adminId = randomUUID();
    this.users.set(adminId, {
      id: adminId,
      username: "admin",
      password: "admin123",
      name: "Administrador",
      role: "admin",
      active: "true",
    });

    const busNumbers = ["101", "102", "103", "104", "105"];
    busNumbers.forEach((num) => {
      const id = randomUUID();
      this.buses.set(id, { id, busNumber: num, plate: `ABC-${num}` });
      
      ["ch1", "ch2", "ch3", "ch4"].forEach((channel) => {
        const statusId = randomUUID();
        this.equipmentStatuses.set(statusId, {
          id: statusId,
          busId: id,
          equipmentType: "camera",
          cameraChannel: channel,
          status: "operational",
          lastIncidentId: null,
          updatedAt: new Date(),
        });
      });
    });

    const busIds = Array.from(this.buses.keys());
    const incidentTypes = ["misaligned", "loose_cable", "faulty", "replacement"];
    const equipmentTypes = ["camera", "dvr", "gps", "hard_drive", "cable"];
    const channels = ["ch1", "ch2", "ch3", "ch4"];
    const statuses = ["pending", "in_progress", "resolved"];

    for (let i = 0; i < 15; i++) {
      const id = randomUUID();
      const busId = busIds[Math.floor(Math.random() * busIds.length)];
      const equipmentType = equipmentTypes[Math.floor(Math.random() * equipmentTypes.length)];
      const incidentType = incidentTypes[Math.floor(Math.random() * incidentTypes.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const daysAgo = Math.floor(Math.random() * 30);
      const reportedAt = new Date();
      reportedAt.setDate(reportedAt.getDate() - daysAgo);

      this.incidents.set(id, {
        id,
        busId,
        equipmentType,
        incidentType,
        cameraChannel: equipmentType === "camera" ? channels[Math.floor(Math.random() * channels.length)] : null,
        status,
        description: `Incidencia de prueba #${i + 1}`,
        resolutionNotes: status === "resolved" ? "Reparado correctamente" : null,
        reportedAt,
        resolvedAt: status === "resolved" ? new Date() : null,
        reporter: `Técnico ${Math.floor(Math.random() * 5) + 1}`,
      });

      if (equipmentType === "camera" && status !== "resolved") {
        const cameraChannel = channels[Math.floor(Math.random() * channels.length)];
        const existingStatus = Array.from(this.equipmentStatuses.values()).find(
          (es) => es.busId === busId && es.cameraChannel === cameraChannel
        );
        if (existingStatus) {
          existingStatus.status = incidentType === "faulty" ? "faulty" : "misaligned";
          existingStatus.lastIncidentId = id;
          existingStatus.updatedAt = new Date();
        }
      }
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      id,
      username: insertUser.username,
      password: insertUser.password,
      name: insertUser.name,
      role: insertUser.role || "technician",
      active: insertUser.active || "true",
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updatedUser = { ...user, ...updates, id };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  async getBuses(): Promise<Bus[]> {
    return Array.from(this.buses.values()).sort((a, b) => {
      const numA = parseInt(a.busNumber, 10);
      const numB = parseInt(b.busNumber, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.busNumber.localeCompare(b.busNumber);
    });
  }

  async getBus(id: string): Promise<Bus | undefined> {
    return this.buses.get(id);
  }

  async createBus(insertBus: InsertBus): Promise<Bus> {
    const id = randomUUID();
    const bus: Bus = { ...insertBus, id, plate: insertBus.plate || null };
    this.buses.set(id, bus);
    
    ["ch1", "ch2", "ch3", "ch4"].forEach((channel) => {
      const statusId = randomUUID();
      this.equipmentStatuses.set(statusId, {
        id: statusId,
        busId: id,
        equipmentType: "camera",
        cameraChannel: channel,
        status: "operational",
        lastIncidentId: null,
        updatedAt: new Date(),
      });
    });
    
    return bus;
  }

  async updateBus(id: string, updates: Partial<Bus>): Promise<Bus | undefined> {
    const bus = this.buses.get(id);
    if (!bus) return undefined;
    const updatedBus = { ...bus, ...updates, id };
    this.buses.set(id, updatedBus);
    return updatedBus;
  }

  async getIncidents(filters?: { status?: string; equipmentType?: string; busId?: string; limit?: number }): Promise<Incident[]> {
    let incidents = Array.from(this.incidents.values());
    
    if (filters?.status) {
      incidents = incidents.filter((i) => i.status === filters.status);
    }
    if (filters?.equipmentType) {
      incidents = incidents.filter((i) => i.equipmentType === filters.equipmentType);
    }
    if (filters?.busId) {
      incidents = incidents.filter((i) => i.busId === filters.busId);
    }
    
    incidents.sort((a, b) => {
      const dateA = a.reportedAt ? new Date(a.reportedAt).getTime() : 0;
      const dateB = b.reportedAt ? new Date(b.reportedAt).getTime() : 0;
      return dateB - dateA;
    });
    
    if (filters?.limit) {
      incidents = incidents.slice(0, filters.limit);
    }
    
    return incidents;
  }

  async getIncident(id: string): Promise<Incident | undefined> {
    return this.incidents.get(id);
  }

  async createIncident(insertIncident: InsertIncident): Promise<Incident> {
    const id = randomUUID();
    const incident: Incident = {
      ...insertIncident,
      id,
      reportedAt: new Date(),
      resolvedAt: null,
      cameraChannel: insertIncident.cameraChannel || null,
      description: insertIncident.description || null,
      resolutionNotes: insertIncident.resolutionNotes || null,
      reporter: insertIncident.reporter || null,
    };
    this.incidents.set(id, incident);

    if (insertIncident.equipmentType === "camera" && insertIncident.cameraChannel) {
      const existingStatus = Array.from(this.equipmentStatuses.values()).find(
        (es) => es.busId === insertIncident.busId && es.cameraChannel === insertIncident.cameraChannel
      );
      if (existingStatus) {
        existingStatus.status = insertIncident.incidentType === "faulty" ? "faulty" : "misaligned";
        existingStatus.lastIncidentId = id;
        existingStatus.updatedAt = new Date();
      }
    }

    return incident;
  }

  async updateIncident(id: string, updates: Partial<Incident>): Promise<Incident | undefined> {
    const incident = this.incidents.get(id);
    if (!incident) return undefined;
    
    const updatedIncident = { ...incident, ...updates };
    if (updates.status === "resolved" && !incident.resolvedAt) {
      updatedIncident.resolvedAt = new Date();
      
      if (incident.equipmentType === "camera" && incident.cameraChannel) {
        const existingStatus = Array.from(this.equipmentStatuses.values()).find(
          (es) => es.busId === incident.busId && es.cameraChannel === incident.cameraChannel
        );
        if (existingStatus) {
          existingStatus.status = "operational";
          existingStatus.updatedAt = new Date();
        }
      }
    }
    
    this.incidents.set(id, updatedIncident);
    return updatedIncident;
  }

  async getEquipmentStatus(busId?: string): Promise<EquipmentStatus[]> {
    let statuses = Array.from(this.equipmentStatuses.values());
    if (busId) {
      statuses = statuses.filter((s) => s.busId === busId);
    }
    return statuses;
  }

  async updateEquipmentStatus(insertStatus: InsertEquipmentStatus): Promise<EquipmentStatus> {
    const existing = Array.from(this.equipmentStatuses.values()).find(
      (s) => s.busId === insertStatus.busId && 
             s.equipmentType === insertStatus.equipmentType &&
             s.cameraChannel === insertStatus.cameraChannel
    );
    
    if (existing) {
      existing.status = insertStatus.status;
      existing.lastIncidentId = insertStatus.lastIncidentId || null;
      existing.updatedAt = new Date();
      return existing;
    }
    
    const id = randomUUID();
    const status: EquipmentStatus = {
      ...insertStatus,
      id,
      cameraChannel: insertStatus.cameraChannel || null,
      lastIncidentId: insertStatus.lastIncidentId || null,
      updatedAt: new Date(),
    };
    this.equipmentStatuses.set(id, status);
    return status;
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const incidents = Array.from(this.incidents.values());
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    
    const activeIncidents = incidents.filter((i) => i.status !== "resolved");
    const resolvedThisWeek = incidents.filter((i) => {
      if (i.status !== "resolved" || !i.resolvedAt) return false;
      const resolvedDate = new Date(i.resolvedAt);
      return isWithinInterval(resolvedDate, { start: weekStart, end: weekEnd });
    });
    
    const incidentsByType: Record<string, number> = {};
    activeIncidents.forEach((i) => {
      incidentsByType[i.equipmentType] = (incidentsByType[i.equipmentType] || 0) + 1;
    });
    
    return {
      totalBuses: this.buses.size,
      activeIncidents: activeIncidents.length,
      resolvedThisWeek: resolvedThisWeek.length,
      pendingRepairs: incidents.filter((i) => i.status === "pending").length,
      incidentsByType,
    };
  }

  async getWeeklyReport(weekStartDate: Date): Promise<WeeklyReport> {
    const weekStart = startOfWeek(weekStartDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(weekStartDate, { weekStartsOn: 1 });
    
    const incidents = Array.from(this.incidents.values()).filter((i) => {
      if (!i.reportedAt) return false;
      const reportedDate = new Date(i.reportedAt);
      return isWithinInterval(reportedDate, { start: weekStart, end: weekEnd });
    });
    
    const incidentsByType: Record<string, number> = {};
    const incidentsByEquipment: Record<string, number> = {};
    const busCounts: Record<string, number> = {};
    
    incidents.forEach((i) => {
      incidentsByType[i.incidentType] = (incidentsByType[i.incidentType] || 0) + 1;
      incidentsByEquipment[i.equipmentType] = (incidentsByEquipment[i.equipmentType] || 0) + 1;
      busCounts[i.busId] = (busCounts[i.busId] || 0) + 1;
    });
    
    const mostAffectedBuses = Object.entries(busCounts)
      .map(([busId, count]) => {
        const bus = this.buses.get(busId);
        return { busNumber: bus?.busNumber || busId, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    return {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      totalIncidents: incidents.length,
      resolvedIncidents: incidents.filter((i) => i.status === "resolved").length,
      incidentsByType,
      incidentsByEquipment,
      mostAffectedBuses,
    };
  }

  async getMonthlyReport(monthStartDate: Date): Promise<MonthlyReport> {
    const monthStart = startOfMonth(monthStartDate);
    const monthEnd = endOfMonth(monthStartDate);
    
    const incidents = Array.from(this.incidents.values()).filter((i) => {
      if (!i.reportedAt) return false;
      const reportedDate = new Date(i.reportedAt);
      return isWithinInterval(reportedDate, { start: monthStart, end: monthEnd });
    });
    
    const incidentsByType: Record<string, number> = {};
    const incidentsByEquipment: Record<string, number> = {};
    const busCounts: Record<string, number> = {};
    const weeklyTrendMap: Record<number, number> = {};
    
    incidents.forEach((i) => {
      incidentsByType[i.incidentType] = (incidentsByType[i.incidentType] || 0) + 1;
      incidentsByEquipment[i.equipmentType] = (incidentsByEquipment[i.equipmentType] || 0) + 1;
      busCounts[i.busId] = (busCounts[i.busId] || 0) + 1;
      
      if (i.reportedAt) {
        const week = getWeek(new Date(i.reportedAt));
        weeklyTrendMap[week] = (weeklyTrendMap[week] || 0) + 1;
      }
    });
    
    const mostAffectedBuses = Object.entries(busCounts)
      .map(([busId, count]) => {
        const bus = this.buses.get(busId);
        return { busNumber: bus?.busNumber || busId, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
    
    const weeklyTrend = Object.entries(weeklyTrendMap)
      .map(([week, count]) => ({ week: parseInt(week), count }))
      .sort((a, b) => a.week - b.week);
    
    return {
      month: format(monthStart, "MMMM"),
      year: monthStart.getFullYear(),
      totalIncidents: incidents.length,
      resolvedIncidents: incidents.filter((i) => i.status === "resolved").length,
      incidentsByType,
      incidentsByEquipment,
      weeklyTrend,
      mostAffectedBuses,
    };
  }

  async getCameraStatus(): Promise<Array<{ busId: string; busNumber: string; plate: string | null; cameras: Array<{ channel: string; status: string }> }>> {
    const buses = Array.from(this.buses.values());
    const statuses = Array.from(this.equipmentStatuses.values()).filter(
      (s) => s.equipmentType === "camera"
    );
    
    return buses.map((bus) => {
      const busStatuses = statuses.filter((s) => s.busId === bus.id);
      const cameras = ["ch1", "ch2", "ch3", "ch4"].map((channel) => {
        const status = busStatuses.find((s) => s.cameraChannel === channel);
        return {
          channel,
          status: status?.status || "operational",
        };
      });
      
      return {
        busId: bus.id,
        busNumber: bus.busNumber,
        plate: bus.plate,
        cameras,
      };
    }).sort((a, b) => {
      const numA = parseInt(a.busNumber, 10);
      const numB = parseInt(b.busNumber, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.busNumber.localeCompare(b.busNumber);
    });
  }
}

export const storage = new MemStorage();
