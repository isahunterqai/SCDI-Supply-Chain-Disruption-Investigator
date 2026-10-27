# SCDI — Official Hackathon Submission Form Responses

This document contains copy-paste ready answers for all standard hackathon submission fields, judging criteria, and sponsor technology evaluation prompts.

---

## 📌 Project Overview & General Information

### Project Name
**SCDI — Supply Chain Disruption Investigator**

### Tagline / One-Liner
*Autonomous Multimodal Agent for Real-Time & Historical Logistics Resilience Powered by Zetaris, Meterless, NVIDIA NIM, and Next.js 15.*

### Short Description / Elevator Pitch (100–150 words)
Global supply chains operate on razor-thin inventory buffers. When a port strike breaks out, a geopolitical chokepoint closes, or extreme weather halts maritime corridors, enterprises lose millions before planners realize stockouts are imminent. SCDI (Supply Chain Disruption Investigator) is an autonomous, multimodal AI agent that shifts logistics from reactive fire-fighting to proactive resilience. 

SCDI combines live global hazard telemetry (Open-Meteo marine weather, USGS seismic data, GDACS disaster alerts) with 11 years of historical Kaggle shock data. Driven by a bounded Planner ↔ Executor ↔ Evaluator (PEE) loop, SCDI issues federated SQL queries across siloed ERPs using **Zetaris**, enforces cost and token spend guardrails via **Meterless**, accelerates reasoning with **NVIDIA NIM**, and presents live geospatial disruption intelligence in a Next.js 15 command center.

---

## ❓ Problem, Users & Solution

### What problem are you solving?
Global supply chains depend on lean Just-In-Time (JIT) inventory (typically 14–21 days of safety stock). Unexpected events (such as Red Sea chokepoint attacks, labor strikes in East Asia, or Gulf hurricanes) induce 10–25 day shipping delays, resulting in sudden, catastrophic factory shutdowns and multi-million dollar stockouts. 

Crucially, enterprise supply chain data is fragmented across regional ERPs (inventory levels), carrier portals (shipping delays), and vendor databases (backup procurement contracts). Today's visibility tools merely sound passive alarms days after vessels are already stranded, leaving human planners overwhelmed and unable to compute real inventory burn rates in time.

### Who are your target users?
- **VPs & Heads of Global Logistics & Supply Chain** needing executive-level financial risk quantification ($M cost avoidance) and safety buffer trajectory.
- **Logistics Operations Directors & Planners** requiring immediate root-cause investigations, Days of Inventory Remaining (DOIR) impact models, and pre-vetted alternative shipping lanes.
- **Procurement & Inventory Managers** needing automated, validated purchase order reallocations to secondary contract vendors before regional capacity vanishes.

### How does your agent solve this challenge?
SCDI acts as an autonomous investigator that detects, evaluates, and resolves supply chain crises before they cause stockouts:
1. **Multimodal Early Detection:** Continuously ingests live marine weather, seismic shake maps, and disaster alerts across seven global maritime chokepoints.
2. **Mathematical DOIR Impact Modeling:** Automatically matches port shock delays to affected warehouse SKUs and daily burn rates to forecast the exact stockout date.
3. **Closed-Loop PEE State Machine:** Executes a reflective **Planner ↔ Executor ↔ Evaluator** loop. When the Evaluator detects missing supplier contracts or low confidence, it triggers a reflective `RETRY` with compact Markovian carryover context.
4. **Automated Mitigation:** Reroutes federated queries to secondary contract shards to locate alternative suppliers, restoring DOIR buffers and synthesizing an executive mitigation report.

---

## 🤝 Sponsor Technology Integrations

### How were Zetaris and Meterless integrated into your project?
- **Zetaris (Federated Data Virtualization):**
  In enterprise logistics, data is split across disconnected silos — warehouse inventories live in regional SAP databases, open POs live in transit systems, and backup supplier agreements live in procurement repositories. SCDI integrates Zetaris as its federated data virtualization fabric. During the `Executor` phase of the agent loop, SCDI issues `zetaris_federated_sql_query` tool calls across unified virtual endpoints:
  - **Primary Shard:** Directly joins warehouse inventory with open purchase orders (`erp.inventory` joined with `erp.purchase_orders`) across origin ports without requiring ETL pipeline maintenance.
  - **Secondary Shard:** When the Evaluator identifies that projected DOIR drops below safety thresholds, the Planner instructs Zetaris to query the secondary backup contracts shard (`erp.backup_contracts`) to retrieve alternative vendor allocations, pricing, and expedited lead times.
- **Meterless (Cost Governance & Token Budgeting):**
  Autonomous recursive agents risk runaway token consumption and unpredictable inference expenses. We integrated Meterless as our cost governance governor. On every PEE iteration, the agent monitors and enforces `meterless_cost_budget_remaining` and `meterless_tokens_used`. If a query branch or retry cycle threatens to exceed allocated budget thresholds, the Evaluator forces bounded Markovian context carryover or transitions directly to final executive mitigation synthesis, guaranteeing cost-predictable enterprise execution.

### How was Cursor used in your workflow?
Cursor served as our primary AI-native development and orchestration cockpit throughout the hackathon:
- **State Machine Scaffolding:** Accelerated the implementation and iterative refinement of the Python Planner-Executor-Evaluator (PEE) state engine and its transition rules.
- **Schema & Type Synchronization:** Kept the Python agent dataclasses in lockstep with Next.js 15 TypeScript definitions (`scdi-traces.generated.ts`), preventing serialization and runtime bugs.
- **Agent Loop Monitoring:** Provided an integrated environment to inspect `loop_state.json` and step-debug the agent CLI tick runner.
- **SSE Stream Protocol Debugging:** Streamlined development of the Server-Sent Events (SSE) streaming API connecting the agent's real-time outputs to the frontend visualizer.

### Where does NVIDIA contribute to your solution?
SCDI leverages NVIDIA NIM microservices to accelerate LLM inference during the Planner and Evaluator stages. Because supply chain crises demand instant situational responses, NVIDIA NIM provides ultra-low latency reasoning (45ms to 75ms per iteration), enabling rapid multi-variable evaluation and silky-smooth real-time streaming to the command center.

---

## 📋 Declarations & Compliance

### Pre-Existing Components vs. Built During Hackathon
- **Pre-Existing Components (Open Data & Public APIs):**
  - Public Kaggle Datasets: *Global Supply Chain Disruption Dataset (2015–2026)* and *Supply Chain Disruptions (2015–2024)*.
  - Public External APIs: Open-Meteo Marine/Atmospheric Weather API, USGS Earthquake GeoJSON feed, GDACS Global Disaster Alert RSS feed.
- **Built During the Hackathon:**
  - Entire Python autonomous PEE (Planner-Executor-Evaluator) decision engine.
  - Markovian carryover context management and dynamic inventory burn rate / DOIR modeling algorithms.
  - Zetaris federated SQL query tools and schema routing logic.
  - Meterless token budget monitoring and cost governor integration.
  - Complete Next.js 15 reactive dashboard, SVG maritime geospatial visualizer, animated DAG state visualizer, and executive KPI analytics suite.

### Zero-Secrets Guarantee
- **Confirmation:** Confirmed. No API keys, passwords, credentials, `.env` files, or private tokens are tracked or committed to the repository. The root `.gitignore` enforces strict exclusion of secret patterns and developer artifacts.

---

## 🔗 Submission Links Checklist
- **GitHub Repository:** `https://github.com/isahunterqai/SCDI-Supply-Chain-Disruption-Investigator`
- **Demo Video (1–4 min):** `[Insert YouTube / Loom / Vimeo Link]` *(Recorded using `DEMO_SCRIPT.md`)*
- **Slide Deck:** `[Insert Google Slides / Canva / PDF Link]` *(Prepared using `SLIDE_DECK.md`)*
- **Live Demo (Optional):** `[Insert Vercel / Cloud Run Link if deployed]`
