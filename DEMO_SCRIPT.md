# SCDI Demo Video Script (3-Minute Hackathon Walkthrough)

**Target Video Length:** 2:45 – 3:15  
**Screen Setup:** 
- Left/Primary window: Browser with Next.js Dashboard running at `http://localhost:3000`
- Optional inset/split: Terminal showing `python3 -m scdi_agent.cli tick` or agent logs.

---

## ⏱️ Timeline & Actions Breakdown

### 0:00 – 0:35 | Hook & The Problem
- **Action:** Full screen on Next.js Dashboard (Dark mode, world map active, glowing hazard nodes).
- **Spoken Audio:**
  > "Global supply chains operate on razor-thin inventory buffers. When a port strike breaks out in Kaohsiung, a geopolitical chokepoint closes in the Red Sea, or an extreme weather event halts shipping, enterprises lose tens of millions of dollars before logistics planners even realize their inventory is at risk. 
  > 
  > Most enterprise dashboards are purely reactive — reporting disruptions days after vessels are already stranded. 
  > 
  > This is **SCDI: Supply Chain Disruption Investigator** — an autonomous multi-modal agent that proactively detects disruptions, models Days of Inventory Remaining (DOIR), and dynamically mitigates stockouts using federated data virtualization and cost-governed AI."

---

### 0:35 – 1:10 | Real-Time Multimodal Intelligence
- **Action:** Toggle to **"Real-Time Disruption View"**. Click **"Refresh Real-Time Feeds"**. Hover over the map pins (Bab el-Mandeb, Suez, Dover, Malacca). Click into the Bab el-Mandeb assessment.
- **Spoken Audio:**
  > "SCDI actively monitors live, multi-source external telemetry across seven critical maritime chokepoints. 
  > 
  > We ingest live marine atmospheric conditions from Open-Meteo, seismic shake data from the USGS, and disaster alerts from GDACS. 
  > 
  > At the same time, SCDI is calibrated against 11 years of historical Kaggle disruption data spanning 2015 to 2026 — from the Hanjin Shipping bankruptcy to Hurricane Harvey — validating our risk formulas against real ground-truth shocks."

---

### 1:10 – 2:15 | The Autonomous PEE Loop & Sponsor Integrations (Crucial Section)
- **Action:** Click **"Simulate Agent Run"** (or switch to Historical Mode and select a critical scenario like Kaohsiung or Tianjin).
- **Visual:** The animated DAG begins pulsing: **Planner ➔ Executor ➔ Evaluator**. The trace panel populates iteration 1, highlights missing evidence in red, and transitions to iteration 2.
- **Spoken Audio:**
  > "When a severe disruption strikes, SCDI spins up a bounded **Planner ↔ Executor ↔ Evaluator (PEE)** state machine. Here is where our sponsor technologies make this production-ready:
  > 
  > **1. Zetaris Federated Virtualization:** In real enterprises, inventory sits in regional SAP systems while supplier contracts sit in external procurement databases. Instead of waiting on brittle ETL pipelines, SCDI's Executor issues **federated SQL queries through Zetaris**. On Step 1, it queries the primary ERP shard to join warehouse inventory with inbound purchase orders. 
  > 
  > **2. Meterless Cost Governance:** Autonomous recursive agents can run away with token costs. SCDI enforces **Meterless cost budgets and token limits** on every single turn. As you can see in the metrics panel, Meterless tracks remaining budget and token consumption, bounding the agent within enterprise budget constraints.
  > 
  > **3. NVIDIA NIM:** During the Planner and Evaluator steps, SCDI leverages **NVIDIA NIM microservices** for high-throughput inference, keeping reasoning latency under 70 milliseconds so the live DAG streams without lag.
  > 
  > Notice what just happened: In Iteration 1, the Evaluator detected that warehouse DOIR dropped below safe safety stock (under 5 days), flagging missing backup supplier contracts. Rather than blindly re-prompting, it triggered a reflective `RETRY` with a compact Markovian carryover context. 
  > 
  > In Iteration 2, the agent re-routed Zetaris to query the backup contracts shard, locating alternate lane capacity and recovering DOIR."

---

### 2:15 – 2:50 | Executive Impact & Quantified Value
- **Action:** Scroll to the **Executive KPI Cards** at the top. Point out **Total Cost Avoidance ($3.2M / 76% Saved)**, **Protected On-Time Delivery (86%)**, and **Safety Buffer Restored**. Show the synthesized executive memo.
- **Spoken Audio:**
  > "Once the Evaluator verifies sufficient confidence, SCDI transitions to final output: synthesizing a structured executive mitigation report for the Vice President of Supply Chain.
  > 
  > The dashboard immediately visualizes the executive impact: **over 3 million dollars in cost avoidance**, on-time delivery protected from plummeting to 18%, and automated purchase order reallocations to pre-vetted secondary vendors."

---

### 2:50 – 3:10 | Engineering with Cursor & Wrap-Up
- **Action:** Briefly show terminal / repo structure or return to the main dashboard hero view.
- **Spoken Audio:**
  > "Developed and orchestrated with **Cursor**, SCDI unifies real-time APIs, Zetaris federated SQL, Meterless budget guardrails, and NVIDIA acceleration into a single resilient system.
  > 
  > SCDI changes supply chain management from passive crisis management into proactive, automated resilience. Thank you!"
