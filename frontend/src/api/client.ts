// In production (Vercel), leave empty so requests go to the same origin and
// are proxied to the backend via vercel.json rewrites.
// In local dev, use VITE_API_URL (e.g. http://localhost:8000).
const API_BASE = import.meta.env.VITE_API_URL ?? '';

// Token getter — set by AuthContext after Auth0 authenticates
let _getToken: (() => Promise<string>) | null = null;

export function setTokenGetter(fn: () => Promise<string>) {
  _getToken = fn;
}

async function authHeaders(): Promise<Record<string, string>> {
  if (!_getToken) return {};
  try {
    const token = await _getToken();
    return { Authorization: `Bearer ${token}` };
  } catch {
    return {};
  }
}

async function apiFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(await authHeaders()),
    ...(opts.headers as Record<string, string> ?? {}),
  };
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  } catch {
    const target = API_BASE || 'same-origin /api';
    throw new Error(`Unable to reach backend (${target}). Start backend and verify VITE_API_URL.`);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Campaign {
  _id: string;
  ngo_id: string;
  ngo_name?: string;
  title: string;
  description: string;
  category: string;
  image?: string;
  goal?: number;
  total_raised_sol: number;
  vault_address?: string;
  status: string;
  trust_score: number;
  failure_count: number;
  donors_count?: number;
  created_at: string;
  milestones?: Milestone[];
}

export interface Milestone {
  _id: string;
  campaign_id: string;
  title: string;
  description: string;
  amount_sol: number;
  due_date: string;
  status: string;
  evidence_urls: string[];
  ai_decision: Record<string, unknown>;
  oracle_result: Record<string, unknown>;
  solana_tx?: string;
  created_at: string;
}

export interface Donation {
  _id: string;
  donor_id: string;
  campaign_id: string;
  campaign_title?: string;
  ngo_name?: string;
  amount_sol: number;
  wallet_address: string;
  solana_tx: string;
  released_sol: number;
  locked_sol: number;
  refunded_sol: number;
  created_at: string;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function getCurrentUser() {
  return apiFetch('/api/auth/me');
}

// ─── Campaigns ────────────────────────────────────────────────────────────────

export async function getCampaigns(filters?: { category?: string; search?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters?.category && filters.category !== 'All') params.set('category', filters.category);
  if (filters?.search) params.set('search', filters.search);
  if (filters?.status && filters.status !== 'All') params.set('status', filters.status);
  const query = params.toString() ? `?${params}` : '';
  return apiFetch<Campaign[]>(`/api/campaigns${query}`);
}

export async function getCampaignById(id: string): Promise<Campaign> {
  return apiFetch<Campaign>(`/api/campaigns/${id}`);
}

export async function createCampaign(data: {
  title: string;
  description: string;
  category: string;
  vault_address?: string;
}) {
  return apiFetch<Campaign>('/api/campaigns', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ─── Milestones ───────────────────────────────────────────────────────────────

export async function getMilestones(campaignId: string): Promise<Milestone[]> {
  return apiFetch<Milestone[]>(`/api/campaigns/${campaignId}/milestones`);
}

export async function createMilestone(campaignId: string, data: {
  title: string;
  description: string;
  amount_sol: number;
  due_date: string;
}) {
  return apiFetch<Milestone>(`/api/campaigns/${campaignId}/milestones`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function submitMilestone(milestoneId: string, data: {
  description: string;
  evidence_urls: string[];
}) {
  return apiFetch(`/api/milestones/${milestoneId}/submit`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function reviewMilestone(milestoneId: string, decision: 'approve' | 'reject', notes: string) {
  return apiFetch(`/api/milestones/${milestoneId}/review`, {
    method: 'POST',
    body: JSON.stringify({ decision, notes }),
  });
}

// ─── Donations ────────────────────────────────────────────────────────────────

export async function makeDonation(data: {
  campaign_id: string;
  amount_sol: number;
  solana_tx: string;
  wallet_address: string;
}) {
  return apiFetch<Donation>('/api/donations', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getMyDonations(): Promise<Donation[]> {
  return apiFetch<Donation[]>('/api/donations/mine');
}

// ─── Verification ─────────────────────────────────────────────────────────────

export async function getVerificationQueue(): Promise<Milestone[]> {
  return apiFetch<Milestone[]>('/api/verification/queue');
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function getPlatformAnalytics() {
  return apiFetch('/api/analytics/platform');
}

export async function getNGOAnalytics() {
  return apiFetch('/api/analytics/ngo');
}

export async function getCampaignActivity(campaignId: string) {
  return apiFetch(`/api/campaigns/${campaignId}/activity`);
}

// ─── User ─────────────────────────────────────────────────────────────────────

export async function updateProfile(data: { name?: string; email?: string }) {
  return apiFetch('/api/users/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function updatePassword(data: { current: string; next: string }) {
  return apiFetch('/api/users/me/password', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function updateRole(role: 'donor' | 'ngo') {
  return apiFetch('/api/users/me/role', {
    method: 'PUT',
    body: JSON.stringify({ role }),
  });
}
