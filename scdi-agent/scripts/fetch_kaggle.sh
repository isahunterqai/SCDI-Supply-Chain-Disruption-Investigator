#!/usr/bin/env bash
# Fetch public Kaggle supply-chain disruption datasets into data/kaggle/
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/data/kaggle"
mkdir -p "$OUT"

if ! command -v kaggle >/dev/null 2>&1; then
  echo "kaggle CLI not found. Install: pip install kaggle"
  echo "Place API token at ~/.kaggle/kaggle.json then re-run."
  echo "Meanwhile sample CSVs in data/sample/ are ready for ingest."
  exit 1
fi

echo "Downloading Global Supply Chain Disruption Dataset (2015–2026)..."
kaggle datasets download -d kuldeepjangra/global-supply-chain-disruption-dataset-20152026 \
  -p "$OUT/global-2015-2026" --unzip

echo "Downloading Supply Chain Disruptions (2015–2024)..."
kaggle datasets download -d devpassive/supply-chain-disruptions-2015-2024 \
  -p "$OUT/port-2015-2024" --unzip || true

echo "Done. Point the agent at data/kaggle:"
echo "  python3 -m scdi_agent.cli ingest-and-simulate --data-dir $OUT"
