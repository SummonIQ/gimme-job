#!/usr/bin/env bash
# P17.20 — Idempotently bake the gimmejob-fill model from
# scripts/ollama/Modelfile.gimmejob-fill.
#
# Usage:
#   ./scripts/ollama/build-fill-model.sh
#   ./scripts/ollama/build-fill-model.sh --force   # rebuild even if model exists
#
# After this runs, opt the resolver into the baked model with:
#   OLLAMA_MODEL_FAST=gimmejob-fill
#   OLLAMA_MODEL_PRIMARY=gimmejob-fill
# (e.g. in .env.local or your shell profile).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODELFILE="$SCRIPT_DIR/Modelfile.gimmejob-fill"
MODEL_NAME="gimmejob-fill"

if ! command -v ollama >/dev/null 2>&1; then
  echo "error: ollama is not on PATH. Install from https://ollama.com first." >&2
  exit 1
fi

if [ ! -f "$MODELFILE" ]; then
  echo "error: Modelfile not found at $MODELFILE" >&2
  exit 1
fi

FORCE=0
for arg in "$@"; do
  case "$arg" in
    --force|-f) FORCE=1 ;;
    *) echo "error: unknown argument: $arg" >&2; exit 2 ;;
  esac
done

# Pull the base model first if missing — saves a confusing error mid-build.
BASE_MODEL="$(awk '/^FROM /{print $2; exit}' "$MODELFILE")"
if [ -z "$BASE_MODEL" ]; then
  echo "error: could not parse FROM line in $MODELFILE" >&2
  exit 1
fi

if ! ollama list 2>/dev/null | awk 'NR>1 {print $1}' | grep -qx "$BASE_MODEL"; then
  echo "Pulling base model $BASE_MODEL …"
  ollama pull "$BASE_MODEL"
fi

# Skip rebuild when the model already exists, unless --force.
if [ "$FORCE" -eq 0 ] && ollama list 2>/dev/null | awk 'NR>1 {print $1}' | grep -qx "$MODEL_NAME:latest"; then
  echo "$MODEL_NAME already exists — skipping rebuild. Pass --force to rebuild."
  exit 0
fi

echo "Building $MODEL_NAME from $MODELFILE …"
ollama create "$MODEL_NAME" -f "$MODELFILE"

cat <<'EOF'

Done. To opt the resolver into the baked model, set:

    OLLAMA_MODEL_FAST=gimmejob-fill
    OLLAMA_MODEL_PRIMARY=gimmejob-fill

(in .env.local, your shell profile, or wherever you keep dev env vars)

Verify with:

    ollama run gimmejob-fill 'What is the largest planet?'
EOF
