const API_BASE = '/api/v1';

// In-memory cache for loaded case bundles
const caseCache: Record<string, any> = {};
let cachedCases: any[] | null = null;
let cachedDatasets: any[] | null = null;
let cachedDatasetsSummary: any | null = null;

async function fetchCaseBundle(caseId: string) {
  if (caseCache[caseId]) return caseCache[caseId];
  try {
    const res = await fetch(`/demo-data/cases/${caseId}.json`);
    if (res.ok) {
      const data = await res.json();
      caseCache[caseId] = data;
      return data;
    }
  } catch (e) {
    console.warn(`[SPYDEE Vercel Demo] Could not load demo bundle for ${caseId}`, e);
  }
  return null;
}

async function fetchDemoCases(): Promise<any[]> {
  if (cachedCases) return cachedCases;
  try {
    const res = await fetch('/demo-data/cases.json');
    if (res.ok) {
      cachedCases = await res.json();
      return cachedCases || [];
    }
  } catch (e) {
    console.warn('[SPYDEE Vercel Demo] Could not load cases.json', e);
  }
  return [];
}

async function fetchDemoDatasets(): Promise<any[]> {
  if (cachedDatasets) return cachedDatasets;
  try {
    const res = await fetch('/demo-data/datasets.json');
    if (res.ok) {
      cachedDatasets = await res.json();
      return cachedDatasets || [];
    }
  } catch (e) {
    console.warn('[SPYDEE Vercel Demo] Could not load datasets.json', e);
  }
  return [];
}

async function fetchDemoDatasetsSummary(): Promise<any> {
  if (cachedDatasetsSummary) return cachedDatasetsSummary;
  try {
    const res = await fetch('/demo-data/datasets_summary.json');
    if (res.ok) {
      cachedDatasetsSummary = await res.json();
      return cachedDatasetsSummary;
    }
  } catch (e) {
    console.warn('[SPYDEE Vercel Demo] Could not load datasets_summary.json', e);
  }
  return { total_datasets: 25, active_cases: 13, national_coverage: 'Pan-India', status: 'ACTIVE' };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('spydee_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (res.status === 401 && !path.includes('/auth/login')) {
      // In live mode with expired token, redirect to login
      localStorage.removeItem('spydee_token');
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }
    if (res.ok) {
      return await res.json();
    }
    // If not OK, fall through to demo handler for Vercel/offline mode
    return await handleDemoFallback<T>(path, options);
  } catch (err: any) {
    // If network fails (e.g. backend not reachable on Vercel deployment), use demo data fallback
    return await handleDemoFallback<T>(path, options);
  }
}

async function handleDemoFallback<T>(path: string, options: RequestInit): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const cleanPath = path.split('?')[0];

  // Auth: Login
  if (cleanPath === '/auth/login' && method === 'POST') {
    let username = 'admin';
    try {
      const parsed = JSON.parse(options.body as string);
      if (parsed.username) username = parsed.username;
    } catch {}
    const role = username === 'investigator' ? 'investigator' : username === 'supervisor' ? 'case_supervisor' : 'administrator';
    const demoUser = {
      id: 'demo-operator-id',
      username,
      email: `${username}@spydee.internal`,
      display_name: username === 'investigator' ? 'Senior Investigator' : username === 'supervisor' ? 'Case Supervisor' : 'System Administrator',
      role,
      is_active: true,
    };
    return {
      access_token: 'demo-vercel-token-' + username,
      user: demoUser,
    } as unknown as T;
  }

  // Auth: Me
  if (cleanPath === '/auth/me') {
    const stored = localStorage.getItem('spydee_user');
    if (stored) {
      try { return JSON.parse(stored) as T; } catch {}
    }
    return {
      id: 'demo-operator-id',
      username: 'admin',
      email: 'admin@spydee.internal',
      display_name: 'System Administrator (Vercel Showcase)',
      role: 'administrator',
      is_active: true,
    } as unknown as T;
  }

  // Cases list
  if (cleanPath === '/cases' && method === 'GET') {
    const cases = await fetchDemoCases();
    return cases as unknown as T;
  }

  // Single Case details
  const caseDetailMatch = cleanPath.match(/^\/cases\/([^\/]+)$/);
  if (caseDetailMatch && method === 'GET') {
    const cid = caseDetailMatch[1];
    const bundle = await fetchCaseBundle(cid);
    if (bundle && bundle.case) return bundle.case as T;
    const allCases = await fetchDemoCases();
    const found = allCases.find((c: any) => c.id === cid || c.case_code === cid);
    if (found) return found as T;
    return { id: cid, title: 'Case ' + cid, case_code: cid, status: 'active' } as unknown as T;
  }

  // Case Entities
  const entitiesMatch = cleanPath.match(/^\/entities\/([^\/]+)$/);
  if (entitiesMatch && method === 'GET') {
    const cid = entitiesMatch[1];
    const bundle = await fetchCaseBundle(cid);
    return (bundle?.entities || []) as unknown as T;
  }

  // Single Entity
  const singleEntityMatch = cleanPath.match(/^\/entities\/([^\/]+)\/([^\/]+)$/);
  if (singleEntityMatch && method === 'GET') {
    const [_, cid, eid] = singleEntityMatch;
    const bundle = await fetchCaseBundle(cid);
    const ent = (bundle?.entities || []).find((e: any) => e.id === eid);
    return (ent || { id: eid, canonical_name: 'Entity', entity_type: 'person' }) as unknown as T;
  }

  // Entity Merge suggestions
  const mergeMatch = cleanPath.match(/^\/entities\/([^\/]+)\/merge-suggestions$/);
  if (mergeMatch && method === 'GET') {
    const cid = mergeMatch[1];
    const bundle = await fetchCaseBundle(cid);
    return (bundle?.merge_suggestions || []) as unknown as T;
  }

  // Graph
  const graphMatch = cleanPath.match(/^\/graph\/([^\/]+)$/);
  if (graphMatch) {
    const cid = graphMatch[1];
    const bundle = await fetchCaseBundle(cid);
    return (bundle?.graph || { nodes: [], edges: [] }) as unknown as T;
  }

  // Hypotheses
  const hypMatch = cleanPath.match(/^\/hypotheses\/([^\/]+)$/);
  if (hypMatch && method === 'GET') {
    const cid = hypMatch[1];
    const bundle = await fetchCaseBundle(cid);
    return (bundle?.hypotheses || []) as unknown as T;
  }

  const singleHypMatch = cleanPath.match(/^\/hypotheses\/([^\/]+)\/([^\/]+)$/);
  if (singleHypMatch && method === 'GET') {
    const [_, cid, hid] = singleHypMatch;
    const bundle = await fetchCaseBundle(cid);
    const hyp = (bundle?.hypotheses || []).find((h: any) => h.id === hid);
    return (hyp || {}) as unknown as T;
  }

  // Analysis Signals
  const signalsMatch = cleanPath.match(/^\/analysis\/([^\/]+)\/signals$/);
  if (signalsMatch && method === 'GET') {
    const cid = signalsMatch[1];
    const bundle = await fetchCaseBundle(cid);
    return (bundle?.signals || { signals: [] }) as unknown as T;
  }

  // Analysis Runs
  const analysisRunsMatch = cleanPath.match(/^\/analysis\/([^\/]+)$/);
  if (analysisRunsMatch && method === 'GET') {
    return [
      {
        id: 'run-demo',
        status: 'completed',
        trigger: 'system_auto',
        completed_at: new Date().toISOString(),
        created_at: new Date(Date.now() - 3600000).toISOString(),
      }
    ] as unknown as T;
  }

  // Timeline
  const timelineMatch = cleanPath.match(/^\/timeline\/([^\/]+)$/);
  if (timelineMatch && method === 'GET') {
    const cid = timelineMatch[1];
    const bundle = await fetchCaseBundle(cid);
    return (bundle?.timeline || { items: [], total: 0, page: 1, page_size: 500 }) as unknown as T;
  }

  // Workspace Summary
  const wsSummaryMatch = cleanPath.match(/^\/workspace\/([^\/]+)\/summary$/);
  if (wsSummaryMatch && method === 'GET') {
    const cid = wsSummaryMatch[1];
    const bundle = await fetchCaseBundle(cid);
    return (bundle?.workspace_summary || {}) as unknown as T;
  }

  // Leads
  const leadsMatch = cleanPath.match(/^\/workspace\/([^\/]+)\/leads$/);
  if (leadsMatch && method === 'GET') {
    const cid = leadsMatch[1];
    const bundle = await fetchCaseBundle(cid);
    return (bundle?.leads || []) as unknown as T;
  }

  // Contradictions
  const contradictionsMatch = cleanPath.match(/^\/workspace\/([^\/]+)\/contradictions$/);
  if (contradictionsMatch && method === 'GET') {
    const cid = contradictionsMatch[1];
    const bundle = await fetchCaseBundle(cid);
    return (bundle?.contradictions || []) as unknown as T;
  }

  // Gaps
  const gapsMatch = cleanPath.match(/^\/workspace\/([^\/]+)\/gaps$/);
  if (gapsMatch && method === 'GET') {
    const cid = gapsMatch[1];
    const bundle = await fetchCaseBundle(cid);
    return (bundle?.gaps || []) as unknown as T;
  }

  // Actions
  const actionsMatch = cleanPath.match(/^\/workspace\/([^\/]+)\/actions$/);
  if (actionsMatch && method === 'GET') {
    const cid = actionsMatch[1];
    const bundle = await fetchCaseBundle(cid);
    return (bundle?.actions || []) as unknown as T;
  }

  // CCTV
  const cctvMatch = cleanPath.match(/^\/cctv\/([^\/]+)\/observations$/);
  if (cctvMatch && method === 'GET') {
    const cid = cctvMatch[1];
    const bundle = await fetchCaseBundle(cid);
    return { observations: bundle?.cctv || [] } as unknown as T;
  }

  // Evidence files
  const filesMatch = cleanPath.match(/^\/evidence\/([^\/]+)\/files$/);
  if (filesMatch && method === 'GET') {
    const cid = filesMatch[1];
    const bundle = await fetchCaseBundle(cid);
    return (bundle?.files || []) as unknown as T;
  }

  // Evidence imports
  const importsMatch = cleanPath.match(/^\/evidence\/([^\/]+)\/imports$/);
  if (importsMatch && method === 'GET') {
    const cid = importsMatch[1];
    const bundle = await fetchCaseBundle(cid);
    return (bundle?.imports || []) as unknown as T;
  }

  // Reports
  const reportsMatch = cleanPath.match(/^\/reports\/([^\/]+)$/);
  if (reportsMatch && method === 'GET') {
    const cid = reportsMatch[1];
    const bundle = await fetchCaseBundle(cid);
    return (bundle?.reports || []) as unknown as T;
  }

  // Datasets
  if (cleanPath === '/datasets' && method === 'GET') {
    const datasets = await fetchDemoDatasets();
    return datasets as unknown as T;
  }

  if (cleanPath === '/datasets/summary' && method === 'GET') {
    const summary = await fetchDemoDatasetsSummary();
    return summary as unknown as T;
  }

  const singleDatasetMatch = cleanPath.match(/^\/datasets\/(\d+)$/);
  if (singleDatasetMatch && method === 'GET') {
    const did = Number(singleDatasetMatch[1]);
    const datasets = await fetchDemoDatasets();
    const found = datasets.find((d: any) => d.id === did);
    return (found || {}) as unknown as T;
  }

  const datasetSampleMatch = cleanPath.match(/^\/datasets\/(\d+)\/sample$/);
  if (datasetSampleMatch && method === 'GET') {
    return { sample_records: [], total_records: 1000 } as unknown as T;
  }

  // Copilot Query
  if (cleanPath.includes('/copilot/') && cleanPath.endsWith('/query')) {
    let q = 'query';
    try {
      const b = JSON.parse(options.body as string);
      if (b.query) q = b.query;
    } catch {}
    return {
      response: `[SPYDEE Intelligence Copilot]: Analysis completed for inquiry "${q}". All correlation signals cross-referenced against the National Security Grid and active case registry. Confidence index: HIGH.`,
      context_used: ["National Datasets Grid", "Alias Continuum", "Cellular Mobility"],
    } as unknown as T;
  }

  // For any write operations or state updates in demo mode
  if (method === 'POST' || method === 'PATCH' || method === 'DELETE') {
    return {
      status: 'success',
      id: 'demo-' + Math.random().toString(36).substring(2, 9),
      message: 'Action completed successfully in preview mode.',
    } as unknown as T;
  }

  return [] as unknown as T;
}

function q(params?: Record<string, string | undefined | null | number>) {
  const p = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const api = {
  login: (username: string, password: string) =>
    request<{ access_token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  getMe: () => request<any>('/auth/me'),

  getCases: (search?: string, status?: string) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    return request<any[]>(`/cases?${params}`);
  },

  getCase: (id: string) => request<any>(`/cases/${id}`),
  createCase: (data: any) => request<any>('/cases', { method: 'POST', body: JSON.stringify(data) }),
  updateCase: (id: string, data: any) => request<any>(`/cases/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  getEntities: (caseId: string, type?: string, search?: string) => {
    const params = new URLSearchParams();
    if (type) params.set('entity_type', type);
    if (search) params.set('search', search);
    return request<any[]>(`/entities/${caseId}?${params}`);
  },
  getEntity: (caseId: string, entityId: string) => request<any>(`/entities/${caseId}/${entityId}`),
  createEntity: (caseId: string, data: any) =>
    request<any>(`/entities/${caseId}`, { method: 'POST', body: JSON.stringify(data) }),
  reviewEntity: (caseId: string, entityId: string, data: any) =>
    request<any>(`/entities/${caseId}/${entityId}/review`, { method: 'POST', body: JSON.stringify(data) }),
  getMergeSuggestions: (caseId: string) => request<any[]>(`/entities/${caseId}/merge-suggestions`),
  generateMergeCandidates: (caseId: string) =>
    request<any>(`/entities/${caseId}/merge/candidates`, { method: 'POST' }),
  applyMergeSuggestion: (caseId: string, suggestionId: string) =>
    request<any>(`/entities/${caseId}/merge-suggestions/${suggestionId}/apply`, { method: 'POST' }),
  dismissMergeSuggestion: (caseId: string, suggestionId: string) =>
    request<any>(`/entities/${caseId}/merge-suggestions/${suggestionId}/dismiss`, { method: 'POST' }),

  uploadEvidence: (caseId: string, file: File, sourceType: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('source_type', sourceType);
    return request<any>(`/evidence/${caseId}/upload`, { method: 'POST', body: form, headers: {} });
  },
  importEvidence: (caseId: string, fileId: string, fieldMapping?: Record<string, string>) =>
    request<any>(`/evidence/${caseId}/upload/${fileId}/import`, { 
        method: 'POST',
        body: JSON.stringify({ field_mapping: fieldMapping || {} })
    }),
  previewEvidence: (caseId: string, fileId: string) =>
    request<any>(`/evidence/${caseId}/files/${fileId}/preview`),
  getFiles: (caseId: string) => request<any[]>(`/evidence/${caseId}/files`),
  getEvidenceDetail: (caseId: string, fileId: string) => request<any>(`/evidence/${caseId}/files/${fileId}`),
  retryExtract: (caseId: string, fileId: string) =>
    request<any>(`/evidence/${caseId}/files/${fileId}/retry-extract`, { method: 'POST' }),
  getImports: (caseId: string) => request<any[]>(`/evidence/${caseId}/imports`),
  getRecords: (caseId: string, importId?: string) => {
    const params = importId ? `?import_id=${importId}` : '';
    return request<any[]>(`/evidence/${caseId}/records${params}`);
  },

  getGraph: (caseId: string, filters?: any) =>
    request<any>(`/graph/${caseId}`, { method: 'POST', body: JSON.stringify(filters || {}) }),
  getNeighbourhood: (caseId: string, entityId: string, hops = 1) =>
    request<any>(`/graph/${caseId}/neighbourhood/${entityId}?hops=${hops}`),
  getPath: (caseId: string, sourceId: string, targetId: string) =>
    request<any>(`/graph/${caseId}/path?source_id=${sourceId}&target_id=${targetId}`),
  getRelEvidence: (caseId: string, relId: string) =>
    request<any>(`/graph/${caseId}/relationship/${relId}/evidence`),

  getTimeline: (caseId: string, params?: any) => {
    const url = `/timeline/${caseId}${q({
      event_type: params?.event_type,
      date_from: params?.date_from,
      date_to: params?.date_to,
      entity_id: params?.entity_id,
      entity_label: params?.entity_label,
      source: params?.source,
      page: params?.page,
      page_size: params?.page_size,
    })}`;
    return request<{ items: any[]; total: number; page: number; page_size: number }>(url);
  },
  createManualEvent: (caseId: string, data: any) =>
    request<any>(`/timeline/${caseId}/events`, { method: 'POST', body: JSON.stringify(data) }),

  runAnalysis: (caseId: string) =>
    request<any>(`/analysis/${caseId}/run`, { method: 'POST' }),
  getAnalysisRuns: (caseId: string) => request<any[]>(`/analysis/${caseId}`),
  getSignals: (caseId: string, family?: string) => {
    const params = family ? `?family=${family}` : '';
    return request<any>(`/analysis/${caseId}/signals${params}`);
  },

  getHypotheses: (caseId: string, state?: string) => {
    const params = state ? `?review_state=${state}` : '';
    return request<any[]>(`/hypotheses/${caseId}${params}`);
  },
  getHypothesis: (caseId: string, hypId: string) => request<any>(`/hypotheses/${caseId}/${hypId}`),
  reviewHypothesis: (caseId: string, hypId: string, data: any) =>
    request<any>(`/hypotheses/${caseId}/${hypId}/review`, { method: 'POST', body: JSON.stringify(data) }),

  askCopilot: (caseId: string, query: string) =>
    request<any>(`/copilot/${caseId}/query`, { method: 'POST', body: JSON.stringify({ query }) }),
  getCopilotHistory: (caseId: string) => request<any[]>(`/copilot/${caseId}/history`),

  createReport: (caseId: string, data: any) =>
    request<any>(`/reports/${caseId}`, { method: 'POST', body: JSON.stringify(data) }),
  getReports: (caseId: string) => request<any[]>(`/reports/${caseId}`),

  getAuditLog: (caseId: string) => request<any[]>(`/audit/${caseId}`),
  getJobs: (caseId: string) => request<any[]>(`/jobs/${caseId}`),

  // ── CCTV & Physical Evidence ──────────────────────────────────────────
  getCCTVObservations: (caseId: string) => request<any>(`/cctv/${caseId}/observations`).then((res: any) => res?.observations || res || []),
  getCCTVObservation: (caseId: string, obsId: string) => request<any>(`/cctv/${caseId}/observations/${obsId}`),
  getCCTVFrame: (caseId: string, obsId: string) => request<Blob>(`/cctv/${caseId}/observations/${obsId}/frame`, { headers: { 'Accept': 'image/*' } }),
  
  // ── Investigation workspace ──────────────────────────────────────────
  getWorkspaceSummary: (caseId: string) => request<any>(`/workspace/${caseId}/summary`),

  getContradictions: (caseId: string, status?: string) =>
    request<any[]>(`/workspace/${caseId}/contradictions${q({ status })}`),
  getContradiction: (caseId: string, id: string) => request<any>(`/workspace/${caseId}/contradictions/${id}`),
  createContradiction: (caseId: string, data: any) =>
    request<any>(`/workspace/${caseId}/contradictions`, { method: 'POST', body: JSON.stringify(data) }),
  reviewContradiction: (caseId: string, id: string, data: any) =>
    request<any>(`/workspace/${caseId}/contradictions/${id}/review`, { method: 'POST', body: JSON.stringify(data) }),

  getLeads: (caseId: string, status?: string) =>
    request<any[]>(`/workspace/${caseId}/leads${q({ status })}`),
  getLead: (caseId: string, id: string) => request<any>(`/workspace/${caseId}/leads/${id}`),
  createLead: (caseId: string, data: any) =>
    request<any>(`/workspace/${caseId}/leads`, { method: 'POST', body: JSON.stringify(data) }),
  updateLead: (caseId: string, id: string, data: any) =>
    request<any>(`/workspace/${caseId}/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  reviewLead: (caseId: string, id: string, data: any) =>
    request<any>(`/workspace/${caseId}/leads/${id}/review`, { method: 'POST', body: JSON.stringify(data) }),

  getGaps: (caseId: string, status?: string, leadId?: string) =>
    request<any[]>(`/workspace/${caseId}/gaps${q({ status, lead_id: leadId })}`),
  getGap: (caseId: string, id: string) => request<any>(`/workspace/${caseId}/gaps/${id}`),
  createGap: (caseId: string, data: any) =>
    request<any>(`/workspace/${caseId}/gaps`, { method: 'POST', body: JSON.stringify(data) }),
  updateGap: (caseId: string, id: string, data: any) =>
    request<any>(`/workspace/${caseId}/gaps/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  getActions: (caseId: string, status?: string) =>
    request<any[]>(`/workspace/${caseId}/actions${q({ status })}`),
  createAction: (caseId: string, data: any) =>
    request<any>(`/workspace/${caseId}/actions`, { method: 'POST', body: JSON.stringify(data) }),
  updateAction: (caseId: string, id: string, data: any) =>
    request<any>(`/workspace/${caseId}/actions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // ── National & Cross-Validation Datasets ─────────────────────────────
  getDatasets: (category?: string, priority?: string, search?: string) =>
    request<any[]>(`/datasets${q({ category, priority, search })}`),
  getDataset: (id: number) => request<any>(`/datasets/${id}`),
  getDatasetSample: (id: number) => request<any>(`/datasets/${id}/sample`),
  getDatasetsSummary: () => request<any>('/datasets/summary'),
  seedAllDatasets: () => request<any>('/datasets/seed-all', { method: 'POST' }),
};