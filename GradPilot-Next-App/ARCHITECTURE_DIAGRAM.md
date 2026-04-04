# Merkle Tree Sidebar Architecture Diagram

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   Dashboard Page                             │   │
│  │  ┌────────────────┐  ┌──────────────────────────────────┐  │   │
│  │  │                │  │                                  │  │   │
│  │  │  Prediction    │  │     Main Dashboard Content       │  │   │
│  │  │  Logs Sidebar  │  │                                  │  │   │
│  │  │                │  │  - File Upload                   │  │   │
│  │  │  [Toggle]      │  │  - Charts                        │  │   │
│  │  │                │  │  - Analytics                     │  │   │
│  │  │  ┌──────────┐  │  │                                  │  │   │
│  │  │  │ Card #1  │  │  │                                  │  │   │
│  │  │  │ Collapsed│  │  │                                  │  │   │
│  │  │  └──────────┘  │  │                                  │  │   │
│  │  │                │  │                                  │  │   │
│  │  │  ┌──────────┐  │  │                                  │  │   │
│  │  │  │ Card #2  │  │  │                                  │  │   │
│  │  │  │ Expanded │  │  │                                  │  │   │
│  │  │  │          │  │  │                                  │  │   │
│  │  │  │ ┌──────┐ │  │  │                                  │  │   │
│  │  │  │ │Tree  │ │  │  │                                  │  │   │
│  │  │  │ │View  │ │  │  │                                  │  │   │
│  │  │  │ └──────┘ │  │  │                                  │  │   │
│  │  │  └──────────┘  │  │                                  │  │   │
│  │  │                │  │                                  │  │   │
│  │  │  ┌──────────┐  │  │                                  │  │   │
│  │  │  │ Card #3  │  │  │                                  │  │   │
│  │  │  │ Collapsed│  │  │                                  │  │   │
│  │  │  └──────────┘  │  │                                  │  │   │
│  │  └────────────────┘  └──────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## 🔄 Data Flow

```
┌──────────────┐
│   MongoDB    │
│   Database   │
└──────┬───────┘
       │
       │ User Document with predictionLogs[]
       │
       ▼
┌──────────────────────────────────────┐
│  Next.js API Route                   │
│  /api/user/predictions               │
│                                      │
│  - Authenticates user                │
│  - Fetches prediction logs           │
│  - Returns JSON                      │
└──────────────┬───────────────────────┘
               │
               │ HTTP GET Request
               │
               ▼
┌──────────────────────────────────────┐
│  PredictionLogsSidebar Component     │
│                                      │
│  State:                              │
│  - predictions[]                     │
│  - expandedId                        │
│  - loading / error                   │
└──────────────┬───────────────────────┘
               │
               │ Maps predictions to cards
               │
               ▼
┌──────────────────────────────────────┐
│  PredictionCard Components           │
│                                      │
│  - Shows metadata                    │
│  - Expand/collapse button            │
└──────────────┬───────────────────────┘
               │
               │ When expanded
               │
               ▼
┌──────────────────────────────────────┐
│  MerkleTreeVisualization Component   │
│                                      │
│  - Receives hierarchicalStructure    │
│  - Generates React Flow nodes/edges  │
│  - Handles leaf node clicks          │
└──────────────┬───────────────────────┘
               │
               │ On leaf click
               │
               ▼
┌──────────────────────────────────────┐
│  FastAPI Backend                     │
│  /merkle-proof/{tx_hash}/{day}       │
│                                      │
│  - Returns cryptographic proof       │
│  - Provides sibling hashes           │
└──────────────┬───────────────────────┘
               │
               │ Proof data
               │
               ▼
┌──────────────────────────────────────┐
│  Tree updates with proof path        │
│                                      │
│  - Highlights nodes in red           │
│  - Shows verification steps          │
│  - Confirms authenticity             │
└──────────────────────────────────────┘
```

## 🌲 Merkle Tree Structure

```
                    ┌──────────────────────┐
                    │    Merkle Root       │
                    │   (Purple Node)      │
                    │   Level 4, Index 0   │
                    └──────────┬───────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
        ┌───────▼────────┐           ┌───────▼────────┐
        │ Intermediate   │           │ Intermediate   │
        │  (Blue Node)   │           │  (Blue Node)   │
        │ Level 3, Idx 0 │           │ Level 3, Idx 1 │
        └───────┬────────┘           └───────┬────────┘
                │                             │
        ┌───────┴────────┐           ┌───────┴────────┐
        │                │           │                │
    ┌───▼───┐        ┌───▼───┐   ┌───▼───┐       ┌───▼───┐
    │ Blue  │        │ Blue  │   │ Blue  │       │ Blue  │
    │ L2,I0 │        │ L2,I1 │   │ L2,I2 │       │ L2,I3 │
    └───┬───┘        └───┬───┘   └───┬───┘       └───┬───┘
        │                │           │                │
    ┌───┴───┐        ┌───┴───┐   ┌───┴───┐       ┌───┴───┐
    │       │        │       │   │       │       │       │
┌───▼─┐ ┌───▼─┐  ┌───▼─┐ ┌───▼─┐ ┌───▼─┐ ┌───▼─┐ ┌───▼─┐ ┌───▼─┐
│Day 1│ │Day 2│  │Day 3│ │Day 4│ │Day 5│ │Day 6│ │Day 7│ │Day 8│
│Green│ │Green│  │Green│ │Green│ │Green│ │Green│ │Green│ │Green│
│$1391│ │$1393│  │$1395│ │$1397│ │$1399│ │$1401│ │$1403│ │$1405│
└─────┘ └─────┘  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘
   L0      L0       L0      L0      L0      L0      L0      L0
   I0      I1       I2      I3      I4      I5      I6      I7

... (continues for all 28 days)
```

## 🎯 Proof Path Visualization

When user clicks "Day 5" leaf node:

```
                    ┌──────────────────────┐
                    │    Merkle Root       │ ◄── Final verification
                    │   🔴 IN PROOF PATH   │
                    └──────────┬───────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
        ┌───────▼────────┐           ┌───────▼────────┐
        │ Intermediate   │           │ Intermediate   │
        │ 🔴 IN PROOF    │           │  (Blue Node)   │
        └───────┬────────┘           └────────────────┘
                │
        ┌───────┴────────┐
        │                │
    ┌───▼───┐        ┌───▼───┐
    │ Blue  │        │ 🔴 IN │
    │ Node  │        │ PROOF │
    └───────┘        └───┬───┘
                         │
                     ┌───┴───┐
                     │       │
                 ┌───▼─┐ ┌───▼─┐
                 │Day 5│ │Day 6│
                 │ 🟡  │ │Green│
                 │SELEC│ │$1401│
                 │TED  │ └─────┘
                 │$1399│      ▲
                 └─────┘      │
                    ▲         └── Sibling (Step 1)
                    │
                    └── User clicked here

Proof Steps:
1. Hash(Day 5) + Hash(Day 6) = Hash(Parent)
2. Hash(Parent) + Hash(Sibling) = Hash(Grandparent)
3. Continue until Merkle Root
4. Compare with stored Merkle Root
5. ✅ Match = Data is authentic!
```

## 📦 Component Hierarchy

```
DashboardLayout
│
└── PredictionLogsSidebar
    │
    ├── State Management
    │   ├── predictions: []
    │   ├── expandedId: string | null
    │   ├── loading: boolean
    │   └── error: string | null
    │
    ├── Effects
    │   └── useEffect: fetchPredictions on mount
    │
    └── Rendered Components
        │
        ├── Sidebar Container (fixed, left)
        │   ├── Header
        │   │   ├── Title: "Blockchain Logs"
        │   │   └── Refresh Button
        │   │
        │   └── Content Area (scrollable)
        │       │
        │       └── predictions.map(pred =>
        │           PredictionCard
        │               │
        │               ├── Header (always visible)
        │               │   ├── Date & Total
        │               │   ├── TX Hash (copyable)
        │               │   ├── Merkle Root (copyable)
        │               │   ├── Dataset Name
        │               │   ├── Metrics (accuracy, MAE)
        │               │   └── Expand Button
        │               │
        │               └── Expanded Content (conditional)
        │                   │
        │                   └── MerkleTreeVisualization
        │                       │
        │                       ├── Props
        │                       │   ├── treeData: hierarchicalStructure
        │                       │   ├── transactionHash: string
        │                       │   └── dailyPredictions: []
        │                       │
        │                       ├── State
        │                       │   ├── nodes: ReactFlowNode[]
        │                       │   ├── edges: ReactFlowEdge[]
        │                       │   ├── selectedLeaf: number | null
        │                       │   └── proofPath: ProofStep[] | null
        │                       │
        │                       └── ReactFlow
        │                           │
        │                           ├── Custom Nodes
        │                           │   └── MerkleNode
        │                           │       ├── Node styling by type
        │                           │       ├── Hover effects
        │                           │       ├── Click handler (leafs)
        │                           │       └── Copy hash button
        │                           │
        │                           ├── Edges (smoothstep)
        │                           │   └── Animated if in proof
        │                           │
        │                           ├── Controls (zoom, pan)
        │                           ├── Background (dots)
        │                           └── MiniMap
        │
        └── Toggle Button (outside sidebar)
            └── Opens/closes sidebar
```

## 🔐 Security Flow

```
┌─────────────────┐
│  User Request   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Next.js Middleware             │
│  - Checks session cookie        │
└────────┬────────────────────────┘
         │
         ▼ (if authenticated)
┌─────────────────────────────────┐
│  API Route Handler              │
│  /api/user/predictions          │
│                                 │
│  const session =                │
│    await getServerSession()     │
│                                 │
│  if (!session) return 401       │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  MongoDB Query                  │
│                                 │
│  User.findOne({                 │
│    email: session.user.email    │ ◄── Only user's data
│  }).lean()                      │ ◄── Read-only
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Return sanitized data          │
│  - No passwords                 │
│  - No API keys                  │
│  - Only predictionLogs          │
└─────────────────────────────────┘
```

## 🎨 Styling Layers

```
┌─────────────────────────────────────────┐
│         globals.css                      │
│  - Tailwind base                         │
│  - Custom fonts                          │
│  - React Flow theme overrides            │
│  - Animation keyframes                   │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│    Component Inline Styles               │
│  - Tailwind utility classes              │
│  - Dynamic classes (conditions)          │
│  - Responsive breakpoints                │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│    React Flow Inline Styles              │
│  - Node positions (calculated)           │
│  - Edge styles (dynamic)                 │
│  - Color based on node state             │
└─────────────────────────────────────────┘
```

## 📊 State Flow Diagram

```
Initial State:
┌─────────────────────────────────┐
│  isOpen: true                   │
│  predictions: []                │
│  loading: true                  │
│  error: null                    │
│  expandedId: null               │
│  selectedLeaf: null             │
│  proofPath: null                │
└─────────────────────────────────┘
                │
                ▼
         useEffect triggers
                │
                ▼
┌─────────────────────────────────┐
│  Fetch /api/user/predictions    │
└─────────────┬───────────────────┘
              │
    ┌─────────┴─────────┐
    │                   │
    ▼ Success           ▼ Error
┌───────────────┐   ┌──────────────┐
│ predictions:  │   │ error: msg   │
│   [data]      │   │ loading:false│
│ loading:false │   └──────────────┘
└───────┬───────┘
        │
        ▼ User clicks expand
┌───────────────────────────────┐
│  expandedId: predictionId     │
└───────────┬───────────────────┘
            │
            ▼
    Tree visualization renders
            │
            ▼ User clicks leaf
┌───────────────────────────────┐
│  selectedLeaf: index          │
│  verifying: true              │
└───────────┬───────────────────┘
            │
            ▼ Fetch proof
┌───────────────────────────────┐
│  proofPath: [...steps]        │
│  verifying: false             │
│  Nodes re-render with colors  │
└───────────────────────────────┘
```

## 🚀 Performance Optimization

```
┌────────────────────────────────┐
│  React.memo on heavy           │
│  components                    │
└────────────┬───────────────────┘
             │
             ▼
┌────────────────────────────────┐
│  useCallback for handlers      │
│  - fetchProof                  │
│  - handleLeafClick             │
│  - generateFlowElements        │
└────────────┬───────────────────┘
             │
             ▼
┌────────────────────────────────┐
│  useMemo for computed values   │
│  - Node positions              │
│  - Edge definitions            │
│  - Proof path checks           │
└────────────┬───────────────────┘
             │
             ▼
┌────────────────────────────────┐
│  React Flow optimizations      │
│  - fitView on mount            │
│  - Debounced zoom/pan          │
│  - Canvas rendering            │
└────────────────────────────────┘
```

---

**This diagram shows the complete architecture of the Merkle Tree Sidebar implementation.** 🎨
