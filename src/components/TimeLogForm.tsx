/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { Project, ProjectStage, User } from "../types";
import { Clock, Plus, BookOpen, User as UserIcon, Calendar, Check, AlertCircle, Sparkles } from "lucide-react";

interface TimeLogFormProps {
  token: string;
  selectedDate: string; // YYYY-MM-DD
  projects: (Project & { stages: ProjectStage[] })[];
  currentUser: User;
  onLogCreated: () => void;
  // If managers/admins are logging, they might select which user to load hours for
  usersList?: User[];
  selectedProjectId: number | "";
  onProjectChange: (id: number | "") => void;
  timelogs: any[];
}

export default function TimeLogForm({
  token,
  selectedDate,
  projects,
  currentUser,
  onLogCreated,
  usersList = [],
  selectedProjectId,
  onProjectChange,
  timelogs
}: TimeLogFormProps) {
  const projectId = selectedProjectId;
  const [stageId, setStageId] = useState<number | "">("");
  const [hours, setHours] = useState<number | "">("");
  const [description, setDescription] = useState("");
  const [targetUserId, setTargetUserId] = useState<number>(currentUser.id);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-reset targetUserId if currentUser changes
  useEffect(() => {
    setTargetUserId(currentUser.id);
  }, [currentUser]);

  // Keep track of the last selected project id to only reset stageId on actual user manual changes
  const [prevProjectId, setPrevProjectId] = useState<number | "">(selectedProjectId);

  useEffect(() => {
    if (selectedProjectId !== prevProjectId) {
      setStageId("");
      setPrevProjectId(selectedProjectId);
    }
  }, [selectedProjectId, prevProjectId]);

  // Find active project's stages to filter them out for foreign key check
  const activeProject = projects.find(p => p.id === Number(projectId));
  const stagesForProject = activeProject ? activeProject.stages : [];

  // Reset stage selection when project changes
  const handleProjectChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const nextProjectId = e.target.value === "" ? "" : Number(e.target.value);
    onProjectChange(nextProjectId);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!projectId || !stageId || !hours) {
      setErrorMessage("Los campos Proyecto, Etapa y Cantidad de Horas son requeridos");
      return;
    }

    const chosenStage = stagesForProject.find(s => s.id === Number(stageId));
    if (chosenStage && chosenStage.isOpen === false) {
      setErrorMessage("La etapa seleccionada se encuentra cerrada para modificaciones.");
      return;
    }

    if (Number(hours) <= 0 || Number(hours) > 24) {
      setErrorMessage("La cantidad de horas debe estar entre 0.1 y 24 horas diarias");
      return;
    }

    setIsSubmitting(true);

    const payload = {
      projectId: Number(projectId),
      stageId: Number(stageId),
      date: selectedDate,
      hours: Number(hours),
      description: description.trim(),
      userId: targetUserId
    };

    try {
      const res = await fetch("/api/timelogs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al registrar tiempo");
      }

      setSuccessMessage("¡Registro de tiempo cargado con éxito!");
      setHours("");
      setDescription("");
      onLogCreated();

      // Clear success banner after 3 seconds
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || "Error al comunicarse con el servidor");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sum hours logged by selected user on selectedDate
  const targetUserLogs = timelogs.filter(
    log => log.userId === targetUserId && log.date === selectedDate
  );
  const totalLoggedToday = targetUserLogs.reduce((acc, curr) => acc + curr.hours, 0);
  const remainingHours = Math.max(0, 7.25 - totalLoggedToday);

  // Find VARIOS project and stage
  const variosProject = projects.find(
    p => p.code?.toUpperCase() === "VARIOS" || p.name?.toUpperCase() === "VARIOS"
  );
  const variosStage = variosProject?.stages.find(
    s => s.name?.toUpperCase() === "VARIOS"
  );

  const handleAutoFillVarios = () => {
    if (!variosProject) {
      setErrorMessage("No se encontró el proyecto VARIOS en el sistema. Asegúrate de crearlo.");
      return;
    }
    if (!variosStage) {
      setErrorMessage("No se encontró la etapa VARIOS para el proyecto VARIOS.");
      return;
    }

    onProjectChange(variosProject.id);
    setPrevProjectId(variosProject.id);
    setStageId(variosStage.id);
    setHours(remainingHours);
    setDescription("VARIOS");
    setErrorMessage("");
    setSuccessMessage("¡Campos de VARIOS completados con éxito!");
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  const isRoleElevated = currentUser.role === "superuser" || currentUser.role === "manager";  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm" id="time-log-form-card">
      <div className="border-b border-slate-100 pb-3 mb-4 flex items-center justify-between">
        <h2 className="font-display font-semibold text-slate-800 text-sm flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-600" />
          Cargar Horas Trabajadas
        </h2>
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg text-slate-600 text-[11px] font-mono font-medium">
          <Calendar className="w-3.5 h-3.5 text-indigo-505" />
          <span>{selectedDate}</span>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs p-3 rounded-xl mb-4 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs p-3 rounded-xl mb-4 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Dynamic user assignment if Superuser/Manager */}
        {isRoleElevated && usersList.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1">
              <UserIcon className="w-3 h-3 text-indigo-500" />
              Asignar horas a Colaborador
            </label>
            <select
              value={targetUserId}
              onChange={e => setTargetUserId(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              {usersList.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.username} - {u.role})
                </option>
              ))}
            </select>
          </div>
        )}        {/* 1. Project Selection */}
        <div className="space-y-3 bg-indigo-50/20 border border-indigo-100/30 p-3 rounded-2xl">
          <span className="block text-xs font-bold text-indigo-900 tracking-wide uppercase">
            Seleccionar Proyecto *
          </span>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1">
                Buscar por Código
              </label>
              <select
                value={projectId}
                onChange={handleProjectChange}
                className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-100 text-slate-700 cursor-pointer"
              >
                <option value="">-- Por Código --</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.code || `[ID: ${p.id}]`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1">
                Buscar por Nombre
              </label>
              <select
                value={projectId}
                onChange={handleProjectChange}
                className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-100 text-slate-700 cursor-pointer"
              >
                <option value="">-- Por Nombre --</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name.length > 50 ? p.name.substring(0, 50) + "..." : p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 2. Project Stage Selection (Nested Foreign Key check) */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            Etapa de Proyecto correspondiente *
          </label>
          <select
            value={stageId}
            onChange={e => setStageId(e.target.value === "" ? "" : Number(e.target.value))}
            disabled={!projectId}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100 disabled:text-slate-400 text-slate-750"
          >
            <option value="">
              {!projectId ? "<- Selecciona primero el proyecto" : "-- Elegir Etapa --"}
            </option>
            {stagesForProject.map(s => (
              <option key={s.id} value={s.id} disabled={s.isOpen === false}>
                {s.name}{s.isOpen === false ? " 🔒 [Cerrada para modificar]" : ""}
              </option>
            ))}
          </select>
        </div>

        {/* 3. Hours Load Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Cantidad de Horas *</label>
          <div className="relative">
            <input
              type="number"
              step="0.25"
              min="0.25"
              max="24"
              placeholder="Ej. 7.25"
              value={hours}
              onChange={e => setHours(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <Clock className="w-4 h-4 text-slate-400 absolute left-2.5 top-3.5" />
          </div>
          <span className="block text-[10px] text-slate-400 mt-1 font-medium">
            Permite múltiplos de 0.25 (Ej. 0.25, 1.50, 7.25, 8.00)
          </span>
        </div>

        {/* 4. Description Note */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">
            Descripción de tareas realizadas
          </label>
          <div className="relative">
            <textarea
              placeholder="Detalla qué hitos completaste en esta etapa..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              maxLength={200}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <BookOpen className="w-4 h-4 text-slate-400 absolute left-2.5 top-3.5" />
          </div>
          <span className="block text-[10px] text-slate-400 text-right mt-1 font-mono">
            {description.length}/200 caracteres
          </span>
        </div>

        <div className="pt-2 space-y-3">
          <button
            type="button"
            onClick={handleAutoFillVarios}
            disabled={totalLoggedToday >= 7.25}
            className="w-full bg-emerald-50 hover:bg-emerald-100 disabled:hover:bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-semibold text-xs py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed"
            title="Auto-completar campos con proyecto VARIOS, etapa VARIOS y horas del remanente diario"
          >
            <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
            Completar con Varios ({remainingHours > 0 ? `${remainingHours.toFixed(2)} Hrs` : "0 Hrs"} restan)
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm py-3 px-4 rounded-xl transition shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {isSubmitting ? "Cargando..." : "Confirmar Registros"}
          </button>
        </div>
      </form>
    </div>
  );
}
