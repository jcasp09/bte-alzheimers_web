# BTE-Alzheimers (primary repo)

Preview: `npm run dev`

1. Overview
2. Core Functionality
3. Advanced Features
4. Tech Stack
5. Data Model

---

### 1. Overview

#### Motivation/Vision

This application provides preventative and early-stage cognitive support through visual, relational graphs. It can help you maintain routines, and stay on track through calendar integration, as well as preserve identity, and strengthen mental associations between the people, places, and activities most important to you

#### Demographic

Our app's aim is to adapt to cognitive progression instead of being limited to a single clinical use case. Through customizable UI, both cognitively intact individuals, as well as those looking for preventative-support can find use.

---

### 2. Core Functionality:

Visual Relationship Graphs lie at the heart of this application. They let you represents meaningful entities and their relationships to eachother.

### 1. Node Types:

- People (family, doctors, caregivers)
- Places (home, work, doctor’s office)
- Tasks / Events (Calendar integration)
- Memories (Journal-entries)

### 2. Edge Types: (TBD)

### 3. UI

Each graph is **highly customizable**:

- Node size and visibility control
- Adjustable number of displayed nodes
- Zoomable and pannable layout
- Ability to:
  - Add nodes
  - Add relationships
  - Upload images per node
  - Link nodes together
- Gentle 2D physics (nodes slowly float for an inviting feel)
- Dynamic node scaling based on importance / urgency
- Accessibility features:

---

### 3. Advanced Feature Concepts

#### A. Task / Calendar Integration (Time-Oriented Cognitive Support)

- Integrates external calendar APIs
- Automatically creates task/event nodes
- Tasks dynamically link to:
  - Person nodes
  - Place nodes
  - Medication nodes

Example:
A doctor’s appointment → creates a task node → links to:

- Doctor (person)
- Doctor’s office (place)

Graph-driven scheduling visualization:

- Node size ∝ time until event
- Display limits:
  - Maximum upcoming tasks
  - Maximum linked context nodes
- Tunable complexity for different cognitive needs

This targets common decline areas:

- Time orientation
- Task recall
- Planning
- Sequencing

#### B. Memory / Moment Nodes (Past-Oriented Cognitive Support)

Memory nodes act as visual snapshots of the past, serving as:

- Emotional anchors
- Identity reinforcers
- Relationship reminders

Each memory node contains:

- One or more images
- Description text
- Links to any relevant people, places, or tasks

Two design options:

1. Separate Visual Journal View
2. Unified Graph Node Type
   These nodes connect past, present, and future, reinforcing continuity of identity.

---

### 4. Tech Stack

### Frontend

- React + Vite
- React Flow

### Backend: Firebase (BaaS)

#### Authentication

- Handles user authentication
- Stores identity & access control

#### Firestore Database

- Stores:
  - User profiles
  - Graph structure
  - Nodes
  - Edges
  - Preferences
  - Reminders

#### Storage

- Stores:
  - Node images
  - Memory photos
- Firestore only stores image URLs

---

### 5. High-Level Data Model (WIP)

```swift
users/{userId}/
 ├── profile/
 │    ├── name
 │    ├── email
 │    ├── themePreference
 │    ├── emergencyContacts
 │
 ├── graph/
 │    ├── nodes/{nodeId}/
 │    │     ├── type (person | place | task | memory)
 │    │     ├── label
 │    │     ├── imageURLj
 │    │     ├── priority
 │    │     ├── metadata (timestamps, tags, etc.)
 │    │
 │    ├── edges/{edgeId}/
 │          ├── sourceNodeId
 │          ├── targetNodeId
 │          ├── relationshipType
 │          ├── weight / importance
 │
 ├── reminders/
 │    ├── {reminderId}
```
