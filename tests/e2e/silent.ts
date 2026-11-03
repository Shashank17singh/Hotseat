import { test as base } from "@playwright/test";

export { expect } from "@playwright/test";
export type { Page } from "@playwright/test";

// Speech goes through the operating system's voice, which --mute-audio does not reliably reach and which
// headless Chromium still plays out loud. Tests that check speech install their own stub on top of this one.
export const test = base.extend({
  page: async ({ page }, run) => {
    await page.addInitScript(() => {
      window.speechSynthesis.speak = (utterance) => {
        setTimeout(() => utterance.onend?.(new Event("end") as SpeechSynthesisEvent), 0);
      };
    });
    await run(page);
  },
});
