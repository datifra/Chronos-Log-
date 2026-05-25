/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Project, ProjectStage, TimeLog } from "../types";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { 
  Briefcase, 
  Clock, 
  Search, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  BookOpen,
  PieChart,
  User,
  ChevronDown,
  ChevronUp,
  FileText,
  FileSpreadsheet
} from "lucide-react";

interface ProjectSummaryPanelProps {
  projects: (Project & { stages: ProjectStage[] })[];
  timelogs: TimeLog[];
}

export default function ProjectSummaryPanel({ projects, timelogs }: ProjectSummaryPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedProjects, setExpandedProjects] = useState<Record<number, boolean>>({});
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingXLS, setIsExportingXLS] = useState(false);

  const toggleExpand = (projectId: number) => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }));
  };

  // Filter projects based on query
  const filteredProjects = projects.filter(p => {
    const term = searchQuery.toLowerCase().trim();
    if (!term) return true;
    return p.name.toLowerCase().includes(term) || (p.code || "").toLowerCase().includes(term);
  });

  // Calculate high level summaries
  const totalSystemHoursLogged = timelogs.reduce((sum, log) => sum + log.hours, 0);
  const totalSystemHoursEstimated = projects.reduce((sum, p) => sum + p.budgetedHours, 0);

  // Find projects that have exceeded their total estimated budget (excluding operational projects with 0 budget)
  const exceededProjectsCount = projects.filter(p => {
    if (p.budgetedHours === 0) return false;
    const logged = timelogs.filter(log => log.projectId === p.id).reduce((sum, log) => sum + log.hours, 0);
    return logged > p.budgetedHours;
  }).length;

  // Modern and professional PDF exporter
  const handleExportPDF = () => {
    try {
      setIsExporting(true);
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const currentDate = new Date().toLocaleString("es-ES", {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });

      // --- PAGE 1: COVER/OVERVIEW & GLOBAL METRICS ---
      doc.setFillColor(30, 41, 59); // Slate-800 background for top accent
      doc.rect(0, 0, 210, 35, "F");

      // Draw elegant title
      doc.setTextColor(255, 255, 255);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(18);
      doc.text("CONTRALORÍA DE PROYECTOS Y TIEMPOS", 14, 15);
      
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(203, 213, 225); // Slate-300
      doc.text(`Reporte Consolidado de Gestión • Nivel de Seguridad 2`, 14, 22);
      doc.text(`Generado el: ${currentDate}`, 14, 27);

      // Metricas Consolidadas Blocks
      doc.setFillColor(248, 250, 252); // Slate-50 background for KPI block
      doc.roundedRect(14, 45, 182, 30, 2, 2, "F");
      
      doc.setTextColor(71, 85, 105); // Slate-600
      doc.setFontSize(8);
      doc.setFont("Helvetica", "bold");
      doc.text("Métricas Totales del Sistema", 20, 52);

      // KPI numbers
      doc.setFontSize(14);
      doc.setTextColor(79, 70, 229); // Indigo text
      doc.text(`${totalSystemHoursLogged.toFixed(2)}h`, 20, 64);
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text("Horas Totales Cargadas", 20, 69);

      doc.setFontSize(14);
      doc.setTextColor(16, 185, 129); // Emerald-600
      doc.text(`${totalSystemHoursEstimated.toFixed(2)}h`, 80, 64);
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text("Presupuesto de Horas Estimado", 80, 69);

      doc.setFontSize(14);
      doc.setTextColor(217, 119, 6); // Amber-600
      doc.text(`${exceededProjectsCount} de ${projects.length}`, 140, 64);
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text("Proyectos que exceden presupuesto", 140, 69);

      // Divider
      doc.setDrawColor(226, 232, 240);
      doc.line(14, 82, 196, 82);

      // Title Section: Listado General de Proyectos
      doc.setFontSize(11);
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(15, 23, 42); // Slate-900
      doc.text("1. Resumen General de Proyectos", 14, 90);

      // Table 1: General Projects summary
      const summaryHeaders = [["CÓDIGO", "PROYECTO", "ESTIMADO (H)", "REAL CARGADO (H)", "% DESVIACIÓN", "COLABORADORES"]];
      const summaryRows = filteredProjects.map(project => {
        const projectLogs = timelogs.filter(log => log.projectId === project.id);
        const loggedHours = projectLogs.reduce((sum, log) => sum + log.hours, 0);
        const isOperational = project.budgetedHours === 0;
        const budgetedHours = isOperational ? 1 : project.budgetedHours;
        const deviationPercent = isOperational ? "N/A" : `${Math.round((loggedHours / budgetedHours) * 100)}%`;
        
        // Find list of active names
        const names = Array.from(new Set(projectLogs.map(l => l.userName || "Colaborador")));
        const namesText = names.length > 0 ? names.join(", ") : "Sin cargas";

        return [
          project.code || `ID: ${project.id}`,
          project.name,
          isOperational ? "Operativo (0h)" : `${project.budgetedHours}h`,
          `${loggedHours.toFixed(1)}h`,
          deviationPercent,
          namesText.length > 30 ? namesText.substring(0, 30) + "..." : namesText
        ];
      });

      autoTable(doc, {
        startY: 95,
        head: summaryHeaders,
        body: summaryRows,
        theme: "striped",
        headStyles: {
          fillColor: [79, 70, 229], // Indigo-600
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: "bold"
        },
        styles: {
          fontSize: 7.5,
          font: "Helvetica",
          cellPadding: 2.5
        },
        columnStyles: {
          0: { cellWidth: 20, fontStyle: "bold" },
          1: { cellWidth: 45 },
          2: { cellWidth: 22 },
          3: { cellWidth: 25 },
          4: { cellWidth: 22, fontStyle: "bold" },
          5: { cellWidth: 48 }
        }
      });

      // --- PAGE 2 ONWARDS: INDIVIDUAL PROJECTS STAGE WATERFALL BREAKDOWN ---
      filteredProjects.forEach((project, pIdx) => {
        doc.addPage();
        
        // Header elegant band for project
        doc.setFillColor(241, 245, 249); // Slate-100
        doc.rect(0, 0, 210, 28, "F");

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(15, 23, 42); // Slate-900
        const prjTitle = project.code ? `[${project.code.toUpperCase()}] ${project.name}` : project.name;
        doc.text(prjTitle, 14, 11);

        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`Descripción: ${project.description || "N/A"}`, 14, 17);
        doc.text(`Fecha Inicio: ${project.startDate || "No especificada"}`, 14, 22);

        // Calculate progress stats for this specific project
        const pLogs = timelogs.filter(log => log.projectId === project.id);
        const pLoggedSum = pLogs.reduce((sum, log) => sum + log.hours, 0);
        const isOperational = project.budgetedHours === 0;
        const pBudgeted = isOperational ? 1 : project.budgetedHours;
        const progressPct = isOperational ? 0 : Math.round((pLoggedSum / pBudgeted) * 100);

        // Overview metrics of selected project
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(14, 34, 182, 18, 1, 1, "D");

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        
        if (isOperational) {
          doc.text(`Tipo de Proyecto:`, 18, 41);
          doc.setFontSize(10);
          doc.setTextColor(79, 70, 229); // Indigo
          doc.text(`PROYECTO OPERATIVO — Carga horaria libre (Total cargado: ${pLoggedSum.toFixed(2)}h)`, 18, 47);
        } else {
          doc.text(`Consumo del Presupuesto del Proyecto:`, 18, 41);
          doc.setFontSize(10);
          const progressColor = pLoggedSum > pBudgeted ? [185, 28, 28] : [67, 56, 202]; // Red-700 or Indigo-700
          doc.setTextColor(progressColor[0], progressColor[1], progressColor[2]);
          doc.text(`${pLoggedSum.toFixed(2)}h de ${project.budgetedHours}h estimadas (${progressPct}% consumido)`, 18, 47);
        }

        // Project overall collaborator list
        const collaboratorsTotal: Record<string, number> = {};
        pLogs.forEach(lg => {
          const u = lg.userName || "Desconocido";
          collaboratorsTotal[u] = (collaboratorsTotal[u] || 0) + lg.hours;
        });

        // Write small block of collaborators
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text("Acumulado de Carga de Trabajo por Colaborador:", 14, 60);

        const colHeaders = [["COLABORADOR / USUARIO", "TOTAL HORAS CARGADAS A ESTE PROYECTO", "ESTATUS CONTRIBUCIÓN"]];
        const colRows = Object.entries(collaboratorsTotal).map(([user, h]) => {
          const ratio = ((h / (pLoggedSum || 1)) * 100).toFixed(0);
          return [user, `${h.toFixed(2)} horas`, `${ratio}% de aporte total`];
        });

        if (colRows.length > 0) {
          autoTable(doc, {
            startY: 64,
            head: colHeaders,
            body: colRows,
            theme: "grid",
            headStyles: { fillColor: [100, 116, 139] }, // Slate-500
            styles: { fontSize: 8, cellPadding: 2 }
          });
        } else {
          doc.setFont("Helvetica", "italic");
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text("Sin registros de asignación o cargas horarias por el personal.", 14, 66);
        }

        // Project stages table breakdown
        const tableStartY = colRows.length > 0 ? (doc as any).lastAutoTable.finalY + 12 : 74;

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text("Desglose Específico por Etapa e Hitos:", 14, tableStartY - 3);

        const stageHeaders = [["ETAPA DEL PROYECTO", "EST ESTIMADO (H)", "REAL CARGADO (H)", "% CONSUMO ETAPA", "ALERTAS / STATUS"]];
        const stageRows = project.stages.map((stg) => {
          const logsForStg = pLogs.filter(l => l.stageId === stg.id);
          const loggedForStg = logsForStg.reduce((sum, l) => sum + l.hours, 0);
          const isStgOperational = isOperational || stg.budgetedHours === 0;
          const stgBudgeted = isStgOperational ? 1 : stg.budgetedHours;
          const pct = isStgOperational ? "N/A" : `${Math.round((loggedForStg / stgBudgeted) * 100)}%`;
          
          let alertLabel = "ÓPTIMO";
          if (isStgOperational) {
            alertLabel = loggedForStg > 0 ? "ACTIVO" : "SIN INICIAR";
          } else {
            if (loggedForStg === 0) alertLabel = "SIN INICIAR";
            else if (loggedForStg > stgBudgeted) alertLabel = `DESVIADO (+${(loggedForStg - stg.budgetedHours).toFixed(1)}h)`;
            else if (loggedForStg === stgBudgeted) alertLabel = "COMPLETADO";
          }

          return [
            stg.name,
            isStgOperational ? "N/A" : `${stg.budgetedHours}h`,
            `${loggedForStg.toFixed(1)}h`,
            pct,
            alertLabel
          ];
        });

        autoTable(doc, {
          startY: tableStartY,
          head: stageHeaders,
          body: stageRows,
          theme: "grid",
          headStyles: { fillColor: [79, 70, 229] }, // Indigo color
          styles: { fontSize: 8, cellPadding: 2.5 },
          columnStyles: {
            0: { fontStyle: "bold" },
            3: { fontStyle: "bold" },
            4: { fontStyle: "bold" }
          },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 4) {
              const text = data.cell.text[0];
              if (text.startsWith("DESVIADO")) {
                data.cell.styles.textColor = [185, 28, 28]; // red
              } else if (text === "COMPLETADO") {
                data.cell.styles.textColor = [5, 150, 105]; // emerald
              } else if (text === "ÓPTIMO") {
                data.cell.styles.textColor = [79, 70, 229]; // indigo
              }
            }
          }
        });
      });

      // Save document with clean formatted name
      doc.save(`Consolidado_Proyectos_${currentDate.replace(/[\s,:]/g, "_")}.pdf`);
    } catch (err) {
      console.error("Error al exportar reporte PDF:", err);
      alert("Hubo un error inesperado al armar el reporte PDF. Revise la consola del navegador.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportXLS = () => {
    try {
      setIsExportingXLS(true);

      const currentDate = new Date().toLocaleString("es-ES", {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });

      // ---- TAB 1: RESUMEN GENERAL ----
      // KPI / Metrics Header
      const metaRows = [
        ["CONTRALORÍA DE PROYECTOS Y TIEMPOS - TIMESHEET"],
        ["Reporte Consolidado de Gestión • Exportado en Excel"],
        [`Fecha de Generación: ${currentDate}`],
        [],
        ["Métrica", "Valor"],
        ["Horas Totales Cargadas", totalSystemHoursLogged],
        ["Presupuesto de Horas Estimado", totalSystemHoursEstimated],
        ["Proyectos que exceden Presupuesto", `${exceededProjectsCount} de ${projects.length}`],
        [],
        ["1. RESUMEN GENERAL DE PROYECTOS"],
        ["CÓDIGO", "PROYECTO", "ESTIMADO (H)", "REAL CARGADO (H)", "% DESVIACIÓN", "COLABORADORES"]
      ];

      filteredProjects.forEach(project => {
        const projectLogs = timelogs.filter(log => log.projectId === project.id);
        const loggedHours = projectLogs.reduce((sum, log) => sum + log.hours, 0);
        const isOperational = project.budgetedHours === 0;
        const budgetedHours = isOperational ? 1 : project.budgetedHours;
        const deviationPercentActual = isOperational ? "N/A" : `${Math.round((loggedHours / budgetedHours) * 100)}%`;
        const names = Array.from(new Set(projectLogs.map(l => l.userName || "Colaborador")));
        const namesText = names.length > 0 ? names.join(", ") : "Sin cargas";

        metaRows.push([
          project.code || `ID: ${project.id}`,
          project.name,
          isOperational ? "Operativo (0h)" : project.budgetedHours.toString(),
          Number(loggedHours.toFixed(1)).toString() + "h",
          deviationPercentActual,
          namesText
        ]);
      });

      // create worksheet
      const wsSummary = XLSX.utils.aoa_to_sheet(metaRows);

      // ---- TAB 2: DESGLOSE POR ETAPA ----
      const stageRows = [
        ["DESGLOSE DETALLADO DE HITOS Y ETAPAS POR PROYECTO"],
        [`Fecha de Generación: ${currentDate}`],
        [],
        ["CÓDIGO PROYECTO", "NOMBRE PROYECTO", "Nº ETAPA", "ETAPA DEL PROYECTO", "EST. ESTIMADO (H)", "REAL CARGADO (H)", "% CONSUMO", "ALERTAS / STATUS", "COLABORADORES PARTICIPANTES"]
      ];

      filteredProjects.forEach(project => {
        const pLogs = timelogs.filter(log => log.projectId === project.id);
        const isOperational = project.budgetedHours === 0;
        
        project.stages.forEach((stg, sIdx) => {
          const logsForStg = pLogs.filter(l => l.stageId === stg.id);
          const loggedForStg = logsForStg.reduce((sum, l) => sum + l.hours, 0);
          const isStgOperational = isOperational || stg.budgetedHours === 0;
          const stgBudgeted = isStgOperational ? 1 : stg.budgetedHours;
          const pct = isStgOperational ? "N/A" : `${Math.round((loggedForStg / stgBudgeted) * 100)}%`;
          
          let alertLabel = "ÓPTIMO";
          if (isStgOperational) {
            alertLabel = loggedForStg > 0 ? "ACTIVO" : "SIN INICIAR";
          } else {
            if (loggedForStg === 0) alertLabel = "SIN INICIAR";
            else if (loggedForStg > stgBudgeted) alertLabel = `DESVIADO (+${(loggedForStg - stg.budgetedHours).toFixed(1)}h)`;
            else if (loggedForStg === stgBudgeted) alertLabel = "COMPLETADO";
          }

          const stageUsers = Array.from(new Set(logsForStg.map(l => l.userName || "Colaborador")));
          const stageUsersText = stageUsers.length > 0 ? stageUsers.join(", ") : "Sin cargas";

          stageRows.push([
            project.code || `ID: ${project.id}`,
            project.name,
            `Etapa ${sIdx + 1}`,
            stg.name,
            isStgOperational ? "N/A" : stg.budgetedHours.toString(),
            Number(loggedForStg.toFixed(1)).toString() + "h",
            pct,
            alertLabel,
            stageUsersText
          ]);
        });
      });

      const wsStages = XLSX.utils.aoa_to_sheet(stageRows);

      // ---- TAB 3: ASIGNACIONES DE COLABORADORES ----
      const colRows = [
        ["RESUMEN DE PARTICIPACIÓN DE COLABORADORES POR PROYECTO"],
        [`Generado el: ${currentDate}`],
        [],
        ["CÓDIGO PROYECTO", "NOMBRE PROYECTO", "COLABORADOR", "HORAS APORTADAS", "% DEL PROYECTO REGISTRADO"]
      ];

      filteredProjects.forEach(project => {
        const pLogs = timelogs.filter(log => log.projectId === project.id);
        const pLoggedSum = pLogs.reduce((sum, log) => sum + log.hours, 0);

        const collaboratorsTotal: Record<string, number> = {};
        pLogs.forEach(lg => {
          const u = lg.userName || "Desconocido";
          collaboratorsTotal[u] = (collaboratorsTotal[u] || 0) + lg.hours;
        });

        Object.entries(collaboratorsTotal).forEach(([usr, h]) => {
          const ratio = ((h / (pLoggedSum || 1)) * 100).toFixed(0);
          colRows.push([
            project.code || `ID: ${project.id}`,
            project.name,
            usr,
            Number(h.toFixed(2)).toString() + "h",
            `${ratio}%`
          ]);
        });
      });

      const wsCollaborators = XLSX.utils.aoa_to_sheet(colRows);

      // Assemble workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen General");
      XLSX.utils.book_append_sheet(wb, wsStages, "Etapas de Proyectos");
      XLSX.utils.book_append_sheet(wb, wsCollaborators, "Aporte Colaboradores");

      // Save spreadsheet
      XLSX.writeFile(wb, `Consolidado_Proyectos_${currentDate.replace(/[\s,:]/g, "_")}.xlsx`);

    } catch (err) {
      console.error("Error al exportar a Excel:", err);
      alert("Hubo un error inesperado al armar la planilla Excel.");
    } finally {
      setIsExportingXLS(false);
    }
  };

  return (
    <div className="space-y-6" id="project-summary-panel">
      {/* Informative Header Row */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="font-sans font-black text-lg text-slate-800 uppercase tracking-tight flex items-center gap-2">
            <PieChart className="w-5 h-5 text-indigo-600" />
            Resumen Consolidado de Proyectos
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Visualización integrada de horas estimadas vs cargadas por todos los usuarios para cada etapa y proyecto.
          </p>
        </div>

        {/* Filter search bar & Export PDF/XLS Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto shrink-0">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Filtrar por código o nombre..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-100 font-medium"
            />
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs px-4 py-2.5 rounded-xl transition flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-center shrink-0"
              type="button"
              title="Exporta todas las métricas de proyectos y etapas a reporte PDF profesional"
            >
              <FileText className="w-3.5 h-3.5" />
              {isExporting ? "Generando PDF..." : "Exportar Reporte PDF"}
            </button>

            <button
              onClick={handleExportXLS}
              disabled={isExportingXLS}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-4 py-2.5 rounded-xl transition flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-center shrink-0"
              type="button"
              title="Exporta todas las métricas de proyectos y etapas a planilla Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              {isExportingXLS ? "Generando XLS..." : "Exportar Reporte a XLS"}
            </button>
          </div>
        </div>
      </div>


      {/* Main projects breakdown */}
      <div className="space-y-4">
        {filteredProjects.map(project => {
          const projectLogs = timelogs.filter(log => log.projectId === project.id);
          const totalLoggedHours = projectLogs.reduce((sum, log) => sum + log.hours, 0);
          const isOperational = project.budgetedHours === 0;
          const budgetedHours = isOperational ? 1 : project.budgetedHours;
          const progressPercent = isOperational ? 0 : Math.min(100, Math.round((totalLoggedHours / budgetedHours) * 100));
          const isOverBudget = !isOperational && totalLoggedHours > budgetedHours;
          const isExpanded = !!expandedProjects[project.id];

          // Overall user breakdown for the whole project
          const projectUserBreakdown: Record<string, number> = {};
          projectLogs.forEach(log => {
            const uName = log.userName || "Desconocido";
            projectUserBreakdown[uName] = (projectUserBreakdown[uName] || 0) + log.hours;
          });

          // Hours logged on each stage of the project by all users
          const stagesDetails = project.stages.map(stage => {
            const logsForStage = projectLogs.filter(log => log.stageId === stage.id);
            const hoursOnStage = logsForStage.reduce((sum, log) => sum + log.hours, 0);
            
            // Group by user for extra details if expanded
            const userBreakdown: Record<string, number> = {};
            logsForStage.forEach(l => {
              const uName = l.userName || "Desconocido";
              userBreakdown[uName] = (userBreakdown[uName] || 0) + l.hours;
            });

            return {
              ...stage,
              hoursLogged: hoursOnStage,
              userBreakdown
            };
          });

          return (
            <div 
              key={project.id} 
              className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 transition overflow-hidden shadow-xs"
              id={`project-card-${project.id}`}
            >
              {/* Card Header Area */}
              <div 
                className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer select-none bg-slate-50/50 hover:bg-slate-50 transition"
                onClick={() => toggleExpand(project.id)}
              >
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {project.code && (
                      <span className="font-mono text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-150 px-2 py-0.5 rounded-md font-bold uppercase">
                        {project.code}
                      </span>
                    )}
                    <h3 className="font-sans font-extrabold text-sm text-slate-800 uppercase tracking-tight">
                      {project.name}
                    </h3>
                    {isOperational && (
                      <span className="text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded uppercase tracking-wider">
                        Operativo
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-455 line-clamp-1">{project.description}</p>

                  {/* Consolidado pequeño de personas que cargaron horas */}
                  {Object.keys(projectUserBreakdown).length > 0 ? (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-2 border-t border-slate-100">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                        <User className="w-2.5 h-2.5 text-slate-400" />
                        Colaboradores:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(projectUserBreakdown).map(([user, hr]) => (
                          <span 
                            key={user} 
                            className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-full px-2 py-0.5 text-[9px] font-medium text-slate-600 shadow-3xs"
                          >
                            <span className="truncate max-w-[80px] font-semibold">{user}</span>
                            <span className="font-mono font-bold text-indigo-650 bg-indigo-50/60 px-1 rounded-full text-[8.5px]">{hr.toFixed(1)}h</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-[9px] text-slate-400 italic pt-1.5 border-t border-slate-100/50">
                      Sin horas registradas aún por colaboradores
                    </div>
                  )}
                </div>

                {/* Performance stats & progress review */}
                <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                  {isOperational ? (
                    <div className="text-right">
                      <span className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider">Total de horas cargadas</span>
                      <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 block mt-0.5">
                        {totalLoggedHours.toFixed(2)} hrs
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="text-right">
                        <span className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider">Cargadas / Estimadas</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-mono font-bold ${isOverBudget ? 'text-amber-600' : 'text-slate-800'}`}>
                            {totalLoggedHours.toFixed(2)}h
                          </span>
                          <span className="text-slate-300 text-xs font-mono">/</span>
                          <span className="text-xs font-mono font-medium text-slate-500">
                            {project.budgetedHours}h
                          </span>
                        </div>
                      </div>

                      {/* Visual progress bar radial or standard */}
                      <div className="w-24 shrink-0">
                        <div className="flex justify-between text-[9px] font-bold text-slate-400 mb-1">
                          <span>Consumido</span>
                          <span className={isOverBudget ? 'text-amber-600' : 'text-indigo-600'}>{progressPercent}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-300 ${isOverBudget ? 'bg-amber-500' : 'bg-indigo-600'}`}
                            style={{ width: `${progressPercent}%` }}
                          ></div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Expand collapse action */}
                  <div className="text-slate-400">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </div>

              {/* Collapsed Detailed Stages Grid view */}
              {isExpanded && (
                <div className="border-t border-slate-100 p-5 bg-white space-y-4">
                  
                  {isOverBudget && (
                    <div className="bg-amber-500/10 border border-amber-500/30 text-amber-800 text-xs p-3.5 rounded-xl flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-bold">Alerta de Desviación de Horas:</strong> El proyecto ha superado las horas presupuestadas originalmente por un total de <span className="font-bold underline">{(totalLoggedHours - project.budgetedHours).toFixed(2)} horas</span>.
                      </div>
                    </div>
                  )}

                  {/* Title of detail */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-900 bg-indigo-50 px-2 py-1 rounded border border-indigo-100/50">
                      Desglose por Etapa ({stagesDetails.length} etapas)
                    </span>
                    <span className="text-[10.5px] font-medium text-slate-400">
                      Calculado sobre registros de {projectLogs.length} timelogs {isOperational ? "(Proyecto Operativo)" : ""}
                    </span>
                  </div>

                  {/* Stage Grid / Tables */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {stagesDetails.map((stage, sIdx) => {
                      const isStageOperational = isOperational || stage.budgetedHours === 0;
                      const stageEstimated = isStageOperational ? 1 : stage.budgetedHours;
                      const stageLoggedPercent = isStageOperational ? 0 : Math.round((stage.hoursLogged / stageEstimated) * 100);
                      const isStageExceeded = !isStageOperational && stage.hoursLogged > stage.budgetedHours;

                      return (
                        <div 
                          key={stage.id} 
                          className={`p-3.5 rounded-xl border transition-all ${isStageExceeded ? 'bg-amber-50/20 border-amber-200' : 'bg-slate-50/40 border-slate-150'}`}
                        >
                          <div className="flex justify-between items-start mb-2 gap-2">
                            <div className="min-w-0">
                              <span className="font-mono text-[9px] text-slate-400 uppercase font-bold block">Etapa #{sIdx + 1}</span>
                              <h4 className="text-xs font-bold text-slate-800 line-clamp-1 truncate" title={stage.name}>
                                {stage.name}
                              </h4>
                            </div>
                            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${isStageExceeded ? 'bg-amber-100 text-amber-700' : stage.hoursLogged > 0 ? 'bg-indigo-50 text-indigo-750' : 'bg-slate-100 text-slate-400'}`}>
                              {isStageOperational ? `${stage.hoursLogged.toFixed(1)}h` : `${stage.hoursLogged.toFixed(1)} / ${stage.budgetedHours}h`}
                            </span>
                          </div>

                          {/* Mini Progress Bar */}
                          {!isStageOperational ? (
                            <div className="space-y-1">
                              <div className="w-full bg-slate-200/60 rounded-full h-1.5">
                                <div 
                                  className={`h-1.5 rounded-full transition-all duration-300 ${isStageExceeded ? 'bg-amber-500' : 'bg-indigo-500'}`}
                                  style={{ width: `${Math.min(100, stageLoggedPercent)}%` }}
                                ></div>
                              </div>
                              <div className="flex justify-between text-[8.5px] font-semibold text-slate-400">
                                <span>Consumo etapa</span>
                                <span className={isStageExceeded ? 'text-amber-600 font-bold' : 'text-slate-500'}>
                                  {stageLoggedPercent}% {isStageExceeded && "⚠️"}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-[9.5px] text-slate-400 bg-slate-100 px-2 py-1 rounded inline-block font-medium">
                              Etapa con carga libre / Operativo
                            </div>
                          )}

                          {/* Users who logged hours detail */}
                          {Object.keys(stage.userBreakdown).length > 0 ? (
                            <div className="mt-3 pt-2.5 border-t border-slate-200/50">
                              <span className="text-[8px] uppercase tracking-wider font-bold text-slate-400 block mb-1">
                                Participación por Colaborador:
                              </span>
                              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                                {Object.entries(stage.userBreakdown).map(([user, hr]) => (
                                  <div key={user} className="flex justify-between items-center text-[9px]">
                                    <span className="text-slate-500 truncate max-w-[100px] flex items-center gap-1">
                                      <User className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                      {user}
                                    </span>
                                    <span className="font-mono font-bold text-slate-700">{hr.toFixed(2)}h</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="mt-2.5 text-[8.5px] text-slate-400 italic">
                              Sin registros de colaboradores aún.
                            </div>
                          )}

                        </div>
                      );
                    })}
                  </div>

                </div>
              )}
            </div>
          );
        })}

        {filteredProjects.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 font-medium text-xs">
            Ningún proyecto coincide con la búsqueda "{searchQuery}".
          </div>
        )}
      </div>
    </div>
  );
}
