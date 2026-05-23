/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock } from "lucide-react";
import { TimeLog } from "../types";

interface CalendarWidgetProps {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  timelogs: TimeLog[];
}

export default function CalendarWidget({ selectedDate, onSelectDate, timelogs }: CalendarWidgetProps) {
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(4); // May (0-indexed, so 4 is May)

  // Align active visible month with selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      const parts = selectedDate.split("-");
      if (parts.length === 3) {
        const year = Number(parts[0]);
        const month = Number(parts[1]) - 1; // 0-indexed month
        if (!isNaN(year) && !isNaN(month) && month >= 0 && month <= 11) {
          setCurrentYear(year);
          setCurrentMonth(month);
        }
      }
    }
  }, [selectedDate]);

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const daysOfWeek = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  // Helper code to get days of the current month
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const daysCount = getDaysInMonth(currentYear, currentMonth);
  const firstDayIndex = getFirstDayOfMonth(currentYear, currentMonth);

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  // Build grid representation
  const calendarGrid = [];
  // Fill empty leading boxes
  for (let i = 0; i < firstDayIndex; i++) {
    calendarGrid.push(null);
  }
  // Fill month days
  for (let i = 1; i <= daysCount; i++) {
    calendarGrid.push(i);
  }

  // Calculate hours parsed per YYYY-MM-DD for visual badges
  const getHoursForDay = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const logs = timelogs.filter(t => t.date === dateStr);
    return logs.reduce((sum, log) => sum + log.hours, 0);
  };

  const handleSelectDay = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onSelectDate(dateStr);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden" id="calendar-widget-card">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 p-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-indigo-600" />
          <h2 className="font-display font-semibold tracking-tight text-slate-800 text-base">
            {monthNames[currentMonth]} {currentYear}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="p-1 px-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition"
            title="Mes Anterior"
            type="button"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={nextMonth}
            className="p-1 px-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition"
            title="Siguiente Mes"
            type="button"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="p-5">
        {/* Days Header */}
        <div className="grid grid-cols-7 gap-1.5 text-center mb-3">
          {daysOfWeek.map(day => (
            <div key={day} className="text-[11px] font-bold text-slate-400 uppercase tracking-widest py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {calendarGrid.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="aspect-square bg-slate-50/50 rounded-xl border border-dashed border-slate-100" />;
            }

            const formattedDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isSelected = selectedDate === formattedDate;
            const hoursOnDay = getHoursForDay(day);

            // Highlight color depending on selected or whether it has hours
            let cellStyle = "aspect-square rounded-xl flex flex-col items-center justify-between p-2 transition text-sm font-medium relative hover:bg-slate-50 cursor-pointer border border-slate-100 bg-white";
            const isTargetHours = hoursOnDay >= 7.25;

            if (isSelected) {
              if (isTargetHours) {
                cellStyle = "aspect-square rounded-xl flex flex-col items-center justify-between p-2 transition text-sm font-semibold relative bg-emerald-600 text-white shadow-lg shadow-emerald-100 border border-emerald-700 cursor-pointer";
              } else {
                cellStyle = "aspect-square rounded-xl flex flex-col items-center justify-between p-2 transition text-sm font-semibold relative bg-indigo-600 text-white shadow-lg shadow-indigo-100 border border-indigo-700 cursor-pointer";
              }
            } else if (hoursOnDay > 0) {
              if (isTargetHours) {
                cellStyle = "aspect-square rounded-xl flex flex-col items-center justify-between p-2 transition text-sm font-semibold relative bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 cursor-pointer";
              } else {
                cellStyle = "aspect-square rounded-xl flex flex-col items-center justify-between p-2 transition text-sm font-semibold relative bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 cursor-pointer";
              }
            }

            return (
              <div
                key={day}
                onClick={() => handleSelectDay(day)}
                className={cellStyle}
                style={{ minHeight: '56px' }}
                id={`day-cell-${formattedDate}`}
              >
                {/* Numeric day */}
                <span className={`text-[13px] font-bold ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                  {day}
                </span>

                {/* Hour indicator badge */}
                {hoursOnDay > 0 && (
                  <div className={`mt-auto text-[9px] px-1.5 flex items-center gap-0.5 rounded-full font-mono font-bold py-0.5 ${isSelected ? (isTargetHours ? 'bg-emerald-500 text-white' : 'bg-indigo-500 text-white') : (isTargetHours ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700')}`}>
                    <span>{hoursOnDay}h</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-3 gap-1 text-[10px] font-medium text-slate-500">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-indigo-50 border border-indigo-100 inline-block" />
            <span>Horas (&lt; 7.25h)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-50 border border-emerald-100 inline-block" />
            <span>Día Completo (&ge; 7.25h)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-indigo-600 inline-block" />
            <span>Seleccionado</span>
          </div>
        </div>
      </div>
    </div>
  );
}
