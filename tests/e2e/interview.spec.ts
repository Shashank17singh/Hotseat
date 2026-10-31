import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function startInterview(page: Page, role = "Backend Engineer") {
  await page.goto("/setup");
  await page.getByLabel("Role you are applying for").fill(role);
  await page.getByText("3", { exact: true }).click();
  await page.getByRole("button", { name: "Start interview" }).click();
  await page.waitForURL(/\/interview\?id=/);
  await expect(page.getByRole("button", { name: "Begin interview" })).toBeVisible();
}

async function waitForTurn(page: Page) {
  await expect(page.getByTestId("room-state")).toHaveText("Your turn", { timeout: 15_000 });
}

async function speakAnswer(page: Page) {
  await page.getByRole("button", { name: "Start answer" }).click();
  await expect(page.getByTestId("room-state")).toHaveText("Recording your answer");
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Stop answer" }).click();
  await expect(page.getByRole("button", { name: "Send answer" })).toBeVisible();
}

test("the hero form carries role and difficulty into setup", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Role you are applying for").fill("Data Analyst");
  await page.locator(".counter").getByText("Bar raiser").click();
  await page.getByRole("button", { name: "Take the seat" }).first().click();
  await page.waitForURL(/\/setup/);
  await expect(page.getByLabel("Role you are applying for")).toHaveValue("Data Analyst");
  await expect(page.locator("#difficulty-bar_raiser")).toBeChecked();
});

test("setup needs a role", async ({ page }) => {
  await page.goto("/setup");
  await page.getByRole("button", { name: "Start interview" }).click();
  await expect(page.getByText("Enter the role so the questions fit it.")).toBeVisible();
  await expect(page).toHaveURL(/\/setup/);
});

test("a real PDF resume uploads and is summarised", async ({ page, context }) => {
  const printer = await context.newPage();
  await printer.setContent(`<h1>Test Candidate</h1><p>${"Backend engineer building billing services in TypeScript. ".repeat(6)}</p>`);
  const pdf = await printer.pdf();
  await printer.close();

  await page.goto("/setup");
  await page.getByLabel("Resume file").setInputFiles({ name: "resume.pdf", mimeType: "application/pdf", buffer: pdf });
  await expect(page.getByTestId("profile")).toContainText("Test Candidate");
  await expect(page.getByTestId("profile")).toContainText("PostgreSQL");
});

test("a bad resume file shows a clear error", async ({ page }) => {
  await page.goto("/setup");
  await page.getByLabel("Resume file").setInputFiles({ name: "resume.exe", mimeType: "application/octet-stream", buffer: Buffer.from([1, 2, 3, 4]) });
  await expect(page.locator(".notice[role=alert]")).toContainText("Upload a PDF, DOCX or TXT file.");
});

test("device check shows the camera and a moving mic level", async ({ page }) => {
  await page.goto("/setup");
  await page.getByRole("button", { name: "Test mic and camera" }).click();
  await expect(page.getByRole("button", { name: "Stop test" })).toBeVisible();
  const video = page.getByLabel("Camera preview");
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.videoWidth)).toBeGreaterThan(0);
  await expect.poll(() => page.getByTestId("mic-meter").evaluate((el) => Number(el.style.getPropertyValue("--level")))).toBeGreaterThan(0);
});

test("a full voice interview reaches a scored report with a playable clip", async ({ page }) => {
  await startInterview(page);
  await expect.poll(() => page.locator("video[aria-label='Your camera']").evaluate((el: HTMLVideoElement) => el.videoWidth)).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Begin interview" }).click();
  await waitForTurn(page);
  await expect(page.getByTestId("question")).toContainText("part 1");

  await speakAnswer(page);
  await expect(page.getByLabel(/as transcribed/)).toHaveValue(/billing service/);
  await page.getByRole("button", { name: "Send answer" }).click();

  await waitForTurn(page);
  await expect(page.getByTestId("question")).toHaveText("What was the measurable result?");
  await speakAnswer(page);
  await page.getByRole("button", { name: "Send answer" }).click();

  await waitForTurn(page);
  await expect(page.getByTestId("question")).toHaveText("Write a function that reverses a string.");
  await page.getByLabel("Your code").fill("const reverse = (s) => [...s].reverse().join('');");
  await page.getByRole("button", { name: "Send code only" }).click();

  await waitForTurn(page);
  await page.getByRole("button", { name: "Show hint (costs 5 points)" }).click();
  await expect(page.getByText("Describe the situation")).toBeVisible();
  await page.getByRole("button", { name: "Type instead" }).click();
  await page.getByLabel("Your answer").fill("I rebuilt the importer and cut failures by half.");
  await page.getByRole("button", { name: "Send answer" }).click();

  await page.waitForURL(/\/report\//);
  // Mock scores 80, 70 and 60, less 5 for the hint on the last question.
  await expect(page.getByTestId("overall")).toHaveText("68", { timeout: 15_000 });
  await expect(page.getByText("How you sounded")).toBeVisible();
  await expect(page.locator("pre code")).toBeHidden();
  await page.getByText("2. Write a function").click();
  await expect(page.locator("pre code")).toContainText("reverse");

  const clip = page.locator("details video").first();
  await expect(clip).toBeVisible();
  await clip.evaluate((el: HTMLVideoElement) => { el.muted = true; return el.play(); });
  await expect.poll(() => clip.evaluate((el: HTMLVideoElement) => el.currentTime)).toBeGreaterThan(0);

  await page.reload();
  await expect(page.getByTestId("overall")).toHaveText("68");
  await page.goto("/history");
  await expect(page.getByRole("link", { name: "Backend Engineer" })).toBeVisible();
});

test("the camera and mic toggles change the live tracks", async ({ page }) => {
  await startInterview(page, "Mobile Engineer");
  await page.getByRole("button", { name: "Camera on" }).click();
  await expect(page.getByText("Camera off", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Mic on" }).click();
  await page.getByRole("button", { name: "Begin interview" }).click();
  await waitForTurn(page);
  await expect(page.getByRole("button", { name: "Start answer" })).toBeDisabled();
});

test("reloading mid-interview resumes the same question", async ({ page }) => {
  await startInterview(page, "QA Engineer");
  await page.getByRole("button", { name: "Begin interview" }).click();
  await waitForTurn(page);
  await page.reload();
  await page.getByRole("button", { name: "Resume interview" }).click();
  await waitForTurn(page);
  await expect(page.getByTestId("question")).toContainText("part 1");
});

test("ending early scores only the questions reached", async ({ page }) => {
  await startInterview(page, "Product Manager");
  await page.getByRole("button", { name: "Begin interview" }).click();
  await waitForTurn(page);
  await page.getByRole("button", { name: "Type instead" }).click();
  await page.getByLabel("Your answer").fill("A typed answer about a hard problem.");
  await page.getByRole("button", { name: "Send answer" }).click();
  await waitForTurn(page);
  await page.getByRole("button", { name: "End early" }).click();
  await page.getByRole("button", { name: "End interview" }).click();
  await page.waitForURL(/\/report\//);
  await expect(page.getByText("Scored on the 1 of 3 questions you reached.")).toBeVisible();
  await expect(page.getByText("Not reached").first()).toBeVisible();
});

test("blocked devices still allow a typed interview", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("blocked", "NotAllowedError"));
  });
  await startInterview(page, "Data Scientist");
  await expect(page.getByText(/access is blocked/)).toBeVisible();
  await page.getByRole("button", { name: "Begin interview" }).click();
  await waitForTurn(page);
  await expect(page.getByRole("button", { name: "Start answer" })).toBeDisabled();
  await page.getByRole("button", { name: "Type instead" }).click();
  await page.getByLabel("Your answer").fill("Typing works.");
  await page.getByRole("button", { name: "Send answer" }).click();
  await waitForTurn(page);
});

test("a missing key points to Settings", async ({ page }) => {
  await page.route("**/api/plan", (route) =>
    route.fulfill({ status: 503, json: { code: "no_key", message: "No AI key is configured. Add a free Groq key in Settings." } }),
  );
  await page.goto("/setup");
  await page.getByLabel("Role you are applying for").fill("Designer");
  await page.getByRole("button", { name: "Start interview" }).click();
  await expect(page.locator(".notice[role=alert]")).toContainText("No AI key");
  await page.getByRole("link", { name: "Open Settings" }).click();
  await expect(page.getByLabel("Groq API key")).toBeVisible();
});

test("a failed interviewer reply can be retried or passed", async ({ page }) => {
  await page.route("**/api/turn", (route) => route.fulfill({ status: 502, json: { code: "upstream", message: "The AI service did not respond. Try again." } }));
  await startInterview(page, "Sales Representative");
  await page.getByRole("button", { name: "Begin interview" }).click();
  await waitForTurn(page);
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(page.locator(".notice[role=alert]")).toContainText("did not respond");
  await page.unroute("**/api/turn");
  await page.getByRole("button", { name: "Next question" }).click();
  await waitForTurn(page);
  await expect(page.getByTestId("question")).toContainText("reverses a string");
});

test("a visitor's key is sent as a header and data can be wiped", async ({ page }) => {
  await page.goto("/settings");
  await page.getByLabel("Groq API key").fill("gsk_visitor");
  const request = page.waitForRequest("**/api/plan");
  await page.goto("/setup");
  await page.getByLabel("Role you are applying for").fill("Finance Analyst");
  await page.getByRole("button", { name: "Start interview" }).click();
  expect((await request).headers()["x-groq-key"]).toBe("gsk_visitor");
  await page.waitForURL(/\/interview/);

  await page.goto("/settings");
  await page.getByRole("button", { name: "Delete all my data" }).click();
  await page.getByRole("button", { name: "Delete everything" }).click();
  await page.goto("/history");
  await expect(page.getByText("No interviews yet")).toBeVisible();
});

for (const path of ["/", "/setup", "/history", "/settings"]) {
  test(`${path} has no horizontal scroll on a phone`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("security headers are set", async ({ request }) => {
  const response = await request.get("/");
  const headers = response.headers();
  expect(headers["permissions-policy"]).toContain("microphone=(self)");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
});
