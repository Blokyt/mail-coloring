/**
 * Rendu pur (sans DOM) d'un mail coloré — surface API/agent du colorieur.
 *
 * PROBLEME RESOLU ICI : le site colore dans un éditeur DOM (invariant
 * un-graphème-un-span, cf. editor-dom.ts) puis exporte par cleanForOutlook().
 * Un agent n'a pas de navigateur : il décrit le mail (blocs + effets) et doit
 * recevoir EXACTEMENT le même HTML Outlook. Ce module refait le parcours
 * spec → tokens → runs → <p>, en miroir de cleanForOutlook(), sans DOM.
 *
 * La parité est prouvée par src/engine/render.test.ts : le même texte passé
 * par l'éditeur réel (ops + cleanForOutlook, happy-dom) et par renderSpec()
 * donne le même HTML octet pour octet.
 *
 * Semantique reprise de l'éditeur (editor-ops.ts mapStyle + applySizeEffects) :
 *  - le cycle de couleurs ne compte QUE les graphèmes non-espace ;
 *  - les espaces ne sont pas colorées en mode texte ('skip') et reprennent
 *    le fond de la lettre précédente en mode fond ('inherit') ;
 *  - taille = round(base + base * shape(t)), t = rang du graphème encre sur
 *    les encre du bloc, minimum 8 px ; les espaces retombent à base px.
 */

import { evaluateMathExprSafe, normalizeProfile } from './effects.js'

/* ══════════════════════════════════════════
   Catalogue d'effets (admin-data.json côté site)
   ══════════════════════════════════════════ */

export interface CatalogColorEffect { name: string; colors: string[] }
export interface CatalogSizeEffect { name: string; profile: number[] }
export interface EffectsCatalog {
  colorEffects: Record<string, CatalogColorEffect>
  sizeEffects: Record<string, CatalogSizeEffect>
}

/* ══════════════════════════════════════════
   Spec déclarative d'un mail
   ══════════════════════════════════════════ */

export interface RenderBlockSpec {
  /** Texte du bloc ; '\n' coupe en lignes supplémentaires (absent si html brut) */
  text?: string
  /** Effet couleur texte : id du catalogue */
  colorEffect?: string
  /** Palette libre (cycle couleur texte) — prioritaire sur colorEffect */
  colors?: string[]
  /** Effet couleur de fond : id du catalogue (cycle de fond) */
  bgEffect?: string
  /** Palette libre de fond — prioritaire sur bgEffect */
  bgColors?: string[]
  /** Effet de taille : id du catalogue */
  sizeEffect?: string
  /** Profil de taille libre, forme [0,1] — prioritaire sur sizeEffect */
  profile?: number[]
  /** Expression math en x → profil échantillonné (même évaluateur que le site) */
  mathExpr?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  /** Police du bloc (ex. "Comic Sans MS") */
  font?: string
  /** Taille de base du bloc en px (dérivation des tailles), défaut 18 */
  baseSize?: number
  /** Lien posé sur tout le bloc */
  link?: string
  /** Emojis insérés avant/après le texte, inline (suivent les effets du bloc) */
  decoration?: { before?: string; after?: string }
  /** Bloc brut : le texte est du HTML déjà prêt, servi tel quel */
  html?: string
}

export interface RenderSpec {
  baseSize?: number
  font?: string
  blocks: RenderBlockSpec[]
}

/* ══════════════════════════════════════════
   Graphèmes & espaces (miroir de editor-dom)
   ══════════════════════════════════════════ */

const SEGMENTER = typeof Intl !== 'undefined' && Intl.Segmenter
  ? new Intl.Segmenter('fr', { granularity: 'grapheme' })
  : null

function graphemes(s: string): string[] {
  if (SEGMENTER) return [...SEGMENTER.segment(s)].map(g => g.segment)
  return [...s]
}

const NBSP = ' '
const ZWS = '​'

function isSpace(ch: string): boolean {
  return ch === ' ' || ch === NBSP || ch === '\t' || ch === '\n' || ch === ZWS
}

/* ══════════════════════════════════════════
   Profil de taille d'un bloc
   ══════════════════════════════════════════ */

const MATH_SAMPLES = 63
const MIN_SIZE = 8

function blockProfile(spec: RenderBlockSpec, catalog: EffectsCatalog): number[] | null {
  if (spec.profile && spec.profile.length > 0) return spec.profile
  if (spec.sizeEffect) {
    const e = catalog.sizeEffects[spec.sizeEffect]
    if (e?.profile?.length) return e.profile
  }
  if (spec.mathExpr) {
    const samples: number[] = []
    for (let i = 0; i < MATH_SAMPLES; i++) samples.push(evaluateMathExprSafe(spec.mathExpr, i / (MATH_SAMPLES - 1)))
    return normalizeProfile(samples)
  }
  return null
}

/** Interpolation linéaire dans le profil (miroir de applySizeEffects) */
function sampleProfile(profile: number[], t: number): number {
  const idx = t * (profile.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.min(lo + 1, profile.length - 1)
  const frac = idx - lo
  return profile[lo] * (1 - frac) + profile[hi] * frac
}

/* ══════════════════════════════════════════
   Tokens (miroir des tokens de cleanForOutlook)
   ══════════════════════════════════════════ */

interface Token {
  type: 'char'
  text: string
  color: string
  bg: string
  fontSize: string
  fontFamily: string
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  href: string
}
interface BrToken { type: 'br' }
type AnyToken = Token | BrToken

function blockColors(spec: RenderBlockSpec, catalog: EffectsCatalog): { colors: string[]; mode: 'text' | 'bg' } | null {
  if (spec.colors?.length) return { colors: spec.colors, mode: 'text' }
  if (spec.bgColors?.length) return { colors: spec.bgColors, mode: 'bg' }
  if (spec.colorEffect) {
    const e = catalog.colorEffects[spec.colorEffect]
    if (e?.colors?.length) return { colors: e.colors, mode: 'text' }
  }
  if (spec.bgEffect) {
    const e = catalog.colorEffects[spec.bgEffect.replace(/_bg$/, '')] ?? catalog.colorEffects[spec.bgEffect]
    if (e?.colors?.length) return { colors: e.colors, mode: 'bg' }
  }
  return null
}

function blockTokens(spec: RenderBlockSpec, defaults: { baseSize: number; font: string }, catalog: EffectsCatalog): AnyToken[] {
  const baseSize = spec.baseSize ?? defaults.baseSize
  const font = spec.font ?? defaults.font
  const cycle = blockColors(spec, catalog)
  const profile = blockProfile(spec, catalog)

  const base = {
    color: '', bg: '', fontSize: '', fontFamily: '',
    bold: false, italic: false, underline: false, strike: false,
    href: spec.link || '',
  }

  const out: AnyToken[] = []
  const pushLine = (text: string) => {
    const chars = graphemes(text)
    const inkTotal = chars.filter(c => !isSpace(c)).length
    let inkIdx = 0
    let lastInkBg = ''

    for (const char of chars) {
      if (char === '\n') { out.push({ type: 'br' }); continue }
      const tk: Token = { type: 'char', text: char, ...base }
      if (isSpace(char)) {
        // Espaces : jamais d'index de cycle (mapStyle). Fond hérité en mode bg.
        if (cycle?.mode === 'bg' && lastInkBg) tk.bg = lastInkBg
        // Taille : dans un marqueur une espace retombe à la base ; hors
        // marqueur elle porte la taille explicite de base (setBaseSize).
        tk.fontSize = `${baseSize}px`
        out.push(tk)
        continue
      }
      if (cycle) {
        const c = cycle.colors[inkIdx % cycle.colors.length]
        if (cycle.mode === 'bg') { tk.bg = c; lastInkBg = c }
        else tk.color = c
      }
      // La police et les formats se posent sur les lettres, pas sur les
      // espaces (setFontFamily, toggleFormat : politique 'skip')
      if (font) tk.fontFamily = font
      tk.bold = !!spec.bold
      tk.italic = !!spec.italic
      tk.underline = !!spec.underline
      tk.strike = !!spec.strike
      if (profile) {
        const t = inkTotal <= 1 ? 0 : inkIdx / (inkTotal - 1)
        const size = Math.max(MIN_SIZE, Math.round(baseSize + baseSize * sampleProfile(profile, t)))
        tk.fontSize = `${size}px`
      } else {
        tk.fontSize = `${baseSize}px`
      }
      out.push(tk)
      inkIdx++
    }
  }

  // Décorations inline : comme si l'utilisateur les avait tapées dans le mot
  // (elles suivent le cycle d'effets du bloc, sur la même ligne)
  const before = spec.decoration?.before ?? ''
  const after = spec.decoration?.after ?? ''
  pushLine(before + spec.text + after)
  return out
}

/* ══════════════════════════════════════════
   Runs & HTML (miroir de cleanForOutlook)
   ══════════════════════════════════════════ */

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function fontFamilyClean(ff: string): string {
  if (!ff) return ''
  const clean = ff.split(',')[0].replace(/["']/g, '').trim()
  if (!clean) return ''
  return clean + ', sans-serif'
}

function runToHtml(run: Token): string {
  let text = escapeHtml(run.text).replace(/[ \u00A0]/g, '&nbsp;')
  if (run.bold) text = `<b>${text}</b>`
  if (run.italic) text = `<i>${text}</i>`
  if (run.underline) text = `<u>${text}</u>`
  if (run.strike) text = `<s>${text}</s>`

  const styles: string[] = []
  if (run.color) styles.push(`color:${run.color}`)
  if (run.bg) styles.push(`background-color:${run.bg}`)
  if (run.fontSize) styles.push(`font-size:${run.fontSize}`)
  const ff = fontFamilyClean(run.fontFamily)
  if (ff) styles.push(`font-family:${ff}`)
  if (styles.length > 0) text = `<span style="${styles.join(';')}">${text}</span>`
  if (run.color) text = `<font color="${run.color}">${text}</font>`
  if (run.href) text = `<a href="${escapeHtml(run.href)}" target="_blank">${text}</a>`
  return text
}

const STYLE_BREAKER = '<span style="font-size:0;line-height:0;mso-hide:all">&#8203;</span>'

function tokensToHtml(tokens: AnyToken[]): string {
  // Fusion : les espaces consécutives seules se fusionnent (pas de style à perdre)
  const runs: AnyToken[] = []
  for (const tok of tokens) {
    if (tok.type === 'br') { runs.push(tok); continue }
    const isSpaceChar = tok.text === ' ' || tok.text === '\u00A0' || isSpace(tok.text)
    const last = runs[runs.length - 1]
    if (isSpaceChar && last && last.type === 'char' && (last.text === ' ' || last.text === '\u00A0' || /^[\s\u00A0]+$/.test(last.text))) {
      last.text += tok.text
    } else {
      runs.push({ ...tok, type: 'char' })
    }
  }

  const lines: Token[][] = [[]]
  for (const run of runs) {
    if (run.type === 'br') lines.push([])
    else lines[lines.length - 1].push(run)
  }

  const paragraphs = lines.map(line => {
    if (line.length === 0) return '<p style="margin:0;padding:0;mso-line-height-rule:exactly">&nbsp;</p>'
    const content = line.map(runToHtml).join('')
    return `<p style="margin:0;padding:0;mso-line-height-rule:exactly">${content}${STYLE_BREAKER}</p>`
  })

  return paragraphs.join('')
}

/* ══════════════════════════════════════════
   API publique du rendu
   ══════════════════════════════════════════ */

export const DEFAULT_BASE_SIZE = 18
/** Police par défaut : AUCUNE — l'éditeur n'écrit font-family que si l'utilisateur
 *  la pose ; le HTML copié laisse alors Outlook appliquer sa police par défaut. */
export const DEFAULT_FONT = ''

/** Rendu complet d'une spec en HTML Outlook. */
export function renderSpec(spec: RenderSpec, catalog: EffectsCatalog): string {
  const defaults = {
    baseSize: spec.baseSize ?? DEFAULT_BASE_SIZE,
    font: spec.font ?? DEFAULT_FONT,
  }
  const parts: string[] = []
  for (const block of spec.blocks) {
    if (block.html !== undefined) {
      // Bloc brut : servi tel quel, une ligne par '\n'
      if (block.html === '') continue
      parts.push(...block.html.split('\n').map(line => `<p style="margin:0;padding:0;mso-line-height-rule:exactly">${line}${STYLE_BREAKER}</p>`))
      continue
    }
    if (!block.text) {
      parts.push('<p style="margin:0;padding:0;mso-line-height-rule:exactly">&nbsp;</p>')
      continue
    }
    parts.push(tokensToHtml(blockTokens(block, defaults, catalog)))
  }
  return parts.join('')
}

/** Raccourci : un bloc unique. */
export function renderText(
  text: string,
  block: Omit<RenderBlockSpec, 'text'>,
  defaults: { baseSize?: number; font?: string },
  catalog: EffectsCatalog,
): string {
  return renderSpec({ baseSize: defaults.baseSize, font: defaults.font, blocks: [{ ...block, text }] }, catalog)
}
