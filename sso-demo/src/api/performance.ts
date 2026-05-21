export interface Goal {
  id: string;
  employee_oid: string;
  manager_oid: string;
  title: string;
  description: string;
  target_date: string;
  status: string;
  progress_percent: number;
  created_at: string;
  updated_at: string;
  employee_name?: string;
  employee_email?: string;
  manager_name?: string;
}

export interface Review {
  id: string;
  employee_oid: string;
  reviewer_oid: string;
  review_period: string;
  rating: number;
  strengths: string;
  improvements: string;
  comments: string;
  created_at: string;
  employee_name?: string;
  employee_email?: string;
  reviewer_name?: string;
}

const API = (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

// Goals
export const getMyGoals = async (): Promise<{ goals: Goal[] }> => {
  const res = await fetch(`${API}/api/performance/goals/my`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch my goals");
  return res.json();
};

export const getEmployeeSummary = async (): Promise<{ summary: any[] }> => {
  const res = await fetch(`${API}/api/performance/employee-summary`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch employee summary");
  return res.json();
};

export const getTeamGoals = async (): Promise<{ goals: Goal[] }> => {
  const res = await fetch(`${API}/api/performance/goals/team`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch team goals");
  return res.json();
};

export const getAllGoals = async (): Promise<{ goals: Goal[] }> => {
  const res = await fetch(`${API}/api/performance/goals`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch all goals");
  return res.json();
};

export const createGoal = async (data: Partial<Goal>): Promise<{ goal: Goal }> => {
  const res = await fetch(`${API}/api/performance/goals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create goal");
  return res.json();
};

export const updateGoal = async (id: string, data: Partial<Goal>): Promise<{ goal: Goal }> => {
  const res = await fetch(`${API}/api/performance/goals/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update goal");
  return res.json();
};

// Reviews
export const getMyReviews = async (): Promise<{ reviews: Review[] }> => {
  const res = await fetch(`${API}/api/performance/reviews/my`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch my reviews");
  return res.json();
};

export const getTeamReviews = async (): Promise<{ reviews: Review[] }> => {
  const res = await fetch(`${API}/api/performance/reviews/team`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch team reviews");
  return res.json();
};

export const getAllReviews = async (): Promise<{ reviews: Review[] }> => {
  const res = await fetch(`${API}/api/performance/reviews`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch all reviews");
  return res.json();
};

export const createReview = async (data: Partial<Review>): Promise<{ review: Review }> => {
  const res = await fetch(`${API}/api/performance/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create review");
  return res.json();
};

export const getDirectReports = async (): Promise<{ employees: any[] }> => {
  const res = await fetch(`${API}/api/performance/direct-reports`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch direct reports");
  return res.json();
};
