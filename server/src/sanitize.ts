/**
 * Sanitisation du HTML des projets.
 *
 * Les projets sont relus dans l'éditeur du site (innerHTML) : le HTML entrant
 * doit être borné. Le colorieur ne produit que span/b/i/u/s/a/font/p/br avec
 * style, href et color — on accepte exactement cela, on rejette le reste.
 * Best effort documenté : les projets ne sont lisibles que par leur
 * propriétaire, mais on ne fait jamais confiance à un client.
 */

const ALLOWED_TAGS = new Set(['p', 'span', 'b', 'i', 'u', 's', 'a', 'font', 'br', 'strong', 'em'])

/** Vire les blocs entiers dangereux, puis les attributs veto, puis les tags inconnus */
export function sanitizeDraftHtml(html: string): string {
  let out = html
  out = out.replace(/<\s*(script|style|iframe|object|embed|svg|math|template)[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
  out = out.replace(/<\s*(script|style|iframe|object|embed|svg|math|template)[^>]*\/?>/gi, '')
  // Attributs d'événement et URLs dangereuses
  out = out.replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
  out = out.replace(/\son\w+\s*=\s*'[^']*'/gi, '')
  out = out.replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
  out = out.replace(/(href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi, '$1=$2#$2')
  // Tags hors liste : ouverts ou fermés, supprimés (le contenu reste)
  out = out.replace(/<\s*\/?\s*([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^<>]*)?)>/g, (m, tag: string) => {
    return ALLOWED_TAGS.has(tag.toLowerCase()) ? m : ''
  })
  return out
}

export function isReasonableDraftHtml(html: string): boolean {
  return typeof html === 'string' && html.length <= 400_000
}
