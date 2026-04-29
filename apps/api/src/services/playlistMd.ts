// ============================================================================
// Parser / writer du format Markdown des playlists — CDC §7.4
//
// Format :
//   ---
//   name: "Blind Test Pop Culture 90-2000"
//   created: 2026-04-18
//   source_platform: manual
//   ---
//
//   ## Morceau 1
//   - titre: Around the World
//   - artiste: Daft Punk
//   - annee: 1997
//   - source_type: musique
//   - source_name: Album Homework
//   - image: https://...
//   - fichier: /musiques/daft-punk-around-the-world.mp3
//   - bonus: non
//   - indices:
//     1. Groupe français de musique électronique
//     2. Structure musicale basée sur la répétition
//
// Implémentation volontairement sans dépendance YAML : le front matter est
// tolérant aux guillemets simples/doubles et aux valeurs non quotées.
// ============================================================================

import type { SourceType } from '@prisma/client';

export type ParsedTrack = {
  title: string;
  artist: string | null;
  year: number | null;
  sourceType: SourceType | null;
  sourceName: string | null;
  imageUrl: string | null;
  filePath: string | null;
  hasBonus: boolean;
  hints: string[];
};

export type ParsedPlaylist = {
  name: string;
  sourcePlatform: 'youtube' | 'spotify' | 'deezer' | 'manual';
  tracks: ParsedTrack[];
  warnings: string[];
};

const VALID_SOURCE_TYPES: readonly SourceType[] = ['film', 'manga', 'jeu', 'serie', 'autre'] as const;
const VALID_PLATFORMS = ['youtube', 'spotify', 'deezer', 'manual'] as const;

function stripQuotes(v: string): string {
  const t = v.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

function parseBool(v: string): boolean {
  const t = v.trim().toLowerCase();
  return t === 'oui' || t === 'yes' || t === 'true' || t === '1';
}

function parseFrontMatter(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of block.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    out[key] = stripQuotes(val);
  }
  return out;
}

function normalizeSourceType(v: string | null): SourceType | null {
  if (!v) return null;
  const t = v.trim().toLowerCase();
  if (t === 'jeu vidéo' || t === 'jeu video' || t === 'jv') return 'jeu';
  if (t === 'série') return 'serie';
  return (VALID_SOURCE_TYPES as readonly string[]).includes(t) ? (t as SourceType) : null;
}

function parseTrackSection(section: string, warnings: string[], index: number): ParsedTrack | null {
  const lines = section.split(/\r?\n/);
  const props: Record<string, string> = {};
  const hints: string[] = [];
  let inHints = false;

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) continue;

    // Sous-liste numérotée des indices (avec indentation)
    const hintMatch = line.match(/^\s+(?:\d+\.|[-*])\s+(.+)$/);
    if (inHints && hintMatch) {
      hints.push(hintMatch[1].trim());
      continue;
    }

    const bulletMatch = line.match(/^\s*-\s+([a-zA-Zéèàêâûîïôöäüùç_]+)\s*:\s*(.*)$/);
    if (!bulletMatch) { inHints = false; continue; }

    const key = bulletMatch[1].toLowerCase().replace(/é/g, 'e').replace(/è/g, 'e');
    const value = bulletMatch[2].trim();

    if (key === 'indices' || key === 'indice') {
      inHints = true;
      if (value) hints.push(stripQuotes(value));
      continue;
    }
    inHints = false;
    props[key] = stripQuotes(value);
  }

  const title = props['titre'] ?? props['title'] ?? '';
  if (!title) { warnings.push(`Morceau ${index} ignoré : titre manquant`); return null; }

  const yearRaw = props['annee'] ?? props['year'] ?? '';
  const year = yearRaw ? Number(yearRaw) : null;

  return {
    title,
    artist: props['artiste'] ?? props['artist'] ?? null,
    year: year && !Number.isNaN(year) ? year : null,
    sourceType: normalizeSourceType(props['source_type'] ?? null),
    sourceName: props['source_name'] ?? null,
    imageUrl: props['image'] ?? null,
    filePath: props['fichier'] ?? props['file'] ?? null,
    hasBonus: parseBool(props['bonus'] ?? 'non'),
    hints,
  };
}

export function parsePlaylistMd(source: string): ParsedPlaylist {
  const warnings: string[] = [];
  let body = source.replace(/^\uFEFF/, '');

  let name = 'Playlist importée';
  let sourcePlatform: ParsedPlaylist['sourcePlatform'] = 'manual';

  const fmMatch = body.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (fmMatch) {
    const fm = parseFrontMatter(fmMatch[1]);
    if (fm.name) name = fm.name;
    const sp = (fm.source_platform ?? 'manual').toLowerCase();
    if ((VALID_PLATFORMS as readonly string[]).includes(sp)) sourcePlatform = sp as typeof sourcePlatform;
    body = body.slice(fmMatch[0].length);
  } else {
    warnings.push("Pas d'en-tête YAML — valeurs par défaut utilisées");
  }

  const sections = body.split(/^##\s.+$/m).slice(1);
  const tracks: ParsedTrack[] = [];
  sections.forEach((section, i) => {
    const t = parseTrackSection(section, warnings, i + 1);
    if (t) tracks.push(t);
  });

  if (tracks.length === 0) warnings.push('Aucun morceau détecté dans le fichier .md');

  return { name, sourcePlatform, tracks, warnings };
}

// ----------------------------------------------------------------------------
// Writer : sérialise une playlist DB en format .md conforme CDC §7.4
// ----------------------------------------------------------------------------

type DbTrack = {
  title: string;
  artist: string | null;
  year: number | null;
  sourceType: SourceType | null;
  sourceName: string | null;
  imageUrl: string | null;
  filePath: string | null;
  hasBonus: boolean;
  hints: { hintText: string; hintOrder: number }[];
};

type DbPlaylist = {
  name: string;
  sourcePlatform: string;
  createdAt: Date;
  tracks: DbTrack[];
};

export function writePlaylistMd(playlist: DbPlaylist): string {
  const date = playlist.createdAt.toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push('---');
  lines.push(`name: "${playlist.name.replace(/"/g, '\\"')}"`);
  lines.push(`created: ${date}`);
  lines.push(`source_platform: ${playlist.sourcePlatform}`);
  lines.push('---');
  lines.push('');

  playlist.tracks.forEach((t, i) => {
    lines.push(`## Morceau ${i + 1}`);
    lines.push(`- titre: ${t.title}`);
    if (t.artist) lines.push(`- artiste: ${t.artist}`);
    if (t.year) lines.push(`- annee: ${t.year}`);
    if (t.sourceType) lines.push(`- source_type: ${t.sourceType}`);
    if (t.sourceName) lines.push(`- source_name: ${t.sourceName}`);
    if (t.imageUrl) lines.push(`- image: ${t.imageUrl}`);
    if (t.filePath) lines.push(`- fichier: ${t.filePath}`);
    lines.push(`- bonus: ${t.hasBonus ? 'oui' : 'non'}`);
    const sortedHints = [...t.hints].sort((a, b) => a.hintOrder - b.hintOrder);
    if (sortedHints.length > 0) {
      lines.push(`- indices:`);
      sortedHints.forEach((h, hi) => lines.push(`  ${hi + 1}. ${h.hintText}`));
    }
    lines.push('');
  });

  return lines.join('\n');
}
