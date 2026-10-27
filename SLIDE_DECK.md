# SCDI Slide Deck (Comprehensive Presentation Outline)

---

## 📽️ Slide 1: Title & Overview
- **Header:** SCDI — Supply Chain Disruption Investigator
- **Subheader:** Autonomous Multimodal Agent for Real-Time & Historical Logistics Resilience
- **Presenter:** Isa Hunter | Quantum AI Inc. Solutions
- **Badges:** Zetaris · Meterless · NVIDIA NIM · Cursor · Next.js 15 · Python 3.10
- **Visual:** High-contrast screenshot of the SCDI Command Center with active shipping corridors and glowing hazard nodes across the global map.

---

## ⚠️ Slide 2: The Problem & Target Users
- **Target Persona:** VPs of Global Supply Chain, Logistics Operations Directors, Inventory Risk Managers.
- **The Core Problem:**
  - **Just-In-Time Fragility:** Global supply chains operate with lean inventory buffers (typically 14–21 days).
  - **Unforgiving Disruptions:** Geopolitical chokepoint closures, labor strikes, and severe weather create sudden delays of 10–25 days, causing complete inventory stockouts.
  - **Fragmented Data Silos:** Inventory lives in regional SAP systems, active shipments in carrier portals, and backup contracts in procurement databases.
  - **Passive Alerting:** By the time traditional ERPs flag a delay, vessels are already anchored and factories face multimillion-dollar shutdowns.

---

## 💡 Slide 3: The Solution — Autonomous Proactive Resilience
- **Proactive Early Warning:** Ingests live environmental and geopolitical hazards before delays reach regional port systems.
- **Dynamic DOIR Modeling:** Mathematically couples delay shocks to warehouse burn rates to calculate exact stockout dates.
- **Closed-Loop Mitigation:** Generates verifiable purchase order reallocations to alternate suppliers and shipping lanes.
- **Executive Decision Intelligence:** Real-time KPI quantification showing Total Cost Avoidance and Protected On-Time Delivery.

---

## 🔁 Slide 4: Agent Workflow & The PEE Architecture
- **Planner:**
  - Decomposes disruption telemetry into structured investigative queries.
  - Generates hypothesis: *"Do exposed SKUs at affected ports violate safety stock under projected delay?"*
- **Executor:**
  - Executes tool actions across federated enterprise shards and domain inventory calculators.
  - Bounded by strict token and cost quotas.
- **Evaluator:**
  - Evaluates completeness of evidence and confidence scores.
  - Emits `RETRY` (re-routes query to missing data shards) or `CONTINUE` (proceeds with bounded Markovian carryover context).
- **Markovian Carryover Context:**
  - Passes only validated state (completed tasks, remaining gaps, decisions) rather than full chat history, keeping inference fast and focused.

---

## 🤝 Slide 5: Sponsor Technology Integrations
| Sponsor | Role in SCDI | Technical Implementation |
|---|---|---|
| **Zetaris** | Federated Data Virtualization | Virtualizes disparate ERP shards, warehouse tables, and backup vendor contract stores into a unified SQL interface (`zetaris_federated_sql_query`) with zero ETL overhead. |
| **Meterless** | Cost Governance & Quota Enforcement | Binds every agent turn to a strict cost ceiling (`meterless_cost_budget_remaining`) and monitors token consumption to halt runaway agent spend. |
| **NVIDIA NIM** | Ultra-Low Latency Inference Acceleration | Microservices power Planner and Evaluator LLM calls with lightning reasoning latency (<75ms), enabling real-time DAG animation. |
| **Cursor** | AI-Native Development & Monitoring | Scaffolded the PEE state machine, synchronized TypeScript/Python schemas, and monitored the agent loop state ticks (`output/loop_state.json`). |

---

## 📊 Slide 6: Product Visuals & Key Features
- **1. Interactive Global Maritime SVG Map:** Visualizes 7 global maritime chokepoints with live weather/seismic pins and risk ratings.
- **2. Animated PEE DAG Loop:** Step-by-step visual feedback showing live Planner, Executor, and Evaluator execution states.
- **3. Executive Impact Suite:**
  - **Total Cost Avoidance:** Direct calculation of cargo value protected ($3.2M / 76% saved).
  - **Safety Buffer Restored:** Days of Inventory Remaining (DOIR) recovered via alternate vendor lanes.
  - **Protected On-Time Delivery (OTD):** Safeguarding delivery reliability from 18% up to 86%.
- **4. Trace Inspector:** Transparent audit log of all SQL queries, token counts, latency, and evaluator decisions.

---

## ⚙️ Slide 7: Tech Stack & Architecture
- **Frontend:** Next.js 15 (App Router), React, Tailwind CSS, Server-Sent Events (SSE) streaming.
- **Backend:** Python 3.10+, Dataclasses, CLI state tick engine.
- **Live Multimodal APIs:**
  - Open-Meteo Marine & Atmospheric Weather API.
  - USGS Earthquake GeoJSON Feeds.
  - GDACS Global Disaster Alert & Coordination System.
- **Historical Ground-Truth Data:** Kaggle Global Supply Chain Disruption Dataset (2015–2026).
- **Containerization:** Docker Compose for the local Zetaris Platform stack.

---

## 📈 Slide 8: Business Value & Quantified ROI
- **$3.2M+ Average Cost Avoidance per Major Disruption:** Prevents catastrophic assembly line stoppages and demurrage fees.
- **Sub-Minute Response Time:** Disruption identified, evaluated, and mitigated within 3 agent loop cycles (<2 seconds runtime).
- **Zero ETL Maintenance:** Zetaris federated virtualization saves months of enterprise data pipeline engineering.
- **Predictable AI Costs:** Meterless budget enforcement eliminates surprise cloud/LLM bills.

---

## 🚀 Slide 9: Future Roadmap
- **Smart Contract Execution:** Automated PO signing and escrow re-routing via blockchain protocols.
- **Tier-N Supplier Graphing:** Graph database traversal to uncover hidden Tier-2 and Tier-3 supplier bottlenecks.
- **Satellite AIS Integration:** Real-time satellite vessel tracking with dynamic route re-plotting around storm cells.
- **ERP Writeback Connectors:** Direct bidirectional connectors to SAP S/4HANA and Oracle Cloud SCM.
