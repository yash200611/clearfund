export const USERS = [
  { id: 'u1', name: 'Sarah Chen', email: 'donor@test.com', password: 'donor123', role: 'donor' as const, trust_score: 92, avatar: 'SC' },
  { id: 'u2', name: 'HealthForAll Foundation', email: 'ngo@test.com', password: 'ngo123', role: 'ngo' as const, trust_score: 88, avatar: 'HF' },
  { id: 'u3', name: 'James Okafor', email: 'verifier@test.com', password: 'verifier123', role: 'verifier' as const, trust_score: 95, avatar: 'JO' },
];

export type User = typeof USERS[number];
export type Role = 'donor' | 'ngo' | 'verifier' | 'admin';

export const CAMPAIGNS = [
  {
    id: 'c1', ngo_id: 'u2', ngo_name: 'HealthForAll Foundation',
    title: 'Mobile Health Van — Rural Clinics',
    description: 'Deploying a fully equipped mobile health van to provide free medical checkups, vaccinations, and emergency care to 12 underserved rural villages across the northern corridor. Each visit includes basic diagnostics, maternal health screenings, and pediatric care.',
    category: 'Healthcare',
    image: 'https://images.pexels.com/photos/263402/pexels-photo-263402.jpeg?auto=compress&cs=tinysrgb&w=800',
    goal: 50000, total_raised: 34500, released: 18000, locked: 12500, refunded: 4000,
    status: 'active' as const, trust_score: 87, failure_count: 1, donors_count: 142, created_at: '2025-11-15',
  },
  {
    id: 'c2', ngo_id: 'u2', ngo_name: 'CleanWaterNow',
    title: 'Solar-Powered Water Purification',
    description: 'Installing solar-powered water purification systems in 8 communities lacking access to clean drinking water. Systems will serve approximately 4,000 people and run entirely on renewable energy.',
    category: 'Water & Sanitation',
    image: 'https://images.pexels.com/photos/2990644/pexels-photo-2990644.jpeg?auto=compress&cs=tinysrgb&w=800',
    goal: 75000, total_raised: 62000, released: 45000, locked: 17000, refunded: 0,
    status: 'active' as const, trust_score: 94, failure_count: 0, donors_count: 287, created_at: '2025-09-22',
  },
  {
    id: 'c3', ngo_id: 'u2', ngo_name: 'SafeHaven',
    title: "Women's Emergency Shelter Expansion",
    description: "Expanding capacity of the downtown emergency shelter from 40 to 80 beds, adding a childcare wing and job training center. Priority intake for domestic violence survivors and families with children.",
    category: 'Shelter & Safety',
    image: 'https://images.pexels.com/photos/8613089/pexels-photo-8613089.jpeg?auto=compress&cs=tinysrgb&w=800',
    goal: 120000, total_raised: 98000, released: 72000, locked: 26000, refunded: 0,
    status: 'active' as const, trust_score: 96, failure_count: 0, donors_count: 412, created_at: '2025-07-10',
  },
  {
    id: 'c4', ngo_id: 'u2', ngo_name: 'EduFuture',
    title: 'Youth STEM Lab — After-School Program',
    description: 'Building a community STEM lab with 3D printers, robotics kits, and coding stations serving 200 students aged 12-18. After-school programs run five days a week with certified instructors.',
    category: 'Education',
    image: 'https://images.pexels.com/photos/8613319/pexels-photo-8613319.jpeg?auto=compress&cs=tinysrgb&w=800',
    goal: 40000, total_raised: 28000, released: 15000, locked: 10000, refunded: 3000,
    status: 'active' as const, trust_score: 82, failure_count: 1, donors_count: 93, created_at: '2025-12-01',
  },
];

export type Campaign = typeof CAMPAIGNS[number];

export const MILESTONES = [
  { id: 'm1', campaign_id: 'c1', title: 'Vehicle Procurement & Equipping', description: 'Purchase and fully outfit the mobile health van with medical equipment.', amount: 18000, due_date: '2026-01-15', status: 'released' as const, evidence: 'Purchase receipts, vehicle registration, and equipment inventory photos uploaded.', reviewer_notes: 'All documentation verified and cross-checked with vendor invoices.' },
  { id: 'm2', campaign_id: 'c1', title: 'Phase 1 — Villages 1-3', description: 'Deploy to first 3 villages. Minimum 300 patients served.', amount: 8000, due_date: '2026-03-01', status: 'submitted' as const, evidence: 'Service logs, patient count records, and village chief sign-offs uploaded.', reviewer_notes: '' },
  { id: 'm3', campaign_id: 'c1', title: 'Phase 2 — Villages 4-6', description: 'Second deployment with maternal health services added.', amount: 8000, due_date: '2026-05-01', status: 'locked' as const, evidence: '', reviewer_notes: '' },
  { id: 'm4', campaign_id: 'c1', title: 'Phase 3 — Villages 7-9', description: 'Third deployment with dental screening.', amount: 8000, due_date: '2026-07-01', status: 'locked' as const, evidence: '', reviewer_notes: '' },
  { id: 'm5', campaign_id: 'c1', title: 'Phase 4 — Villages 10-12 & Final Report', description: 'Final deployment plus comprehensive impact report.', amount: 8000, due_date: '2026-09-01', status: 'locked' as const, evidence: '', reviewer_notes: '' },
  { id: 'm6', campaign_id: 'c2', title: 'Equipment Procurement', description: 'Purchase solar panels and purification units.', amount: 25000, due_date: '2025-11-01', status: 'released' as const, evidence: 'All equipment delivered and photos submitted.', reviewer_notes: 'Verified against purchase orders.' },
  { id: 'm7', campaign_id: 'c2', title: 'Installation Phase 1 (4 communities)', description: 'Install systems in first 4 communities.', amount: 20000, due_date: '2026-01-15', status: 'released' as const, evidence: 'Installation photos and community leader sign-offs.', reviewer_notes: 'Confirmed operational.' },
  { id: 'm8', campaign_id: 'c2', title: 'Installation Phase 2 (4 communities)', description: 'Complete remaining 4 installations.', amount: 17000, due_date: '2026-04-01', status: 'locked' as const, evidence: '', reviewer_notes: '' },
];

export type Milestone = typeof MILESTONES[number];
export type MilestoneStatus = 'locked' | 'submitted' | 'approved' | 'released' | 'rejected';

export const DONATIONS = [
  { id: 'd1', donor_id: 'u1', campaign_id: 'c1', campaign_title: 'Mobile Health Van — Rural Clinics', ngo_name: 'HealthForAll Foundation', amount: 500, released_portion: 260, refundable_portion: 240, date: '2026-01-20', status: 'active' as const },
  { id: 'd2', donor_id: 'u1', campaign_id: 'c2', campaign_title: 'Solar-Powered Water Purification', ngo_name: 'CleanWaterNow', amount: 1000, released_portion: 725, refundable_portion: 275, date: '2026-02-05', status: 'active' as const },
  { id: 'd3', donor_id: 'u1', campaign_id: 'c3', campaign_title: "Women's Emergency Shelter Expansion", ngo_name: 'SafeHaven', amount: 250, released_portion: 184, refundable_portion: 66, date: '2026-02-14', status: 'active' as const },
  { id: 'd4', donor_id: 'u1', campaign_id: 'c4', campaign_title: 'Youth STEM Lab — After-School Program', ngo_name: 'EduFuture', amount: 750, released_portion: 401, refundable_portion: 349, date: '2026-03-01', status: 'active' as const },
];

export type Donation = typeof DONATIONS[number];

export const NGOS = [
  { name: 'HealthForAll', initials: 'HF', tagline: 'Healthcare Access', funded: '$2.4M', campaigns: 12 },
  { name: 'CleanWaterNow', initials: 'CW', tagline: 'Clean Water Initiative', funded: '$1.8M', campaigns: 8 },
  { name: 'SafeHaven', initials: 'SH', tagline: 'Shelter & Safety', funded: '$3.1M', campaigns: 15 },
  { name: 'EduFuture', initials: 'EF', tagline: 'Education First', funded: '$2.7M', campaigns: 10 },
  { name: 'GreenEarth', initials: 'GE', tagline: 'Climate Action', funded: '$1.5M', campaigns: 6 },
  { name: 'FoodBank+', initials: 'FB', tagline: 'Food Security', funded: '$2.9M', campaigns: 14 },
  { name: 'TechForGood', initials: 'TG', tagline: 'Digital Literacy', funded: '$1.2M', campaigns: 5 },
  { name: 'YouthRise', initials: 'YR', tagline: 'Youth Empowerment', funded: '$1.9M', campaigns: 9 },
];

export const PLATFORM_STATS = {
  total_protected: '$12.4M',
  success_rate: '91%',
  total_campaigns: 44,
  total_donors: 3200,
  monthly_donations: [
    { month: 'Oct', amount: 145000 },
    { month: 'Nov', amount: 198000 },
    { month: 'Dec', amount: 267000 },
    { month: 'Jan', amount: 312000 },
    { month: 'Feb', amount: 289000 },
    { month: 'Mar', amount: 341000 },
  ],
  category_breakdown: [
    { name: 'Healthcare', value: 35 },
    { name: 'Education', value: 25 },
    { name: 'Water', value: 20 },
    { name: 'Shelter', value: 15 },
    { name: 'Other', value: 5 },
  ],
  escrow_status: [
    { name: 'Released', value: 5200000, color: '#FFFFFF' },
    { name: 'Locked', value: 4800000, color: '#FF6432' },
    { name: 'Refunded', value: 2400000, color: '#EF4444' },
  ],
};

export const VERIFICATION_QUEUE = [
  {
    id: 'vq1',
    milestone_id: 'm2',
    campaign_id: 'c1',
    campaign_title: 'Mobile Health Van — Rural Clinics',
    ngo_name: 'HealthForAll Foundation',
    milestone_title: 'Phase 1 — Villages 1-3',
    amount: 8000,
    submitted_at: '2026-03-15',
    evidence: 'Service logs, patient count records, and village chief sign-offs uploaded.',
    status: 'submitted' as const,
  },
];

export const ACTIVITY_FEED = [
  { id: 'a1', type: 'donation', message: 'Anonymous donated $500', time: '2 hours ago', campaign_id: 'c1' },
  { id: 'a2', type: 'milestone', message: 'Milestone "Vehicle Procurement" released', time: '3 days ago', campaign_id: 'c1' },
  { id: 'a3', type: 'donation', message: 'Sarah C. donated $250', time: '5 days ago', campaign_id: 'c1' },
  { id: 'a4', type: 'milestone', message: 'Phase 1 evidence submitted for review', time: '1 week ago', campaign_id: 'c1' },
];
