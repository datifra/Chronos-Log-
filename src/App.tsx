/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, FormEvent } from "react";
import { User, Project, ProjectStage, TimeLog, ProjectStats } from "./types";
import CalendarWidget from "./components/CalendarWidget";
import ProjectStatsPanel from "./components/ProjectStatsPanel";
import TimeLogForm from "./components/TimeLogForm";
import ProjectManagerPanel from "./components/ProjectManagerPanel";
import AdminUsersPanel from "./components/AdminUsersPanel";
import ProjectSummaryPanel from "./components/ProjectSummaryPanel";
import { 
  Briefcase, 
  Clock, 
  LogOut, 
  User as UserIcon, 
  Calendar as CalendarIcon, 
  Search, 
  Trash2, 
  Lock, 
  Settings, 
  Users, 
  Layers,
  History,
  CheckCircle,
  HelpCircle,
  AlertCircle,
  ClipboardList,
  Sparkles,
  Database
} from "lucide-react";

export default function App() {
  // Auth state
  const [token, setToken] = useState<string | null>(localStorage.getItem("hours_app_token"));
  const [user, setUser] = useState<User | null>(
    localStorage.getItem("hours_app_user") ? JSON.parse(localStorage.getItem("hours_app_user")!) : null
  );

  const isRoleElevated = user?.role === "superuser" || user?.role === "manager";

  // Login form inputs
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // App data states
  const [projects, setProjects] = useState<(Project & { stages: ProjectStage[] })[]>([]);
  const [timelogs, setTimelogs] = useState<(TimeLog & { userName: string; projectName: string; stageName: string })[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | "">("");
  const [projectStats, setProjectStats] = useState<ProjectStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("2026-05-20"); // Defaults to mock system datetime

  // Filter logs for current user for the selected day only
  const filteredTimelogs = timelogs.filter(
    (log) => user && log.userId === user.id && log.date === selectedDate
  );

  // Dashboard view selection
  // 'dashboard' (Cargar/Estadísticas), 'projects' (Gestión Gerencial), 'users' (Admin de usuarios 50), 'resumen' (Resumen Consolidado), 'help' (Guía y Seguridad)
  const [activeTab, setActiveTab] = useState<"dashboard" | "projects" | "users" | "resumen" | "help">("dashboard");
  const [isEditingBlocked, setIsEditingBlocked] = useState(false);

  // User profile actions & Change Password modal states
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  // Notifications
  const [appError, setAppError] = useState("");
  const [appSuccess, setAppSuccess] = useState("");
  const [confirmDeleteLogId, setConfirmDeleteLogId] = useState<number | null>(null);

  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPwError("");
    setPwSuccess("");
    setPwLoading(true);

    try {
      // 1. If password change is filled, do password change first
      if (oldPassword || newPassword || confirmNewPassword) {
        if (!oldPassword || !newPassword) {
          setPwError("Para cambiar tu contraseña, completa los campos actual y nueva.");
          setPwLoading(false);
          return;
        }

        if (newPassword !== confirmNewPassword) {
          setPwError("La nueva contraseña y su confirmación no coinciden.");
          setPwLoading(false);
          return;
        }

        if (newPassword.trim().length < 4) {
          setPwError("La nueva contraseña debe tener al menos 4 caracteres.");
          setPwLoading(false);
          return;
        }

        const resPw = await fetch("/api/auth/change-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ currentPassword: oldPassword, newPassword })
        });

        const dataPw = await resPw.json();
        if (!resPw.ok) {
          throw new Error(dataPw.error || "No se pudo cambiar la contraseña.");
        }
      }

      // 2. Always update contact details (email and phone)
      const resProf = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ email: profileEmail.trim(), phone: profilePhone.trim() })
      });

      const dataProf = await resProf.json();
      if (!resProf.ok) {
        throw new Error(dataProf.error || "No se pudo actualizar los datos del perfil.");
      }

      // 3. Update active user with fresh database content
      if (dataProf.user) {
        setUser(dataProf.user);
        localStorage.setItem("hours_app_user", JSON.stringify(dataProf.user));
      }

      setPwSuccess("¡Perfil y de datos de contacto actualizados!");
      setOldPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setTimeout(() => {
        setIsPasswordModalOpen(false);
        setPwSuccess("");
      }, 1500);
    } catch (err: any) {
      setPwError(err.message || "Error de red al actualizar los datos.");
    } finally {
      setPwLoading(false);
    }
  };

  // Synchronous initial fetch
  useEffect(() => {
    if (token && user) {
      fetchInitialData();
    }
  }, [token, user]);

  const fetchInitialData = async () => {
    try {
      await Promise.all([
        fetchProjects(),
        fetchTimeLogs(),
        fetchUsersList()
      ]);
    } catch (e) {
      console.error("Error loading operational files", e);
    }
  };

  // Fetch updated stats when selected project changes
  useEffect(() => {
    if (selectedProjectId) {
      fetchProjectStats(Number(selectedProjectId));
    } else {
      setProjectStats(null);
    }
  }, [selectedProjectId, timelogs]); // Recalculate also on time logs changes!

  const fetchProjects = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/projects", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (err) {
      console.error("Error fetching projects", err);
    }
  };

  const fetchTimeLogs = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/timelogs", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTimelogs(data);
      }
    } catch (err) {
      console.error("Error fetching logs", err);
    }
  };

  const fetchUsersList = async () => {
    if (!token || !user) return;
    // Only superuser/manager can access lists of users properly from the server
    if (user.role !== "superuser" && user.role !== "manager") return;
    
    try {
      const res = await fetch("/api/users", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsersList(data);
      }
    } catch (err) {
      console.error("Error fetching user list", err);
    }
  };

  const fetchProjectStats = async (id: number) => {
    if (!token) return;
    setStatsLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProjectStats(data);
      }
    } catch (err) {
      console.error("Error getting project stats", err);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError("");
    if (!loginUsername || !loginPassword) {
      setLoginError("Por favor completa las credenciales.");
      return;
    }

    setLoginLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Credenciales de ingreso no autorizadas");
      }

      // Save to localStorage and state
      localStorage.setItem("hours_app_token", data.token);
      localStorage.setItem("hours_app_user", JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      
      // Clear fields
      setLoginUsername("");
      setLoginPassword("");
    } catch (err: any) {
      setLoginError(err.message || "Fallo de conexión con el servidor");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("hours_app_token");
    localStorage.removeItem("hours_app_user");
    setToken(null);
    setUser(null);
    setProjects([]);
    setTimelogs([]);
    setUsersList([]);
    setSelectedProjectId("");
    setProjectStats(null);
    setActiveTab("dashboard");
  };

  const handleDeleteLog = async (logId: number) => {
    setAppError("");
    setAppSuccess("");

    try {
      const res = await fetch(`/api/timelogs/${logId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error de eliminación");
      }
      setAppSuccess("Registro de tiempo eliminado");
      fetchTimeLogs();
      if (selectedProjectId) {
         fetchProjectStats(Number(selectedProjectId));
      }
    } catch (err: any) {
      setAppError(err.message || "No se pudo realizar la eliminación");
    }
  };

  // Pre-login interface
  if (!token || !user) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans transition-all" id="login-container">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
          {/* Hexagonal decorative icon */}
          <div className="mx-auto h-12 w-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Clock className="w-6 h-6 text-white" />
          </div>
          <h2 className="font-display font-bold text-3xl tracking-tight text-white uppercase">
            TIMESHEET PORTAL
          </h2>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          {/* Concentric layered designer frame to match the screenshot */}
          <div className="bg-slate-950/20 border border-slate-850/50 backdrop-blur-md p-2 rounded-3xl shadow-2xl">
            <div className="bg-slate-900/60 py-8 px-6 border border-slate-755/40 rounded-2xl sm:px-10 space-y-6">
              {loginError && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs p-3.5 rounded-xl mb-4 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <form className="space-y-6" onSubmit={handleLogin}>
                <div>
                  <label className="block text-xs font-semibold text-slate-350 uppercase tracking-wider mb-2">
                    NOMBRE DE USUARIO
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      placeholder="Escribe tu nombre de usuario"
                      className="w-full h-12 bg-slate-950/50 border border-slate-800 text-white rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder-slate-500 focus:bg-slate-950 leading-normal"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between">
                    <label className="block text-xs font-semibold text-slate-355 uppercase tracking-wider mb-2">
                      CONTRASEÑA DE INGRESO
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Escribe tu contraseña"
                      className="w-full h-12 bg-slate-950/50 border border-slate-800 text-white rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder-slate-500 focus:bg-slate-950 leading-normal"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-2xl transition shadow-lg shadow-indigo-650/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 select-none active:scale-98 uppercase tracking-wide"
                >
                  {loginLoading ? "Verificando..." : "Iniciar Sesión"}
                </button>
              </form>
            </div>
          </div>

          </div>
        </div>
      );
    }

  return (
    <div className="min-h-screen bg-slate-50 font-sans" id="applet-dashboard-container">
      {/* Dynamic Notifications */}
      {appError && (
        <div className="bg-rose-600 text-white text-xs px-4 py-3 text-center flex items-center justify-center gap-2 sticky top-0 z-50 shadow-md">
          <AlertCircle className="w-4 h-4" />
          <span>{appError}</span>
          <button className="ml-4 underline font-semibold" onClick={() => setAppError("")}>Cerrar</button>
        </div>
      )}
      {appSuccess && (
        <div className="bg-indigo-600 text-white text-xs px-4 py-3 text-center flex items-center justify-center gap-2 sticky top-0 z-50 shadow-md">
          <CheckCircle className="w-4 h-4" />
          <span>{appSuccess}</span>
          <button className="ml-4 underline font-semibold" onClick={() => setAppSuccess("")}>Cerrar</button>
        </div>
      )}

      {/* Modern Dashboard Header */}
      <header className="bg-white text-slate-900 sticky top-0 z-40 border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            
            {/* Logo and Level Badge */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                <Clock className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="font-sans font-black tracking-widest text-sm block uppercase text-indigo-700">
                  Timesheet
                </span>
              </div>
            </div>

            {/* Profile actions */}
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-bold text-slate-400 uppercase leading-none">
                  {user.role === "superuser" ? "Superusuario" : user.role === "manager" ? "Gerente de Proyectos" : "Colaborador Consulta"}
                </p>
                <p className="text-sm font-semibold text-slate-800">{user.name}</p>
              </div>
              {/* User logo avatar with integrated change-password & logout menu */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  disabled={isEditingBlocked}
                  className="w-10 h-10 rounded-full bg-slate-100 border-2 border-indigo-100 hover:border-indigo-400 flex items-center justify-center overflow-hidden font-bold text-sm text-indigo-600 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-505/40 disabled:opacity-50"
                  title="Opciones de usuario"
                >
                  {user.username.slice(0, 2).toUpperCase()}
                </button>

                {isUserMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40 bg-transparent" 
                      onClick={() => setIsUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white border border-slate-200 shadow-xl py-2 z-50">
                      <div className="px-4 py-2">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide leading-none mb-1">
                          {user.role === "superuser" ? "Superusuario" : user.role === "manager" ? "Gerente de Proyectos" : "Colaborador Consulta"}
                        </p>
                        <p className="text-sm font-semibold text-slate-800 truncate leading-tight">{user.name}</p>
                        <p className="text-xs text-slate-450 truncate">@{user.username}</p>
                      </div>
                      <div className="py-1">
                        <button
                          type="button"
                          onClick={() => {
                            setProfileEmail(user?.email || "");
                            setProfilePhone(user?.phone || "");
                            setIsPasswordModalOpen(true);
                            setIsUserMenuOpen(false);
                          }}
                          className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition flex items-center gap-2 cursor-pointer"
                        >
                          <Lock className="w-3.5 h-3.5 text-slate-400" />
                          Configuración de Perfil
                        </button>
                      </div>
                      <div className="py-1">
                        <button
                          type="button"
                          onClick={() => {
                            handleLogout();
                            setIsUserMenuOpen(false);
                          }}
                          className="w-full text-left px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition flex items-center gap-2 cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          Cerrar Sesión
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Help button */}
              <button
                onClick={() => setActiveTab("help")}
                disabled={isEditingBlocked}
                className={`p-2 rounded-xl transition border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  activeTab === "help"
                    ? "text-indigo-600 bg-indigo-50 border-indigo-200 font-bold"
                    : "text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border-slate-200"
                }`}
                title={isEditingBlocked ? "Por favor confirma o cancela los cambios para navegar" : "Información de la Aplicación y Seguridad"}
                type="button"
              >
                <HelpCircle className="w-4 h-4" />
              </button>

              {/* Logout button */}
              <button
                onClick={handleLogout}
                disabled={isEditingBlocked}
                className="p-2 text-slate-500 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 rounded-xl transition border border-slate-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title={isEditingBlocked ? "Por favor confirma o cancela los cambios para salir" : "Cerrar Sesión"}
                type="button"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Role Navigation Tabs */}
      <div className="bg-white border-b border-slate-200/80 sticky top-16 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 py-2">
            
            <button
              onClick={() => setActiveTab("dashboard")}
              disabled={isEditingBlocked}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                activeTab === "dashboard"
                  ? "bg-indigo-50 text-indigo-700 font-bold border border-indigo-100"
                  : "text-slate-600 hover:text-slate-900 border border-transparent hover:bg-slate-50"
              }`}
              type="button"
            >
              <Layers className="w-3.5 h-3.5" />
              Carga de Horas
            </button>

            {/* Manager and Admin level view tabs */}
            {(user.role === "superuser" || user.role === "manager") && (
              <>
                <button
                  onClick={() => setActiveTab("projects")}
                  disabled={isEditingBlocked}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    activeTab === "projects"
                      ? "bg-indigo-50 text-indigo-700 font-bold border border-indigo-100"
                      : "text-slate-600 hover:text-slate-900 border border-transparent hover:bg-slate-50"
                  }`}
                  type="button"
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  Definición de Proyectos / Etapas
                </button>
                <button
                  onClick={() => setActiveTab("resumen")}
                  disabled={isEditingBlocked}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    activeTab === "resumen"
                      ? "bg-indigo-50 text-indigo-700 font-bold border border-indigo-100"
                      : "text-slate-600 hover:text-slate-900 border border-transparent hover:bg-slate-50"
                  }`}
                  type="button"
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  Resumen de Proyectos
                </button>
              </>
            )}

            {/* Superuser level view tabs */}
            {user.role === "superuser" && (
              <button
                onClick={() => setActiveTab("users")}
                disabled={isEditingBlocked}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  activeTab === "users"
                    ? "bg-indigo-50 text-indigo-700 font-bold border border-indigo-100"
                    : "text-slate-600 hover:text-slate-900 border border-transparent hover:bg-slate-50"
                }`}
                type="button"
              >
                <Users className="w-3.5 h-3.5" />
                Gestión de Usuarios
              </button>
            )}

          </div>
        </div>
      </div>

      {/* Main Page Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ backgroundColor: "#62a06f" }}>
        {activeTab === "dashboard" && (
          <div className="space-y-8" id="tab-dashboard-view">
            
            {/* Top Interactive Row: Worked Hours Loader & Calendar (at the absolute top) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1">
                <CalendarWidget
                  selectedDate={selectedDate}
                  onSelectDate={(date) => {
                    setSelectedDate(date);
                    setAppSuccess(`Día ${date} seleccionado para cargar horas`);
                    setTimeout(() => setAppSuccess(""), 3000);
                  }}
                  timelogs={timelogs.filter(t => user && t.userId === user.id)}
                />
              </div>
              <div className="lg:col-span-2">
                <TimeLogForm
                  token={token}
                  selectedDate={selectedDate}
                  projects={projects}
                  currentUser={user}
                  onLogCreated={() => {
                    fetchTimeLogs();
                    if (selectedProjectId) {
                      fetchProjectStats(Number(selectedProjectId));
                    }
                  }}
                  selectedProjectId={selectedProjectId}
                  onProjectChange={(id) => setSelectedProjectId(id)}
                  usersList={usersList}
                  timelogs={timelogs}
                />
              </div>
            </div>

            {/* Calculations Panel */}
            <ProjectStatsPanel stats={projectStats} loading={statsLoading} />

            {/* Bottom Row (History Registry & Context Bento) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Right/List Column (Logs Registry & list outputs, taking 2 columns) */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* List Container */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm" id="timelogs-list-container">
                  <div className="border-b border-slate-100 pb-3 mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-sans font-extrabold text-indigo-755 text-xs uppercase tracking-widest flex items-center gap-2">
                        <History className="w-4 h-4 text-indigo-600" />
                        Historial de Registros de Tiempos
                      </h3>
                      <p className="text-[11px] text-slate-450 mt-1 lines-clamp-1">
                        Mostrando tus registros de horas cargadas para el día seleccionado ({selectedDate}).
                      </p>
                    </div>

                    <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100/45 rounded-lg px-2.5 py-1">
                      Mis registros de este día: {filteredTimelogs.length}
                    </span>
                  </div>

                  {/* List item elements */}
                  <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto pr-2 space-y-2">
                    {filteredTimelogs.map((log) => (
                      <div key={log.id} className="py-3 px-3 hover:bg-slate-50/70 rounded-xl transition flex flex-col md:flex-row justify-between md:items-center gap-3 border border-slate-100 hover:border-slate-300">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-indigo-600 font-mono">
                              {log.date}
                            </span>
                            <span className="text-[10px] bg-slate-105 border border-slate-200 text-slate-600 px-2.5 py-0.5 rounded font-bold flex items-center gap-1.5">
                              {log.projectCode && (
                                <span className="font-mono text-indigo-700 bg-indigo-50 border border-indigo-150 px-1 py-0.5 rounded text-[8px] font-bold">
                                  {log.projectCode}
                                </span>
                              )}
                              <span>{log.projectName}</span>
                            </span>
                            <span className="text-[10px] bg-indigo-50/70 border border-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded font-bold uppercase tracking-wider font-mono">
                              {log.stageName}
                            </span>
                          </div>

                          <p className="text-xs text-slate-700 mt-2 font-medium">
                            "{log.description}"
                          </p>

                          <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                            <span>Registrado por: <strong className="text-slate-600">{log.userName}</strong></span>
                            {isRoleElevated && (
                              <span className="text-slate-300">| ID: #{log.id} (Relational Key)</span>
                            )}
                          </div>
                        </div>

                        {/* Action triggers */}
                        <div className="flex items-center gap-3 shrink-0 justify-between md:justify-end">
                          <div className="flex items-center gap-1.5 bg-slate-900 text-white font-black text-xs px-3.5 py-2 rounded-xl font-mono border border-slate-800">
                            <Clock className="w-3.5 h-3.5 text-indigo-400" />
                            <span>{log.hours} hs</span>
                          </div>

                          {/* Level criteria logic */}
                          {(user.role === "superuser" || user.role === "manager" || log.userId === user.id) && (
                            log.stageIsOpen === false ? (
                              <div className="flex items-center gap-1 text-[11px] font-bold text-rose-705 bg-rose-50/70 border border-rose-200/50 rounded-lg px-2 py-1" title="No puedes eliminar un registro de una etapa cerrada para modificaciones.">
                                <Lock className="w-3 h-3 text-rose-500 shrink-0" />
                                <span>Etapa Cerrada</span>
                              </div>
                            ) : confirmDeleteLogId === log.id ? (
                              <div className="flex items-center gap-1 bg-rose-50 border border-rose-100 p-0.5 rounded-lg border-dashed">
                                <button
                                  onClick={() => {
                                    handleDeleteLog(log.id);
                                    setConfirmDeleteLogId(null);
                                  }}
                                  className="px-1.5 py-0.5 text-[9px] font-bold text-rose-700 hover:bg-rose-100 rounded transition cursor-pointer"
                                  type="button"
                                >
                                  Sí
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteLogId(null)}
                                  className="px-1.5 py-0.5 text-[9px] font-bold text-slate-500 hover:bg-slate-100 rounded transition cursor-pointer"
                                  type="button"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteLogId(log.id)}
                                className="p-2 border border-slate-200 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-100 transition cursor-pointer"
                                title="Remover Registro"
                                type="button"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    ))}

                    {filteredTimelogs.length === 0 && (
                      <div className="py-12 text-center text-slate-400 text-xs font-medium">
                        No has registrado horas para el día {selectedDate}.
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </div>
          </div>
        )}

        {/* Manager/Superuser view container */}
        {activeTab === "projects" && (user.role === "superuser" || user.role === "manager") && (
          <div id="tab-projects-view">
            <ProjectManagerPanel
              token={token}
              currentUser={user}
              projects={projects}
              onProjectUpdated={() => {
                fetchProjects();
                fetchTimeLogs();
              }}
              onEditingChange={setIsEditingBlocked}
            />
          </div>
        )}

        {/* Superuser view container */}
        {activeTab === "users" && user.role === "superuser" && (
          <div id="tab-users-view">
            <AdminUsersPanel
              token={token}
              currentUser={user}
              onEditingChange={setIsEditingBlocked}
            />
          </div>
        )}

        {/* Project summary view container */}
        {activeTab === "resumen" && (user.role === "superuser" || user.role === "manager") && (
          <div id="tab-resumen-view">
            <ProjectSummaryPanel
              projects={projects}
              timelogs={timelogs}
            />
          </div>
        )}

        {/* Help, Manual & Security view container */}
        {activeTab === "help" && (
          <div id="tab-help-view" className="space-y-8 animate-fadeIn">
            {/* Elegant header banner */}
            <div className="bg-indigo-900 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-lg border border-indigo-950">
              <div className="absolute right-0 top-0 translate-x-12 -translate-y-6 w-96 h-96 rounded-full bg-indigo-800 opacity-40 blur-3xl"></div>
              <div className="relative z-10 space-y-2 max-w-3xl">
                <span className="text-[10px] font-bold tracking-widest text-indigo-300 uppercase bg-indigo-950/50 px-3.5 py-1 rounded-full border border-indigo-700/30 font-mono">
                  Guía Operativa & Seguridad del Sistema
                </span>
                <h2 className="text-3xl font-black font-display tracking-tight text-white mt-1 uppercase">
                  TIMESHEET • MANUAL & ARQUITECTURA
                </h2>
                <p className="text-sm text-indigo-150 leading-relaxed font-sans">
                  Soporte técnico integral para colaboradores y administradores de la plataforma. Conoce los esquemas de privilegios jerárquicos y las robustas salvaguardas programáticas que se encargan del resguardo de cada registro transaccional.
                </p>
              </div>
            </div>

            {/* Bento Grid layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Card 1: Guía de Uso Operacional */}
              <div className="lg:col-span-1 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between space-y-5">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                      <Layers className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="font-sans font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                        Cómo manejar la aplicación
                      </h3>
                      <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest leading-none mt-1">Guía del Usuario</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed">
                    Sigue esta secuencia simplificada para la correcta imputación manual y auditoría de tiempos laborados por proyecto:
                  </p>

                  <div className="space-y-4 text-xs text-slate-650">
                    <div className="flex gap-3">
                      <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-750 font-mono text-[10px] shrink-0 mt-0.5 text-center">
                        1
                      </div>
                      <div className="space-y-0.5">
                        <strong className="text-slate-850 block text-xs">Configurar la Fecha de Carga</strong>
                        <span className="text-slate-600 leading-relaxed">En la pestaña <em>Carga de Horas</em>, toca cualquier día en el widget del Calendario lateral para seleccionarlo como la fecha activa del registro.</span>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-750 font-mono text-[10px] shrink-0 mt-0.5 text-center">
                        2
                      </div>
                      <div className="space-y-0.5">
                        <strong className="text-slate-855 block text-xs">Imputar Horas al Hito</strong>
                        <span className="text-slate-600 leading-relaxed">Escoge el proyecto correspondiente y la etapa requerida en el formulario del panel principal. Digita las horas y detalla brevemente las tareas asociadas.</span>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-750 font-mono text-[10px] shrink-0 mt-0.5 text-center">
                        3
                      </div>
                      <div className="space-y-0.5">
                        <strong className="text-slate-855 block text-xs">Consultar Avance y Estimaciones</strong>
                        <span className="text-slate-600 leading-relaxed">El panel informático inferior calculará dinámicamente las horas netas consumidas contra el presupuesto acordado y el costo remanente.</span>
                      </div>
                    </div>

                    <div className="flex gap-3 font-sans">
                      <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-750 font-mono text-[10px] shrink-0 mt-0.5 text-center">
                        4
                      </div>
                      <div className="space-y-0.5">
                        <strong className="text-slate-855 block text-xs">Completar Día y Gestión de Registros</strong>
                        <span className="text-slate-600 leading-relaxed">Usa el botón para completar el día con varios items de carga si deseas rellenar rápidamente la jornada de 8h. Asimismo, todos los logs de carga pueden ser libremente eliminados en cualquier momento desde el panel del historial ubicado más abajo.</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 text-center">
                  <button 
                    onClick={() => setActiveTab("dashboard")} 
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-500 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Ir a Cargar Horas Ahora</span>
                    <span>&rarr;</span>
                  </button>
                </div>
              </div>

              {/* Card 2: Niveles de Usuario y Seguridad Estructural de Roles */}
              <div className="lg:col-span-1 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-sans font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                      Esquema de Niveles de Acceso
                    </h3>
                    <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest leading-none mt-1">Gobernanza RBAC</p>
                  </div>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  Timesheet implementa un modelo jerárquico estricto de control de accesos basado en roles (RBAC) con tres niveles funcionales:
                </p>

                <div className="space-y-4 text-xs">
                  {/* Nivel 1 */}
                  <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-805 font-display text-xs">Nivel 1: Superusuario</span>
                      <span className="text-[8px] font-mono font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded border border-rose-150 uppercase">ADMINISTRADOR</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      Posee la máxima jerarquía. Habilitado para la administración completa del catálogo de usuarios colaboradores, gestionando sus roles y credenciales. Administra adicionalmente proyectos, diagramas de etapas y registros de horas de todo el equipo. <strong className="text-rose-700">Es el único rol con privilegios exclusivos para eliminar proyectos del sistema.</strong>
                    </p>
                  </div>

                  {/* Nivel 2 */}
                  <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-805 font-display text-xs">Nivel 2: Gerente de Proyectos</span>
                      <span className="text-[8px] font-mono font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded border border-amber-150 uppercase">OPERATIVO</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      Enfocado en la planeación. Puede crear proyectos, etapas con horas proyectadas y costos presupuestados. Consulta el <em>Resumen Consolidado de Proyectos</em> en tiempo real para visualizar las discrepancias de tiempos de todos los usuarios, pero <strong className="text-slate-700">no posee permisos para eliminar proyectos ni modificar el personal</strong>.
                    </p>
                  </div>

                  {/* Nivel 3 */}
                  <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-805 font-display text-xs">Nivel 3: Colaborador Consulta</span>
                      <span className="text-[8px] font-mono font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded border border-emerald-150 uppercase">CONSULTA</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      Rol de ejecución. Habilitado exclusivamente para imputar sus horas diarias, consultar el historial de sus propios tiempos y constatar la salud estadística general de los proyectos asignados.
                    </p>
                  </div>
                </div>
              </div>

              {/* Card 3: Datos de Arquitectura Técnica de Seguridad */}
              <div className="lg:col-span-1 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center shrink-0">
                    <Lock className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-sans font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                      Arquitectura de Seguridad de Datos
                    </h3>
                    <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest leading-none mt-1">Especificación del Motor</p>
                  </div>
                </div>

                <p className="text-xs text-slate-550 leading-relaxed">
                  La seguridad informática y la coherencia estructural de Timesheet se asientan sobre pilares garantizados en la plataforma:
                </p>

                <div className="space-y-4 text-xs font-sans">
                  {/* Password Hashing */}
                  <div className="space-y-1 bg-slate-50 p-3.5 border border-slate-100 rounded-xl">
                    <span className="font-mono text-[9px] font-bold bg-purple-100 border border-purple-150 px-2 py-0.5 text-purple-750 uppercase rounded block w-fit">
                      Contraseñas Encriptadas
                    </span>
                    <p className="text-slate-600 leading-relaxed mt-1">
                      El servidor utiliza el algoritmo <strong className="text-slate-700">bcryptjs</strong>. Durante la creación o rediseño de credenciales, la contraseña se dispersa con un factor de cost de salto de <code className="bg-slate-200 text-slate-800 px-1 rounded font-mono text-[10px]">10</code> pasadas. La base de datos guarda únicamente la firma hash irreversible (<code className="bg-slate-200 text-slate-700 font-mono text-[10px]">passwordHash</code>), de modo que nadie en texto plano puede conocerlas.
                    </p>
                  </div>

                  {/* Sessions tokenized */}
                  <div className="space-y-1 bg-slate-50 p-3.5 border border-slate-100 rounded-xl">
                    <span className="font-mono text-[9px] font-bold bg-blue-100 border border-blue-150 px-2 py-0.5 text-blue-750 uppercase rounded block w-fit">
                      Sesiones Tokenizadas (JWT)
                    </span>
                    <p className="text-slate-600 leading-relaxed mt-1">
                      La sesión de usuario utiliza <strong className="text-slate-700">JSON Web Tokens (JWT)</strong> firmados con firma digital secreta custodiada en el servidor. El cliente adjunta este token en cada llamada de API mediante la cabecera estándar HTTP <code className="bg-slate-200 text-slate-800 px-1 rounded font-mono text-[10px]">Authorization: Bearer</code>, evitando la suplantación de identidad.
                    </p>
                  </div>

                  {/* Relational DB & Referential Integrity */}
                  <div className="space-y-1 bg-slate-50 p-3.5 border border-slate-100 rounded-xl">
                    <span className="font-mono text-[9px] font-bold bg-emerald-100 border border-emerald-150 px-2 py-0.5 text-emerald-750 uppercase rounded block w-fit">
                      Integridad Referencial Relacional (PostgreSQL)
                    </span>
                    <p className="text-slate-600 leading-relaxed mt-1">
                      El motor funciona con un esquema relacional estricto en <strong className="text-slate-700">PostgreSQL</strong> donde las etapas y registros de horas se vinculan mediante claves foráneas (<code className="bg-slate-200 text-slate-750 font-mono text-[10px]">projectId</code>, <code className="bg-slate-200 text-slate-750 font-mono text-[10px]">stageId</code>) con borrado en cascada (<code className="bg-slate-200 text-slate-750 font-mono text-[10px]">Cascade Delete</code>), garantizando consistencia transaccional absoluta en cada operación sin riesgo de registros huérfanos.
                    </p>
                  </div>
                </div>
              </div>

            </div>

            {/* Configuración de Infraestructura y Base de Datos Postgres */}
            <div className="bg-gradient-to-r from-slate-50 to-indigo-50/30 rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100/60 border border-indigo-200/50 flex items-center justify-center shrink-0">
                  <Database className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-sans font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                    Infraestructura de Datos y Persistencia Activa
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest leading-none mt-1">Motor de Almacenamiento Relacional</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                <div className="md:col-span-2 space-y-2">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    La aplicación utiliza <strong className="text-slate-700">PostgreSQL como base de datos corporativa activa</strong>, gestionada de forma centralizada con el ORM <strong className="text-indigo-600">Prisma</strong>. Esta arquitectura moderna supera los límites de los archivos planos de desarrollo, brindando un rendimiento óptimo de alta disponibilidad.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    <p className="text-xs text-slate-700 leading-relaxed font-semibold flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                      Transacciones ACID: Seguridad garantizada contra corrupción de datos.
                    </p>
                    <p className="text-xs text-slate-700 leading-relaxed font-semibold flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                      Borrado en Cascadas: Depura logs relacionados automáticamente.
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-4 border border-slate-150 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Database className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="space-y-1">
                    <span className="font-bold text-slate-800 text-xs block">Prisma ORM & PostgreSQL</span>
                    <span className="text-[11px] text-slate-550 leading-normal block">
                      Garantiza transacciones totalmente seguras, bloqueos de concurrencia nativos, migraciones declarativas y portabilidad robusta de esquemas de datos empresariales.
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </main>

      {/* Humble simple status footer */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 py-6 mt-16 text-center text-xs space-y-1">
        <p>© 2026 TIMESHEET PORTAL</p>
        <p className="text-[10px] text-slate-650 font-mono">
          Creado por David Ticino
        </p>
      </footer>

      {/* Change Password / Profile Configuration Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="bg-indigo-600 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-indigo-200" />
                <h3 className="font-sans font-bold text-base">
                  Configuración de Perfil
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsPasswordModalOpen(false);
                  setOldPassword("");
                  setNewPassword("");
                  setConfirmNewPassword("");
                  setPwError("");
                  setPwSuccess("");
                }}
                className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg p-1 transition cursor-pointer"
              >
                <span className="text-xl font-bold font-mono">×</span>
              </button>
            </div>

            {/* Content/Form */}
            <form onSubmit={handleProfileSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {pwError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{pwError}</span>
                </div>
              )}

              {pwSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs p-3 rounded-xl flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
                  <span>{pwSuccess}</span>
                </div>
              )}

              {/* Email Profile Input */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Correo Electrónico (Email)
                </label>
                <input
                  type="email"
                  value={profileEmail}
                  onChange={e => setProfileEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  placeholder="Ej. correo@empresa.com"
                />
                <span className="block text-[10px] text-slate-400">Opcional para recibir notificaciones</span>
              </div>

              {/* Phone Profile Input */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Teléfono de Contacto
                </label>
                <input
                  type="text"
                  value={profilePhone}
                  onChange={e => setProfilePhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  placeholder="Ej.  09X XXX XXX "
                />
                <span className="block text-[10px] text-slate-400">Opcional para asignación y contacto</span>
              </div>

              {/* Password Section */}
              <div className="border-t border-slate-200/50 pt-3">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Cambiar Contraseña (Opcional)</h4>
                
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Contraseña Actual
                    </label>
                    <input
                      type="password"
                      value={oldPassword}
                      onChange={e => setOldPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      placeholder="Sólamente si deseas cambiar tu clave"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Nueva Contraseña
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      placeholder="Mínimo 4 caracteres"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Confirmar Nueva Contraseña
                    </label>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={e => setConfirmNewPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-505/50"
                      placeholder="Repite la nueva contraseña"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsPasswordModalOpen(false);
                    setOldPassword("");
                    setNewPassword("");
                    setConfirmNewPassword("");
                    setPwError("");
                    setPwSuccess("");
                  }}
                  disabled={pwLoading}
                  className="w-1/2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs py-2.5 rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pwLoading}
                  className="w-1/2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 rounded-xl transition shadow-md shadow-indigo-600/10 cursor-pointer disabled:opacity-50"
                >
                  {pwLoading ? "Guardando..." : "Actualizar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
