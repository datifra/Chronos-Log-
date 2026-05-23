/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent } from "react";
import { Project, ProjectStage, User } from "../types";
import { Plus, Trash, FolderPlus, Edit, Check, X, Calendar, DollarSign, Clock, Search, Lock, Unlock, AlertTriangle } from "lucide-react";

const PREDEFINED_STAGES = [
  "Selección de Cliente",
  "WTA",
  "Negociación y firma de contrato AGI",
  "AGI",
  "Negociación y firma de contrato de ejecución",
  "Proyecto de detalle interno",
  "Compra de Materiales",
  "Instalación de equipos",
  "M&V",
  "Financiero Contable",
  "Beneficios Eficiencia Energética",
  "Cierre"
];

interface ProjectManagerPanelProps {
  token: string;
  currentUser: User;
  projects: (Project & { stages: ProjectStage[] })[];
  onProjectUpdated: () => void;
  onEditingChange?: (isEditing: boolean) => void;
}

export default function ProjectManagerPanel({ token, currentUser, projects, onProjectUpdated, onEditingChange }: ProjectManagerPanelProps) {
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  // Search filter state
  const [searchQuery, setSearchQuery] = useState("");

  // Form states
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("2026-05-20");
  const [budgetedHours, setBudgetedHours] = useState<number>(100);
  const [budgetedCost, setBudgetedCost] = useState<number>(5000);
  const [stages, setStages] = useState<{ id?: number; name: string; budgetedHours: number; isOpen?: boolean }[]>(
    PREDEFINED_STAGES.map(name => ({ name, budgetedHours: 10, isOpen: true }))
  );

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [projectToDelete, setProjectToDelete] = useState<(Project & { stages: ProjectStage[] }) | null>(null);
  const [deleteConfirmCode, setDeleteConfirmCode] = useState("");
  const [confirmDeleteStageIdx, setConfirmDeleteStageIdx] = useState<number | null>(null);

  const [projectStats, setProjectStats] = useState<{ totalHours: number } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Stage deletion confirmation states & flow
  const [stageToDeleteIdx, setStageToDeleteIdx] = useState<number | null>(null);
  const [deleteConfirmStageName, setDeleteConfirmStageName] = useState("");
  const [stageToDeleteHours, setStageToDeleteHours] = useState<number | null>(null);
  const [loadingStageStats, setLoadingStageStats] = useState(false);

  const startStageDeleteFlow = async (idx: number) => {
    setStageToDeleteIdx(idx);
    setDeleteConfirmStageName("");
    setStageToDeleteHours(null);
    const stage = stages[idx];
    if (!stage.id || !editId) {
      setStageToDeleteHours(0);
      return;
    }
    setLoadingStageStats(true);
    try {
      const res = await fetch(`/api/projects/${editId}/stats`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const matched = data.hoursByStage?.find((h: any) => h.stageId === stage.id);
        setStageToDeleteHours(matched ? matched.hours : 0);
      }
    } catch (err) {
      console.error("Error fetching stage stats:", err);
      setStageToDeleteHours(0);
    } finally {
      setLoadingStageStats(false);
    }
  };

  const startDeleteFlow = async (proj: Project & { stages: ProjectStage[] }) => {
    setProjectToDelete(proj);
    setDeleteConfirmCode("");
    setProjectStats(null);
    setLoadingStats(true);
    try {
      const res = await fetch(`/api/projects/${proj.id}/stats`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProjectStats(data);
      }
    } catch (err) {
      console.error("Error fetching stats for deletion:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleAddStageRow = () => {
    setConfirmDeleteStageIdx(null);
    setStages([...stages, { name: "", budgetedHours: 10, isOpen: true }]);
  };

  const handleLoadPredefinedStages = () => {
    setConfirmDeleteStageIdx(null);
    // Distribute budgeted hours of the project across the 12 stages, minimum 5 hours per stage unless budgetedHours is 0
    const minHours = budgetedHours === 0 ? 0 : 5;
    const hoursPerStage = Math.max(minHours, Math.floor(budgetedHours / PREDEFINED_STAGES.length));
    const loaded = PREDEFINED_STAGES.map((name, idx) => {
      // Put remainder on the last stage
      const h = idx === PREDEFINED_STAGES.length - 1 
        ? Math.max(minHours, budgetedHours - (hoursPerStage * (PREDEFINED_STAGES.length - 1))) 
        : hoursPerStage;
      return {
        name,
        budgetedHours: h,
        isOpen: true
      };
    });
    setStages(loaded);
  };

  const handleRemoveStageRow = (idx: number) => {
    setConfirmDeleteStageIdx(null);
    const updated = [...stages];
    updated.splice(idx, 1);
    setStages(updated);
  };

  const handleStageChange = (idx: number, field: "name" | "budgetedHours", value: any) => {
    const updated = [...stages];
    updated[idx] = {
      ...updated[idx],
      [field]: field === "budgetedHours" ? Number(value) : value
    };
    setStages(updated);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!code || !name || !startDate || budgetedHours < 0 || budgetedCost < 0) {
      setErrorMessage("Por favor, introduce los valores válidos para las variables principales (incluido el código). El presupuesto y las horas deben ser cero o superiores.");
      return;
    }

    // Validar formato del proyecto (letras y números obligatorios)
    if (!/[a-zA-Z]/.test(code) || !/[0-9]/.test(code)) {
      setErrorMessage("El código de proyecto es obligatorio y debe contener letras y números (ej: PRY-101).");
      return;
    }

    if (stages.length === 0) {
      setErrorMessage("Todo proyecto debe tener al menos una etapa de desarrollo configurada.");
      return;
    }

    for (const s of stages) {
      if (!s.name || s.budgetedHours < 0) {
        setErrorMessage("Cada etapa requiere un nombre y horas presupuestadas válidas (cero o más).");
        return;
      }
    }

    // Verify stage hours don't mismatch too much or list warning (optional, but let's calculate sum)
    const totalStageHours = stages.reduce((acc, s) => acc + s.budgetedHours, 0);
    if (totalStageHours !== budgetedHours) {
      // Just adjust or warn
    }

    const payload = {
      code: code.trim().toUpperCase(),
      name,
      description,
      startDate,
      budgetedHours: Number(budgetedHours),
      budgetedCost: Number(budgetedCost),
      stages
    };

    try {
      const url = isEditing ? `/api/projects/${editId}` : "/api/projects";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Código de error inesperado en servidor");
      }

      setSuccessMessage(isEditing ? "Proyecto y variables actualizadas correctamente" : "Proyecto registrado exitosamente con sus correspondientes etapas.");
      onProjectUpdated();
      resetForm();
    } catch (err: any) {
      setErrorMessage(err.message || "Error al procesar el proyecto");
    }
  };

  const handleEdit = (project: Project & { stages: ProjectStage[] }) => {
    setIsEditing(true);
    setEditId(project.id);
    setCode(project.code || "");
    setName(project.name);
    setDescription(project.description);
    setStartDate(project.startDate);
    setBudgetedHours(project.budgetedHours);
    setBudgetedCost(project.budgetedCost);
    setStages(project.stages.map(s => ({ id: s.id, name: s.name, budgetedHours: s.budgetedHours, isOpen: s.isOpen !== false })));
    setIsOpenForm(true);
    onEditingChange?.(true);
    setTimeout(() => {
      document.getElementById("project-form-container")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handleDelete = async (id: number) => {
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al eliminar");
      }
      setSuccessMessage("Proyecto y dependencias relacionales eliminados correctamente.");
      onProjectUpdated();
      setProjectToDelete(null);
      setDeleteConfirmCode("");
    } catch (err: any) {
      setErrorMessage(err.message || "No se pudo eliminar el proyecto.");
    }
  };

  const resetForm = () => {
    setIsEditing(false);
    setEditId(null);
    setCode("");
    setName("");
    setDescription("");
    setStartDate("2026-05-20");
    setBudgetedHours(100);
    setBudgetedCost(5000);
    setStages(
      PREDEFINED_STAGES.map(name => ({ name, budgetedHours: 10, isOpen: true }))
    );
    setConfirmDeleteStageIdx(null);
    setIsOpenForm(false);
    onEditingChange?.(false);
  };

  // Filter projects by searchQuery (name, description, or project code!)
  const filteredProjects = projects.filter(proj => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (proj.code || "").toLowerCase().includes(q) ||
      proj.name.toLowerCase().includes(q) ||
      (proj.description || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm" id="project-manager-panel">
      {/* Header banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-6">
        <div>
          <h2 className="font-display font-bold text-xl text-slate-800 flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-indigo-600" />
            Configuración de Proyectos y Etapas
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Gestión y edición de variables presupuestarias, montos totales, fechas de inicio y estructura de etapas (foreign keys).
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsOpenForm(true);
          }}
          disabled={isEditing}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm px-4 py-2.5 rounded-xl transition flex items-center gap-2 shadow-sm cursor-pointer self-start md:self-auto disabled:opacity-40 disabled:cursor-not-allowed"
          type="button"
        >
          <Plus className="w-4 h-4" />
          Registrar Proyecto
        </button>
      </div>

      {/* Operations output */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-150 text-rose-700 text-xs p-3.5 rounded-xl mb-4 flex items-center gap-2">
          <X className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-150 text-emerald-700 text-xs p-3.5 rounded-xl mb-4 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Editor/Creation form */}
      {isOpenForm && (
        <form onSubmit={handleSubmit} id="project-form-container" className="bg-slate-50 rounded-2xl p-5 border border-slate-100 mb-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-150 pb-3">
            <h3 className="font-display font-semibold text-slate-800 text-sm">
              {isEditing ? "Editar Proyecto y Etapas Relacionales" : "Definición del Nuevo Proyecto"}
            </h3>
            <button
              onClick={resetForm}
              className="text-slate-400 hover:text-slate-600 p-1"
              type="button"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Primary Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Código del Proyecto *</label>
                <input
                  type="text"
                  placeholder="Ej. PRY-101 (Debe contener letras y números)"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase font-mono font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre del Proyecto *</label>
                <input
                  type="text"
                  placeholder="Ej. Sistema de Monitoreo IoT"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Fecha de Inicio *</label>
                <div className="relative">
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
                  />
                  <Calendar className="w-4 h-4 text-slate-300 absolute right-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Presupuesto (Horas) *</label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="Hours"
                      value={budgetedHours}
                      onChange={e => setBudgetedHours(Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Monto Presupuestado ($) *</label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="Monto"
                      value={budgetedCost}
                      onChange={e => setBudgetedCost(Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                    <DollarSign className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Descripción corta o ámbito</label>
              <textarea
                placeholder="Escribe una breve reseña del propósito del proyecto..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Stage Definition (Foreign Key elements) */}
            <div className="border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-600 block uppercase tracking-wider">
                  Etapas Integradas al Proyecto (Estructura Relacional)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddStageRow}
                    className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold text-xs px-2.5 py-1.5 rounded-lg border border-indigo-100 flex items-center gap-1 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Añadir Etapa
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {stages.map((stg, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <span className="text-xs font-semibold text-slate-450 w-6 text-center">#{i+1}</span>
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        value={PREDEFINED_STAGES.includes(stg.name) ? stg.name : (stg.name ? "otro" : "")}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === "otro") {
                            if (PREDEFINED_STAGES.includes(stg.name)) {
                              handleStageChange(i, "name", "");
                            }
                          } else {
                            handleStageChange(i, "name", val);
                          }
                        }}
                        className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 cursor-pointer"
                      >
                        <option value="">-- Seleccionar Etapa --</option>
                        {PREDEFINED_STAGES.map(pName => (
                          <option key={pName} value={pName}>{pName}</option>
                        ))}
                        <option value="otro">✍️ Escribir etapa personalizada...</option>
                      </select>

                      {(!PREDEFINED_STAGES.includes(stg.name) || stg.name === "" || stg.name === undefined) && (
                        <input
                          type="text"
                          placeholder="Nombre personalizado"
                          value={stg.name}
                          onChange={e => handleStageChange(i, "name", e.target.value)}
                          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      )}
                    </div>
                    <div className="relative w-36">
                      <input
                        type="number"
                        placeholder="Horas"
                        value={stg.budgetedHours}
                        onChange={e => handleStageChange(i, "budgetedHours", e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = [...stages];
                        updated[i] = {
                          ...updated[i],
                          isOpen: stg.isOpen === false ? true : false
                        };
                        setStages(updated);
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1 shrink-0 ${
                        stg.isOpen === false
                          ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                      }`}
                      title={stg.isOpen === false ? "Haz clic para abrir etapa" : "Haz clic para cerrar etapa"}
                    >
                      {stg.isOpen === false ? (
                        <>
                          <Lock className="w-3.5 h-3.5 text-rose-600" />
                          <span>Cerrada</span>
                        </>
                      ) : (
                        <>
                          <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Abierta</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => startStageDeleteFlow(i)}
                      disabled={stages.length <= 1}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition disabled:opacity-25 shrink-0"
                      title="Eliminar Etapa"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-3 text-right">
                <span className="font-mono text-xs text-slate-600 bg-slate-100/80 px-2.5 py-1 rounded-lg">
                  Suma total etapas: <span className="font-bold text-slate-800">{stages.reduce((acc, s) => acc + s.budgetedHours, 0)}h</span> / Presupuesto total: <span className="font-bold text-slate-800">{budgetedHours}h</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={resetForm}
              className="bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs px-4 py-2 rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-4 py-2 rounded-xl transition shadow-sm font-semibold cursor-pointer"
            >
              {isEditing ? "Guardar Cambios" : "Guardar Proyecto"}
            </button>
          </div>
        </form>
      )}

      {/* Directory of Projects */}
      <div className="border-t border-slate-100 pt-6 mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <h3 className="font-display font-semibold text-slate-700 text-sm">
            Listado de Proyectos Registrados ({filteredProjects.length})
          </h3>
          <div className="relative max-w-md w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por código, nombre..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              disabled={isEditing}
              className="w-full bg-slate-50 border border-slate-205 rounded-xl pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-100 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProjects.map(proj => (
            <div key={proj.id} className="border border-slate-100 rounded-xl p-4 space-y-3.5 hover:shadow-md hover:shadow-slate-50 transition bg-slate-50/50">
              <div>
                <div className="flex justify-between items-start gap-2">
                  <div>
                    {proj.code && (
                      <span className="inline-block font-mono text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded mb-1">
                        {proj.code}
                      </span>
                    )}
                    <h3 className="font-display font-bold text-slate-800 text-base leading-tight truncate">
                      {proj.name}
                    </h3>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => handleEdit(proj)}
                      disabled={isEditing}
                      className="p-1 px-1.5 text-slate-500 hover:text-indigo-600 bg-white border border-slate-100 rounded-lg transition text-xs flex items-center gap-1 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      title={isEditing ? "Edición en curso" : "Editar Variables y Etapas"}
                      type="button"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    {currentUser.role === "superuser" && (
                      <button
                        onClick={() => startDeleteFlow(proj)}
                        disabled={isEditing}
                        className="p-1 px-1.5 text-slate-400 hover:text-rose-600 bg-white border border-slate-100 rounded-lg transition text-xs flex items-center gap-1 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        title={isEditing ? "Edición en curso" : "Eliminar Completo"}
                        type="button"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-550 mt-1 line-clamp-2">
                  {proj.description || "Sin descripción cargada."}
                </p>
              </div>

            <div className="grid grid-cols-3 gap-2 bg-white/70 p-2.5 rounded-lg border border-slate-100 text-center">
              <div>
                <span className="block text-[9px] font-bold text-slate-400 uppercase">Inicio</span>
                <span className="font-mono text-xs text-slate-700 font-medium">{proj.startDate}</span>
              </div>
              <div>
                <span className="block text-[9px] font-bold text-slate-400 uppercase">Horas Estimadas</span>
                <span className="font-mono text-xs text-slate-700 font-medium">{proj.budgetedHours}h</span>
              </div>
              <div>
                <span className="block text-[9px] font-bold text-slate-400 uppercase">Monto Destinado</span>
                <span className="font-mono text-xs text-slate-700 font-semibold">${proj.budgetedCost.toLocaleString()}</span>
              </div>
            </div>

            {/* Display nested stages count and list tags */}
            <div>
              <span className="text-[10px] font-bold text-slate-450 block uppercase tracking-wider mb-1.5">
                Etapas definidas ({proj.stages.length})
              </span>
              <div className="flex flex-wrap gap-1">
                {proj.stages.map(stg => (
                  <span key={stg.id} className="text-[10px] bg-slate-105 border border-slate-200 font-mono text-slate-600 px-2 py-1 rounded-md flex items-center gap-1">
                    {stg.isOpen === false ? (
                      <Lock className="w-2.5 h-2.5 text-rose-600 inline-block shrink-0" />
                    ) : (
                      <Unlock className="w-2.5 h-2.5 text-emerald-600 inline-block shrink-0" />
                    )}
                    <span>{stg.name} ({stg.budgetedHours}h)</span>
                    <span className={`text-[8px] uppercase font-bold px-1 py-0.25 rounded ${
                      stg.isOpen === false ? "bg-rose-50 text-rose-600 border border-rose-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                    }`}>
                      {stg.isOpen === false ? "Cerrada" : "Abierta"}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}

        {filteredProjects.length === 0 && (
          <div className="col-span-2 py-10 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-400">
            No se encuentran proyectos que coincidan con la búsqueda. Presiona "Registrar Proyecto" para crear un nuevo registro.
          </div>
        )}
      </div>

      {/* Modal de confirmación crítica de eliminación de proyecto */}
      {projectToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-150 p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => {
                setProjectToDelete(null);
                setDeleteConfirmCode("");
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-50 transition"
              type="button"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-3.5 mb-4">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl animate-pulse">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-slate-900 text-lg">
                  ¿Eliminar Proyecto por Completo?
                </h3>
                <p className="text-xs text-rose-600 font-semibold mt-1">
                  Esta acción es irreversible y crítica.
                </p>
              </div>
            </div>

            {loadingStats ? (
              <div className="flex items-center justify-center py-6 text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-150 rounded-xl mb-5 animate-pulse">
                <Clock className="w-4 h-4 animate-spin mr-2 text-indigo-500" />
                Consultando volumen de horas registradas...
              </div>
            ) : (
              <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 text-xs text-rose-700 mb-5 leading-normal space-y-2 animate-in fade-in duration-150">
                <p>
                  ⚠️ <strong>¡ADVERTENCIA DE INTEGRIDAD REFERENCIAL!</strong> Al confirmar la eliminación, se borrará permanentemente toda la información relacionada con el proyecto <strong>"{projectToDelete.name}"</strong>:
                </p>
                <ul className="list-disc pl-4 space-y-1 font-medium">
                  <li>Su código identificador <strong>{projectToDelete.code}</strong>.</li>
                  <li>Todas las etapas registradas ({projectToDelete.stages?.length || 0} de desarrollo vinculadas).</li>
                  <li className="text-rose-800 font-bold">
                    El histórico de <span className="underline font-black">{projectStats?.totalHours ?? 0} horas</span> totales registradas por todos los colaboradores en sus planillas de tiempos, las cuales se depurarán primero de manera automática para evitar errores de restricción en base de datos.
                  </li>
                </ul>
              </div>
            )}

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                Paso obligatorio de seguridad: ingresa el código del proyecto <span className="font-mono text-xs font-black text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">{projectToDelete.code}</span> para confirmar:
              </label>
              <input
                type="text"
                value={deleteConfirmCode}
                onChange={e => setDeleteConfirmCode(e.target.value)}
                placeholder="Código del proyecto"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono font-black text-slate-800 uppercase tracking-widest placeholder:normal-case placeholder:font-sans placeholder:font-normal placeholder:tracking-normal"
                autoFocus
              />
            </div>

            <div className="flex items-center gap-2 mt-6 justify-end">
              <button
                type="button"
                onClick={() => {
                  setProjectToDelete(null);
                  setDeleteConfirmCode("");
                }}
                className="bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs font-semibold px-4 py-2.5 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deleteConfirmCode.trim().toUpperCase() === projectToDelete.code.trim().toUpperCase()) {
                    handleDelete(projectToDelete.id);
                  }
                }}
                disabled={deleteConfirmCode.trim().toUpperCase() !== projectToDelete.code.trim().toUpperCase()}
                className="bg-rose-600 hover:bg-rose-700 disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-md shadow-rose-100 cursor-pointer"
              >
                Eliminar Todo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación crítica de eliminación de etapa */}
      {stageToDeleteIdx !== null && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-150 p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => {
                setStageToDeleteIdx(null);
                setDeleteConfirmStageName("");
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-50 transition"
              type="button"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-3.5 mb-4">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl animate-pulse">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-slate-900 text-lg">
                  ¿Eliminar Etapa del Proyecto?
                </h3>
                <p className="text-xs text-rose-600 font-semibold mt-1">
                  Esta acción eliminará la etapa de la planificación.
                </p>
              </div>
            </div>

            {loadingStageStats ? (
              <div className="flex items-center justify-center py-6 text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-150 rounded-xl mb-5 animate-pulse">
                <Clock className="w-4 h-4 animate-spin mr-2 text-indigo-500" />
                Consultando horas registradas en esta etapa...
              </div>
            ) : (
              <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 text-xs text-rose-700 mb-5 leading-normal space-y-2 animate-in fade-in duration-150">
                <p>
                  ⚠️ <strong>¡ADVERTENCIA DE INTEGRIDAD REFERENCIAL!</strong> Al confirmar la eliminación, se borrará permanentemente toda la información relacionada con la etapa <strong>"{stages[stageToDeleteIdx]?.name || 'Sin nombre'}"</strong>:
                </p>
                <ul className="list-disc pl-4 space-y-1 font-medium">
                  <li>Se retirará la etapa de la configuración de este proyecto.</li>
                  {stageToDeleteHours !== null && stageToDeleteHours > 0 ? (
                    <li className="text-rose-800 font-bold">
                      El histórico de <span className="underline font-black">{stageToDeleteHours} horas</span> totales registradas por todos los colaboradores en sus planillas de tiempos de esta etapa se depurará de manera automática para evitar errores de restricción en base de datos.
                    </li>
                  ) : (
                    <li>Esta etapa no registra horas cargadas actualmente o es nueva.</li>
                  )}
                </ul>
              </div>
            )}

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                Paso obligatorio de seguridad: ingresa el nombre exacto de la etapa <span className="font-mono text-xs font-black text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">{stages[stageToDeleteIdx]?.name || 'Sin nombre'}</span> para confirmar:
              </label>
              <input
                type="text"
                value={deleteConfirmStageName}
                onChange={e => setDeleteConfirmStageName(e.target.value)}
                placeholder="Nombre de la etapa"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 font-semibold text-slate-800 placeholder:font-normal placeholder:font-sans"
                autoFocus
              />
            </div>

            <div className="flex items-center gap-2 mt-6 justify-end">
              <button
                type="button"
                onClick={() => {
                  setStageToDeleteIdx(null);
                  setDeleteConfirmStageName("");
                }}
                className="bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs font-semibold px-4 py-2.5 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deleteConfirmStageName.trim().toLowerCase() === (stages[stageToDeleteIdx]?.name || "").trim().toLowerCase()) {
                    handleRemoveStageRow(stageToDeleteIdx);
                    setStageToDeleteIdx(null);
                    setDeleteConfirmStageName("");
                  }
                }}
                disabled={deleteConfirmStageName.trim().toLowerCase() !== (stages[stageToDeleteIdx]?.name || "").trim().toLowerCase()}
                className="bg-rose-600 hover:bg-rose-700 disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-md shadow-rose-100 cursor-pointer"
              >
                Eliminar Etapa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
  );
}
