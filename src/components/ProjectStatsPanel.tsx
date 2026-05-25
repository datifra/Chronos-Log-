/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Clock, User } from "lucide-react";
import { ProjectStats } from "../types";

interface ProjectStatsPanelProps {
  stats: ProjectStats | null;
  loading: boolean;
}

export default function ProjectStatsPanel({ stats, loading }: ProjectStatsPanelProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm animate-pulse space-y-4">
        <div className="h-6 w-1/3 bg-slate-200 rounded" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-xl" />
          ))}
        </div>
        <div className="h-32 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm text-center flex flex-col items-center justify-center min-h-[160px]">
        <Clock className="w-10 h-10 text-slate-300 mb-3 stroke-1 animate-pulse" />
        <h3 className="font-display font-semibold text-slate-700 text-sm mb-1">Cálculo Relacional de Tiempos</h3>
        <p className="text-xs text-slate-450 max-w-sm leading-relaxed">
          Selección de proyecto inactiva. Selecciona un proyecto en el bloque superior de <strong>Cargar Horas Trabajadas</strong> para visualizar su desvío presupuestario y avance de horas en tiempo real.
        </p>
      </div>
    );
  }

  // Calculate executed vs budgeted hours percentage
  const isOperational = stats.budgetedHours === 0;
  const hourPercent = isOperational ? 0 : (Math.min(100, Math.round((stats.totalHours / (stats.budgetedHours || 1)) * 100)) || 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id={`project-stats-panel-${stats.projectId}`}>
      
      {/* Selection & Global Hito Panel (Left side of Stats Bento, col-span-4) */}
      <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
        <div>
          <span className="text-[10px] font-bold text-indigo-650 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-100 uppercase tracking-wider">
            Hito / Detalle de Selección
          </span>
          <h2 className="font-display font-black text-2xl text-slate-800 tracking-tight mt-3">
            {stats.projectName}
          </h2>
          <p className="text-xs text-slate-450 mt-1 line-clamp-2">
            Control de desviación de horas presupuestadas contra facturación real de tareas integradas.
          </p>
        </div>

        <div className="pt-6 mt-6 border-t border-slate-100 space-y-4">
          {isOperational ? (
            <div className="space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Proyecto Operativo</span>
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-xl inline-block mt-0.5">
                Carga Libre • Sin Límite Estimado
              </span>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-semibold uppercase tracking-wider">Ejecución del Presupuesto</span>
                <span className="font-mono font-bold text-indigo-600">{stats.totalHours} / {stats.budgetedHours}h</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${hourPercent}%` }}></div>
              </div>
            </>
          )}
          <div className="flex justify-between text-[11px] font-medium pt-1">
            <span className="text-slate-400">Iniciado: Hace {stats.daysSinceStart || 1} días</span>
            <span className="text-indigo-600 font-bold">{stats.daysSinceStart} días transcurridos</span>
          </div>
        </div>
      </div>

      {/* Hour statistics progress bars - Dark Theme Bento Card (Middle, col-span-5) */}
      <div className="lg:col-span-5 bg-slate-900 text-white rounded-2xl p-6 flex flex-col justify-between shadow-lg">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Horas por Etapa</h3>
            <span className="text-[9px] bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-mono">
              {isOperational ? "Carga de Tiempos" : "Real vs Presupuestado"}
            </span>
          </div>
          
          <div className="space-y-3.5">
            {stats.hoursByStage.map(stg => {
              const stgOperational = isOperational || stg.budgetedHours === 0;
              const stagePercent = stgOperational ? 0 : (Math.min(100, Math.round((stg.hours / (stg.budgetedHours || 1)) * 100)) || 0);
              let barColor = "bg-indigo-400";
              if (stagePercent > 100) barColor = "bg-rose-500";
              else if (stagePercent === 100) barColor = "bg-emerald-400";
              else if (stagePercent > 80) barColor = "bg-amber-400";

              return (
                <div key={stg.stageId} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-200">{stg.stageName}</span>
                    <span className="text-slate-400 font-mono">
                      {stgOperational ? `${stg.hours}h` : `${stg.hours} / ${stg.budgetedHours}h`} {stagePercent >= 100 && !stgOperational && <span className="text-emerald-400">✓</span>}
                    </span>
                  </div>
                  {!stgOperational ? (
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${stagePercent}%` }}></div>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-400 block pb-1">Etapa libre sin presupuesto</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800/80">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Costo Relacional Proyectado</span>
            <span className="text-lg font-black text-white font-mono">
              {!isOperational && stats.budgetedCost > 0 ? `$${stats.budgetedCost.toLocaleString("es-AR")}` : "N/A"}
            </span>
          </div>
        </div>
      </div>

      {/* Right column of stats bento (col-span-3): Quick Stats Cards */}
      <div className="lg:col-span-3 flex flex-col gap-4">
        {/* Tu Actividad Semanal average hour load stats */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex-1 flex flex-col justify-center">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Tu Actividad Semanal</p>
          <div className="flex items-end gap-1.5 h-14 mb-3">
            <div className="bg-indigo-100 h-[60%] w-full rounded-t-lg"></div>
            <div className="bg-indigo-200 h-[80%] w-full rounded-t-lg"></div>
            <div className="bg-indigo-500 h-[100%] w-full rounded-t-lg"></div>
            <div className="bg-indigo-300 h-[40%] w-full rounded-t-lg"></div>
            <div className="bg-indigo-150 h-[20%] w-full rounded-t-lg"></div>
          </div>
          <p className="text-xl font-extrabold text-slate-800 font-sans tracking-tight">
            {stats.totalHours} <span className="text-xs font-normal text-slate-400 block mt-0.5">horas cargadas</span>
          </p>
        </div>

        {/* Quick Average deviation card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Medición / Desvío Diario</p>
          <div>
            <span className="text-2xl font-black text-slate-850 font-mono">
              {Math.round(stats.totalHours / (stats.daysSinceStart || 1))} hs/d
            </span>
            <p className="text-[10px] text-slate-400 mt-1">Carga promedio por día calendario.</p>
          </div>
        </div>
      </div>

    </div>
  );
}
