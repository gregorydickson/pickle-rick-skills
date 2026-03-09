#!/bin/bash
set -euo pipefail

INSTALL_ROOT="${PICKLE_RICK_SKILLS_HOME:-$HOME/.pickle-rick-skills}"
SKILLS_ROOT="${AGENTS_SKILLS_HOME:-$HOME/.agents/skills}"

FORCE=false
KEEP_LOGS=false

for arg in "$@"; do
  case "$arg" in
    --force) FORCE=true ;;
    --keep-logs) KEEP_LOGS=true ;;
    --help) echo "Usage: ./uninstall.sh [--force] [--keep-logs]"; exit 0 ;;
  esac
done

SKILL_DIRS=(
  council-of-ricks meeseeks pickle-jar pickle-metrics pickle-prd
  pickle-refine-prd pickle-rick pickle-standup portal-gun project-mayhem
)

if [ "$FORCE" = false ]; then
  echo "This will remove:"
  echo "  $INSTALL_ROOT/"
  for d in "${SKILL_DIRS[@]}"; do
    [ -d "$SKILLS_ROOT/$d" ] && echo "  $SKILLS_ROOT/$d/"
  done
  printf "Continue? [y/N] "
  read -r confirm
  case "$confirm" in
    [yY]|[yY][eE][sS]) ;;
    *) echo "Aborted."; exit 0 ;;
  esac
fi

echo "Uninstalling pickle-rick-skills..."

# Remove skill directories
for d in "${SKILL_DIRS[@]}"; do
  if [ -d "$SKILLS_ROOT/$d" ]; then
    rm -rf "$SKILLS_ROOT/$d"
    echo "  Removed $SKILLS_ROOT/$d/"
  fi
done

# Remove install root
if [ -d "$INSTALL_ROOT" ]; then
  if [ "$KEEP_LOGS" = true ] && [ -d "$INSTALL_ROOT/activity" ]; then
    # Preserve activity logs — remove everything else
    find "$INSTALL_ROOT" -mindepth 1 -maxdepth 1 -not -name activity -exec rm -rf {} +
    echo "  Removed $INSTALL_ROOT/ (activity logs preserved)"
  else
    rm -rf "$INSTALL_ROOT"
    echo "  Removed $INSTALL_ROOT/"
  fi
fi

echo ""
echo "pickle-rick-skills uninstalled."
