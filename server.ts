/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { createServer as createViteServer } from "vite";
import {
  testConnection,
  findUserByUsername,
  findUserById,
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  getAllProjects,
  createProject,
  updateProject,
  deleteProject,
  getProjectStats,
  getTimeLogs,
  getStageById,
  createTimeLog,
  getSingleTimeLog,
  updateTimeLog,
  deleteTimeLog,
  DBUser,
  DBProject,
  DBProjectStage,
  DBTimeLog
} from "./lib/dbService.js";

const PORT = 3000;
const JWT_SECRET = "project_hours_jwt_secret_key_2026";

/**
 * Robust database exception handler for mapping database-specific codes (PostgreSQL and custom ORM errors)
 * into precise HTTP actions.
 */
function handleDatabaseError(error: any, res: express.Response) {
  console.error("Database Transaction Exception Caught:", error);

  // Custom stage deletion rules
  if (error.message && error.message.includes("CRITICAL_STAGE_DELETE:")) {
    const friendlyMessage = error.message.split("CRITICAL_STAGE_DELETE:")[1];
    return res.status(400).json({
      error: friendlyMessage,
      details: error.message
    });
  }

  // unique constraint violations (code 23505) P2002
  if (
    error.code === "23505" ||
    error.code === "P2002" ||
    error.name === "UniqueConstraintError" ||
    error.message?.includes("unique constraint") ||
    error.message?.includes("Unique constraint failed")
  ) {
    return res.status(409).json({
      error: "Error de unicidad en BD: Ya existe un registro con estos valores únicos clave.",
      details: error.message || "Unique constraint violation (23505)"
    });
  }

  // foreign key constraint violations (code 23503) P2003
  if (
    error.code === "23503" ||
    error.code === "P2003" ||
    error.name === "ForeignKeyConstraintError" ||
    error.message?.includes("foreign key") ||
    error.message?.includes("Foreign key constraint failed")
  ) {
    return res.status(409).json({
      error: "Error de integridad referencial: El registro referenciado no existe o tiene otros registros asociados vinculados.",
      details: error.message || "Foreign key constraint violation (23503)"
    });
  }

  // not-null checking error (code 23502)
  if (error.code === "23502" || error.name === "NotNullViolationError" || error.message?.includes("null value")) {
    return res.status(400).json({
      error: "Error de restricción de base de datos: Faltan campos obligatorios no nulos.",
      details: error.message || "Not null violation (23502)"
    });
  }

  // connection errors
  if (error.name === "DatabaseConnectionError" || error.message?.includes("ECONNREFUSED")) {
    return res.status(503).json({
      error: "Servicio no disponible debido a cortes de comunicación con el motor de base de datos PostgreSQL.",
      details: "Database connection refused"
    });
  }

  // Default fallback for general transaction failures
  res.status(500).json({
    error: "Fallo inesperado al persistir o consultar la base de datos relacional.",
    details: error.message || String(error)
  });
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Connect & diagnose Prisma database on startup
  await testConnection();

  // CORS Headers
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Authentication Middleware (Asynchronous database fetch)
  const authenticateToken = async (req: any, res: any, next: any) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Token de acceso requerido" });

    jwt.verify(token, JWT_SECRET, async (err: any, tokenUser: any) => {
      if (err) return res.status(403).json({ error: "Token inválido o expirado" });

      try {
        const user = await findUserById(tokenUser.id);
        if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

        req.user = {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          email: user.email,
          phone: user.phone
        };
        next();
      } catch (e) {
        return res.status(500).json({ error: "Error interno al verificar identidad." });
      }
    });
  };

  // Helper inside routes to verify security level
  const checkRole = (roles: Array<'superuser' | 'manager' | 'user'>) => {
    return (req: any, res: any, next: any) => {
      if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ error: "No tienes permisos suficientes para realizar esta acción" });
      }
      next();
    };
  };

  // ---------------- AUTHENTICATION APIS ----------------
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Usuario y contraseña requeridos" });
      }

      const user = await findUserByUsername(username);
      if (!user) {
        return res.status(401).json({ error: "Credenciales incorrectas" });
      }

      const isPasswordValid = bcrypt.compareSync(password, user.passwordHash);
      if (!isPasswordValid) {
        return res.status(401).json({ error: "Credenciales incorrectas" });
      }

      const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "2h" });
      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          email: user.email,
          phone: user.phone
        }
      });
    } catch (e: any) {
      handleDatabaseError(e, res);
    }
  });

  app.get("/api/me", authenticateToken, async (req: any, res) => {
    try {
      res.json({ user: req.user });
    } catch (e: any) {
      handleDatabaseError(e, res);
    }
  });

  app.post("/api/auth/change-password", authenticateToken, async (req: any, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "La contraseña actual y la nueva son obligatorias." });
      }

      const user = await findUserById(userId);
      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado." });
      }

      const isPasswordValid = bcrypt.compareSync(currentPassword, user.passwordHash);
      if (!isPasswordValid) {
        return res.status(400).json({ error: "La contraseña actual introducida es incorrecta." });
      }

      const trimmedNew = newPassword.trim();
      if (trimmedNew.length < 4) {
        return res.status(400).json({ error: "La nueva contraseña debe tener al menos 4 caracteres." });
      }

      await updateUser(userId, { passwordHash: bcrypt.hashSync(trimmedNew, 10) });

      res.json({ success: true, message: "Contraseña actualizada exitosamente." });
    } catch (e: any) {
      handleDatabaseError(e, res);
    }
  });

  app.put("/api/auth/profile", authenticateToken, async (req: any, res) => {
    try {
      const { email, phone } = req.body;
      const userId = req.user.id;

      const user = await findUserById(userId);
      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      const updated = await updateUser(userId, {
        email: email !== undefined ? (email ? email.trim() : "") : undefined,
        phone: phone !== undefined ? (phone ? phone.trim() : "") : undefined
      });

      res.json({
        success: true,
        message: "Perfil actualizado correctamente.",
        user: {
          id: updated.id,
          username: updated.username,
          name: updated.name,
          role: updated.role,
          email: updated.email,
          phone: updated.phone
        }
      });
    } catch (e: any) {
      handleDatabaseError(e, res);
    }
  });

  // ---------------- USER MANAGEMENT APIS (Superuser level) ----------------
  app.get("/api/users", authenticateToken, checkRole(["superuser"]), async (req, res) => {
    try {
      const list = await getAllUsers();
      res.json(list.map(u => ({
        id: u.id,
        username: u.username,
        name: u.name,
        role: u.role,
        email: u.email,
        phone: u.phone
      })));
    } catch (e: any) {
      handleDatabaseError(e, res);
    }
  });

  app.post("/api/users", authenticateToken, checkRole(["superuser"]), async (req, res) => {
    try {
      const { username, password, name, role, email, phone } = req.body;
      if (!username || !password || !name || !role) {
        return res.status(400).json({ error: "Todos los campos obligatorios son requeridos." });
      }

      const exists = await findUserByUsername(username);
      if (exists) {
        const err = new Error(`Unique constraint violation: el nombre de usuario '${username}' ya está registrado.`);
        (err as any).code = "23505";
        throw err;
      }

      const newUser = await createUser({
        username: username.trim().toLowerCase(),
        passwordHash: bcrypt.hashSync(password, 10),
        name: name.trim(),
        role: role as any,
        email: email ? email.trim() : undefined,
        phone: phone ? phone.trim() : undefined
      });

      res.status(201).json({
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        role: newUser.role,
        email: newUser.email,
        phone: newUser.phone
      });
    } catch (e: any) {
      handleDatabaseError(e, res);
    }
  });

  app.put("/api/users/:id", authenticateToken, checkRole(["superuser"]), async (req: any, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { name, role, password, username, email, phone } = req.body;

      const user = await findUserById(userId);
      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      if (userId === 1 && role && role !== "superuser") {
        return res.status(400).json({ error: "No se puede degradar el rol del administrador principal" });
      }

      const updatedPayload: any = {};
      if (username) {
        const usernameLower = username.trim().toLowerCase();
        const duplicate = await findUserByUsername(usernameLower);
        if (duplicate && duplicate.id !== userId) {
          const err = new Error(`Unique constraint violation: el nombre de usuario '${usernameLower}' ya está en uso.`);
          (err as any).code = "23505";
          throw err;
        }
        updatedPayload.username = usernameLower;
      }

      if (name) updatedPayload.name = name.trim();
      if (role) updatedPayload.role = role;
      if (password && password.trim() !== "") {
        updatedPayload.passwordHash = bcrypt.hashSync(password, 10);
      }
      if (email !== undefined) updatedPayload.email = email ? email.trim() : "";
      if (phone !== undefined) updatedPayload.phone = phone ? phone.trim() : "";

      const updated = await updateUser(userId, updatedPayload);

      res.json({
        id: updated.id,
        username: updated.username,
        name: updated.name,
        role: updated.role,
        email: updated.email,
        phone: updated.phone
      });
    } catch (e: any) {
      handleDatabaseError(e, res);
    }
  });

  app.delete("/api/users/:id", authenticateToken, checkRole(["superuser"]), async (req: any, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (userId === 1 || userId === req.user.id) {
        return res.status(400).json({ error: "No puedes eliminarte a ti mismo o al administrador principal" });
      }

      const user = await findUserById(userId);
      if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

      await deleteUser(userId);
      res.json({ success: true, message: "Usuario eliminado correctamente" });
    } catch (e: any) {
      handleDatabaseError(e, res);
    }
  });

  // ---------------- PROJECT MANAGEMENT APIS (Manager & Superuser level) ----------------
  app.get("/api/projects", authenticateToken, async (req, res) => {
    try {
      const projects = await getAllProjects();
      res.json(projects);
    } catch (e: any) {
      handleDatabaseError(e, res);
    }
  });

  app.post("/api/projects", authenticateToken, checkRole(["manager", "superuser"]), async (req, res) => {
    try {
      const { code, name, description, startDate, budgetedHours, budgetedCost, stages } = req.body;
      if (!code || !name || !startDate || budgetedHours === undefined || budgetedHours === null || budgetedCost === undefined || budgetedCost === null) {
        return res.status(400).json({ error: "Campos obligatorios faltantes (Código, Nombre, fecha, etc.)" });
      }

      if (typeof code !== "string" || !/[a-zA-Z]/.test(code) || !/[0-9]/.test(code)) {
        return res.status(400).json({ error: "El código de proyecto es obligatorio y debe contener letras y números (ej: PRY-101)" });
      }

      const list = await getAllProjects();
      const codeExists = list.some(p => p.code.trim().toUpperCase() === code.trim().toUpperCase());
      if (codeExists) {
        const err = new Error(`Unique constraint violation: el código de proyecto '${code}' ya existe.`);
        (err as any).code = "23505";
        throw err;
      }

      const cleanStages = Array.isArray(stages) ? stages.map(s => ({
        name: s.name.trim(),
        budgetedHours: Number(s.budgetedHours),
        isOpen: s.isOpen !== false
      })) : [];

      const newProj = await createProject({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: (description || "").trim(),
        startDate,
        budgetedHours: Number(budgetedHours),
        budgetedCost: Number(budgetedCost)
      }, cleanStages);

      res.status(201).json(newProj);
    } catch (e: any) {
      handleDatabaseError(e, res);
    }
  });

  app.put("/api/projects/:id", authenticateToken, checkRole(["manager", "superuser"]), async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const { code, name, description, startDate, budgetedHours, budgetedCost, stages } = req.body;

      const list = await getAllProjects();
      const project = list.find(p => p.id === projectId);
      if (!project) {
        return res.status(404).json({ error: "Proyecto no encontrado" });
      }

      const updatePayload: any = {};
      if (code) {
        if (typeof code !== "string" || !/[a-zA-Z]/.test(code) || !/[0-9]/.test(code)) {
          return res.status(400).json({ error: "El código de proyecto debe contener letras y números (ej: PRY-101)" });
        }
        const duplicateCode = list.some(p => p.id !== projectId && p.code.trim().toUpperCase() === code.trim().toUpperCase());
        if (duplicateCode) {
          const err = new Error(`Unique constraint violation: el código de proyecto '${code}' ya está en uso.`);
          (err as any).code = "23505";
          throw err;
        }
        updatePayload.code = code.trim().toUpperCase();
      }

      if (name) updatePayload.name = name.trim();
      if (description !== undefined) updatePayload.description = description.trim();
      if (startDate) updatePayload.startDate = startDate;
      if (budgetedHours !== undefined) updatePayload.budgetedHours = Number(budgetedHours);
      if (budgetedCost !== undefined) updatePayload.budgetedCost = Number(budgetedCost);

      const cleanStages = Array.isArray(stages) ? stages.map(s => ({
        id: s.id ? Number(s.id) : undefined,
        name: s.name.trim(),
        budgetedHours: Number(s.budgetedHours),
        isOpen: s.isOpen !== false
      })) : undefined;

      const updated = await updateProject(projectId, updatePayload, cleanStages);
      res.json(updated);
    } catch (e: any) {
      handleDatabaseError(e, res);
    }
  });

  app.delete("/api/projects/:id", authenticateToken, checkRole(["superuser"]), async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const list = await getAllProjects();
      const project = list.find(p => p.id === projectId);
      if (!project) {
        return res.status(404).json({ error: "Proyecto no encontrado" });
      }

      await deleteProject(projectId);
      res.json({ success: true, message: "Proyecto y registros relacionados eliminados con éxito" });
    } catch (e: any) {
      handleDatabaseError(e, res);
    }
  });

  // ---------------- PROJECT STATS API  ----------------
  app.get("/api/projects/:id/stats", authenticateToken, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const stats = await getProjectStats(projectId);
      if (!stats) {
        return res.status(404).json({ error: "Proyecto no encontrado" });
      }
      res.json(stats);
    } catch (e: any) {
      handleDatabaseError(e, res);
    }
  });

  // ---------------- TIME LOGS APIS ----------------
  app.get("/api/timelogs", authenticateToken, async (req: any, res) => {
    try {
      const queryProjectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;
      const logs = await getTimeLogs(req.user.id, req.user.role, queryProjectId);
      res.json(logs);
    } catch (e: any) {
      handleDatabaseError(e, res);
    }
  });

  app.post("/api/timelogs", authenticateToken, async (req: any, res) => {
    try {
      const { projectId, stageId, date, hours, description, userId } = req.body;

      if (!projectId || !stageId || !date || !hours) {
        return res.status(400).json({ error: "Faltan campos obligatorios para registrar el tiempo" });
      }

      let assignedUserId = req.user.id;
      if (req.user.role === "superuser" || req.user.role === "manager") {
        if (userId) {
          const targetUsr = await findUserById(Number(userId));
          if (!targetUsr) {
            const err = new Error("Foreign key violation: El usuario destino especificado no existe.");
            (err as any).code = "23503";
            throw err;
          }
          assignedUserId = Number(userId);
        }
      } else {
        if (userId && Number(userId) !== req.user.id) {
          return res.status(403).json({ error: "No tienes autorización para cargar horas en nombre de otro usuario" });
        }
      }

      const projects = await getAllProjects();
      const project = projects.find(p => p.id === Number(projectId));
      if (!project) {
        const err = new Error(`Foreign key constraint violation: No existe el proyecto con ID ${projectId}.`);
        (err as any).code = "23503";
        throw err;
      }

      const stage = await getStageById(Number(stageId));
      if (!stage) {
        const err = new Error(`Foreign key constraint violation: No existe la etapa de proyecto con ID ${stageId}.`);
        (err as any).code = "23503";
        throw err;
      }

      if (stage.projectId !== Number(projectId)) {
        return res.status(400).json({ error: "La etapa elegida no pertenece al proyecto seleccionado" });
      }

      if (stage.isOpen === false) {
        return res.status(400).json({ error: "No se pueden registrar horas en una etapa que se encuentra cerrada para modificaciones" });
      }

      const created = await createTimeLog({
        userId: assignedUserId,
        projectId: Number(projectId),
        stageId: Number(stageId),
        date,
        hours: Number(hours),
        description: (description || "").trim()
      });

      res.status(201).json(created);
    } catch (e: any) {
      handleDatabaseError(e, res);
    }
  });

  app.put("/api/timelogs/:id", authenticateToken, async (req: any, res) => {
    try {
      const logId = parseInt(req.params.id);
      const { projectId, stageId, date, hours, description } = req.body;

      const currentLog = await getSingleTimeLog(logId);
      if (!currentLog) {
        return res.status(404).json({ error: "Registro de tiempo no encontrado" });
      }

      if (req.user.role === "user" && currentLog.userId !== req.user.id) {
        return res.status(403).json({ error: "No tienes permiso para editar registros de otros usuarios" });
      }

      if (currentLog.stageIsOpen === false) {
        return res.status(400).json({ error: "La etapa actual está cerrada para modificaciones" });
      }

      const finalProjectId = projectId ? Number(projectId) : currentLog.projectId;
      const finalStageId = stageId ? Number(stageId) : currentLog.stageId;

      if (projectId || stageId) {
        const projects = await getAllProjects();
        const project = projects.find(p => p.id === finalProjectId);
        if (!project) {
          const err = new Error(`Foreign key constraint violation: No existe el proyecto con ID ${finalProjectId}.`);
          (err as any).code = "23503";
          throw err;
        }

        const stage = await getStageById(finalStageId);
        if (!stage) {
          const err = new Error(`Foreign key constraint violation: No existe la etapa con ID ${finalStageId}.`);
          (err as any).code = "23503";
          throw err;
        }

        if (stage.projectId !== finalProjectId) {
          return res.status(400).json({ error: "La etapa especificada no pertenece al proyecto seleccionado" });
        }

        if (stage.isOpen === false) {
          return res.status(400).json({ error: "No se puede transferir un registro a una etapa cerrada para modificaciones" });
        }
      }

      const updated = await updateTimeLog(logId, {
        projectId: projectId ? Number(projectId) : undefined,
        stageId: stageId ? Number(stageId) : undefined,
        date,
        hours: hours !== undefined ? Number(hours) : undefined,
        description: description !== undefined ? description.trim() : undefined
      });

      res.json(updated);
    } catch (e: any) {
      handleDatabaseError(e, res);
    }
  });

  app.delete("/api/timelogs/:id", authenticateToken, async (req: any, res) => {
    try {
      const logId = parseInt(req.params.id);
      const currentLog = await getSingleTimeLog(logId);
      if (!currentLog) {
        return res.status(404).json({ error: "Registro de tiempo no encontrado" });
      }

      if (req.user.role === "user" && currentLog.userId !== req.user.id) {
        return res.status(403).json({ error: "No tienes autorización para eliminar este registro" });
      }

      if (currentLog.stageIsOpen === false) {
        return res.status(400).json({ error: "No se pueden eliminar las horas cargadas en una etapa cerrada para modificaciones" });
      }

      await deleteTimeLog(logId);
      res.json({ success: true, message: "Registro eliminado correctamente" });
    } catch (e: any) {
      handleDatabaseError(e, res);
    }
  });

  // Serve frontend files (Vite / Static production SPA)
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server running on http://localhost:${PORT}`);
  });
}

startServer().catch((e) => {
  console.error("Failed to start server", e);
});
