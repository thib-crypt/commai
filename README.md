# commai

> Générateur de messages de commit IA — propulsé par Gemini

## Installation rapide

```bash
# Cloner ou télécharger le repo, puis :
cd commai
npm install
npm link          # Rend "commai" disponible globalement
```

Ou via un chemin absolu dans votre `.bashrc` / `.zshrc` :
```bash
alias commai="node /chemin/vers/commai/bin/commai.js"
```

## Configuration

Au premier lancement, `commai` vous demande votre clé API Gemini.
Obtenez-en une gratuitement sur [Google AI Studio](https://aistudio.google.com/apikey).

La clé est sauvegardée dans `~/.commai.json`.

Pour la changer :
```bash
commai --config
```

Ou via variable d'environnement :
```bash
export GEMINI_API_KEY=votre_clé
```

### Configuration par projet (`.commairc`)

Créez un fichier `.commairc` à la racine de votre repo pour des conventions d'équipe :

```json
{
  "language": "fr",
  "defaultMode": "short",
  "excludeFiles": ["*.lock", "dist/**"]
}
```

| Option | Type | Description |
|--------|------|-------------|
| `language` | `string` | Langue des messages (`en`, `fr`, etc.) |
| `defaultMode` | `string` | Mode par défaut (`quick`, `short`, `standard`, `long`, `emoji`) |
| `excludeFiles` | `string[]` | Patterns de fichiers à exclure du diff |

## Utilisation

```bash
commai              # Mode interactif — choisissez le style
commai -q           # ⚡ Rapide : une ligne (conventionnal commit)
commai -s           # ✏️  Court : titre + contexte bref
commai -l           # 📝 Long : détaillé avec bullets
commai -e           # 🎨 Emoji (gitmoji)
commai --lang en    # 🌐 Forcer la langue (en, fr, es, de, etc.)
commai --push       # Génère, committe ET push automatiquement
commai --config     # Reconfigurer la clé API
commai --help       # Aide
```

## Styles disponibles

| Mode | Flag | Description |
|------|------|-------------|
| ⚡ Rapide | `-q` | Une ligne, max 72 chars |
| ✏️ Court | `-s` | Titre + 1-2 bullets |
| 📋 Standard | _(défaut)_ | Titre + paragraphe |
| 📝 Long | `-l` | Titre + description + bullets |
| 🎨 Emoji | `-e` | Style gitmoji |
| 💬 Chat | _(interactif)_ | Générer puis affiner avec l'IA |

## Mode Chat

Le mode Chat vous permet de discuter avec Gemini pour affiner le message :
- Modifier le ton, la précision, ajouter du contexte
- L'IA propose des améliorations et explique ses suggestions
- Vous pouvez aussi éditer manuellement à tout moment

## Fonctionnalités

- **Smart Diff** — Exclut automatiquement les lockfiles, fichiers minifiés et dossiers de build
- **Détection de branche** — Utilise le nom de branche pour enrichir le contexte IA
- **Scope automatique** — Détecte le scope du conventional commit depuis les fichiers modifiés
- **Streaming** — Affiche le message en temps réel pendant la génération
- **Retry intelligent** — Relance automatiquement en cas d'erreur réseau (3 tentatives)
- **Timeout** — Timeout de 30s pour éviter les blocages
- **Validation de clé** — Vérifie la clé API avant de la sauvegarder
- **Config projet** — Fichier `.commairc` pour des conventions d'équipe
- Stage automatiquement si besoin (`git add -A`)
- Option de push après commit
- Copie dans le presse-papier
- Clé API sauvegardée localement (`~/.commai.json`)

## Architecture

```
commai/
├── bin/commai.js       # Point d'entrée CLI
├── src/
│   ├── ai.js           # Génération IA (Gemini, retry, streaming)
│   ├── cli.js          # Orchestration principale
│   ├── clipboard.js    # Presse-papier cross-platform
│   ├── config.js       # Configuration (global + projet)
│   ├── git.js          # Opérations Git (smart diff, branche, scope)
│   ├── modes.js        # Définitions des styles de commit
│   └── ui.js           # Affichage (banner, boxes, couleurs)
├── package.json
└── README.md
```
