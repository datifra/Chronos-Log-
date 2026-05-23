/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'superuser' | 'manager' | 'user';

export interface User {
  id: number;           // Primary Key
  username: string;     // Unique index
  name: string;
  role: UserRole;
  email?: string;
  phone?: string;
}

export interface Project {
  id: number;           // Primary Key
  code: string;         // Project Code
  name: string;
  description: string;
  startDate: string;    // YYYY-MM-DD
  budgetedHours: number;
  budgetedCost: number; // Total budget amount ($ / hours budget equivalence)
}

export interface ProjectStage {
  id: number;           // Primary Key
  projectId: number;    // Foreign Key -> Project.id
  name: string;
  budgetedHours: number;
  isOpen?: boolean;     // Se define si la etapa está abierta para modificaciones
}

export interface TimeLog {
  id: number;           // Primary Key
  userId: number;       // Foreign Key -> User.id
  projectId: number;    // Foreign Key -> Project.id
  stageId: number;      // Foreign Key -> ProjectStage.id
  date: string;         // YYYY-MM-DD
  hours: number;
  description: string;
  userName?: string;
  projectName?: string;
  projectCode?: string;
  stageName?: string;
  stageIsOpen?: boolean;
}

// Stats interface returned when searching/selecting a project
export interface ProjectStats {
  projectId: number;
  projectName: string;
  totalHours: number;
  hoursByStage: {
    stageId: number;
    stageName: string;
    hours: number;
    budgetedHours: number;
  }[];
  budgetedCost: number;
  budgetedHours: number;
  daysSinceStart: number;
}

export interface AuthResponse {
  token: string;
  user: User;
}
