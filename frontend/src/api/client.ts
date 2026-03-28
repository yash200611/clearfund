import {
  CAMPAIGNS, MILESTONES, DONATIONS, PLATFORM_STATS, VERIFICATION_QUEUE, ACTIVITY_FEED, USERS,
  type Campaign, type Milestone, type Donation,
} from '@/data/seed';

const delay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

// TODO: Replace with real API call to POST /api/auth/login
export async function loginUser(email: string, password: string) {
  await delay();
  const user = USERS.find(u => u.email === email && u.password === password);
  if (!user) throw new Error('Invalid credentials');
  return user;
}

// TODO: Replace with real API call to POST /api/auth/register
export async function registerUser(name: string, email: string, _password: string, role: string) {
  await delay();
  return { id: 'new_' + Date.now(), name, email, role, trust_score: 0 };
}

// TODO: Replace with real API call to POST /api/auth/logout
export async function logoutUser() {
  await delay(100);
  return { success: true };
}

// TODO: Replace with real API call to GET /api/auth/me
export async function getCurrentUser() {
  await delay();
  return USERS[0];
}

// TODO: Replace with real API call to GET /api/campaigns
export async function getCampaigns(filters?: { category?: string; search?: string; status?: string }) {
  await delay();
  let result = [...CAMPAIGNS];
  if (filters?.category && filters.category !== 'All') {
    result = result.filter(c => c.category === filters.category);
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(c => c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
  }
  if (filters?.status && filters.status !== 'All') {
    result = result.filter(c => c.status === filters.status);
  }
  return result;
}

// TODO: Replace with real API call to GET /api/campaigns/:id
export async function getCampaignById(id: string): Promise<Campaign | undefined> {
  await delay();
  return CAMPAIGNS.find(c => c.id === id);
}

// TODO: Replace with real API call to POST /api/campaigns
export async function createCampaign(data: Partial<Campaign>) {
  await delay(500);
  return { id: 'c_' + Date.now(), ...data, status: 'active', trust_score: 0, failure_count: 0, donors_count: 0, created_at: new Date().toISOString() };
}

// TODO: Replace with real API call to GET /api/campaigns/:id/milestones
export async function getMilestones(campaignId: string): Promise<Milestone[]> {
  await delay();
  return MILESTONES.filter(m => m.campaign_id === campaignId);
}

// TODO: Replace with real API call to POST /api/campaigns/:id/milestones
export async function createMilestone(campaignId: string, data: Partial<Milestone>) {
  await delay(500);
  return { id: 'm_' + Date.now(), campaign_id: campaignId, ...data, status: 'locked' };
}

// TODO: Replace with real API call to POST /api/milestones/:id/submit
export async function submitMilestone(milestoneId: string, evidence: string) {
  await delay(500);
  return { id: milestoneId, status: 'submitted', evidence };
}

// TODO: Replace with real API call to POST /api/campaigns/:id/donate
export async function makeDonation(campaignId: string, amount: number) {
  await delay(500);
  const campaign = CAMPAIGNS.find(c => c.id === campaignId);
  return { id: 'd_' + Date.now(), campaign_id: campaignId, campaign_title: campaign?.title, amount, released_portion: 0, refundable_portion: amount, date: new Date().toISOString() };
}

// TODO: Replace with real API call to GET /api/donations/mine
export async function getMyDonations(): Promise<Donation[]> {
  await delay();
  return DONATIONS;
}

// TODO: Replace with real API call to GET /api/verification/queue
export async function getVerificationQueue() {
  await delay();
  return VERIFICATION_QUEUE;
}

// TODO: Replace with real API call to POST /api/milestones/:id/review
export async function reviewMilestone(milestoneId: string, decision: 'approve' | 'reject', notes: string) {
  await delay(500);
  return { id: milestoneId, status: decision === 'approve' ? 'released' : 'rejected', reviewer_notes: notes };
}

// TODO: Replace with real API call to GET /api/analytics/platform
export async function getPlatformAnalytics() {
  await delay();
  return PLATFORM_STATS;
}

// TODO: Replace with real API call to GET /api/analytics/ngo
export async function getNGOAnalytics() {
  await delay();
  return {
    ...PLATFORM_STATS,
    my_campaigns: CAMPAIGNS.slice(0, 2),
    total_raised_by_me: 62500,
  };
}

// TODO: Replace with real API call to GET /api/campaigns/:id/activity
export async function getCampaignActivity(_campaignId: string) {
  await delay();
  return ACTIVITY_FEED;
}

// TODO: Replace with real API call to PUT /api/users/me
export async function updateProfile(data: { name?: string; email?: string }) {
  await delay(500);
  return { ...USERS[0], ...data };
}

// TODO: Replace with real API call to PUT /api/users/me/password
export async function updatePassword(_data: { current: string; next: string }) {
  await delay(500);
  return { success: true };
}
