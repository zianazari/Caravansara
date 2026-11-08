## What and why

<!-- One or two sentences: what changes and the reason. Link the spec: specs/NNN-name/spec.md -->

## Spec Kit

- [ ] `spec.md`, `plan.md` and `tasks.md` are in `specs/NNN-name/` and match what was built (`/speckit-converge` reports Converged)
- [ ] The plan's Constitution Check passes, or each exception is justified in Complexity Tracking
- [ ] Not a feature (typo, docs wording, dependency bump): Spec Kit skipped on purpose

## Checks

- [ ] Every acceptance criterion (Given/When/Then) has a test
- [ ] API changes start in `backend/openapi.json` (`caravansara export-openapi`), and error codes stay stable
- [ ] New endpoints or events have metrics and logs; the dashboard and alerts still use only exported metrics
- [ ] CI is green: ruff, mypy, import-linter, tests (coverage ≥ 90%), monitoring config, and for the web site: the API client in sync with `openapi.json`, ESLint, Prettier, `tsc`, Vitest (coverage ≥ 90% for `src/lib` and `src/api`), build
- [ ] Pages: Persian and English, right-to-left and left-to-right, no horizontal scroll from 320 px, accessible (axe)

## Docs

- [ ] Decisions moved into `docs/backend-design.md` (and its PDF)
- [ ] The finished section left `docs/future-work.md`
- [ ] README and CONTEXT updated if they describe what changed
