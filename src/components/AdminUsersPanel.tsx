/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from "react";
import { User, UserRole } from "../types";
import { UserPlus, Edit, Trash2, Shield, Search, X, Check, Key } from "lucide-react";

interface AdminUsersPanelProps {
  token: string;
  currentUser: User;
  onEditingChange?: (isEditing: boolean) => void;
}

export default function AdminUsersPanel({ token, currentUser, onEditingChange }: AdminUsersPanelProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Form states
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error("No se pudieron cargar los usuarios");
      }
      const data = await res.json();
      setUsers(data);
    } catch (err: any) {
      setErrorMessage(err.message || "Error al obtener usuarios");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!username || !name || (!isEditing && !password)) {
      setErrorMessage("Por favor, completa todos los campos requeridos");
      return;
    }

    const payload: any = { username, name, role, email: email.trim(), phone: phone.trim() };
    if (password) payload.password = password;

    try {
      const url = isEditing ? `/api/users/${editId}` : "/api/users";
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
        throw new Error(data.error || "Operación fallida");
      }

      setSuccessMessage(isEditing ? "Usuario actualizado correctamente" : "Usuario creado correctamente");
      fetchUsers();
      resetForm();
    } catch (err: any) {
      setErrorMessage(err.message || "Ocurrió un error");
    }
  };

  const handleEdit = (user: User) => {
    setIsEditing(true);
    setEditId(user.id);
    setUsername(user.username);
    setName(user.name);
    setRole(user.role);
    setEmail(user.email || "");
    setPhone(user.phone || "");
    setPassword(""); // Clear password field for update
    setIsOpenForm(true);
    setErrorMessage("");
    setSuccessMessage("");
    onEditingChange?.(true);
    setTimeout(() => {
      document.getElementById("user-form-container")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handleDelete = async (id: number) => {
    if (id === 1) {
      setErrorMessage("No es posible eliminar al Administrador Principal.");
      return;
    }
    if (id === currentUser.id) {
      setErrorMessage("No puedes eliminar a tu propio usuario activo.");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error de eliminación");
      }
      setSuccessMessage("Usuario eliminado de la base de datos.");
      fetchUsers();
    } catch (err: any) {
      setErrorMessage(err.message || "Error en el servidor");
    }
  };

  const resetForm = () => {
    setIsEditing(false);
    setEditId(null);
    setUsername("");
    setPassword("");
    setName("");
    setRole("user");
    setEmail("");
    setPhone("");
    setIsOpenForm(false);
    onEditingChange?.(false);
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (u.phone && u.phone.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm" id="admin-users-panel">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-6">
        <div>
          <h2 className="font-display font-bold text-xl text-slate-800 flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600" />
            Gestión Central de Usuarios
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Administración segura de usuarios y asignación de niveles según el esquema jerárquico. Total: <span className="font-semibold text-indigo-600">{users.length} usuarios</span>.
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
          <UserPlus className="w-4 h-4" />
          Registrar Colaborador
        </button>
      </div>

      {/* Notifications */}
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

      {/* User Form Drawer/Card */}
      {isOpenForm && (
        <form onSubmit={handleSubmit} id="user-form-container" className="bg-slate-50 rounded-2xl p-5 border border-slate-100 mb-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-display font-semibold text-slate-800 text-sm">
              {isEditing ? "Modificar Datos del Usuario" : "Configurar Nuevo Colaborador"}
            </h3>
            <button
              onClick={resetForm}
              className="text-slate-400 hover:text-slate-600 p-1"
              type="button"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre Completo *</label>
              <input
                type="text"
                placeholder="Ej. Juan Pérez"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre de Usuario (Log-in) *</label>
              <input
                type="text"
                placeholder="Ej. jperez"
                value={username}
                onChange={e => setUsername(e.target.value)}
                disabled={isEditing && editId === 1}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                {isEditing ? "Contraseña nueva (opcional)" : "Contraseña de Acceso *"}
              </label>
              <div className="relative">
                <input
                  type="password"
                  placeholder={isEditing ? "Dejar vacío si no cambia" : "Ingresa contraseña"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <Key className="w-4 h-4 text-slate-300 absolute right-3 top-2.5" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Nivel de Seguridad / Rol *</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as UserRole)}
                disabled={isEditing && editId === 1}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
              >
                <option value="user">Usuario Estándar (Carga/Consulta Propio)</option>
                <option value="manager">Gestor / Editor de Proyectos</option>
                <option value="superuser">Superusuario (Control Total)</option>
              </select>
            </div>
          </div>

          <div className="border-t border-slate-200/60 pt-3">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Datos de Contacto (Opcionales)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Correo Electrónico (Email)</label>
                <input
                  type="email"
                  placeholder="Ej. jperez@empresa.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Teléfono de Contacto</label>
                <input
                  type="text"
                  placeholder="Ej. +34 600 123 456"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
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
              {isEditing ? "Guardar Cambios" : "Crear Registro"}
            </button>
          </div>
        </form>
      )}

      {/* Users Search and Directory List */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Filtrar por nombre, usuario o rol de seguridad..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            disabled={isEditing}
            className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {loading ? (
          <div className="space-y-2 py-4">
            <div className="h-10 bg-slate-100 rounded animate-pulse" />
            <div className="h-10 bg-slate-100 rounded animate-pulse" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  <th className="p-4 pl-5">Nombre Completo / Contacto</th>
                  <th className="p-4">Usuario</th>
                  <th className="p-4">Nivel de Seguridad</th>
                  <th className="p-4 text-right pr-5">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-400">
                      No se encontraron colaboradores que coincidan con la búsqueda
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/50">
                      <td className="p-4 pl-5">
                        <div className="font-semibold text-slate-800">{u.name}</div>
                        {(u.email || u.phone) && (
                          <div className="flex flex-col gap-0.5 mt-1 text-[10.5px] text-slate-500 font-sans">
                            {u.email && <span className="truncate" title="Email">✉ {u.email}</span>}
                            {u.phone && <span className="truncate" title="Teléfono">📞 {u.phone}</span>}
                          </div>
                        )}
                        {u.id === currentUser.id && (
                          <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.25 rounded-md mt-1 inline-block font-mono">
                            Sesión Activa
                          </span>
                        )}
                      </td>
                      <td className="p-4 font-mono text-xs text-slate-600">
                        {u.username}
                      </td>
                      <td className="p-4">
                        {u.role === "superuser" ? (
                          <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-1 rounded-lg border border-indigo-100">
                            Superusuario
                          </span>
                        ) : u.role === "manager" ? (
                          <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-1 rounded-lg border border-blue-100">
                            Gestor / Editor
                          </span>
                        ) : (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg border border-emerald-100">
                            Usuario Consulta
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right pr-5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEdit(u)}
                            disabled={isEditing}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title={isEditing ? "Edición en curso" : "Editar Usuario"}
                            type="button"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {confirmDeleteId === u.id ? (
                            <div className="flex items-center gap-1 bg-rose-50 border border-rose-100 p-0.5 rounded-lg">
                              <button
                                onClick={() => {
                                  handleDelete(u.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-1.5 py-0.5 text-[10px] font-bold text-rose-700 hover:bg-rose-100 rounded transition cursor-pointer"
                                type="button"
                              >
                                Sí
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-1.5 py-0.5 text-[10px] font-bold text-slate-500 hover:bg-slate-100 rounded transition cursor-pointer"
                                type="button"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(u.id)}
                              disabled={isEditing || u.id === 1 || u.id === currentUser.id}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                              title={isEditing ? "Edición en curso" : "Eliminar Usuario"}
                              type="button"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
