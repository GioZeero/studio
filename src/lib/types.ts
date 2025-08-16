export type DayOfWeek = 'Lunedì' | 'Martedì' | 'Mercoledì' | 'Giovedì' | 'Venerdì' | 'Sabato' | 'Domenica';

export interface Slot {
  id: string;
  timeRange: string;
  bookedBy: string[];
  createdBy?: string;
}

export interface DaySchedule {
  day: DayOfWeek;
  morning: Slot[];
  afternoon: Slot[];
  isOpen: boolean;
}

export interface User {
  name: string;
  role: 'owner' | 'client';
  subscriptionExpiry?: string;
  isBlocked?: boolean;
  previousName?: string;
  subscriptionStatus?: 'active' | 'suspended';
}

export interface ClientData extends User {
  id: string;
}

export interface Expense {
  id: string;
  name: string;
  cost: number;
  date: string; // ISO String
}

export interface Goal {
  id: string;
  name: string;
  cost: number;
  status: 'active' | 'completed';
  createdAt: string; // ISO String
  completedAt?: string; // ISO String
}
