export interface ParsedSeries {
  name: string
  label: string | null // position as printed: "1", "1.5", "1–3"; null when unnumbered
  sortKey: number | null // numeric ordering derived from the label; null when unnumbered
}

// Position suffixes we recognise on a free-text series string, e.g. the
// "#1" in "Foundation #1", the ", Part 1" in "The Lord of the Rings, Part 1",
// the " (2)" in "Dune (2)". A bare trailing number with no marker is left
// alone - "Warhammer 40,000" is a name, not "Warhammer" volume 40,000.
const POSITION = new RegExp(
  '^(.*?)[\\s,]*(?:#|part\\s+|book\\s+|vol\\.?\\s+|volume\\s+|\\()' +
    '\\s*(\\d+(?:\\.\\d+)?(?:\\s*[-–]\\s*\\d+(?:\\.\\d+)?)?)\\s*\\)?$',
  'i'
)

// Lenient parse of one series string into { name, label, sortKey }. Used for
// Open Library lookups, the catalogue's inline editor, and CSV import - all of
// which hand us free text of varying shape.
export function parseSeries(raw: string): ParsedSeries | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const match = POSITION.exec(trimmed)
  if (!match || !match[1].trim()) {
    return { name: trimmed, label: null, sortKey: null }
  }

  const label = match[2].replace(/\s+/g, '')
  const sortKey = Number.parseFloat(label) // "1-3" and "1–3" both yield 1
  return {
    name: match[1].trim().replace(/[\s,]+$/, ''),
    label,
    sortKey: Number.isNaN(sortKey) ? null : sortKey,
  }
}

// Inverse of parseSeries, for display and CSV export.
export function formatSeries(entry: { name: string; label: string | null }): string {
  return entry.label ? `${entry.name} #${entry.label}` : entry.name
}
