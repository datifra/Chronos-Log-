import { prisma } from "./prisma.js";
import bcrypt from "bcryptjs";

// Structure interfaces matching server.ts
export interface DBUser {
  id: number;
  username: string;
  passwordHash: string;
  name: string;
  role: 'superuser' | 'manager' | 'user';
  email?: string;
  phone?: string;
}

export interface DBProject {
  id: number;
  code: string;
  name: string;
  description: string;
  startDate: string;
  budgetedHours: number;
  budgetedCost: number;
  stages?: DBProjectStage[];
}

export interface DBProjectStage {
  id: number;
  projectId: number;
  name: string;
  budgetedHours: number;
  isOpen?: boolean;
}

export interface DBTimeLog {
  id: number;
  userId: number;
  projectId: number;
  stageId: number;
  date: string;
  hours: number;
  description: string;
  userName?: string;
  projectName?: string;
  projectCode?: string;
  stageName?: string;
  stageIsOpen?: boolean;
}

export interface Schema {
  users: DBUser[];
  projects: DBProject[];
  stages: DBProjectStage[];
  timelogs: DBTimeLog[];
}

// In-Memory Seed Data Template (used purely as a recipe if PostgreSQL is empty)
function getSeedDataTemplate(): Schema {
  const users: DBUser[] = [
    {
      id: 1,
      username: "admin",
      passwordHash: bcrypt.hashSync("admin", 10),
      name: "Administrador del Sistema",
      role: "superuser"
    },
    {
      id: 2,
      username: "manager",
      passwordHash: bcrypt.hashSync("manager", 10),
      name: "Gerente de Proyectos",
      role: "manager"
    }
  ];

  for (let i = 1; i <= 48; i++) {
    users.push({
      id: i + 2,
      username: `user${i}`,
      passwordHash: bcrypt.hashSync(`user123`, 10),
      name: `Colaborador ${i}`,
      role: "user"
    });
  }

  const projects: DBProject[] = [
    {
      id: 1,
      code: "PEC-01",
      name: "Portal de E-commerce Multi-idioma",
      description: "Desarrollo completo de la plataforma de ventas online para clientes de LATAM, incluyendo pasarelas de pago y soporte regional.",
      startDate: "2026-04-10",
      budgetedHours: 500,
      budgetedCost: 25000
    },
    {
      id: 2,
      code: "MBC-02",
      name: "Migración de Base de Datos Cloud",
      description: "Migración de servidores legacy MySQL on-premise hacia bases de datos administradas de alta disponibilidad.",
      startDate: "2026-05-01",
      budgetedHours: 150,
      budgetedCost: 9000
    },
    {
      id: 3,
      code: "RAM-03",
      name: "Rediseño App Móvil iOS/Android",
      description: "Optimización de experiencia de usuario UX/UI para la aplicación móvil principal e integración de notificaciones push.",
      startDate: "2026-05-15",
      budgetedHours: 320,
      budgetedCost: 16000
    },
    {
      id: 99,
      code: "VARIOS",
      name: "VARIOS",
      description: "Proyecto para registro de tareas y horas varias",
      startDate: "2026-05-01",
      budgetedHours: 1000,
      budgetedCost: 0
    }
  ];

  const stages: DBProjectStage[] = [
    { id: 1, projectId: 1, name: "Planificación & UX", budgetedHours: 100 },
    { id: 2, projectId: 1, name: "Desarrollo Frontend & Backend", budgetedHours: 250 },
    { id: 3, projectId: 1, name: "Testing de Integración & QA", budgetedHours: 100 },
    { id: 4, projectId: 1, name: "Despliegue & Soporte", budgetedHours: 50 },
    { id: 5, projectId: 2, name: "Análisis de Esquema", budgetedHours: 30 },
    { id: 6, projectId: 2, name: "Testing de Script de Migración", budgetedHours: 80 },
    { id: 7, projectId: 2, name: "Validación de Integridad", budgetedHours: 40 },
    { id: 8, projectId: 3, name: "Diseño & Wireframes", budgetedHours: 60 },
    { id: 9, projectId: 3, name: "Desarrollo UI Componentes", budgetedHours: 180 },
    { id: 10, projectId: 3, name: "QA & Pruebas en Dispositivos", budgetedHours: 80 },
    { id: 99, projectId: 99, name: "VARIOS", budgetedHours: 1000 }
  ];

  const timelogs: DBTimeLog[] = [
    { id: 1, userId: 3, projectId: 1, stageId: 1, date: "2026-05-12", hours: 8, description: "Sesión inicial de wireframes y requerimientos" },
    { id: 2, userId: 3, projectId: 1, stageId: 1, date: "2026-05-13", hours: 6, description: "Definición del flujo de checkout con el cliente" },
    { id: 3, userId: 4, projectId: 1, stageId: 2, date: "2026-05-15", hours: 8, description: "Configuración inicial del repositorio y Express server" },
    { id: 4, userId: 5, projectId: 2, stageId: 5, date: "2026-05-14", hours: 5, description: "Auditoría de foreign keys en base de datos legacy" },
    { id: 5, userId: 6, projectId: 3, stageId: 8, date: "2026-05-18", hours: 7, description: "Mockups rápidos en alta fidelidad de la Home" }
  ];

  return { users, projects, stages, timelogs };
}

// Programmatic validation & auto-seeding of PostgreSQL if Prisma is connected but empty
async function autoSeedPostgres() {
  try {
    const adminUser = await prisma.user.findFirst({
      where: { username: { equals: "admin", mode: "insensitive" } }
    });

    if (!adminUser) {
      console.log("PostgreSQL database is missing 'admin' user. Performing a fresh seed of the structure...");
      const local = getSeedDataTemplate();

      // Clear existing records to start clean and prevent ID/relationship conflicts
      await prisma.timeLog.deleteMany({});
      await prisma.stage.deleteMany({});
      await prisma.project.deleteMany({});
      await prisma.user.deleteMany({});

      // Seed Users
      for (const u of local.users) {
        await prisma.user.create({
          data: {
            id: u.id,
            username: u.username,
            passwordHash: u.passwordHash,
            name: u.name,
            role: u.role,
            email: u.email || null,
            phone: u.phone || null
          }
        });
      }

      // Seed Projects
      for (const p of local.projects) {
        await prisma.project.create({
          data: {
            id: p.id,
            code: p.code,
            name: p.name,
            description: p.description,
            startDate: p.startDate,
            budgetedHours: p.budgetedHours,
            budgetedCost: p.budgetedCost
          }
        });
      }

      // Seed Stages
      for (const s of local.stages) {
        await prisma.stage.create({
          data: {
            id: s.id,
            projectId: s.projectId,
            name: s.name,
            budgetedHours: s.budgetedHours,
            isOpen: s.isOpen !== false
          }
        });
      }

      // Seed TimeLogs
      for (const t of local.timelogs) {
        await prisma.timeLog.create({
          data: {
            id: t.id,
            userId: t.userId,
            projectId: t.projectId,
            stageId: t.stageId,
            date: t.date,
            hours: t.hours,
            description: t.description
          }
        });
      }

      // Reset PostgreSQL sequences to match the maximum IDs inserted
      try {
        await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"User"', 'id'), coalesce(max(id), 1)) FROM "User";`);
        await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Project"', 'id'), coalesce(max(id), 1)) FROM "Project";`);
        await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Stage"', 'id'), coalesce(max(id), 1)) FROM "Stage";`);
        await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"TimeLog"', 'id'), coalesce(max(id), 1)) FROM "TimeLog";`);
        console.log("PostgreSQL sequences reset successfully.");
      } catch (sqErr) {
        console.warn("Could not reset DB sequences (this is expected if not running full PostgreSQL):", sqErr);
      }

      console.log("PostgreSQL database auto-seeded successfully!");
    } else {
      console.log("System 'admin' user is present. Skipping auto-seeding.");
    }
  } catch (err) {
    console.error("Failed to seed PostgreSQL via Prisma:", err);
  }
}

// Public Check function on boot
export async function testConnection(): Promise<boolean> {
  if (!process.env.DATABASE_URL) {
    throw new Error("MANDATORY_DATABASE_URL_MISSING: El entorno no cuenta con la variable DATABASE_URL configurada en sus variables de sistema (.env). PostgreSQL es requerido.");
  }
  try {
    console.log("🔌 Attempting connection to PostgreSQL via Prisma Client...");
    await prisma.$connect();
    console.log("✅ Successfully connected to remote PostgreSQL via Prisma!");
    
    // Auto-seed if database is empty list
    await autoSeedPostgres();
    return true;
  } catch (err: any) {
    console.error("❌ Fallo crítico al conectarse a la base de datos PostgreSQL remota:", err);
    throw new Error(`DATABASE_CONNECTION_ERROR: No se pudo establecer conexión con PostgreSQL remota. Detalles: ${err.message || err}`);
  }
}

// ================= USER CRUD =================

export async function findUserByUsername(username: string): Promise<DBUser | null> {
  const u = await prisma.user.findFirst({
    where: { username: { equals: username.trim(), mode: "insensitive" } }
  });
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    passwordHash: u.passwordHash,
    name: u.name,
    role: u.role as any,
    email: u.email || undefined,
    phone: u.phone || undefined
  };
}

export async function findUserById(id: number): Promise<DBUser | null> {
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    passwordHash: u.passwordHash,
    name: u.name,
    role: u.role as any,
    email: u.email || undefined,
    phone: u.phone || undefined
  };
}

export async function getAllUsers(): Promise<DBUser[]> {
  const list = await prisma.user.findMany({ orderBy: { id: "asc" } });
  return list.map(u => ({
    id: u.id,
    username: u.username,
    passwordHash: u.passwordHash,
    name: u.name,
    role: u.role as any,
    email: u.email || undefined,
    phone: u.phone || undefined
  }));
}

export async function createUser(data: Omit<DBUser, "id">): Promise<DBUser> {
  const u = await prisma.user.create({
    data: {
      username: data.username,
      passwordHash: data.passwordHash,
      name: data.name,
      role: data.role,
      email: data.email || null,
      phone: data.phone || null
    }
  });
  return {
    id: u.id,
    username: u.username,
    passwordHash: u.passwordHash,
    name: u.name,
    role: u.role as any,
    email: u.email || undefined,
    phone: u.phone || undefined
  };
}

export async function updateUser(id: number, data: Partial<Omit<DBUser, "id">>): Promise<DBUser> {
  const u = await prisma.user.update({
    where: { id },
    data: {
      username: data.username,
      passwordHash: data.passwordHash,
      name: data.name,
      role: data.role,
      email: data.email === undefined ? undefined : (data.email || null),
      phone: data.phone === undefined ? undefined : (data.phone || null)
    }
  });
  return {
    id: u.id,
    username: u.username,
    passwordHash: u.passwordHash,
    name: u.name,
    role: u.role as any,
    email: u.email || undefined,
    phone: u.phone || undefined
  };
}

export async function deleteUser(id: number): Promise<void> {
  await prisma.user.delete({ where: { id } });
}

// ================= PROJECT CRUD =================

export async function getAllProjects(): Promise<DBProject[]> {
  const list = await prisma.project.findMany({
    include: { stages: { orderBy: { id: "asc" } } },
    orderBy: { id: "asc" }
  });
  return list.map(p => ({
    id: p.id,
    code: p.code,
    name: p.name,
    description: p.description,
    startDate: p.startDate,
    budgetedHours: p.budgetedHours,
    budgetedCost: p.budgetedCost,
    stages: p.stages.map(s => ({
      id: s.id,
      projectId: s.projectId,
      name: s.name,
      budgetedHours: s.budgetedHours,
      isOpen: s.isOpen
    }))
  }));
}

export async function createProject(data: Omit<DBProject, "id">, stagesData?: Omit<DBProjectStage, "id" | "projectId">[]): Promise<DBProject> {
  const p = await prisma.project.create({
    data: {
      code: data.code,
      name: data.name,
      description: data.description,
      startDate: data.startDate,
      budgetedHours: data.budgetedHours,
      budgetedCost: data.budgetedCost,
      stages: stagesData ? {
        create: stagesData.map(s => ({
          name: s.name,
          budgetedHours: s.budgetedHours,
          isOpen: s.isOpen !== false
        }))
      } : undefined
    },
    include: { stages: true }
  });
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    description: p.description,
    startDate: p.startDate,
    budgetedHours: p.budgetedHours,
    budgetedCost: p.budgetedCost,
    stages: p.stages.map(s => ({
      id: s.id,
      projectId: s.projectId,
      name: s.name,
      budgetedHours: s.budgetedHours,
      isOpen: s.isOpen
    }))
  };
}

export async function updateProject(
  id: number,
  data: Partial<Omit<DBProject, "id">>,
  stagesData?: (Omit<DBProjectStage, "id" | "projectId"> & { id?: number })[]
): Promise<DBProject> {
  const p = await prisma.$transaction(async (tx) => {
    if (stagesData) {
      const currentStages = await tx.stage.findMany({ where: { projectId: id } });
      const incomingIds = stagesData.map(s => s.id).filter(Boolean) as number[];
      const stagesToDelete = currentStages.filter(s => !incomingIds.includes(s.id));

      if (stagesToDelete.length > 0) {
        const deleteStageIds = stagesToDelete.map(s => s.id);
        // Borrado en cascada directo de etapas y sus horas relacionadas gracias a onDelete: Cascade
        await tx.stage.deleteMany({
          where: { id: { in: deleteStageIds } }
        });
      }

      // Update existing or create brand-new stages
      for (const s of stagesData) {
        if (s.id) {
          await tx.stage.update({
            where: { id: s.id },
            data: {
              name: s.name,
              budgetedHours: s.budgetedHours,
              isOpen: s.isOpen !== false
            }
          });
        } else {
          await tx.stage.create({
            data: {
              projectId: id,
              name: s.name,
              budgetedHours: s.budgetedHours,
              isOpen: s.isOpen !== false
            }
          });
        }
      }
    }

    return await tx.project.update({
      where: { id },
      data: {
        code: data.code,
        name: data.name,
        description: data.description,
        startDate: data.startDate,
        budgetedHours: data.budgetedHours,
        budgetedCost: data.budgetedCost
      },
      include: { stages: { orderBy: { id: "asc" } } }
    });
  });

  return {
    id: p.id,
    code: p.code,
    name: p.name,
    description: p.description,
    startDate: p.startDate,
    budgetedHours: p.budgetedHours,
    budgetedCost: p.budgetedCost,
    stages: p.stages.map(s => ({
      id: s.id,
      projectId: s.projectId,
      name: s.name,
      budgetedHours: s.budgetedHours,
      isOpen: s.isOpen
    }))
  };
}

export async function deleteProject(id: number): Promise<void> {
  await prisma.project.delete({
    where: { id }
  });
}

// ================= STATS API =================

export async function getProjectStats(projectId: number) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { stages: true, timeLogs: true }
  });
  if (!project) return null;

  const totalHours = project.timeLogs.reduce((acc, t) => acc + t.hours, 0);
  const hoursByStage = project.stages.map(stage => {
    const stageLogs = project.timeLogs.filter(t => t.stageId === stage.id);
    const stageHoursSum = stageLogs.reduce((acc, t) => acc + t.hours, 0);
    return {
      stageId: stage.id,
      stageName: stage.name,
      hours: stageHoursSum,
      budgetedHours: stage.budgetedHours
    };
  });

  const start = new Date(project.startDate);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - start.getTime());
  const daysSinceStart = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return {
    projectId: project.id,
    projectName: project.name,
    totalHours,
    hoursByStage,
    budgetedHours: project.budgetedHours,
    budgetedCost: project.budgetedCost,
    daysSinceStart: isNaN(daysSinceStart) ? 0 : daysSinceStart
  };
}

// ================= TIMELOG CRUD =================

export async function getTimeLogs(userId?: number, role?: string, queryProjectId?: number): Promise<DBTimeLog[]> {
  const whereClause: any = {};
  if (role === "user" && userId) {
    whereClause.userId = userId;
  }
  if (queryProjectId) {
    whereClause.projectId = queryProjectId;
  }

  const list = await prisma.timeLog.findMany({
    where: whereClause,
    include: {
      user: true,
      project: true,
      stage: true
    },
    orderBy: { date: "desc" }
  });

  return list.map(log => ({
    id: log.id,
    userId: log.userId,
    projectId: log.projectId,
    stageId: log.stageId,
    date: log.date,
    hours: log.hours,
    description: log.description,
    userName: log.user.name,
    projectName: log.project.name,
    projectCode: log.project.code,
    stageName: log.stage.name,
    stageIsOpen: log.stage.isOpen
  }));
}

export async function getStageById(id: number): Promise<DBProjectStage | null> {
  const s = await prisma.stage.findUnique({ where: { id } });
  if (!s) return null;
  return {
    id: s.id,
    projectId: s.projectId,
    name: s.name,
    budgetedHours: s.budgetedHours,
    isOpen: s.isOpen
  };
}

export async function createTimeLog(data: Omit<DBTimeLog, "id">): Promise<DBTimeLog> {
  const log = await prisma.timeLog.create({
    data: {
      userId: data.userId,
      projectId: data.projectId,
      stageId: data.stageId,
      date: data.date,
      hours: data.hours,
      description: data.description
    },
    include: {
      user: true,
      project: true,
      stage: true
    }
  });
  return {
    id: log.id,
    userId: log.userId,
    projectId: log.projectId,
    stageId: log.stageId,
    date: log.date,
    hours: log.hours,
    description: log.description,
    userName: log.user.name,
    projectName: log.project.name,
    projectCode: log.project.code,
    stageName: log.stage.name,
    stageIsOpen: log.stage.isOpen
  };
}

export async function getSingleTimeLog(id: number): Promise<DBTimeLog | null> {
  const log = await prisma.timeLog.findUnique({
    where: { id },
    include: { user: true, project: true, stage: true }
  });
  if (!log) return null;
  return {
    id: log.id,
    userId: log.userId,
    projectId: log.projectId,
    stageId: log.stageId,
    date: log.date,
    hours: log.hours,
    description: log.description,
    userName: log.user.name,
    projectName: log.project.name,
    projectCode: log.project.code,
    stageName: log.stage.name,
    stageIsOpen: log.stage.isOpen
  };
}

export async function updateTimeLog(id: number, data: Partial<Omit<DBTimeLog, "id">>): Promise<DBTimeLog> {
  const log = await prisma.timeLog.update({
    where: { id },
    data: {
      projectId: data.projectId,
      stageId: data.stageId,
      date: data.date,
      hours: data.hours,
      description: data.description
    },
    include: {
      user: true,
      project: true,
      stage: true
    }
  });
  return {
    id: log.id,
    userId: log.userId,
    projectId: log.projectId,
    stageId: log.stageId,
    date: log.date,
    hours: log.hours,
    description: log.description,
    userName: log.user.name,
    projectName: log.project.name,
    projectCode: log.project.code,
    stageName: log.stage.name,
    stageIsOpen: log.stage.isOpen
  };
}

export async function deleteTimeLog(id: number): Promise<void> {
  await prisma.timeLog.delete({ where: { id } });
}
