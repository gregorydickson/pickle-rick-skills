#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_ROOT="${PICKLE_RICK_SKILLS_HOME:-$HOME/.pickle-rick-skills}"
SKILLS_ROOT="${AGENTS_SKILLS_HOME:-$HOME/.agents/skills}"

SKIP_AUTH=false
for arg in "$@"; do
  case "$arg" in
    --skip-auth) SKIP_AUTH=true ;;
    --help) echo "Usage: ./install.sh [--skip-auth]"; exit 0 ;;
  esac
done

echo "Installing pickle-rick-skills..."

# --- VALIDATION ---
node --version >/dev/null 2>&1 || { echo "ERROR: node not found on PATH"; exit 1; }

SKILL_DIRS=(
  council-of-ricks meeseeks pickle-jar pickle-metrics pickle-prd
  pickle-refine-prd pickle-rick pickle-standup portal-gun project-mayhem
)

for d in "${SKILL_DIRS[@]}"; do
  [ -f "$SCRIPT_DIR/.agents/skills/$d/SKILL.md" ] || { echo "ERROR: .agents/skills/$d/SKILL.md not found"; exit 1; }
done

# --- CLI DETECTION ---
CLIS=(claude gemini codex aider hermes goose amp kilo)
TIERS=(verified pending pending pending community community community community)
DETECTED_JSON="{"
PRIMARY_CLI=""
DETECTED_COUNT=0

for i in "${!CLIS[@]}"; do
  cli="${CLIS[$i]}"
  tier="${TIERS[$i]}"
  if command -v "$cli" >/dev/null 2>&1; then
    echo "  Found: $cli ($tier)"
    DETECTED_JSON="$DETECTED_JSON\"$cli\":{\"detected\":true,\"tier\":\"$tier\"},"
    [ -z "$PRIMARY_CLI" ] && PRIMARY_CLI="$cli"
    DETECTED_COUNT=$((DETECTED_COUNT + 1))

    # Auth probe
    if [ "$SKIP_AUTH" = false ]; then
      if "$cli" --version >/dev/null 2>&1; then
        echo "    Auth: OK"
      else
        echo "    WARN: $cli --version failed (auth may need setup)"
      fi
    fi
  else
    DETECTED_JSON="$DETECTED_JSON\"$cli\":{\"detected\":false,\"tier\":\"$tier\"},"
  fi
done

DETECTED_JSON="${DETECTED_JSON%,}}"

if [ "$DETECTED_COUNT" -eq 0 ]; then
  echo "WARN: No supported CLIs found on PATH. Skills will be installed but no CLI is configured."
  echo "      Supported: ${CLIS[*]}"
  PRIMARY_CLI="claude"
fi

# --- DIRECTORIES ---
mkdir -p "$INSTALL_ROOT" "$INSTALL_ROOT/sessions" "$INSTALL_ROOT/activity"
mkdir -p "$SKILLS_ROOT"
chmod 700 "$INSTALL_ROOT/activity" 2>/dev/null || true

# --- CONFIG MERGE (Node.js — no jq dependency) ---
node -e "
const fs = require('fs');
const path = require('path');

const configPath = path.join('$INSTALL_ROOT', 'config.json');
const detected = $DETECTED_JSON;
const primaryCli = '$PRIMARY_CLI';

const defaults = {
  max_iterations: 100,
  max_time_minutes: 120,
  worker_timeout_seconds: 1200,
  tmux_max_turns: 200,
  manager_max_turns: 50,
  refinement_cycles: 3,
  refinement_max_turns: 100,
  refinement_worker_timeout_seconds: 600,
  meeseeks_min_passes: 10,
  meeseeks_max_passes: 50,
  meeseeks_model: 'sonnet',
  rate_limit_wait_minutes: 60,
  max_rate_limit_retries: 3,
  rate_limit_poll_ms: 10000,
  sigkill_grace_seconds: 5,
  cb_enabled: true,
  cb_no_progress_threshold: 5,
  cb_half_open_after: 3,
  cb_error_threshold: 3,
  chain_meeseeks: false,
  activity_logging: true,
};

let existing = {};
try {
  if (fs.existsSync(configPath)) {
    existing = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
} catch { /* fresh config */ }

// Merge defaults — preserve user-modified values
const mergedDefaults = { ...defaults };
if (existing.defaults) {
  for (const [k, v] of Object.entries(existing.defaults)) {
    if (k in mergedDefaults && v !== undefined) {
      mergedDefaults[k] = v;
    }
  }
}

// Merge runtimes — overlay detection status
const mergedRuntimes = existing.runtimes || {};
for (const [cli, info] of Object.entries(detected)) {
  if (mergedRuntimes[cli]) {
    mergedRuntimes[cli].detected = info.detected;
    mergedRuntimes[cli].tier = info.tier;
  } else {
    mergedRuntimes[cli] = info;
  }
}

const config = {
  primary_cli: existing.primary_cli || primaryCli,
  persona: existing.persona !== undefined ? existing.persona : true,
  activity_logging: mergedDefaults.activity_logging,
  runtimes: mergedRuntimes,
  defaults: mergedDefaults,
};

const tmpPath = configPath + '.tmp.' + process.pid;
fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2) + '\n');
fs.renameSync(tmpPath, configPath);
"
echo "  Config written to $INSTALL_ROOT/config.json"

# --- COPY SKILLS ---
for d in "${SKILL_DIRS[@]}"; do
  mkdir -p "$SKILLS_ROOT/$d"
  cp "$SCRIPT_DIR/.agents/skills/$d/SKILL.md" "$SKILLS_ROOT/$d/SKILL.md"
done
echo "  Skills copied to $SKILLS_ROOT/"

# --- SYMLINKS (scripts/ -> compiled output) ---
for d in "${SKILL_DIRS[@]}"; do
  ln -sf "$SCRIPT_DIR/scripts" "$SKILLS_ROOT/$d/scripts"
done
echo "  Symlinks created"

# --- COPY SETTINGS + PERSONA ---
cp "$SCRIPT_DIR/pickle_settings.json" "$INSTALL_ROOT/pickle_settings.json"
cp "$SCRIPT_DIR/persona.md" "$INSTALL_ROOT/persona.md"

# --- TMUX CHECK ---
if ! command -v tmux >/dev/null 2>&1; then
  echo "WARN: tmux not found. Skills work inline without tmux, but the loop runner requires it."
fi

echo ""
echo "pickle-rick-skills installed!"
echo "  Config:  $INSTALL_ROOT/config.json"
echo "  Skills:  $SKILLS_ROOT/"
echo "  Primary: $PRIMARY_CLI"
echo ""
echo "Get started: use /pickle-rick in your CLI agent"
