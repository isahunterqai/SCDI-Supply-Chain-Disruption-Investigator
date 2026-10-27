# SCDI Agent — Historical Disruption Ingest + PEE Loop

Python backend for the **Supply Chain Disruption Investigator**. Ingests Kaggle-shaped supply-chain disruption CSVs, turns rows into simulation scenarios, and runs the **Planner ↔ Executor ↔ Evaluator** loop so decision traces reflect historical disruption signals (delays, risk, port congestion).

## Data sources

Drop Kaggle CSVs into `data/kaggle/` (or use bundled samples in `data/sample/`):

| File | Expected columns (flexible aliases supported) |
|------|-----------------------------------------------|
| `geopolitical_events.csv` | event, start_date, end_date, severity, region, ports |
| `weekly_route_operations.csv` | date, route, delay_days, freight_cost, risk_score, port_congestion |
| `shipping_disruptions.csv` | date, port, region, vessel_type, disruption_index, wait_hours, freight_rate, on_time_pct |

Dataset references:

- [Global Supply Chain Disruption Dataset (2015–2026)](https://www.kaggle.com/datasets/kuldeepjangra/global-supply-chain-disruption-dataset-20152026)
- [Supply Chain Disruptions (2015–2024)](https://www.kaggle.com/datasets/devpassive/supply-chain-disruptions-2015-2024)

With Kaggle CLI configured (`~/.kaggle/kaggle.json`):

```bash
./scripts/fetch_kaggle.sh
```

## Run one historical scenario

```bash
python3 -m scdi_agent.cli run --data-dir data/sample --scenario-index 0
```

## Ingest all + export dashboard traces

```bash
python3 -m scdi_agent.cli ingest-and-simulate --data-dir data/sample --limit 5 \
  --export-json output/traces/latest.json \
  --export-ts ../scdi-dashboard/src/lib/scdi-traces.generated.ts
```

## Agent loop tick (Cursor monitored loop)

```bash
python3 -m scdi_agent.cli tick --state-file output/loop_state.json --data-dir data/sample
```
