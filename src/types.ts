export interface Day {
  id: number;
  date: string;
  reserved_count: number;
  max_capacity?: number;
}

export interface Plan {
  id: number;
  name: string;
  allowed_days: number;
  duration_days: number;
  price: number;
}

export interface UserPlan {
  id: number;
  user_id: string;
  plan_id: number;
  remaining_days: number;
  status: 'activo' | 'inactivo';
  created_at: string;
  plans?: {
    name: string;
    price?: number;
  };
}

export interface Booking {
  id: number;
  user_id: string;
  day_id: number;
  user_plan_id: number;
  created_at?: string;
  days?: Day;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'cliente';
}
