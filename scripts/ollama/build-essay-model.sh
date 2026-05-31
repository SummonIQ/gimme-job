#!/usr/bin/env bash
# Idempotently bake the gimmejob-essay model from
# scripts/ollama/Modelfile.gimmejob-essay.
#
# Usage:
#   ./scripts/ollama/build-essay-model.sh
#   ./scripts/ollama/build-essay-model.sh --force   # rebuild even if model exists
#
# After this runs, opt the resolver into the baked essay model with:
#   OLLAMA_MODEL_STRONG=gimmejob-essay
# (e.g. in .env.local or your shell profile). The resolver routes
# long-form questions to the STRONG tier, so this is the one that
# matters for cover-letter prompts.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODELFILE="$SCRIPT_DIR/Modelfile.gimmejob-essay"
MODEL_NAME="gimmejob-essay"

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

BASE_MODEL="$(awk '/^FROM /{print $2; exit}' "$MODELFILE")"
if [ -z "$BASE_MODEL" ]; then
  echo "error: could not parse FROM line in $MODELFILE" >&2
  exit 1
fi

if ! ollama list 2>/dev/null | awk 'NR>1 {print $1}' | grep -qx "$BASE_MODEL"; then
  echo "Pulling base model $BASE_MODEL …"
  ollama pull "$BASE_MODEL"
fi

if [ "$FORCE" -eq 0 ] && ollama list 2>/dev/null | awk 'NR>1 {print $1}' | grep -qx "$MODEL_NAME:latest"; then
  echo "$MODEL_NAME already exists — skipping rebuild. Pass --force to rebuild."
  exit 0
fi

echo "Building $MODEL_NAME from $MODELFILE …"
ollama create "$MODEL_NAME" -f "$MODELFILE"

cat <<'EOF'

Done. To route long-form answers through this model, set:

    OLLAMA_MODEL_STRONG=gimmejob-essay

(in .env.local, your shell profile, or wherever you keep dev env vars)

Verify with:

    ollama run gimmejob-essay 'Write 3 sentences on why you would join a small fintech.'
EOF
