---
name: "test-env-setup"
description: "Manage test infrastructure including browser binaries, test databases, and mock services for isolated testing."
metadata:
  author: "madz"
  version: "1.0"
  agent: "coding"
---

# Test Environment Setup Skill

Manage test infrastructure including browser binaries, test databases, and mock services. This skill depends on `project-context` output to determine the test framework and infrastructure requirements.

## Prerequisites

- **project-context skill** must be run first to detect the test framework
- Platform: Linux (primary), macOS (secondary)
- Docker available for containerized test services (optional but recommended)

## Input/Output Contract

**Input**:
- Action: `setup`, `verify`, or `cleanup`
- Service type: `browser`, `database`, `mock`, or `all`
- Optional: specific service name (e.g., `postgresql`, `chromium`)

**Output**: Structured setup/verification report:

```
## Test Environment Report

### Browser Binaries
- [OK] Chromium: /usr/lib/chromium/chromium (v120.0.6099.109)
- [MISSING] Firefox: not installed
- [OK] WebKit: /usr/lib/webkit/webkit (v17.4)

### Test Databases
- [OK] PostgreSQL: localhost:5432 (v16.1)
- [OK] SQLite: in-memory (v3.45.1)
- [MISSING] MongoDB: not running

### Mock Services
- [OK] SMTP: localhost:1025 (mailhog)
- [OK] HTTP: localhost:8080 (wiremock)

### Summary
- Total services: 6
- Ready: 4
- Missing: 2
```

## 1. Browser Binary Management

Manage browser binaries for end-to-end testing frameworks:

```bash
# Playwright — Chromium installation
if [ "$TEST_FRAMEWORK" = "playwright" ] || { [ -f "package.json" ] && grep -q '"@playwright/test"' package.json; }; then
  echo "Checking Playwright browser binaries..."

  # Check if Chromium is installed
  CHROMIUM_PATH=$(npx playwright install --dry-run chromium 2>&1 | grep -oP 'to \K.*' || true)

  if [ -z "$CHROMIUM_PATH" ] || [ ! -d "$CHROMIUM_PATH" ]; then
    echo "Installing Chromium for Playwright..."
    npx playwright install chromium 2>&1
    PW_EXIT=$?
    if [ $PW_EXIT -ne 0 ]; then
      echo "PLAYWRIGHT CHROMIUM INSTALL FAILED (exit $PW_EXIT)"
    else
      echo "PLAYWRIGHT CHROMIUM INSTALLED"
    fi
  else
    echo "PLAYWRIGHT CHROMIUM ALREADY INSTALLED: $CHROMIUM_PATH"
  fi

  # Check for Firefox
  if { grep -q '"firefox"' package.json playwright.config.* 2>/dev/null; }; then
    echo "Checking Firefox..."
    npx playwright install firefox 2>&1 || true
  fi

  # Check for WebKit
  if { grep -q '"webkit"' package.json playwright.config.* 2>/dev/null; }; then
    echo "Checking WebKit..."
    npx playwright install webkit 2>&1 || true
  fi
fi

# Puppeteer — Chrome installation
if [ "$TEST_FRAMEWORK" = "puppeteer" ] || { [ -f "package.json" ] && grep -q '"puppeteer"' package.json; }; then
  echo "Checking Puppeteer browser..."

  # Check if Chrome/Chromium is installed
  if command -v chromium-browser &> /dev/null; then
    echo "Chrome/Chromium available: $(chromium-browser --version 2>/dev/null)"
  elif command -v google-chrome &> /dev/null; then
    echo "Google Chrome available: $(google-chrome --version 2>/dev/null)"
  else
    echo "Installing Chrome for Puppeteer..."
    npx puppeteer browsers install chrome 2>&1
    PP_EXIT=$?
    if [ $PP_EXIT -ne 0 ]; then
      echo "PUPPETEER CHROME INSTALL FAILED (exit $PP_EXIT)"
    else
      echo "PUPPETEER CHROME INSTALLED"
    fi
  fi
fi

# Cypress — browser installation
if [ "$TEST_FRAMEWORK" = "cypress" ] || { [ -f "package.json" ] && grep -q '"cypress"' package.json; }; then
  echo "Checking Cypress browsers..."
  npx cypress cache list 2>&1 || true

  if [ -z "$(npx cypress cache list 2>/dev/null)" ]; then
    echo "Installing Cypress browsers..."
    npx cypress install 2>&1
    CE_EXIT=$?
    if [ $CE_EXIT -ne 0 ]; then
      echo "CYPRESS BROWSER INSTALL FAILED (exit $CE_EXIT)"
    else
      echo "CYPRESS BROWSERS INSTALLED"
    fi
  fi
fi
```

## 2. Test Database Setup

Set up test databases for integration testing:

```bash
# PostgreSQL — create test database
if [ "$TEST_FRAMEWORK" = "junit" ] || [ "$TEST_FRAMEWORK" = "pytest" ]; then
  # Check if PostgreSQL is running
  if command -v psql &> /dev/null; then
    if pg_isready -h localhost -p 5432 &> /dev/null; then
      echo "PostgreSQL is running on localhost:5432"

      # Create test database if it doesn't exist
      TEST_DB="${TEST_DB_NAME:-test_db}"
      psql -h localhost -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = '$TEST_DB'" | grep -q 1 || \
        psql -h localhost -U postgres -c "CREATE DATABASE $TEST_DB" 2>&1

      echo "Test database ready: $TEST_DB"
    else
      echo "PostgreSQL not running. Starting with Docker..."
      docker run -d --name madz-postgres -e POSTGRES_PASSWORD=test -e POSTGRES_DB=$TEST_DB -p 5432:5432 postgres:16-alpine 2>&1
      PG_EXIT=$?
      if [ $PG_EXIT -ne 0 ]; then
        echo "POSTGRESQL DOCKER START FAILED (exit $PG_EXIT)"
      else
        echo "POSTGRESQL STARTED: localhost:5432/$TEST_DB"
      fi
    fi
  else
    echo "PostgreSQL client (psql) not found. Installing test DB with Docker..."
    docker run -d --name madz-postgres -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test_db -p 5432:5432 postgres:16-alpine 2>&1
  fi
fi

# SQLite — in-memory or file-based
if [ "$TEST_FRAMEWORK" = "pytest" ] || [ "$TEST_FRAMEWORK" = "node-builtin" ]; then
  echo "SQLite is available (built-in to most languages)"

  # Create test database file if needed
  TEST_DB_FILE="${TEST_DB_FILE:-:memory:}"
  if [ "$TEST_DB_FILE" != ":memory:" ]; then
    mkdir -p "$(dirname "$TEST_DB_FILE")"
    if [ ! -f "$TEST_DB_FILE" ]; then
      echo "Creating SQLite test database: $TEST_DB_FILE"
      sqlite3 "$TEST_DB_FILE" ".dump" 2>/dev/null || touch "$TEST_DB_FILE"
    fi
    echo "SQLite test database ready: $TEST_DB_FILE"
  else
    echo "SQLite test database: in-memory (transient)"
  fi
fi

# MongoDB — start test instance
if [ "$TEST_FRAMEWORK" = "junit" ] || grep -q 'mongodb' package.json requirements.txt 2>/dev/null; then
  if command -v mongosh &> /dev/null; then
    if pg_isready -h localhost -p 27017 &> /dev/null 2>&1 || mongosh --eval "db.runCommand('ping')" &> /dev/null 2>&1; then
      echo "MongoDB is running on localhost:27017"
    else
      echo "Starting MongoDB with Docker..."
      docker run -d --name madz-mongodb -p 27017:27017 mongo:7 2>&1
      MONGO_EXIT=$?
      if [ $MONGO_EXIT -ne 0 ]; then
        echo "MONGODB DOCKER START FAILED (exit $MONGO_EXIT)"
      else
        echo "MONGODB STARTED: localhost:27017"
      fi
    fi
  else
    echo "MongoDB not available. Starting with Docker..."
    docker run -d --name madz-mongodb -p 27017:27017 mongo:7 2>&1
  fi
fi
```

## 3. Mock Service Configuration

Configure mock services for isolated testing:

```bash
# Mock SMTP server (Mailhog)
if [ "$TEST_FRAMEWORK" = "pytest" ] || grep -q 'nodemailer\|smtp' package.json requirements.txt 2>/dev/null; then
  echo "Checking mock SMTP server..."

  if ! curl -s http://localhost:1025 &> /dev/null; then
    echo "Starting Mailhog (mock SMTP)..."
    docker run -d --name madz-mailhog -p 1025:1025 -p 8025:8025 mailhog/mailhog:latest 2>&1
    MH_EXIT=$?
    if [ $MH_EXIT -ne 0 ]; then
      echo "MAILHOG DOCKER START FAILED (exit $MH_EXIT)"
    else
      echo "MAILHOG STARTED: localhost:1025 (SMTP), localhost:8025 (UI)"
    fi
  else
    echo "Mailhog already running: localhost:1025"
  fi
fi

# Mock HTTP server (WireMock / local)
if grep -q 'nock\|mockttp\|wiremock' package.json requirements.txt 2>/dev/null; then
  echo "Checking mock HTTP server..."

  # Check if a mock server is already running on common ports
  if ! curl -s http://localhost:8080 &> /dev/null; then
    echo "Starting WireMock (mock HTTP)..."
    docker run -d --name madz-wiremock -p 8080:8080 wiremock/wiremock:latest-alpine 2>&1
    WM_EXIT=$?
    if [ $WM_EXIT -ne 0 ]; then
      echo "WIREMOCK DOCKER START FAILED (exit $WM_EXIT)"
    else
      echo "WIREMOCK STARTED: localhost:8080"
    fi
  else
    echo "WireMock already running: localhost:8080"
  fi
fi

# Redis for caching tests
if grep -q 'redis\|ioredis\|redis-py' package.json requirements.txt 2>/dev/null; then
  echo "Checking Redis..."

  if ! redis-cli ping &> /dev/null; then
    echo "Starting Redis with Docker..."
    docker run -d --name madz-redis -p 6379:6379 redis:7-alpine 2>&1
    REDIS_EXIT=$?
    if [ $REDIS_EXIT -ne 0 ]; then
      echo "REDIS DOCKER START FAILED (exit $REDIS_EXIT)"
    else
      echo "REDIS STARTED: localhost:6379"
    fi
  else
    echo "Redis already running: localhost:6379"
  fi
fi
```

## 4. Platform-Specific Considerations

Handle platform differences (Linux vs. macOS):

```bash
# Detect platform
PLATFORM=$(uname -s | tr '[:upper:]' '[:lower:]')

case "$PLATFORM" in
  linux)
    echo "Platform: Linux"
    # Linux-specific: use system package manager for browser binaries
    if command -v apt-get &> /dev/null; then
      echo "Detected apt — browsers can be installed via system packages"
      # Chromium: apt install chromium-browser
      # Firefox: apt install firefox
    elif command -v yum &> /dev/null; then
      echo "Detected yum — browsers can be installed via system packages"
    fi
    ;;
  darwin)
    echo "Platform: macOS"
    # macOS-specific: use Homebrew for browser binaries
    if command -v brew &> /dev/null; then
      echo "Detected Homebrew — browsers can be installed via brew"
      # Chromium: brew install --cask chromium
      # Firefox: brew install --cask firefox
    fi
    ;;
  *)
    echo "WARNING: Unsupported platform: $PLATFORM"
    echo "Browser and service installation may require manual setup."
    ;;
esac
```

## 5. Cleanup

Clean up test environment after tests complete:

```bash
# Stop and remove Docker containers started by this skill
cleanup_containers() {
  echo "Cleaning up test environment..."

  for container in madz-postgres madz-mongodb madz-mailhog madz-wiremock madz-redis; do
    if docker ps -q -f name="$container" &> /dev/null; then
      echo "Stopping container: $container"
      docker stop "$container" 2>/dev/null
      docker rm "$container" 2>/dev/null
    fi
  done

  # Remove test database files
  if [ -n "$TEST_DB_FILE" ] && [ "$TEST_DB_FILE" != ":memory:" ] && [ -f "$TEST_DB_FILE" ]; then
    echo "Removing test database file: $TEST_DB_FILE"
    rm -f "$TEST_DB_FILE"
  fi

  echo "Test environment cleanup complete."
}
```

## 6. Verification

Verify all required test infrastructure is available:

```bash
echo "=== Test Environment Verification ==="

# Browser binaries
echo ""
echo "Browser Binaries:"
if command -v chromium-browser &> /dev/null; then
  echo "  [OK] Chromium: $(chromium-browser --version 2>/dev/null)"
else
  echo "  [MISSING] Chromium"
fi

if command -v firefox &> /dev/null; then
  echo "  [OK] Firefox: $(firefox --version 2>/dev/null)"
else
  echo "  [MISSING] Firefox"
fi

# Databases
echo ""
echo "Databases:"
if pg_isready -h localhost -p 5432 &> /dev/null; then
  echo "  [OK] PostgreSQL: localhost:5432"
else
  echo "  [MISSING] PostgreSQL"
fi

echo "  [OK] SQLite: built-in"

if mongosh --eval "db.runCommand('ping')" &> /dev/null 2>&1; then
  echo "  [OK] MongoDB: localhost:27017"
else
  echo "  [MISSING] MongoDB"
fi

# Mock services
echo ""
echo "Mock Services:"
if curl -s http://localhost:1025 &> /dev/null; then
  echo "  [OK] SMTP: localhost:1025"
else
  echo "  [MISSING] SMTP (Mailhog)"
fi

if redis-cli ping &> /dev/null; then
  echo "  [OK] Redis: localhost:6379"
else
  echo "  [MISSING] Redis"
fi

echo ""
echo "=== Verification Complete ==="
```

## Edge Cases

- **No Docker**: If Docker is not available, suggest installing services via system package managers or skip containerized services.
- **Port conflicts**: If a required port is already in use, try an alternative port (e.g., 5433 instead of 5432) and report the change.
- **Limited permissions**: If the user cannot run Docker (no sudo), suggest using in-memory alternatives (SQLite, embedded Redis via ioredis).
- **CI/CD environments**: In CI, browser binaries may already be pre-installed. Check for `CI=true` environment variable and skip installation if present.
- **Network restrictions**: If the sandbox has no network access, skip Docker pulls and suggest local alternatives.

## Guardrails

- Do NOT start services on privileged ports (< 1024) without user confirmation.
- Do NOT persist test data between test runs — always use fresh databases.
- Do NOT leave Docker containers running after cleanup — always stop and remove them.
- Do NOT install browser binaries system-wide — use npx/playwright/puppeteer local installs when possible.
- Always report the port and credentials used for test services so the agent can configure tests correctly.
- Never use `eval` to construct service commands.
