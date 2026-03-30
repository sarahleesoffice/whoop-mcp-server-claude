import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface WhoopTokenRecord {
  id: string;
  access_token: string;
  refresh_token: string | null;
  token_type: string | null;
  expires_in: number | null;
  scope: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PersistWhoopTokensInput {
  accessToken: string;
  refreshToken?: string | null;
  tokenType?: string | null;
  expiresIn?: number | null;
  scope?: string | null;
}

const DEFAULT_ROW_ID = 'primary';
let supabaseClient: SupabaseClient | null = null;

function getSupabaseUrl() {
  return process.env.SUPABASE_URL
    ?? process.env.SUPABASE_PROJECT_URL
    ?? 'https://ovnspzlndkekmvtcrcwt.supabase.co';
}

function getSupabaseServiceKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY
    ?? process.env.SUPABASE_SERVICE_KEY
    ?? process.env.SUPABASE_ANON_KEY;
}

export function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const url = getSupabaseUrl();
  const serviceKey = getSupabaseServiceKey();

  if (!url || !serviceKey) {
    return null;
  }

  supabaseClient = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseClient;
}

export async function persistWhoopTokens(tokens: PersistWhoopTokensInput) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return {
      persisted: false,
      reason: 'Supabase client is not configured',
    };
  }

  const payload: WhoopTokenRecord = {
    id: DEFAULT_ROW_ID,
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken ?? null,
    token_type: tokens.tokenType ?? null,
    expires_in: typeof tokens.expiresIn === 'number' ? tokens.expiresIn : null,
    scope: tokens.scope ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('whoop_tokens')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return {
    persisted: true,
    record: data as WhoopTokenRecord,
  };
}

export async function getLatestWhoopTokens() {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const byId = await supabase
    .from('whoop_tokens')
    .select('*')
    .eq('id', DEFAULT_ROW_ID)
    .maybeSingle();

  if (byId.data) {
    return byId.data as WhoopTokenRecord;
  }

  const latest = await supabase
    .from('whoop_tokens')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest.data) {
    return latest.data as WhoopTokenRecord;
  }

  return null;
}
