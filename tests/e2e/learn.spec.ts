import { expect, test } from "./silent";
import type { Page } from "./silent";

const RESUME = "Test Candidate. Backend engineer who shipped a billing service in TypeScript and PostgreSQL over three years of work on payments.";

async function buildCourse(page: Page) {
  await page.goto("/learn");
  await page.getByRole("button", { name: "Paste text instead" }).click();
  await page.getByLabel("Resume text").fill(RESUME);
  await page.getByRole("button", { name: "Use this text" }).click();
  await expect(page.getByTestId("profile")).toContainText("Test Candidate");
  await page.getByLabel("Target role").fill("Backend Engineer");
  await page.getByRole("button", { name: "Build my course" }).click();
  await page.waitForURL(/\/learn\/[\w-]+$/);
  await expect(page.getByRole("heading", { name: "Backend interview foundations" })).toBeVisible();
}

const chooseIn = (page: Page, skill: number, option: string) =>
  page.locator("fieldset").nth(skill).getByText(option, { exact: true }).click();

async function placeByQuiz(page: Page) {
  await chooseIn(page, 0, "The correct statement");
  await chooseIn(page, 1, "A wrong statement");
  await chooseIn(page, 2, "I don't know");
  await page.getByRole("button", { name: "See my path" }).click();
}

test("a course needs a resume or a topic", async ({ page }) => {
  await page.goto("/learn");
  await page.getByRole("button", { name: "Build my course" }).click();
  await expect(page.getByText("Add a resume or at least one topic.")).toBeVisible();
  await expect(page).toHaveURL(/\/learn$/);
});

test("topics alone build a course, and the audit is left out without a resume", async ({ page }) => {
  await page.goto("/learn");
  await page.getByLabel("Topics").fill("Database indexes");
  await page.getByRole("button", { name: "Build my course" }).click();
  await page.waitForURL(/\/learn\/[\w-]+$/);
  await page.getByRole("button", { name: "Skip this and start from the top" }).click();
  await expect(page.getByTestId("course-stats")).toHaveText("0 of 3 skills ready");
  await expect(page.getByRole("heading", { name: "Can you defend your resume?" })).toHaveCount(0);
});

test("the quiz places the learner and the audit quotes only the real resume", async ({ page }) => {
  await buildCourse(page);
  await expect(page.getByRole("button", { name: "3 left to answer" })).toBeDisabled();
  await page.setViewportSize({ width: 1100, height: 500 });
  await placeByQuiz(page);

  await expect(page.getByTestId("skill-s1")).toContainText("Quiz passed");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.getByTestId("skill-s2")).toContainText("Needs work");
  await expect(page.getByTestId("skill-s2")).toContainText("Builds on Database indexes");
  await expect(page.getByTestId("skill-s3")).toContainText("Needs work");
  await expect(page.getByRole("link", { name: "Continue: Idempotent billing" })).toBeVisible();

  await expect(page.getByTestId("claim-s1")).toContainText("Not checked yet");
  await expect(page.getByTestId("claim-s2")).toContainText("You could not back this up yet");
  // The scripted model claims Kafka, which this resume never mentions.
  await expect(page.getByTestId("claim-s3")).toHaveCount(0);
  await expect(page.getByText("Kafka")).toHaveCount(0);
});

test("a lesson is taught once, checked, retaught and survives a reload", async ({ page }) => {
  await buildCourse(page);
  await placeByQuiz(page);
  const lessonCalls: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/learn/lesson")) lessonCalls.push(request.url());
  });

  await page.getByRole("link", { name: "Continue: Idempotent billing" }).click();
  await expect(page.getByText("Idempotent billing, explained from the beginning.")).toBeVisible();
  await expect(page.getByText("The answer: The correct statement")).toBeVisible();
  await expect(page.getByRole("heading", { name: "In your own work" })).toBeVisible();

  const search = page.getByRole("link", { name: "Official documentation" });
  await expect(search).toHaveAttribute("href", /^https:\/\/www\.google\.com\/search\?q=/);

  await expect(page.getByRole("button", { name: "Check my explanation" })).toBeDisabled();
  const checks: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/learn/check")) checks.push(request.url());
  });
  await page.getByLabel(/Explain this to a teammate/).fill("First, what it is and the problem it solves. Then, how it works underneath.");
  await page.getByRole("button", { name: "Check my explanation" }).click();
  await expect(page.getByText("mostly the lesson's own wording")).toBeVisible();
  expect(checks).toEqual([]);

  await page.getByLabel(/Explain this to a teammate/).fill("It stops charges.");
  await expect(page.getByText("mostly the lesson's own wording")).toHaveCount(0);
  await page.getByRole("button", { name: "Check my explanation" }).click();
  await expect(page.getByTestId("check-result")).toContainText("Not there yet.");
  await expect(page.getByTestId("check-result")).toContainText("Why it matters");
  await expect(page.getByTestId("check-result")).toContainText("Another way to see it");

  await page.getByLabel(/Explain this to a teammate/).fill("It is safe to repeat because a key marks the charge as done.");
  await page.getByRole("button", { name: "Check again" }).click();
  await expect(page.getByTestId("check-result")).toContainText("You have got this one.");
  await expect(page.getByRole("link", { name: "Next: Message queues" })).toBeVisible();

  await page.reload();
  await expect(page.getByText("Idempotent billing, explained from the beginning.")).toBeVisible();
  expect(lessonCalls).toHaveLength(1);

  await page.getByRole("link", { name: "Backend interview foundations" }).click();
  await expect(page.getByTestId("course-stats")).toHaveText("1 of 3 skills ready");
  await expect(page.getByTestId("claim-s2")).toContainText("You can defend this");
});

test("a failed lesson request can be retried", async ({ page }) => {
  await buildCourse(page);
  await page.getByRole("button", { name: "Skip this and start from the top" }).click();
  await page.route("**/api/learn/lesson", (route) => route.fulfill({ status: 502, json: { code: "upstream", message: "The AI service did not respond. Try again." } }));
  await page.getByRole("link", { name: "Continue: Database indexes" }).click();
  await expect(page.locator(".notice[role=alert]")).toContainText("did not respond");
  await page.unroute("**/api/learn/lesson");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("Database indexes, explained from the beginning.")).toBeVisible();
});

test("a busy AI service is retried without the learner doing anything", async ({ page }) => {
  await buildCourse(page);
  await page.getByRole("button", { name: "Skip this and start from the top" }).click();
  let calls = 0;
  await page.route("**/api/learn/lesson", (route) => {
    calls += 1;
    return calls === 1
      ? route.fulfill({ status: 429, json: { code: "rate_limited", message: "The AI service hit its rate limit.", retryAfterSec: 1 } })
      : route.continue();
  });
  await page.getByRole("link", { name: "Continue: Database indexes" }).click();
  await expect(page.getByText("explained from the beginning.")).toBeVisible({ timeout: 10_000 });
  expect(calls).toBe(2);
});

test("the site's hourly limit is shown, not waited out", async ({ page }) => {
  await buildCourse(page);
  await page.getByRole("button", { name: "Skip this and start from the top" }).click();
  await page.route("**/api/learn/lesson", (route) =>
    route.fulfill({ status: 429, json: { code: "rate_limited", message: "You have reached the hourly practice limit on this site.", retryAfterSec: 1800 } }),
  );
  await page.getByRole("link", { name: "Continue: Database indexes" }).click();
  await expect(page.locator(".notice[role=alert]")).toContainText("hourly practice limit");
});

test("an unchecked lesson says so and can be checked again", async ({ page }) => {
  await buildCourse(page);
  await page.getByRole("button", { name: "Skip this and start from the top" }).click();
  await page.route("**/api/learn/lesson", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...(await response.json()), reviewed: false } });
  });
  await page.getByRole("link", { name: "Continue: Database indexes" }).click();
  await expect(page.getByTestId("unchecked")).toBeVisible();
  await page.unroute("**/api/learn/lesson");
  await page.getByRole("button", { name: "Check it now" }).click();
  await expect(page.getByTestId("unchecked")).toHaveCount(0);
  await expect(page.getByText("without official documentation")).toBeVisible();
});

test("a weak interview answer sends its skill back to the course", async ({ page }) => {
  await buildCourse(page);
  await page.getByRole("button", { name: "Skip this and start from the top" }).click();
  await page.getByRole("link", { name: "Test it in an interview" }).click();
  await page.waitForURL(/\/setup\?course=/);
  await expect(page.getByTestId("focus")).toContainText("Database indexes");
  await expect(page.getByTestId("profile")).toContainText("Test Candidate");
  await expect(page.getByLabel("Role you are applying for")).toHaveValue("Backend Engineer");

  await page.getByText("3", { exact: true }).click();
  const planning = page.waitForRequest("**/api/plan");
  await page.getByRole("button", { name: "Start interview" }).click();
  expect((await planning).postDataJSON().focus).toHaveLength(3);
  await page.waitForURL(/\/interview\?id=/);

  await page.getByRole("button", { name: "Begin interview" }).click();
  await expect(page.getByTestId("room-state")).toHaveText("Your turn", { timeout: 15_000 });
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(page.getByTestId("room-state")).toHaveText("Your turn", { timeout: 15_000 });
  await page.getByRole("button", { name: "End early" }).click();
  await page.getByRole("button", { name: "End interview" }).click();
  await page.waitForURL(/\/report\//);

  await expect(page.getByTestId("reopened")).toContainText("Database indexes", { timeout: 15_000 });
  await page.getByRole("link", { name: "Open your course" }).click();
  await expect(page.getByTestId("skill-s1")).toContainText("Needs work");
  await expect(page.getByRole("link", { name: "Continue: Database indexes" })).toBeVisible();
});

test("an interview without a course shows no course section", async ({ page }) => {
  await page.goto("/setup");
  await expect(page.getByTestId("focus")).toHaveCount(0);
});

test("a missing course says so", async ({ page }) => {
  await page.goto("/learn/nothing-here");
  await expect(page.getByText("This course was not found")).toBeVisible();
  await page.goto("/learn/nothing-here/s1");
  await expect(page.getByText("This lesson was not found")).toBeVisible();
});

test("a course can be deleted and is removed by the data wipe", async ({ page }) => {
  await buildCourse(page);
  await page.goto("/learn");
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Keep" }).click();
  await expect(page.getByRole("link", { name: "Backend interview foundations" })).toBeVisible();
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("heading", { name: "Your courses" })).toHaveCount(0);

  await buildCourse(page);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Delete all my data" }).click();
  await page.getByRole("button", { name: "Delete everything" }).click();
  await expect(page.getByText("All interviews, recordings and courses were deleted.")).toBeVisible();
  await page.goto("/learn");
  await expect(page.getByRole("heading", { name: "Your courses" })).toHaveCount(0);
});

test("the course and lesson pages have no horizontal scroll on a phone", async ({ page }) => {
  await buildCourse(page);
  await page.getByRole("button", { name: "Skip this and start from the top" }).click();
  await page.setViewportSize({ width: 360, height: 740 });
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(await overflow()).toBeLessThanOrEqual(0);
  await page.getByRole("link", { name: "Continue: Database indexes" }).click();
  await expect(page.getByText("explained from the beginning.")).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
});
