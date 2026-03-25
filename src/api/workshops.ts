/**
 * API stubs pour le workshop en ligne (Supabase).
 * Les fonctions retournent des valeurs vides tant que Supabase n'est pas connecte.
 *
 * Schema SQL prevu :
 *
 *   CREATE TABLE effects (
 *     id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     type       TEXT NOT NULL CHECK (type IN ('color', 'size', 'custom-size')),
 *     label      TEXT NOT NULL,
 *     colors     JSONB,
 *     profile    JSONB,
 *     math_expr  TEXT,
 *     author     TEXT,
 *     likes      INTEGER DEFAULT 0,
 *     created_at TIMESTAMPTZ DEFAULT now()
 *   );
 *
 *   CREATE INDEX idx_effects_type ON effects(type);
 *   CREATE INDEX idx_effects_likes ON effects(likes DESC);
 */

import type { WorkshopEffect } from '../stores/workshops'

export interface OnlineEffectPayload {
  type: 'color' | 'size' | 'custom-size'
  label: string
  colors?: string[]
  profile?: number[]
  mathExpr?: string
  author?: string
}

// Config — sera remplace par les env vars Supabase
const SUPABASE_URL = ''
const SUPABASE_ANON_KEY = ''

function isConnected(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY)
}

export async function fetchOnlineEffects(): Promise<WorkshopEffect[]> {
  if (!isConnected()) return []
  // TODO: supabase.from('effects').select('*').order('likes', { ascending: false })
  return []
}

export async function createOnlineEffect(payload: OnlineEffectPayload): Promise<WorkshopEffect | null> {
  if (!isConnected()) return null
  // TODO: supabase.from('effects').insert(payload).select().single()
  return null
}

export async function updateOnlineEffect(id: string, payload: Partial<OnlineEffectPayload>): Promise<boolean> {
  if (!isConnected()) return false
  void id; void payload
  // TODO: supabase.from('effects').update(payload).eq('id', id)
  return false
}

export async function deleteOnlineEffect(id: string): Promise<boolean> {
  if (!isConnected()) return false
  void id
  // TODO: supabase.from('effects').delete().eq('id', id)
  return false
}

export async function likeOnlineEffect(id: string): Promise<boolean> {
  if (!isConnected()) return false
  void id
  // TODO: supabase.rpc('increment_likes', { effect_id: id })
  return false
}
