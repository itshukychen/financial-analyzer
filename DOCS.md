# DOCS.md — Documentation Index

[Home](README.md) > Docs Index

Welcome to the financial-analyzer documentation hub. This page guides you to the right documentation based on your role.

---

## Reading Paths by Persona

### New Developer (Starting Today)

You want to understand the codebase and make your first contribution.

**Recommended order:**
1. [README.md](README.md) — Project overview and quickstart (2 min)
2. [ARCHITECTURE.md](ARCHITECTURE.md) — How the system is structured (30 min)
3. [DEV.md](DEV.md) — Development environment setup (15 min)
4. [CONTRIBUTING.md](CONTRIBUTING.md) — How to write code and open PRs (20 min)
5. [TESTING.md](TESTING.md) — How to write tests (20 min)

**Goal:** First PR submitted within one day.

---

### API Consumer (Integrating with the API)

You need to call the REST API endpoints from another service or script.

**Recommended order:**
1. [README.md](README.md) — What the project does (2 min)
2. [API.md](API.md) — All endpoints with request/response schemas (reference)
3. [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — When API calls return unexpected errors

---

### Operator / DevOps (Running in Production)

You manage deployments, monitor the service, and handle incidents.

**Recommended order:**
1. [DEPLOYMENT.md](DEPLOYMENT.md) — Deployment pipeline and procedures (required reading)
2. [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — Diagnosing and fixing common issues
3. [DATABASE.md](DATABASE.md) — Database backup, recovery, and maintenance

---

### Code Reviewer

You're reviewing a pull request and want to verify it meets standards.

**Recommended order:**
1. [CONTRIBUTING.md](CONTRIBUTING.md) — Code standards and PR checklist
2. [TESTING.md](TESTING.md) — Required test coverage and patterns
3. [ARCHITECTURE.md](ARCHITECTURE.md) — Architectural constraints and patterns

---

### Feature Contributor (Adding a New Feature)

You're implementing a new API endpoint, component, or data pipeline.

**Recommended order:**
1. [CONTRIBUTING.md](CONTRIBUTING.md) — Step-by-step guides for common tasks
2. [TESTING.md](TESTING.md) — How to write tests for your feature
3. [API.md](API.md) — API conventions and how to document new endpoints
4. [DATABASE.md](DATABASE.md) — If your feature needs schema changes
5. [TYPESCRIPT.md](TYPESCRIPT.md) — TypeScript patterns and type conventions

---

## All Documentation Files

| File | Purpose |
|---|---|
| [README.md](README.md) | Project overview, quickstart, features list |
| [DOCS.md](DOCS.md) | This file — documentation navigation index |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design, directory layout, request flow, design decisions |
| [API.md](API.md) | Complete REST API reference with curl examples and JSON schemas |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Developer workflow, code standards, PR process, common tasks |
| [DATABASE.md](DATABASE.md) | SQLite schema, migrations, backup/recovery, common queries |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Self-service debugging guide for common errors |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Production deployment flow, manual deploy, rollback, monitoring |
| [TESTING.md](TESTING.md) | Three-layer test strategy, patterns, coverage requirements |
| [TYPESCRIPT.md](TYPESCRIPT.md) | tsconfig settings, conventions, common patterns, IDE setup |
| [DEV.md](DEV.md) | Development environment, worktrees, port allocation, npm scripts |

---

## Quick Links

- **Open an issue:** [GitHub Issues](https://github.com/anthropics/financial-analyzer/issues)
- **CI/CD pipeline:** `.github/workflows/ci.yaml` and `.github/workflows/report.yml`
- **Dev server:** `http://localhost:3001` (main dev workspace)
- **Production (internal):** `http://localhost:3000`

---

## Documentation Conventions

- All docs use GitHub-flavored Markdown
- Code examples are copy-pasteable and tested against the actual codebase
- Breadcrumb navigation appears at the top of each doc: `[Home](README.md) > [Docs Index](DOCS.md) > Page`
- "See Also" sections at the bottom of each doc link to related documentation
- Shell commands assume bash and a working directory of the project root
