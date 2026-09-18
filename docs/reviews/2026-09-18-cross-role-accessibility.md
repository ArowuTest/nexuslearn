# Cross-role accessibility hardening — 18 September 2026

## Scope and authority

Continue the existing frontend-first MVP plan after support-profile release
`35a6243`. This is a shared presentation and regression-test batch, not a new
design, curriculum expansion, native mobile app, or change to account permissions.
The compact mobile admin menu and desktop sidebar remain unchanged.

## Reproduced defects and changes

- The global gold keyboard outline was weak on light surfaces, and textareas
  were omitted. Inputs, textareas, links, buttons, selects and summaries now use
  a four-pixel navy outline with eight-pixel white backing; high-contrast mode
  retains cyan with black backing. This follows the pupil-route two-colour
  approach while preserving the documented four-pixel shared/mission contract.
  The personal route keeps its own existing three-pixel outline.
- The OS reduced-motion block preceded later portal/ambient animation rules,
  so those rules won the cascade. Pop, squash and shake were also missing.
  Preference overrides now follow the shared component declarations.
- Buttons, tiles and sentence cards still translated on hover/press with the
  pupil's reduced-motion setting. Both OS and pupil preferences now suppress
  these movements and transitions. Decorative shimmer, trace and particle
  animation are covered; static isometric diagram transforms are preserved.
- Admin setup disclosure text and release-ledger guidance failed 4.5:1 text
  contrast in the automated audit. Reuse an existing dark neutral for setup and
  remove the release text's opacity reduction; wording and governance stay intact.
- The expanded admin matrix reproduced an empty-progress text contrast failure
  on both devices. Its shared component now uses the existing stronger body-text
  opacity. An independent reviewer identified inline hatch confetti ignoring OS
  reduction; a real completion test failed on `confetti-fall` before the fix.
  Its animation name now lives in CSS, keeping normal duration/delay variation
  while hiding the decoration under either reduction preference.

Normal-mode animation remains available. No blanket universal animation reset,
new animation library, changed asset budget or relaxed visual threshold is used.

## Regression coverage

- Four role entry surfaces at 320 CSS pixels: keyboard focus, reflow and Axe
  critical/serious WCAG A/AA findings.
- All 18 existing admin sections: compact-menu keyboard selection, menu closure,
  focus transfer to the named workspace, narrow-screen reflow and Axe checks.
  These fixtures include a world and otherwise mostly empty directories; they
  are not proof that every possible populated record or CRUD workflow was audited.
- Linked parent card disclosure, support setup and child progress page; school
  support-note focus and section-link keyboard continuation.
- Pupil standard and SEND routes at 320px, expanded discoveries, plus the existing
  route regressions for Years 1–7 and independent subject progression.
- Shared animation CSS probes distinguish OS preference, pupil preference and
  normal mode. They are style-contract tests, not evidence that an unavailable
  public-world API or a full lesson journey loaded successfully.
- Real UI mission completion checks cover both OS-reduced and normal hatch
  motion with a standard pupil profile, preserving the ordinary celebration.

One bounded independent read-only code review found the hatch gap, a deferred
admin-panel loading race in the audit, and missing focus-ring backing assertions.
The gate now awaits loaded Reviews/Audio/Releases controls and checks the second
ring colour/spread and offset, including high contrast. The reviewer did not run
tests and did not provide human educational or clinical approval. A bounded
follow-up found no remaining concrete blocker in these specific remediations;
the reviewer was then closed.

Test fixtures contain disposable identities and never contact live pupil accounts.
All browser checks run against a fresh production build, not stale development CSS.

## Test-development corrections

The original red run included seven valid focus/motion failures. Four additional
motion tests had used an unsupported top-level Playwright option; `reducedMotion`
belongs in `contextOptions`. The corrected tests explicitly assert the browser's
media query before checking movement. Other preliminary fixture errors included
an invented admin content ID, raw rather than displayed discovery text, and an
incomplete AI-review summary. They were corrected against source/trace evidence,
not counted as application defects. Assertions and existing screenshot thresholds
were not weakened to conceal failures.

## Guidance and limitations

The engineering checks use W3C guidance for [visible keyboard focus](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html),
[320px reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) and
[disabling nonessential interaction animation](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html).
The last criterion is AAA; this document does not misrepresent it as an AA rule.

Automated checks and screenshot inspection are not a full WCAG certification,
screen-reader/device usability study, clinical SEND approval or teacher approval.
Independent safeguarding, real-child pilot evidence and hash-bound human audio
listening remain separate release gates. No new ElevenLabs generation or provider
spend is part of this CSS/UI batch.

## Validation

- Complete `npm run build`, including content quality, public-content boundary,
  TypeScript and production generation: exit 0. Content tooling reports no
  structural failures; 87 backend-unavailable warnings and `promotion=false`
  remain explicit in this isolated local build, not converted into approvals.
- Complete web lint: exit 0. All 96 combined CI boundary, performance-budget and
  deployment-smoke unit regressions: passed with no skips.
- Unchanged production asset budgets pass: aggregate JS 1,429,049 / 1,430,000,
  largest JS 222,191, CSS 72,947 and largest public asset 275,314 bytes. The
  small JS headroom is an ongoing constraint, not grounds to lift the cap.
- The initial final-candidate three-file browser run passed 138 cases and
  exposed four failures: two genuine empty-progress contrast failures and two
  synthetic motion-probe stacking collisions on touch viewports. The latter
  probes now occupy their own fixed test surface; no forced interaction is used.
- Direct screenshot inspection caught a synthetic admin directory returning an
  invalid response instead of the intended empty list. The first Linux run was
  deliberately stopped (exit 137, not a pass); all directory fixtures now follow
  the paginated contracts. Every admin scan awaits its section-loaded status and
  rejects directory-error fallback text as well as waiting for deferred panels.
- The next Linux matrix passed 248 cases, including the unchanged desktop/mobile
  visual baselines, but two tests detected the pre-existing four-pixel mission
  focus requirement. The global
  outline was restored to four pixels with stronger backing; the old renderer
  assertion remains unchanged. New helpers check exact ring sizes and colours.
- After restoring the four-pixel contract, a fresh bounded production build
  passed, followed by all **250 Linux browser tests in 10.2 minutes**, exit 0,
  with two workers, no retries and no external network. The pinned CI browser
  image uses the freshly compiled Windows production artifact and exact-lockfile
  dependencies. CI must independently rebuild the pushed source on Linux and
  run the complete repository matrix, including real API/PostgreSQL journeys.
  Local evidence: `apps/web/.agent/accessibility-linux-accepted-20260918.log`;
  build evidence: `apps/web/.agent/accessibility-focus4-build-20260918.log`.
- Inspected synthetic 320px school-note, admin progress and pupil SEND screenshots:
  visible focus backing, readable wrapped content and no horizontal page overflow.
  The final school-note screenshot also confirms the restored four-pixel outline.

Record post-push exact-commit CI/deployment outcomes in the FS V2B checkpoint;
this source document must not predict a successful deployment.
