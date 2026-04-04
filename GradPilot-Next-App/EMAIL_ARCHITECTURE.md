# Email Node Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          EMAIL NODE WORKFLOW                             │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 1: CSV Upload                                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  User                     Frontend                    Backend API        │
│   │                          │                            │              │
│   │  Click Upload Button    │                            │              │
│   │────────────────────────>│                            │              │
│   │                          │                            │              │
│   │  Select CSV File        │                            │              │
│   │────────────────────────>│                            │              │
│   │                          │                            │              │
│   │                          │  POST /api/email/parse-csv │              │
│   │                          │───────────────────────────>│              │
│   │                          │    (FormData with file)    │              │
│   │                          │                            │              │
│   │                          │                       ┌────┴────┐         │
│   │                          │                       │ PapaParse│        │
│   │                          │                       │  Parse   │        │
│   │                          │                       │  Validate│        │
│   │                          │                       └────┬────┘         │
│   │                          │                            │              │
│   │                          │<───────────────────────────│              │
│   │                          │  { emailList, stats }      │              │
│   │                          │                            │              │
│   │  ✅ X emails loaded     │                            │              │
│   │<────────────────────────│                            │              │
│                                                                          │
│  Node Data Updated: data.emailList = [...]                              │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 2: Run Email Node                                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  User                     Frontend                    Backend            │
│   │                          │                            │              │
│   │  Click "Run Agent"      │                            │              │
│   │────────────────────────>│                            │              │
│   │                          │                            │              │
│   │                          │  POST /api/campaign/       │              │
│   │                          │       execute-node         │              │
│   │                          │───────────────────────────>│              │
│   │                          │  { nodeId, nodes, edges }  │              │
│   │                          │                            │              │
│   │                          │                       ┌────┴─────────┐    │
│   │                          │                       │ Build Context│    │
│   │                          │                       │ from Workflow│    │
│   │                          │                       └────┬─────────┘    │
│   │                          │                            │              │
│   │                          │                       ┌────┴──────┐       │
│   │                          │                       │  Compile  │       │
│   │                          │                       │  Prompt   │       │
│   │                          │                       └────┬──────┘       │
│   │                          │                            │              │
│   │                          │                       ┌────┴──────────┐   │
│   │                          │                       │ Gemini AI     │   │
│   │                          │                       │ Generate Email│   │
│   │                          │                       │ Content (JSON)│   │
│   │                          │                       └────┬──────────┘   │
│   │                          │                            │              │
│   │                          │                     { subject, html,      │
│   │                          │                       text }              │
│   │                          │                            │              │
│   │                          │                       ┌────┴──────────┐   │
│   │                          │                       │ Get emailList │   │
│   │                          │                       │ from node.data│   │
│   │                          │                       └────┬──────────┘   │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 3: Send Bulk Emails                                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Backend                   Resend API                                   │
│     │                          │                                         │
│     │  POST /api/email/       │                                         │
│     │       send-bulk          │                                         │
│     │─────────────────────────>│                                         │
│     │  { emailList, subject,   │                                         │
│     │    html, text }          │                                         │
│     │                          │                                         │
│     │                     ┌────┴────────┐                                │
│     │                     │ For each    │                                │
│     │                     │ recipient:  │                                │
│     │                     │             │                                │
│     │                     │ 1. Replace  │                                │
│     │                     │    {{name}} │                                │
│     │                     │             │                                │
│     │                     │ 2. Send via │                                │
│     │                     │    Resend   │─────> Email Sent! ✉️          │
│     │                     │             │                                │
│     │                     │ 3. Wait     │                                │
│     │                     │    100ms    │                                │
│     │                     │             │                                │
│     │                     │ 4. Track    │                                │
│     │                     │    Stats    │                                │
│     │                     └────┬────────┘                                │
│     │                          │                                         │
│     │<─────────────────────────│                                         │
│     │  { sent: 48, failed: 2,  │                                         │
│     │    total: 50 }           │                                         │
│     │                          │                                         │
│     │                          │                                         │
│  Frontend                      │                                         │
│     │                          │                                         │
│     │  ✅ Email campaign sent! │                                         │
│     │  Sent: 48/50 emails     │                                         │
│     │<─────────────────────────                                          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ DATA FLOW                                                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  CSV File                                                                │
│     │                                                                    │
│     ├─> Parse with PapaParse                                            │
│     │                                                                    │
│     ├─> Validate emails (regex)                                         │
│     │                                                                    │
│     ├─> Extract names                                                   │
│     │                                                                    │
│     └─> Store in node.data.emailList                                    │
│                  │                                                       │
│                  │                                                       │
│                  ├─> Campaign Brief ─────┐                              │
│                  │                        │                              │
│                  ├─> Strategy Context ────┤                              │
│                  │                        │                              │
│                  ├─> Previous Nodes ──────┼─> Build Execution Context   │
│                  │                        │                              │
│                  └─> Node Prompt ─────────┘                              │
│                                  │                                       │
│                                  │                                       │
│                                  ├─> Compile Final Prompt                │
│                                  │                                       │
│                                  ├─> Send to Gemini AI                   │
│                                  │                                       │
│                                  ├─> Generate Email JSON                 │
│                                  │    { subject, html, text }           │
│                                  │                                       │
│                                  ├─> Personalize with {{name}}          │
│                                  │                                       │
│                                  └─> Send via Resend API                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ COMPONENT INTERACTIONS                                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐                                                   │
│  │   AgentNode.jsx  │                                                   │
│  │  (UI Component)  │                                                   │
│  └────────┬─────────┘                                                   │
│           │                                                             │
│           │ Uses                                                        │
│           ▼                                                             │
│  ┌──────────────────┐                                                   │
│  │   store.ts       │                                                   │
│  │  (Zustand Store) │                                                   │
│  └────────┬─────────┘                                                   │
│           │                                                             │
│           │ Manages                                                     │
│           ▼                                                             │
│  ┌──────────────────────┐                                              │
│  │  WorkflowNode[]      │                                              │
│  │  └─ data.emailList   │                                              │
│  │  └─ data.status      │                                              │
│  │  └─ data.output      │                                              │
│  └────────┬─────────────┘                                              │
│           │                                                             │
│           │ Used by                                                     │
│           ▼                                                             │
│  ┌──────────────────────────┐                                          │
│  │  execution-engine.ts     │                                          │
│  │  - buildExecutionContext │                                          │
│  │  - compilePrompt         │                                          │
│  └────────┬─────────────────┘                                          │
│           │                                                             │
│           │ Called by                                                   │
│           ▼                                                             │
│  ┌──────────────────────────────┐                                      │
│  │  execute-node/route.ts       │                                      │
│  │  - Email node logic          │                                      │
│  │  - AI content generation     │                                      │
│  │  - Bulk email sending        │                                      │
│  └────────┬─────────────────────┘                                      │
│           │                                                             │
│           │ Calls                                                       │
│           ▼                                                             │
│  ┌──────────────────────────────┐                                      │
│  │  send-bulk/route.ts          │                                      │
│  │  - Resend API integration    │                                      │
│  │  - Personalization           │                                      │
│  │  - Rate limiting             │                                      │
│  └──────────────────────────────┘                                      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ FILE STRUCTURE                                                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  GradPilot-Next-App/                                                │
│  ├── app/                                                               │
│  │   └── api/                                                           │
│  │       ├── campaign/                                                  │
│  │       │   └── execute-node/                                          │
│  │       │       └── route.ts ──────────── Email execution logic        │
│  │       │                                                              │
│  │       └── email/                                                     │
│  │           ├── parse-csv/                                             │
│  │           │   └── route.ts ──────────── CSV parsing (NEW)            │
│  │           │                                                          │
│  │           └── send-bulk/                                             │
│  │               └── route.ts ──────────── Bulk sending (existing)      │
│  │                                                                      │
│  ├── components/                                                        │
│  │   └── campaign/                                                      │
│  │       └── AgentNode.jsx ────────────── Email UI + CSV upload         │
│  │                                                                      │
│  ├── lib/                                                               │
│  │   ├── execution-engine.ts ──────────── Email prompt logic            │
│  │   └── store.ts ─────────────────────── State management             │
│  │                                                                      │
│  ├── types/                                                             │
│  │   └── workflow.ts ──────────────────── Email node type               │
│  │                                                                      │
│  ├── EMAIL_SETUP_GUIDE.md ──────────────── Complete setup guide (NEW)   │
│  ├── EMAIL_FEATURE_SUMMARY.md ───────────── Implementation docs (NEW)   │
│  ├── QUICK_START_EMAIL.md ───────────────── Quick reference (NEW)       │
│  └── sample-email-list.csv ──────────────── Example CSV (NEW)           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Technologies

- **Frontend:** React, Zustand (state), ReactFlow (workflow canvas)
- **Backend:** Next.js API routes, TypeScript
- **AI:** Google Gemini (email content generation)
- **Email:** Resend API (email delivery)
- **CSV Parsing:** PapaParse library
- **Styling:** Tailwind CSS, Lucide React (icons)

## Security Features

✅ API key stored in .env.local (not committed)
✅ Email validation with regex
✅ File type validation (CSV only)
✅ Rate limiting (100ms delays)
✅ Error handling throughout
✅ Input sanitization

## Personalization

```
Template:    "Hello {{name}}, check out our offer!"
             ↓
Recipient 1: "Hello John Doe, check out our offer!"
Recipient 2: "Hello Jane Smith, check out our offer!"
```

## Rate Limiting Strategy

```
Batch Processing:
┌─────────────────────────────────────┐
│ Batch 1 (100 emails)                │
│  ├─ Email 1 ──> Send ──> Wait 100ms│
│  ├─ Email 2 ──> Send ──> Wait 100ms│
│  └─ Email 100 ──> Send              │
├─────────────────────────────────────┤
│ Batch 2 (100 emails)                │
│  └─ ...                             │
└─────────────────────────────────────┘

Total time for 200 emails: ~20 seconds
```
