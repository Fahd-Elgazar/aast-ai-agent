import { API_BASE } from '../../config/api';
import { fetchAndConsumeWithTimeout } from '../../services/httpClient';

export interface DecisionProgram {
  id: string;
  program_name: string;
  college_id: string;
  min_percentage: number | null;
  program_fees: number | null;
  allowed_tracks: string | null;
}

export interface DecisionProgramUpdate {
  min_percentage: number | null;
  program_fees: number | null;
  allowed_tracks: string | null;
}

interface ProgramUpdateResponse {
  status: 'success';
  program: DecisionProgram;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) {
    const message = typeof payload?.message === 'string'
      ? payload.message
      : typeof payload?.detail === 'string'
        ? payload.detail
        : `Administrator request failed (${response.status})`;
    throw new Error(message);
  }
  if (payload === null) throw new Error('Administrator service returned an invalid response.');
  return payload as T;
}

export async function listDecisionPrograms(): Promise<DecisionProgram[]> {
  const programs = await fetchAndConsumeWithTimeout(
    `${API_BASE}/decision/admin/programs`,
    {},
    parseJsonResponse<DecisionProgram[]>,
  );
  if (!Array.isArray(programs)) throw new Error('Administrator service returned an invalid program list.');
  return programs;
}

export async function updateDecisionProgram(
  programId: string,
  update: DecisionProgramUpdate,
): Promise<DecisionProgram> {
  const result = await fetchAndConsumeWithTimeout(
    `${API_BASE}/decision/admin/programs/${encodeURIComponent(programId)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    },
    parseJsonResponse<ProgramUpdateResponse>,
  );
  if (result.status !== 'success' || !result.program?.id) {
    throw new Error('Administrator service did not confirm the program update.');
  }
  return result.program;
}
