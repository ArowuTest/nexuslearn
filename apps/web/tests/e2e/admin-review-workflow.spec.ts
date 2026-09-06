import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("reviewer filters the SEND queue and sees honest release gates", async ({ page }) => {
  test.setTimeout(60_000);
  let narrationApproved = false;
  await page.addInitScript(() => {
    sessionStorage.setItem("nexuslearn_account_session", "reviewer-session-token");
    sessionStorage.setItem("nexuslearn_account_role", "content_reviewer");
    sessionStorage.setItem("nexuslearn_account_session_expires", "2099-01-01T00:00:00Z");
  });

  await page.route("http://api.test/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/v1/admin/ai-reviews/summary") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          packs: 87,
          variants: 20210,
          current_ai_curriculum_lead: 6614,
          current_ai_send_lead: 6614,
          stale: 0,
          revision_required: 1,
          escalation_required: 0,
          blocking_findings: 1,
          escalation_findings: 0,
          controlled_pilot_allowed: false,
        }),
      });
      return;
    }
    if (url.pathname === "/v1/admin/ai-reviews") {
      expect(route.request().headers().authorization).toBe("Bearer reviewer-session-token");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          items: [{
            id: "review-1",
            content_id: "en-y1-phonics-family-1",
            content_type: "variant_family",
            content_revision: "0.2.0",
            content_hash: "a".repeat(64),
            pack_id: "en-y1-phonics-blend-cvc-words",
            year_group: 1,
            subject: "English",
            lane_id: "ai_send_lead",
            status: "revision_required",
            risk_tier: "tier_3",
            rubric_revision: "curriculum-send-v1",
            source_set_revision: "sources-v1",
            reviewer_implementation: "nexuslearn-ai-curriculum-send-review-v1",
            model_identifier: "gpt-5",
            confidence: 0.91,
            criterion_results: { instruction_clarity: { result: "not_met", evidence: "The prompt needs shorter chunks." } },
            source_ids: ["dfe-send-code-0-25", "w3c-wcag-22"],
            reviewed_variant_ids: ["variant-1", "variant-2"],
            evidence_notes: "AI SEND review found one governed revision.",
            findings: [{
              criterion_id: "instruction_clarity",
              severity: "blocking",
              finding_code: "instruction_chunking",
              affected_fields: ["body.prompt"],
              rationale: "The prompt needs shorter chunks.",
              required_revisions: ["Split the direction into two steps."],
            }],
            stale: false,
          }],
          next_cursor: "cursor-2",
        }),
      });
      return;
    }
    if (url.pathname === "/v1/admin/config") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({}) });
      return;
    }
    if (url.pathname === "/v1/curriculum/objectives") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ objectives: [] }) });
      return;
    }
    if (url.pathname === "/v1/admin/content/readiness") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ generated_at: "", totals: { objectives: 0, ready: 0, pilot: 0, draft: 0, blocked: 0, published_activities: 0, published_questions: 0, formats: 0 }, items: [] }),
      });
      return;
    }
    if (url.pathname === "/v1/admin/audit") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ audit_logs: [] }) });
      return;
    }
    if (url.pathname === "/v1/admin/content/versions") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ content_versions: [] }) });
      return;
    }
    if (url.pathname === "/v1/admin/parent-invitations") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ parent_invitations: [] }) });
      return;
    }
    if (url.pathname === "/v1/admin/content/narration-queue") {
      const status = url.searchParams.get("status") ?? "awaiting";
      const item = {
        rank: 1,
        asset_id: "en-y1-phonics-form-lowercase-letters--lesson--finger-warm-up",
        pack_id: "en-y1-phonics-form-lowercase-letters",
        year: 1,
        subject: "English",
        kind: "lesson",
        source_id: "finger-warm-up",
        text_preview: "Follow the path slowly. Start at the glowing dot.",
        file: "/audio/narration/alice/en-y1-phonics-form-lowercase-letters/lesson/finger-warm-up.mp3",
        text_sha256: "a".repeat(64),
        audio_sha256: "b".repeat(64),
        voice_name: "Alice - Clear, Engaging Educator",
        model_id: "eleven_multilingual_v2",
        status: narrationApproved ? "approved" : "awaiting",
        rationale: ["early-years audio clarity has the highest child-impact risk"],
      };
      const visible = status === "all" || status === item.status ? [item] : [];
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ items: visible, total: visible.length, counts: { awaiting: narrationApproved ? 873 : 874, approved: narrationApproved ? 1 : 0, rejected: 0, stale: 0 }, limit: 20, offset: 0, next_offset: null, served_by: "api" }),
      });
      return;
    }
    if (url.pathname === "/v1/admin/content/narration-reviews") {
      if (route.request().method() === "POST") {
        const payload = route.request().postDataJSON();
        expect(payload.criteria).toEqual({ natural: true, clear: true, pronunciation: true, age_suitable: true });
        narrationApproved = true;
        await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ...payload, id: "audio-review-1", created_at: "2026-08-09T10:00:00Z", updated_at: "2026-08-09T10:00:00Z" }) });
        return;
      }
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ reviews: [] }) });
      return;
    }
    if (url.pathname === "/v1/admin/content/releases") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ content_releases: [] }) });
      return;
    }
    if (url.pathname === "/v1/admin/content/reviews") {
      await route.fulfill({ contentType: "application/json", body: "null" });
      return;
    }
    if (url.pathname.startsWith("/v1/admin/content/reports/")) {
      await route.fulfill({ contentType: "application/json", body: "null" });
      return;
    }
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({}) });
  });

  await page.goto("/admin?section=reviews");
  await expect(page.getByRole("heading", { name: "Curriculum and SEND review" })).toBeVisible();
  await page.getByLabel("Review lane").selectOption("ai_send_lead");
  const selectedEvidence = page.getByRole("region", { name: "Selected AI review evidence" });
  await expect(selectedEvidence.getByText("AI SEND Lead", { exact: true })).toBeVisible();
  await expect(page.getByText(/not independent human professional approval/i)).toBeVisible();
  await expect(page.getByText(/controlled pilot blocked/i)).toBeVisible();
  await expect(selectedEvidence.getByText("en-y1-phonics-family-1")).toBeVisible();
  await expect(page.getByText("Split the direction into two steps.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve governed evidence" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Next review page" })).toBeEnabled();

  const accessibility = await new AxeBuilder({ page })
    .include("main")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(accessibility.violations.filter((item) => item.impact === "critical" || item.impact === "serious")).toEqual([]);

  await page.getByRole("button", { name: "Audio", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Audio listening QA" })).toBeVisible();
  await expect(page.getByText("874", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Follow the path slowly. Start at the glowing dot.")).toBeVisible();
  await page.getByLabel("Natural, warm voice").check();
  await page.getByLabel("Clear and intelligible").check();
  await page.getByLabel("Accurate pronunciation").check();
  await page.getByLabel("Age-suitable pace and tone").check();
  await page.getByLabel("Reviewer name").fill("A. Audio Reviewer");
  await page.getByRole("button", { name: "Approve listening" }).click();
  await expect(page.getByText(/approved against the current transcript, audio and production profile/i)).toBeVisible();
  await expect(page.getByText(/No recordings match these filters/)).toBeVisible();
});
