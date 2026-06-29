# Frontend Architecture Documentation

## Phase 1 – Project Overview

**Project Purpose:**
The project serves as a Student Portal and an AI-driven Academic Advisor. It allows students and prospective students (guests) to explore academic programs, chat with an AI agent to get personalized major/course recommendations, and visualize knowledge graphs related to their fields of interest.

**Main User Workflows:**
1. **Authentication:** Users can log in using a Student ID/Password or continue as a Prospective Student (Guest).
2. **Dashboard & Navigation:** Logged-in users access a central dashboard to navigate between Home, Courses, Advisor, and Results.
3. **AI Academic Advisor:** Users chat with an AI agent (`ChatPage` or `AdvisorPage`) which provides textual answers and visualizes concepts via a knowledge graph.
4. **Decision Engine:** Users input their academic background (High School Percentage, Certificate Type, Budget, Interests) into a form (`DecisionForm`), which queries the backend to recommend suitable college programs.
5. **Administration:** Admins can access `AdminDashboardPage` to configure program constraints (minimum percentage, fees, allowed tracks).

**Business Goal:**
To streamline the college enrollment and major selection process by providing an interactive, AI-powered advisory system that matches students to suitable programs based on their preferences and academic background.

**Technology Stack:**
- **Core:** React 19, TypeScript, React Router v7, Vite v8
- **Styling:** Tailwind CSS v3.4 (with custom typography plugin), Lucide React (icons)
- **Data Visualization:** `react-force-graph`, `d3`, `vis-network`
- **Network Layer:** `fetch` API, Axios v1.15
- **Animations:** `framer-motion`

**Frontend Architectural Style:**
Single Page Application (SPA) leveraging functional components, React Hooks (`useState`, `useEffect`, `useCallback`, `useMemo`), and Context API for global state. The application features a modular structure segregating UI components, decision engine elements, and API services.

---

## Phase 2 – Repository Structure

```text
frontend/
├── src/
│   ├── auth/
│   │   └── RequireStudent.tsx
│   ├── components/
│   │   ├── pages/             (Main dashboard pages)
│   │   │   ├── AdvisorPage.tsx
│   │   │   ├── CoursesPage.tsx
│   │   │   ├── HomePage.tsx
│   │   │   └── ResultsPage.tsx
│   │   ├── ChatMessage.tsx
│   │   ├── ConversationHistorySidebar.tsx
│   │   ├── Dashboard.tsx
│   │   ├── GraphVisualizer.tsx
│   │   ├── LoginPage.tsx
│   │   └── ...
│   ├── decision/              (Decision Engine Domain)
│   │   ├── components/        (Domain-specific UI)
│   │   │   ├── CollegeCard.tsx
│   │   │   ├── DecisionForm.tsx
│   │   │   └── VoiceRecorder.tsx
│   │   ├── context/
│   │   │   └── StudentContext.tsx
│   │   └── pages/             (Domain-specific Pages)
│   │       ├── AdminDashboardPage.tsx
│   │       ├── ChatPage.tsx
│   │       └── DecisionPage.tsx
│   ├── services/              (API & Network Layer)
│   │   ├── agentService.ts
│   │   ├── backendService.ts
│   │   ├── conversationsApi.ts
│   │   └── decisionApi.ts
│   ├── App.tsx                (Routing configuration)
│   ├── index.css              (Global Tailwind imports)
│   ├── index.tsx              (Application entry point)
│   └── types.ts               (Shared TypeScript definitions)
├── .env                       (Environment variables)
├── package.json               (Dependencies and scripts)
├── tailwind.config.js         (Tailwind theme customization)
└── vite.config.ts             (Vite bundler configuration)
```

**Folder Responsibilities:**
- **`src/components/`**: Reusable generic UI elements and main application pages.
- **`src/decision/`**: Encapsulates the entire "Decision Engine" feature, including its specific context, components, and pages (Feature-Sliced Design pattern).
- **`src/services/`**: Abstracts all backend communication, containing HTTP clients and mock implementations.
- **`src/auth/`**: Contains authorization wrappers and utility components.

---

## Phase 3 – Entry Point Analysis

**Entry Point Sequence:**

```text
Browser
  ↓
index.html (div#root)
  ↓
src/index.tsx (ReactDOM.createRoot)
  ↓
<React.StrictMode>
  ↓
<BrowserRouter>
  ↓
<App>
  ↓
<StudentProvider>
  ↓
<Routes>
  ↓
Pages
```

**Key Details:**
- **`index.tsx`**: Initializes React 19 root, applies `React.StrictMode`, and wraps the application in `BrowserRouter`.
- **`App.tsx`**: Initializes the routing tree and the global `StudentProvider`. It reads authentication state synchronously from `localStorage` during initial mount to determine the user's session status (logged in vs. guest vs. unauthenticated).
- **Theme Initialization**: Tailwind directives are imported via `index.css`.

---

## Phase 4 – Routing System

| Route | Component | Purpose | Authentication | APIs Used |
|---|---|---|---|---|
| `/` | `LoginPage` | Authentication portal | None | Local auth logic |
| `/dashboard` | `HomePage` | Main landing for students | User (Not Guest) | None |
| `/advisor` | `AdvisorPage` / `GuestAdvisorPage`| Interactive AI Chat & Graph | User / Guest | `agentService`, `conversationsApi` |
| `/courses` | `CoursesPage` | Display academic courses | User (Not Guest) | NOT FOUND IN CODEBASE |
| `/results` | `ResultsPage` | Display academic results | User (Not Guest) | NOT FOUND IN CODEBASE |
| `/decision` | `DecisionPage` | Input form & recommendations| None (Public) | `decisionApi` |
| `/decision/chat` | `ChatPage` | Fullscreen decision AI chat | None (Public) | `agentService` |
| `/decision/admin` | `AdminDashboardPage` | Configure gatekeeper rules | None (Public) | `axios` (Admin APIs) |

**Routing Flow Diagram:**

```text
User Navigation
       ↓
    App.tsx (Route Definitions & Auth Guards)
       ↓
    Condition: Is User Logged In?
       ├── No → LoginPage
       └── Yes → Condition: Is Guest?
                  ├── Yes → GuestAdvisorPage
                  └── No → Dashboard (Layout Wrapper)
                             ↓
                        Target Page (e.g., HomePage, CoursesPage)
```

---

## Phase 5 – Page Documentation

### 1. `AdvisorPage`
- **Purpose**: A comprehensive AI chat interface featuring a conversation history sidebar, a chat pane, and a dynamic Force-Directed Graph visualization.
- **Components Used**: `ConversationHistorySidebar`, `ChatMessage`, `GraphVisualizer`, `VoiceRecorder`.
- **Local State**: `conversations`, `currentCid`, `messages`, `graph`, `input`, `isLoading`, `isRecording`, `graphPanelMode`.
- **API Dependencies**: `listConversations`, `getConversation`, `askAgent`, `saveMessage`.
- **Data Flow**: User inputs text/voice -> Sent to `askAgent` -> Response updates `messages` and `graph` state -> Triggers re-render of `GraphVisualizer`.
- **Loading States**: Displays a custom pulsing dot loader when `isLoading` is true.
- **Error Handling**: Sets and renders `historyError` if chat fetching fails.

### 2. `DecisionPage`
- **Purpose**: Provides a split-pane layout where users adjust academic parameters to receive college program recommendations.
- **Components Used**: `DecisionForm`, `CollegeCard`.
- **Local State**: `recommendations` (array of cards), `loading`, `error`.
- **Global State**: `profile` from `StudentContext`.
- **API Dependencies**: `getRecommendation` (`decisionApi.ts`).
- **Data Flow**: `StudentContext` updates -> `useEffect` triggers debounced API call -> Response parsed by `normalizeRecommendations` -> Renders `CollegeCard`s.

### 3. `ChatPage`
- **Purpose**: A focused, fullscreen chat interface specifically for decision-making without the complex sidebar/graph split layout.
- **Components Used**: `CollegeCard`, `VoiceRecorder`.
- **API Dependencies**: `askAgent`.
- **Error Handling**: Appends a fallback error message directly into the chat stream if the orchestrator fails.

### 4. `AdminDashboardPage`
- **Purpose**: Administration panel for modifying hard eligibility constraints for academic programs.
- **UI Sections**: Table of programs, Edit Configuration Modal.
- **Local State**: `programs`, `loading`, `editingProgram`, `editForm`.
- **API Dependencies**: Direct `axios.get` and `axios.put` to `/decision/admin/programs`.

### 5. `LoginPage`
- **Purpose**: Entry gate. Handles fake/mock authentication.
- **User Actions**: User enters ID/Password -> `onLogin` callback -> Updates `App.tsx` state. Alternatively, clicks "Prospective Student Chat" -> `onGuestAccess` callback.

---

## Phase 6 – Component Inventory

| Component | Type | Props | State | Dependencies | Reusability |
|---|---|---|---|---|---|
| `Dashboard` | Layout | `user`, `children`, `onLogout` | None | None | High |
| `CollegeCard` | UI/Data | `programName`, `matchScore`, etc. | None | None | High |
| `DecisionForm` | Form | None | None | `useStudent` | Medium |
| `GraphVisualizer` | Vis | `graphData`, `isLoading`, `panelMode`| None | `react-force-graph` | High |
| `VoiceRecorder` | Input | `onResponseFetched`, `setLoading` | `isRecording` | `window.SpeechRecognition`| High |
| `ChatMessage` | UI | `message` (type `ChatMessageType`) | None | None | High |

**`GraphVisualizer` Details:**
- **Responsibility**: Renders nodes and links representing semantic relationships from the AI advisor.
- **Rendering Logic**: Uses `ForceGraph2D` with custom node canvas rendering to draw circles, labels, and icons based on node groupings.

---

## Phase 7 – State Management

**Identified Mechanisms:**
- `useState`: Standard local component state.
- `Context API`: Used exclusively for the Decision Engine (`StudentContext`).
- `localStorage`: Used as a persistence layer for authentication, chat history, and UI layout preferences.
- *Redux / Zustand / React Query*: NOT FOUND IN CODEBASE.

**State Flow (Student Profile):**
```text
User interacts with <DecisionForm> slider/select
  ↓
updateProfile() (from useStudent hook)
  ↓
Context State Updates (profile object)
  ↓
<DecisionPage> useEffect detects profile change
  ↓
Debounced API Call (getRecommendation)
  ↓
setRecommendations() updates local state
  ↓
Renders <CollegeCard> array
```

---

## Phase 8 – API Layer Analysis

**Identified Mechanisms:**
- Custom `fetch` wrappers: `backendService.ts`, `agentService.ts`, `conversationsApi.ts`, `decisionApi.ts`.
- Direct `axios` usage: Found exclusively in `AdminDashboardPage.tsx`.

**Endpoint Analysis:**

| Method | URL | Component / Service | Request Body | Response | Error Handling |
|---|---|---|---|---|---|
| POST | `/chatbot/query` | `agentService.ts` | `{ query, cid }` | `{ answer, graph, cid }` | Throws HTTP status error |
| GET | `/conversations` | `conversationsApi.ts` | Query params | `{ conversations: [...] }` | Throws extracted text or status |
| POST | `/decision/recommend` | `decisionApi.ts` | `RecommendationPayload`| `RecommendationResponse`| Safely parses JSON, throws fallback |
| GET | `/decision/admin/programs`| `AdminDashboardPage` | None | `Program[]` | Sets local `error` state string |
| PUT | `/decision/admin/programs/:id`| `AdminDashboardPage` | `{ min_percentage, ... }`| 200 OK | Catches and displays generic error |

**Request Lifecycle (AI Chat):**
```text
User Action (e.g. Type Message & Send)
       ↓
Event Handler (sendMessage)
       ↓
Service Function (askAgent)
       ↓
Network (fetch POST /chatbot/query)
       ↓
Response (JSON)
       ↓
State Update (setMessages, setGraph)
       ↓
Component Re-render (ChatMessage, GraphVisualizer)
```

---

## Phase 9 – Authentication Flow

**Documented Flow:**
1. **Login Flow**: Purely mocked on the frontend. Submitting the form in `LoginPage.tsx` triggers `onLogin` with a hardcoded `Somaya Osama` user object.
2. **Guest Flow**: Clicking Prospective Student triggers `onGuestAccess`, yielding a generic `Newcomer` profile.
3. **Storage Locations**: Authentication state is stored synchronously in `localStorage` using keys `aast_ai_agent_user` (JSON string) and `aast_ai_agent_is_guest` (boolean string).
4. **Protected Routes**: Routing in `App.tsx` conditionally renders `<Navigate>` components based on the presence of the user object and guest boolean.
5. **Logout Process**: Clears `localStorage` keys and resets state to `null`, navigating back to `/`.
6. **Tokens / JWT**: `backendService.ts` implements a `getToken()` function looking for `"token"` in localStorage, but actual JWT issuance and validation from a backend auth server is NOT FOUND IN CODEBASE.

---

## Phase 10 – Forms

**1. `LoginPage`**
- **Fields**: Student ID, Password, Remember Me (Checkbox).
- **Validation**: Basic empty-check (`if (studentId && password)`).
- **Libraries**: Native HTML forms.
- **Submission Flow**: Prevents default -> Validates -> Fires `onLogin` prop.

**2. `DecisionForm`**
- **Fields**: Max Budget (Range Slider), Certificate (Select), Grade Percentage (Number Input), Campus (Select), Interests (Multi-select pill buttons), Student Group (Toggle buttons).
- **State Integration**: Two-way binding directly to `StudentContext` via `updateProfile`.

**3. `AdminDashboardPage` Edit Form**
- **Fields**: Minimum Percentage (number), Program Fees (number), Allowed Tracks (text).
- **Validation Rules**: Percentage must be between 0 and 100.
- **Submission Flow**: Maps empty strings to `null`, fires PUT request via `axios`, hides modal on success.

---

## Phase 11 – Custom Hooks

### `useStudent`
- **Purpose**: Consumes the `StudentContext`.
- **Inputs**: None.
- **Outputs**: `{ profile: StudentProfile, updateProfile: (updates) => void }`.
- **Dependencies**: React `useContext`.
- **Consumers**: `DecisionForm`, `DecisionPage`.

### `useMediaQuery` (Internal to `AdvisorPage.tsx`)
- **Purpose**: Subscribes to CSS media query changes.
- **Inputs**: Media query string (e.g., `"(min-width: 1280px)"`).
- **Outputs**: Boolean indicating if the media query matches.
- **Side Effects**: Adds/removes `change` event listener on `window.matchMedia`.

---

## Phase 12 – Context Providers

### `StudentProvider`
- **Responsibilities**: Maintains the global configuration of a student's academic background and preferences.
- **State**: `profile` object containing budget, percentage, tracks, interests, etc.
- **Actions**: `updateProfile(updates: Partial<StudentProfile>)` merges new values into existing state.
- **Consumers**: `<App>` wraps the entire application routing tree in `<StudentProvider>`.
- **Initialization**: Hydrates with a static `defaultProfile`.

---

## Phase 13 – Styling System

**Core Technologies:**
- Tailwind CSS v3.4.19
- Custom classes in `index.css`

**Theme System (`tailwind.config.js`):**
- **Design Tokens**: Extends the default palette with specific `navy` (from `50` `#f3f6fb` to `950` `#020514`) and `gold` (from `50` `#fdf7e6` to `900` `#4c3c17`) branding colors.
- **Plugins**: Utilizes `@tailwindcss/typography` for rich text rendering (likely used in Markdown chat responses).

**Global Styles (`index.css`):**
- Custom utilities exist for styling the scrollbars (`.custom-scrollbar`).

---

## Phase 14 – Environment Variables

File: `.env`

| Variable | Used In | Purpose | Required |
|---|---|---|---|
| `VITE_USE_MOCK` | `backendService.ts` | Toggles whether to use hardcoded frontend mock responses or actual API calls. | No (defaults false) |
| `VITE_API_BASE` | All API Services | Base URL for backend orchestrator API. | No (falls back to localhost) |

---

## Phase 15 – Performance Optimizations

- **`useMemo`**: Used in `AdvisorPage.tsx` to memoize the `currentConversation` object lookup from the conversations array, preventing unnecessary object recreations on render.
- **`useCallback`**: Extensively utilized in `AdvisorPage.tsx` for network handlers (`loadConversation`, `refreshConversations`, `sendMessage`, `handleSpeechToText`) to maintain stable references for child components and `useEffect` dependency arrays.
- **Debouncing**:
  - In `DecisionPage.tsx`, the `fetchRecommendations` call is debounced by 500ms using a standard `setTimeout` inside a `useEffect` to prevent spamming the backend while the user drags the budget slider.
  - In `AdvisorPage.tsx`, the search bar triggers a debounced API request by 250ms.
- **Deferred Rendering**: `AdvisorPage.tsx` intentionally defers graph state updates by 100ms via `setTimeout` to prioritize the chat UI update during intensive operations.
- *Virtualization / Lazy Loading*: NOT FOUND IN CODEBASE.

---

## Phase 16 – Error Handling

- **API Error Handling**: All service files wrap standard `fetch` in helper functions that explicitly check `!res.ok` and throw an `Error` containing the HTTP status and body text.
- **Try/Catch Blocks**: Used within standard async operations in pages (`AdvisorPage.tsx`, `DecisionPage.tsx`, `ChatPage.tsx`).
- **Fallback UI**: 
  - `DecisionPage.tsx`: Displays a red banner (`bg-red-50 text-red-700`) and forces a hardcoded "Fallback" recommendation card if the API fails.
  - `ChatPage.tsx`: Appends a new message block to the chat history explicitly stating "I could not connect to the orchestrator."
  - `AdminDashboardPage`: Renders an aesthetic "Connection Failed" empty-state block with a "Retry Connection" button.
- **Error Boundaries**: Native React Error Boundaries are NOT FOUND IN CODEBASE.

---

## Phase 17 – Security Review

- **XSS Protection**: Relying natively on React's auto-escaping. If `react-markdown` is used, it mitigates XSS by safely rendering tags.
- **Token Storage Risks**: The use of `localStorage` for `aast_ai_agent_user`, `token`, and chat history makes the application vulnerable to Cross-Site Scripting (XSS) token exfiltration.
- **Route Protection**: The routing logic in `App.tsx` prevents unauthenticated users from reaching `/dashboard`. However, the `/decision/admin` route is completely public and lacks an authentication wrapper in the frontend router.

---

## Phase 18 – Dependency Graph

**Page → Components Diagram:**
```text
App
├── LoginPage
├── Dashboard (Layout)
│   ├── HomePage
│   ├── CoursesPage
│   ├── ResultsPage
│   └── AdvisorPage
│       ├── ConversationHistorySidebar
│       ├── ChatMessage
│       ├── GraphVisualizer
│       └── VoiceRecorder
├── GuestAdvisorPage
├── DecisionPage
│   ├── DecisionForm
│   └── CollegeCard
├── ChatPage
│   ├── VoiceRecorder
│   └── CollegeCard
└── AdminDashboardPage
```

**API Flow Diagram:**
```text
User Action (e.g. Type Message & Send)
       ↓
Event Handler (sendMessage)
       ↓
Service Function (askAgent)
       ↓
Network (fetch POST /chatbot/query)
       ↓
Response (JSON)
       ↓
State Update (setMessages, setGraph)
       ↓
Component Re-render (ChatMessage, GraphVisualizer)
```

---

## Phase 19 – Developer Onboarding Guide

**Prerequisites:**
- Node.js (v18+ recommended)
- Running Backend Orchestrator (Port 8000/8004 based on `.env`)

**Installation & Environment Setup:**
1. Clone the repository and navigate to `frontend/`.
2. Run `npm install` to install dependencies.
3. Create a `.env` file referencing the backend: `VITE_API_BASE=http://localhost:8000/api`.

**Running Development Server:**
Run `npm run dev`. The server will start on `127.0.0.1`.

**Production Build:**
Run `npm run build` to compile TypeScript and bundle via Vite.

**Folder Conventions:**
- Keep domain-specific logic in isolated folders (e.g., `src/decision/`).
- Place all reusable network calls in `src/services/`.

**Adding a New Page:**
1. Create the component inside `src/components/pages/` or `src/decision/pages/`.
2. Map the path in `src/App.tsx` via a new `<Route>`.

**Adding a New Component:**
1. Create `NewComponent.tsx` in `src/components/`.
2. Ensure you type props clearly via interface.

**Adding a New API:**
1. Define the types in `src/types.ts`.
2. Create a dedicated service file inside `src/services/` utilizing native `fetch`.

**Debugging Guide:**
- Toggle `VITE_USE_MOCK=true` to develop UI without needing the backend orchestrator running.
- Use Chrome DevTools Network tab to inspect the `/graph/ask` and `/decision/recommend` payloads.

---

## Phase 20 – Final Frontend Architecture Summary

**Executive Summary:**
The frontend provides a polished, highly interactive student portal experience. It successfully integrates modern AI conversational interfaces with complex data visualization capabilities (Force-Directed Graphs) and structured input logic.

**Architectural Strengths:**
- **Feature-Sliced Design**: The `decision` domain is neatly encapsulated in its own directory, keeping complex logic isolated.
- **Responsive & Interactive**: Excellent implementation of debouncing, state-driven UI, and graceful degradation via fallback mock data.
- **Component Reusability**: UI pieces like `VoiceRecorder` and `CollegeCard` are well decoupled.

**Architectural Weaknesses:**
- **Inconsistent Network Stack**: Mixing native `fetch` wrappers and `axios` creates mental overhead.
- **Security Vulnerability**: The Admin page (`/decision/admin`) is completely unprotected on the frontend router layer.
- **State Management Scaling**: Excessive reliance on prop-drilling and large `useEffect` dependency arrays in `AdvisorPage.tsx`.

**Technical Debt:**
- Authentication is entirely mocked and fundamentally relies on local storage logic.
- Complex graph logic and chat state are tightly coupled inside single monolithic page files (e.g., `AdvisorPage.tsx` is 600+ lines).

**Suggested Improvements:**
1. Integrate **React Query (@tanstack/react-query)** to abstract caching, loading, and error states for network requests.
2. Standardize the HTTP client (migrate everything to Axios or a dedicated fetch abstraction).
3. Introduce JWT validation and backend-driven sessions instead of localStorage overrides.
4. Protect `/decision/admin` behind a Role-Based Access Control (RBAC) wrapper.

**Scalability Assessment:**
The application can handle scaling feature-wise due to the modular component approach, but will struggle with state bloat as global requirements expand.

- **Maintainability Score:** **7/10** (Good component reuse, but bloated page files).
- **Complexity Score:** **6/10** (Straightforward SPA routing, but moderately complex graph/audio integrations).
