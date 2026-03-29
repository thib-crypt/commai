# commai 🤖

[🇬🇧 English](#-english) | [🇫🇷 Français](#-français)

---

## 🇬🇧 English

> ✨ AI-powered git commit generator — powered by Google Gemini

### 🚀 Quick Install

```bash
# Clone or download the repository, then:
cd commai
npm install
npm link          # Makes "commai" available globally
```

Alternatively, via an absolute path in your `.bashrc` / `.zshrc`:
```bash
alias commai="node /path/to/commai/bin/commai.js"
```

### ⚙️ Setup

On first launch, `commai` will ask for your Gemini API key and preferred language.
Get a free API key at [Google AI Studio](https://aistudio.google.com/apikey).

The key and preferences are securely saved in `~/.commai.json`.

Access the interactive settings menu anytime to adjust your config:
```bash
commai --settings
```

You can also provide the key via an environment variable:
```bash
export GEMINI_API_KEY=your_api_key
```

### 🛠 Usage

```bash
commai              # Interactive mode — choose your style
commai -q           # ⚡ Quick: One line (conventional commit max 72 chars)
commai -s           # ✏️  Short: Title + brief context
commai -l           # 📝 Long: Title + description + bullet points
commai -e           # 🎨 Emoji: Gitmoji style
commai --lang <lg>  # 🌐 Force language (en, fr, es, de)
commai --push       # Generate, commit, AND push automatically
commai --install-hook # Install Git hook for a zero-click experience
commai --guide      # Launch the interactive onboarding tutorial
commai --settings   # Open interactive settings menu
commai --help       # Display help
```

### ✨ Features

- **Interactive Staging:** If nothing is staged, commai lets you interactively select the unstaged files you want to include in the commit.
- **Smart Diffing:** Automatically excludes lockfiles, minified files, and build folders from the context to save tokens and improve AI accuracy.
- **Branch & Ticket Detection:** Extracts the scope and ticket numbers (e.g., Jira, GitHub) directly from your branch name.
- **Multilingual Support:** Interface and commit message generation fully supported in English, French, Spanish, and German.
- **Chat Mode:** Discuss with Gemini to refine, tweak, or completely rewrite the generated commit message before saving.
- **Project Rules:** Use a local `.commairc` file to enforce specific team conventions or syntax.
- **Git Hook Integration:** Run `commai --install-hook` and experience commai automatically whenever you type `git commit`.
- **Live Streaming:** Watch Gemini write your commit message in real-time.

### 📋 Project Configuration (`.commairc`)

Create a `.commairc` file at the root of your repository to define project-specific conventions:

```json
{
  "language": "en",
  "defaultMode": "short",
  "excludeFiles": ["*.lock", "dist/**"],
  "rules": [
    "Always use the imperative mood",
    "Never mention variable names in the subject line"
  ]
}
```

| Option | Type | Description |
|--------|------|-------------|
| `language` | `string` | Commit message language (`en`, `fr`, `es`, `de`, etc.) |
| `defaultMode` | `string` | Default commit style (`quick`, `short`, `standard`, `long`, `emoji`) |
| `excludeFiles` | `string[]` | Array of regex patterns to exclude files from the diff |
| `rules` | `string[]` | Custom instructions passed to the AI to format the commit |

---

## 🇫🇷 Français

> ✨ Générateur de messages de commit IA — propulsé par Google Gemini

### 🚀 Installation rapide

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

### ⚙️ Configuration

Au premier lancement, `commai` vous demandera votre clé API Gemini et votre langue préférée.
Obtenez une clé gratuitement sur [Google AI Studio](https://aistudio.google.com/apikey).

La clé et vos préférences sont sauvegardées de manière sécurisée dans `~/.commai.json`.

Accédez au menu interactif des réglages à tout moment pour modifier votre configuration :
```bash
commai --settings
```

Vous pouvez aussi utiliser une variable d'environnement :
```bash
export GEMINI_API_KEY=votre_clé
```

### 🛠 Utilisation

```bash
commai              # Mode interactif — choisissez le style
commai -q           # ⚡ Rapide : Une ligne (conventional commit)
commai -s           # ✏️  Court : Titre + contexte bref
commai -l           # 📝 Long : Titre + description + liste à puces
commai -e           # 🎨 Emoji : Style gitmoji
commai --lang <lg>  # 🌐 Forcer la langue (en, fr, es, de)
commai --push       # Génère, committe ET push automatiquement
commai --install-hook # Installe le hook Git pour exécuter commai via un simple git commit
commai --guide      # Lancer le tutoriel d'accueil interactif
commai --settings   # Ouvrir le menu des réglages
commai --help       # Aide
```

### ✨ Fonctionnalités

- **Staging Interactif :** Sélectionnez précisément quels fichiers non-stagés inclure si rien n'est encore stagé, directement depuis la CLI.
- **Smart Diff :** Exclut automatiquement les lockfiles, les fichiers minifiés et les dossiers de build pour des résultats plus performants.
- **Détection de Branche & Tickets :** Extrait automatiquement le scope et les numéros de tickets (JIRA, GitHub) depuis le nom de votre branche.
- **Support Multilingue :** L'interface et la génération de commits sont supportées en Français, Anglais, Espagnol et Allemand.
- **Mode Chat :** Discutez avec Gemini pour affiner, modifier ou réécrire le message généré avant validation.
- **Règles par Projet :** Utilisez un fichier `.commairc` pour imposer des conventions d'équipe.
- **Intégration Git Hook :** Lancez `commai --install-hook` pour que commai prenne le relai à chaque commande `git commit`.
- **Streaming :** Affiche la génération de votre message par l'IA en temps réel.

### 📋 Configuration par projet (`.commairc`)

Créez un fichier `.commairc` à la racine de votre dépôt pour des conventions spécifiques à votre projet :

```json
{
  "language": "fr",
  "defaultMode": "short",
  "excludeFiles": ["*.lock", "dist/**"],
  "rules": [
    "Toujours utiliser le présent de l'indicatif",
    "Ne jamais mentionner le nom des variables dans le titre"
  ]
}
```

| Option | Type | Description |
|--------|------|-------------|
| `language` | `string` | Langue préférée des messages (`en`, `fr`, `es`, `de`, etc.) |
| `defaultMode` | `string` | Mode par défaut (`quick`, `short`, `standard`, `long`, `emoji`) |
| `excludeFiles` | `string[]` | Patterns regex de fichiers à exclure du diff |
| `rules` | `string[]` | Instructions personnalisées passées à l'IA pour encadrer le résultat |
