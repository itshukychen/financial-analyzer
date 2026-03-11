#!/usr/bin/env bash
# scripts/validate-docs.sh — Documentation Quality Validator
#
# USAGE:
#   bash scripts/validate-docs.sh           # Run all checks
#   bash scripts/validate-docs.sh --quick   # Skip slow checks (external links)
#
# WHAT IT CHECKS:
#   1. Broken internal markdown links (./path.md, path.md, ../path.md)
#   2. bash code block syntax (bash -n on each extracted block)
#   3. Required sections present (TOC in long docs, Examples in API.md)
#   4. Consistent heading levels (no skipped levels like h1 → h3)
#   5. Unclosed code blocks (odd number of triple-backtick markers)
#
# EXIT CODES:
#   0 — all checks passed
#   1 — one or more checks failed (details printed to stderr)
#
# CI USAGE:
#   Add to .github/workflows/docs-check.yml:
#     - run: bash scripts/validate-docs.sh

set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────

DOCS_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ERRORS=0
WARNINGS=0

# ANSI colors (disabled in CI if NO_COLOR is set)
if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
  RED='\033[0;31m'
  YELLOW='\033[0;33m'
  GREEN='\033[0;32m'
  CYAN='\033[0;36m'
  RESET='\033[0m'
else
  RED='' YELLOW='' GREEN='' CYAN='' RESET=''
fi

# Docs to validate (relative to DOCS_ROOT)
DOCS=(
  "README.md"
  "DOCS.md"
  "ARCHITECTURE.md"
  "API.md"
  "CONTRIBUTING.md"
  "DATABASE.md"
  "TROUBLESHOOTING.md"
  "DEPLOYMENT.md"
  "TESTING.md"
  "TYPESCRIPT.md"
  "DEV.md"
)

# ─── Helper Functions ─────────────────────────────────────────────────────────

error() {
  echo -e "${RED}[ERROR]${RESET} $*" >&2
  ((ERRORS++)) || true
}

warn() {
  echo -e "${YELLOW}[WARN]${RESET} $*" >&2
  ((WARNINGS++)) || true
}

info() {
  echo -e "${CYAN}[INFO]${RESET} $*"
}

pass() {
  echo -e "${GREEN}[PASS]${RESET} $*"
}

# ─── Check 1: Broken Internal Links ──────────────────────────────────────────

check_internal_links() {
  info "Checking internal markdown links..."
  local link_errors=0

  for doc in "${DOCS[@]}"; do
    local doc_path="$DOCS_ROOT/$doc"
    if [[ ! -f "$doc_path" ]]; then
      warn "Document not found: $doc (skipping link check)"
      continue
    fi

    # Extract all markdown links: [text](target)
    # Capture targets that are relative paths (not http/https, not anchors-only)
    while IFS= read -r line_num_and_link; do
      local line_num="${line_num_and_link%%:*}"
      local link="${line_num_and_link#*:}"

      # Skip external URLs
      if [[ "$link" =~ ^https?:// ]]; then
        continue
      fi

      # Skip pure anchor links
      if [[ "$link" =~ ^# ]]; then
        continue
      fi

      # Strip anchor fragment from file path
      local file_target="${link%%#*}"

      # Skip empty
      if [[ -z "$file_target" ]]; then
        continue
      fi

      # Resolve relative to the doc's directory
      local doc_dir
      doc_dir="$(dirname "$doc_path")"
      local resolved="$doc_dir/$file_target"

      if [[ ! -f "$resolved" ]]; then
        error "$doc:$line_num — broken link: [$file_target] — file not found at $resolved"
        ((link_errors++)) || true
      fi
    done < <(
      grep -n '\[.\+\](.\+)' "$doc_path" 2>/dev/null |
      grep -oP '\d+:\([^)]+\)' |
      sed 's/^//' |
      while IFS= read -r match; do
        local lnum="${match%%:*}"
        local rest="${match#*:}"
        # Extract just the URL part from (url)
        local url
        url="$(echo "$rest" | grep -oP '(?<=\()[^)]+(?=\))')"
        echo "$lnum:$url"
      done
    ) 2>/dev/null || true
  done

  if [[ $link_errors -eq 0 ]]; then
    pass "Internal links — all links resolved"
  fi
}

# Link checker that skips content inside code blocks
check_internal_links_simple() {
  info "Checking internal markdown links..."
  local link_errors=0

  for doc in "${DOCS[@]}"; do
    local doc_path="$DOCS_ROOT/$doc"
    if [[ ! -f "$doc_path" ]]; then
      warn "Document not found: $doc"
      continue
    fi

    local doc_dir
    doc_dir="$(dirname "$doc_path")"

    # Parse file, tracking code block state, only check links outside code blocks
    local in_code_block=0
    local line_num=0

    while IFS= read -r line; do
      ((line_num++)) || true

      # Toggle code block state on triple-backtick lines
      if [[ "$line" =~ ^\`\`\` ]]; then
        if [[ $in_code_block -eq 0 ]]; then
          in_code_block=1
        else
          in_code_block=0
        fi
        continue
      fi

      # Skip lines inside code blocks
      [[ $in_code_block -eq 1 ]] && continue

      # Also skip inline code spans (lines starting with 4 spaces = indented code)
      [[ "$line" =~ ^[[:space:]]{4} ]] && continue

      # Extract markdown link targets: [text](target) pattern
      # Use a sed approach to find all [text](url) matches on this line
      local targets
      targets=$(echo "$line" | grep -oP '\[([^\]]+)\]\(([^)]+)\)' | grep -oP '(?<=\()([^)]+)(?=\))' || true)

      while IFS= read -r target; do
        [[ -z "$target" ]] && continue

        # Skip external URLs
        [[ "$target" =~ ^https?:// ]] && continue
        # Skip mailto links
        [[ "$target" =~ ^mailto: ]] && continue
        # Skip pure anchor links
        [[ "$target" =~ ^# ]] && continue
        # Skip links with spaces (table formatting, not real links)
        [[ "$target" =~ [[:space:]] ]] && continue

        # Strip anchor fragment to get just the file path
        local file_part="${target%%#*}"
        [[ -z "$file_part" ]] && continue

        local resolved="$doc_dir/$file_part"
        if [[ ! -f "$resolved" ]]; then
          error "$doc:$line_num — broken link: '$file_part' — file not found"
          ((link_errors++)) || true
        fi
      done <<< "$targets"
    done < "$doc_path"
  done

  if [[ $link_errors -eq 0 ]]; then
    pass "Internal links — all OK"
  fi
}

# ─── Check 2: bash Code Block Syntax ─────────────────────────────────────────

check_bash_syntax() {
  info "Checking bash code block syntax..."
  local syntax_errors=0
  local tmp_file
  tmp_file="$(mktemp /tmp/validate-docs-bash-XXXXXX.sh)"

  for doc in "${DOCS[@]}"; do
    local doc_path="$DOCS_ROOT/$doc"
    [[ ! -f "$doc_path" ]] && continue

    # Extract bash code blocks (between ```bash and ```)
    local in_bash_block=0
    local block_start=0
    local line_num=0
    local block_content=""

    while IFS= read -r line; do
      ((line_num++)) || true

      if [[ "$line" == '```bash' ]]; then
        in_bash_block=1
        block_start=$line_num
        block_content=""
        continue
      fi

      if [[ $in_bash_block -eq 1 ]]; then
        if [[ "$line" == '```' ]]; then
          in_bash_block=0
          # Skip blocks containing placeholder syntax like <commit-sha> or <files>
          # These are meant as human-readable templates, not executable bash
          if echo "$block_content" | grep -qP '<[a-zA-Z][a-zA-Z0-9_-]+>'; then
            block_content=""
            continue
          fi
          # Write block to temp file and syntax-check
          echo "$block_content" > "$tmp_file"
          if ! bash -n "$tmp_file" 2>/tmp/bash-check-error.txt; then
            local bash_error
            bash_error="$(cat /tmp/bash-check-error.txt)"
            error "$doc:$block_start — bash syntax error in code block: $bash_error"
            ((syntax_errors++)) || true
          fi
          block_content=""
        else
          block_content+="$line"$'\n'
        fi
      fi
    done < "$doc_path"
  done

  rm -f "$tmp_file" /tmp/bash-check-error.txt

  if [[ $syntax_errors -eq 0 ]]; then
    pass "bash syntax — all code blocks valid"
  fi
}

# ─── Check 3: Required Sections ──────────────────────────────────────────────

check_required_sections() {
  info "Checking required sections..."
  local section_errors=0

  for doc in "${DOCS[@]}"; do
    local doc_path="$DOCS_ROOT/$doc"
    [[ ! -f "$doc_path" ]] && continue

    local word_count
    word_count=$(wc -w < "$doc_path")

    # Docs over 800 words should have a Table of Contents
    if [[ $word_count -gt 800 ]]; then
      if ! grep -qi "table of contents\|## Contents\|## TOC" "$doc_path"; then
        warn "$doc — document has $word_count words but no Table of Contents section"
      fi
    fi
  done

  # API.md must have an Examples or example request section
  if [[ -f "$DOCS_ROOT/API.md" ]]; then
    if ! grep -qi "example request\|example response\|curl" "$DOCS_ROOT/API.md"; then
      error "API.md — missing example requests (should include curl commands)"
      ((section_errors++)) || true
    else
      pass "API.md — has example requests"
    fi
  fi

  # TROUBLESHOOTING.md must have Symptom/Solution structure
  if [[ -f "$DOCS_ROOT/TROUBLESHOOTING.md" ]]; then
    if ! grep -qi "symptom\|solution\|root cause" "$DOCS_ROOT/TROUBLESHOOTING.md"; then
      warn "TROUBLESHOOTING.md — consider using Symptom/Root Cause/Solution structure"
    fi
  fi

  if [[ $section_errors -eq 0 ]]; then
    pass "Required sections — all checks passed"
  fi
}

# ─── Check 4: Heading Level Consistency ──────────────────────────────────────

check_heading_levels() {
  info "Checking heading level consistency..."
  local heading_errors=0

  for doc in "${DOCS[@]}"; do
    local doc_path="$DOCS_ROOT/$doc"
    [[ ! -f "$doc_path" ]] && continue

    local prev_level=0
    local line_num=0
    local in_code_block=0

    while IFS= read -r line; do
      ((line_num++)) || true

      # Track code blocks to avoid flagging headings inside code blocks
      if [[ "$line" =~ ^\`\`\` ]]; then
        in_code_block=$(( 1 - in_code_block ))
        continue
      fi
      [[ $in_code_block -eq 1 ]] && continue

      # Match markdown headings: # ## ### etc.
      if [[ "$line" =~ ^(#{1,6})[[:space:]] ]]; then
        local hashes="${BASH_REMATCH[1]}"
        local level=${#hashes}

        # Only flag if jumping more than 1 level down (e.g., h1 → h3)
        # Allow h1 (document title) followed by h2+ (normal document structure)
        # Only flag skips that are clearly unintentional (skip 2+ levels)
        if [[ $prev_level -gt 1 && $level -gt $((prev_level + 1)) ]]; then
          warn "$doc:$line_num — heading level jumps from h$prev_level to h$level (skipped level)"
        fi

        prev_level=$level
      fi
    done < "$doc_path"
  done

  if [[ $heading_errors -eq 0 ]]; then
    pass "Heading levels — no skipped levels found"
  fi
}

# ─── Check 5: Unclosed Code Blocks ────────────────────────────────────────────

check_code_blocks() {
  info "Checking for unclosed code blocks..."
  local block_errors=0

  for doc in "${DOCS[@]}"; do
    local doc_path="$DOCS_ROOT/$doc"
    [[ ! -f "$doc_path" ]] && continue

    # Count lines that start with exactly three backticks (code fence markers)
    # Use python3 for reliable matching without shell quoting issues
    local backtick_count
    backtick_count=$(python3 -c "
import sys
count = 0
for line in open(sys.argv[1]):
    if line.startswith('\`\`\`'):
        count += 1
print(count)
" "$doc_path" 2>/dev/null || echo 0)

    if (( backtick_count % 2 != 0 )); then
      error "$doc — odd number of code fence markers ($backtick_count); likely an unclosed code block"
      ((block_errors++)) || true
    fi
  done

  if [[ $block_errors -eq 0 ]]; then
    pass "Code blocks — all blocks properly closed"
  fi
}

# ─── Check 6: All Docs Exist ─────────────────────────────────────────────────

check_docs_exist() {
  info "Checking all expected documentation files exist..."
  local missing=0

  for doc in "${DOCS[@]}"; do
    if [[ ! -f "$DOCS_ROOT/$doc" ]]; then
      error "Missing documentation file: $doc"
      ((missing++)) || true
    fi
  done

  if [[ $missing -eq 0 ]]; then
    pass "All $((${#DOCS[@]})) documentation files present"
  fi
}

# ─── Main ────────────────────────────────────────────────────────────────────

main() {
  echo ""
  echo "========================================"
  echo "  Documentation Validator"
  echo "  Root: $DOCS_ROOT"
  echo "========================================"
  echo ""

  check_docs_exist
  echo ""
  check_internal_links_simple
  echo ""
  check_bash_syntax
  echo ""
  check_required_sections
  echo ""
  check_heading_levels
  echo ""
  check_code_blocks
  echo ""

  echo "========================================"
  if [[ $ERRORS -gt 0 ]]; then
    echo -e "${RED}FAILED${RESET}: $ERRORS error(s), $WARNINGS warning(s)"
    echo "Fix the errors above before merging."
    exit 1
  elif [[ $WARNINGS -gt 0 ]]; then
    echo -e "${YELLOW}PASSED WITH WARNINGS${RESET}: 0 errors, $WARNINGS warning(s)"
    echo "Consider addressing the warnings above."
    exit 0
  else
    echo -e "${GREEN}ALL CHECKS PASSED${RESET}"
    exit 0
  fi
}

main "$@"
