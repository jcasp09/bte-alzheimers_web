# Memory Jog

Memory Jog is a web application that turns the people, places, tasks, and memories most important to you into a calm, visual map. It is designed to support cognitive wellbeing across a wide spectrum, from people who want a friendlier way to keep track of their lives to those living with dementia or Alzheimer's. Caregivers and family members can also help set up and maintain the graph on someone else's behalf.

## Contents

1. Overview
2. Features
3. How to Run It
4. Configuration
5. Project Structure
6. Tech Stack

## 1. Overview

The core idea is simple. Rather than asking the user to manage long lists, calendars, and contacts spread across different apps, Memory Jog draws a single relationship graph centered on the person using it. Family, friends, doctors, neighbors, meaningful places, and upcoming tasks all become nodes that connect back to a central "Self" node. The result is a familiar, at-a-glance picture of one's life that is easier to read than text-heavy interfaces.

The interface is built for clarity first. Visuals are large, contrast is high, motion can be reduced, and themes are adjustable. The same graph that helps someone with mild memory issues stay oriented can be used by a fully cognitively intact user who simply enjoys the layout.

## 2. Features

### Relationship Graph

The main canvas is an interactive graph powered by React Flow. A central "Self" node represents the user, surrounded by concentric rings:

- **Favorites**: spouse, parents, children, siblings, and anyone else you choose to keep nearest.
- **Family**: extended family, including grandparents, aunts, uncles, cousins, and in-laws.
- **Friends**: personal friends.
- **Community**: neighbors, coworkers, doctors, caregivers, and other people in your life.
- **Places**: meaningful places such as home, workplaces, and regular destinations.

Ring placement is automatic when you set a relationship. For example, typing "daughter" places the node in Favorites, while "doctor" places it in Community. Any node can also be moved to a different ring manually. Each node carries a photo, name, and the metadata that makes sense for its type: people show relationship, email, and phone; places show address.

The canvas itself supports panning, zooming, drag-and-drop placement from a dock of node types, gentle motion (which can be turned off), and a search bar that jumps to any node by name. A side panel handles adding nodes, viewing details, editing connections, and removing items. A left sidebar provides ring visibility filters, edge controls, and a minimap.

### Memory Bubbles

Memories are captured as bubbles that anchor a moment in time. Each one can include one or more photos, a title and description, an "occurred on" date, and links to the people and places involved. From the graph, you can flip on the **Memory Lens** to overlay memory bubbles on top of the relationship graph and brush across a timeline to focus on a specific period. While the lens is active, context nodes that are not connected to a visible memory fade back so the moment stands out.

The home dashboard also surfaces a "Latest memory" card and a running count of memories, so picking up where you left off is easy.

### Tasks and Calendar

Tasks live inside the graph experience. The graph's left sidebar shows your upcoming items in chronological order, with friendly labels like "Today" and "Tomorrow," small avatars of the people and places each task is linked to, and a quick add button. Tasks can be created manually or imported by connecting Google Calendar from the Integrations settings page. Imported events become task entries that can link to relevant people and places, and items that have already passed are cleaned up automatically.

### Customizable Appearance

Three themes ship with the app: **Soft** (sage greens, the default), **Warm** (parchment and brown for a softer, paper-like feel), and **Dark** (low-light navy with warm gold accents). Theme choice is saved to the user's profile and follows them across devices.

### Accessibility

Motion can be set to follow the system's reduced-motion preference or always reduced, which is helpful for users sensitive to animation. The graph supports keyboard navigation, ARIA roles, generous tap targets, and plain-language validation messages. Design tokens are centralized so future accessibility adjustments, including font sizing, can be tuned in one place.

### Account Management

Each user has a profile that includes name, birthday, and an optional photo. Settings are split into Account, Appearance, Accessibility, and Integrations for easy navigation.

### Per-User Cloud Sync

Everything lives in the user's own Firestore document. Photos are stored in Firebase Storage and referenced by URL, which keeps Firestore reads lightweight.

## 3. How to Run It

The web app is a Vite project. You will need Node.js 20 or later and npm installed.

**First time setup:**

1. From the `bte-alzheimers_web` directory, install dependencies: `npm install`
2. Copy `configs/.env.example` to `configs/.env` and fill in your Firebase project credentials and Google Calendar OAuth client ID. Details are in the Configuration section below.
3. Run the server via `npm run dev`, and view at http://localhost:5173.

## 4. Configuration

All environment variables live in `configs/.env`. The `configs/.env.example` file is checked in as a template; the real `.env` is ignored by git. You will need:

- A Firebase project with Authentication (Email/Password), Cloud Firestore, and Cloud Storage enabled. Paste the Web SDK config values into the seven `VITE_FIREBASE_*` variables.
- A Google Cloud OAuth 2.0 Web client with the Calendar read-only scope. Paste the client ID into `VITE_GOOGLE_CALENDAR_CLIENT_ID`.

Firestore and Storage security rules are kept in `configs/firestore.rules` and `configs/storage.rules`, wired up through `firebase.json`. Deploy them with the Firebase CLI when you are ready to push changes.

## 5. Project Structure

The `src/` folder is organized by feature rather than by file type:

- `app/` contains the top-level header and application shell.
- `auth/` holds the authentication context and provider that expose the current user and profile to the rest of the app.
- `firebase/` initializes the Firebase app and exports the SDK clients for Auth, Firestore, and Storage.
- `calendar/` wraps the Google Calendar OAuth flow and event sync.
- `graph/` contains the visual graph: node components (including the memory bubble), edge handles, Firestore adapters for nodes, edges, and tasks, the ring model, and the modal dialogs for adding and editing nodes, connections, tasks, and memories.
- `memories/` contains memory storage, the memory-lens model, the timeline component, and the memory detail modal.
- `pages/` contains the routed pages: the marketing-and-dashboard `Home` page, the `graph/` page with its sidebar, dock, search, and task list, and the `settings/` section.
- `settings/` stores the theme and motion preference modules.
- `shared/` contains the reusable UI primitives, hooks, validation helpers, and design tokens used across the app.

## 6. Tech Stack

**Frontend**

- React 19 with TypeScript
- Vite 7 for the dev server and production builds
- React Router 7 for navigation
- @xyflow/react (React Flow) for the graph canvas
- clsx for class composition
- CSS Modules and CSS custom properties for theming

**Backend (Firebase)**

- Authentication (Email/Password)
- Cloud Firestore for user data, nodes, edges, tasks, and memories
- Cloud Storage for images
- Analytics

**Tooling**

- ESLint with the TypeScript and React Hooks plugins
- TypeScript strict configuration split across `configs/tsconfig.app.json` and `configs/tsconfig.node.json`
