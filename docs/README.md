# Option Price Projection - Documentation

This directory contains all design and planning documents for the **SPWX Put Options Price Projection** feature.

---

## 📚 Document Guide

### [SUMMARY.md](./SUMMARY.md)
**→ Start here!**  
Quick overview of the feature, architecture, acceptance criteria, and next steps.

**Read this if you want:**
- High-level understanding of what we're building
- Quick start instructions
- Validation checklist

---

### [prd-option-price-projection.md](./prd-option-price-projection.md)
**Product Requirements Document**  
Complete product specification with user stories, success criteria, and scope.

**Read this if you want to understand:**
- WHY we're building this
- WHAT problem it solves
- WHO will use it
- WHAT success looks like

**Key sections:**
- Problem statement & goals
- User stories
- Scope & deliverables
- Success metrics
- Out of scope items

---

### [design-option-price-projection.md](./design-option-price-projection.md)
**Technical Design Document**  
Detailed technical architecture, API specs, database schema, and component design.

**Read this if you want to understand:**
- HOW to build it
- Database schema
- API endpoints & response formats
- Component architecture
- Analytics algorithms (IV, Greeks, HV)
- Testing strategy

**Key sections:**
- Architecture diagrams
- Database schema (SQL + types)
- Analytics library design (Black-Scholes formulas)
- API design (request/response schemas)
- UI component specs
- Mock data strategy

---

### [tasks-option-price-projection.md](./tasks-option-price-projection.md)
**Implementation Task Breakdown**  
Step-by-step guide for the engineer. Lists every task, in order, with code examples.

**Read this if you're:**
- The engineer implementing this
- Reviewing implementation progress
- Estimating time remaining

**Structure:**
- 5 phases (Foundation → Analytics → API → UI → Polish)
- ~25 tasks total
- Each task has: actions, code examples, tests, acceptance criteria
- Time estimates per phase

---

## 🗺️ How to Use These Docs

### For **Product Managers**:
1. Read: **PRD** (understand requirements)
2. Skim: **SUMMARY** (check acceptance criteria)
3. Monitor: **Tasks** (track engineer progress)

### For **Engineers**:
1. Read: **SUMMARY** (quick start)
2. Read: **Design** (understand architecture)
3. Follow: **Tasks** (implement step-by-step)
4. Reference: **PRD** (clarify product intent)

### For **Reviewers** (QA, Code Review):
1. Read: **SUMMARY** (understand what's being built)
2. Check: **Tasks** (validation checklist)
3. Reference: **Design** (verify technical approach)

### For **Stakeholders**:
1. Read: **SUMMARY** (high-level overview)
2. Skim: **PRD** (goals & success criteria)

---

## 📋 Quick Reference

### Feature Scope
- **Primary:** SPWX put options analysis
- **Dashboard widget:** IV, implied move, regime
- **Report page:** Greeks, probability distributions, AI insights
- **Data source:** Mock data (MVP), real API later

### Key Files to Implement
```
lib/db.ts                                    (database schema)
lib/optionsAnalytics.ts                      (IV, Greeks, HV)
lib/mockOptionsData.ts                       (test data)
scripts/backfill-option-data.ts              (populate DB)
app/api/options/snapshot/route.ts            (API endpoint)
app/api/options/projection/route.ts          (API endpoint)
app/components/options/OptionProjectionWidget.tsx
app/reports/option-projection/page.tsx
```

### Acceptance Criteria Summary
- [ ] Widget loads in < 500ms
- [ ] Report loads in < 2s
- [ ] 30 days of data in database
- [ ] All tests pass (unit + E2E)
- [ ] Mobile responsive
- [ ] No console errors

### Time Estimate
**26-36 hours** (3-5 days for one engineer)

---

## 🔄 Document Updates

| Date | Document | Change | Author |
|------|----------|--------|--------|
| 2026-03-09 | All | Initial creation | Architect |

---

## 📞 Need Help?

**Unclear requirement?** → Check PRD  
**Technical question?** → Check Design  
**Implementation question?** → Check Tasks  
**Still stuck?** → Ask architect or PM

---

**Happy building!** 🚀
