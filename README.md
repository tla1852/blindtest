# 🎮 RetroBuzz

**Blind test musical interactif — esthétique rétro-arcade années 90-2000**

Application temps réel permettant à un animateur de piloter des sessions de blind test dans un bar ou lors d'événements à thème pop culture. Les participants buzzent depuis leur smartphone via un QR code ; un écran de présentation (TV/vidéoprojecteur) affiche le classement et les réponses.

> Cahier des charges : Notion — RetroBuzz v1.3 (18 avril 2026)

---

## 🧱 Stack

| Couche | Techno |
|---|---|
| Frontend (participant + présentation) | Next.js 14 + TypeScript + TailwindCSS |
| Admin / Animateur | Next.js 14 (web, pilotage provisoire) · cible CDC : **Electron + TypeScript** (Windows natif) |
| Backend | Fastify + TypeScript |
| Temps réel | Socket.io (WebSocket) |
| Base de données | PostgreSQL 16 + Prisma |
| Cache / Pub-Sub | Redis 7 |
| Auth | JWT + bcrypt |
| QR code | `qrcode` (frontend) |
| Audio | **Lecteur HTML5 natif** (Web Audio) — fichier local via file picker |
| Stockage playlists | BDD Postgres + export/import **Markdown** (`.md`, CDC §7.4) |

> ⚠️ La cible long terme pour l'admin est une **app Electron Windows** embarquant
> directement le lecteur audio (CDC §3.3–§3.4). Cette version web couvre la même
> logique via un `<audio>` HTML5 + file picker en attendant le portage.

---

## 🚀 Démarrage rapide

### Prérequis
- Node.js ≥ 20
- Docker + Docker Compose
- (optionnel) clés API : YouTube, Deezer

### Installation

```bash
git clone https://github.com/tla1852/blindtest.git
cd blindtest
cp .env.example .env
# Éditer .env avec vos clés API

npm install
docker compose up -d postgres redis
npm run db:migrate
npm run db:seed
npm run dev
```

Ouvrir :
- **Animateur** : http://localhost:3000/admin (login : `admin@retrobuzz.io` / `retrobuzz`)
- **Participant** : http://localhost:3000/play/:gameId (ou scan QR)
- **Présentation** : http://localhost:3000/display/:gameId

### Avec Docker complet

```bash
docker compose up --build
```

---

## 🗂️ Structure

```
blindtest/
├── apps/
│   ├── api/              # Backend Fastify + Socket.io
│   │   ├── prisma/       # Schéma + migrations
│   │   └── src/
│   │       ├── routes/   # REST (auth, playlists, games, import, stats)
│   │       ├── services/ # youtube, deezer, n8n, gameState, playlistMd
│   │       ├── ws/       # Handlers Socket.io
│   │       └── middleware/
│   └── web/              # Frontend Next.js (3 écrans)
│       └── src/app/
│           ├── admin/    # /admin, /admin/game/[id]
│           ├── display/  # /display/[id]
│           └── play/     # /play/[id]
├── docker-compose.yml
└── .env.example
```

---

## 🎯 Modes de jeu

- **Free for All (FFA)** — jusqu'à 40 joueurs individuels
- **Team Deathmatch (TDM)** — 8 équipes max, 2 buzz par équipe par manche (configurable)

## 🔊 Contrôle audio

Le lecteur audio est **embarqué dans la page admin** via un élément `<audio>`
HTML5. L'animateur charge un fichier local (MP3, FLAC, AAC…) via file picker,
ou utilise le `previewUrl` 30s de Deezer si disponible. Quand un joueur
buzze, le serveur émet `track:pause` vers le navigateur animateur + écran
présentation (CDC §5.1), et le lecteur local s'arrête instantanément —
aucun lecteur tiers (VLC, Spotify Desktop) n'est requis.

## 📄 Playlists au format Markdown

Les playlists peuvent être **importées et exportées au format `.md`** (CDC §7.4).
Le format est éditable dans n'importe quel éditeur texte et encode titre,
artiste, année, source, indices, chemin de fichier local et point bonus.

```markdown
---
name: "Blind Test 90s"
created: 2026-04-18
source_platform: manual
---

## Morceau 1
- titre: Wonderwall
- artiste: Oasis
- annee: 1995
- fichier: /musiques/wonderwall.mp3
- bonus: non
- indices:
  1. Groupe de Manchester
  2. Premier album : Definitely Maybe
```

## 🎨 Identité visuelle

Esthétique VHS / arcade : fond sombre, néons violet `#A855F7` / rose `#F472B6` / cyan `#38BDF8` / or `#FBBF24`. Typos : `Press Start 2P` (titres/jeu) + `Outfit` (texte courant).

---

## 📅 Roadmap

- [x] **Phase 1 — MVP** : auth, import Deezer/YouTube + `.md`, FFA, 3 écrans, WebSocket
- [x] **Phase 2** : TDM, indices (manuels + N8N), bonus, délai buzz, stats, historique, export `.md`
- [ ] **Phase 3** : **portage admin en app Electron Windows** (CDC §3.3), polish animations, déploiement cloud, tests de charge

## 📄 Licence

MIT
