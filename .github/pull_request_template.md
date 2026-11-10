## What and why

<!-- One or two sentences: what changes and the reason, and the decisions taken on the way. -->

## Checks

- [ ] Every behaviour that changed has a test, written before or with the code
- [ ] The change follows the constitution (`.specify/memory/constitution.md`), or the exception and its reason are stated above
- [ ] API changes start in `backend/openapi.json` (`caravansara export-openapi`), and error codes stay stable
- [ ] New endpoints or events have metrics and logs; the dashboard and alerts still use only exported metrics
- [ ] CI is green: ruff, mypy, import-linter, tests (coverage ≥ 90%), monitoring config, and for the web site: the API client in sync with `openapi.json`, ESLint, Prettier, `tsc`, Vitest (coverage ≥ 90% for `src/lib` and `src/api`), build
- [ ] Pages: Persian and English, right-to-left and left-to-right, no horizontal scroll from 320 px, accessible (axe)

## Docs

- [ ] Decisions moved into `docs/backend-design.md` (and its PDF)
- [ ] The finished section left `docs/future-work.md`
- [ ] README and CONTEXT updated if they describe what changed
