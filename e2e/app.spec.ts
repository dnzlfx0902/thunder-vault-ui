import { expect, test } from "@playwright/test";

async function openApp(page: import("@playwright/test").Page) { await page.goto("/"); await page.getByLabel("Password").fill("test"); await page.getByRole("button", { name: "Open Second Brain" }).click(); await expect(page.getByRole("region", { name: "Shared workspace" })).toBeVisible(); }

test.beforeEach(async ({ page }) => { await openApp(page); });

function openContextChat(page: import("@playwright/test").Page, testInfo: import("@playwright/test").TestInfo) {
  if (testInfo.project.name === "mobile") return page.getByRole("button", { name: /Open Second Brain for/ });
  return page.getByTestId("open-context-chat");
}

test("switches the shared center between chat and note modes", async ({ page }, testInfo) => {
  if (testInfo.project.name === "mobile") await page.getByRole("button", { name: "Open vault" }).click();
  await page.getByLabel("Vault files").getByRole("button", { name: "Welcome.md" }).click();
  await expect(page.getByRole("heading", { name: "Welcome.md" })).toBeVisible();
  await openContextChat(page, testInfo).click();
  await expect(page.getByTestId("context-panel")).toBeVisible();
  await page.getByRole("button", { name: "Close chat" }).click();
  await expect(page.getByRole("heading", { name: "Welcome.md" })).toBeVisible();
  await page.getByLabel("Recent chats").getByRole("button").first().click();
  await expect(page.getByRole("textbox", { name: "Message Second Brain", exact: true })).toBeVisible();
});

test("keeps note tools and contextual history separate", async ({ page }, testInfo) => {
  if (testInfo.project.name === "mobile") await page.getByRole("button", { name: "Open vault" }).click();
  await page.getByLabel("Vault files").getByRole("button", { name: "Welcome.md" }).click();
  await page.getByRole("button", { name: "Links" }).click();
  await expect(page.getByRole("button", { name: "Linked.md" }).last()).toBeVisible();
  await openContextChat(page, testInfo).click();
  await expect(page.getByTestId("context-panel")).toBeVisible();
  await page.getByLabel("Ask about this note").fill("Summarize this note");
  await page.getByRole("button", { name: /Ask (Thunder|Rain) about note/ }).click();
  await expect(page.getByText(/Note answer/)).toBeVisible();
});

test("shows a sent message immediately while Thunder is still thinking", async ({ page }) => {
  const input = page.getByRole("textbox", { name: "Message Second Brain", exact: true });
  await input.fill("slow optimistic message");
  await page.getByRole("button", { name: /Send (message|quick message)/ }).click();
  await expect(page.getByRole("status")).toContainText("está pensando");
  await expect(page.getByRole("article").filter({ hasText: "slow optimistic message" }).first()).toBeVisible({ timeout: 500 });
  await expect(page.getByRole("button", { name: /Send (message|quick message)/ })).toBeEnabled({ timeout: 10_000 });
});

test("keeps tabs and composer fixed while only the conversation scrolls", async ({ page }) => {
  const input = page.getByRole("textbox", { name: "Message Second Brain", exact: true });
  const send = page.getByRole("button", { name: /Send (message|quick message)/ });
  for (let i = 0; i < 10; i++) {
    await input.fill(`Long chat message ${i} `.repeat(20));
    await send.click();
    await expect(send).toBeEnabled();
    const cancel = page.getByRole("button", { name: "Cancel" });
    if (await cancel.isVisible()) await cancel.click();
  }
  const layout = await page.evaluate(() => {
    const tabs = document.querySelector(".chat-tabs")!.getBoundingClientRect();
    const conversation = document.querySelector(".conversation")! as HTMLElement;
    const composer = document.querySelector(".composer")!.getBoundingClientRect();
    conversation.scrollTop = 200;
    return { tabsTop: tabs.top, composerBottom: composer.bottom, viewport: innerHeight, pageScroll: scrollY, conversationScroll: conversation.scrollTop, scrollable: conversation.scrollHeight > conversation.clientHeight };
  });
  expect(layout.tabsTop).toBeGreaterThanOrEqual(0);
  expect(layout.composerBottom).toBeLessThanOrEqual(layout.viewport);
  expect(layout.pageScroll).toBe(0);
  expect(layout.conversationScroll).toBeGreaterThan(0);
  expect(layout.scrollable).toBe(true);
});

test("imports into note mode and sends attachment from main chat", async ({ page }) => {
  await page.getByLabel("Attach document").setInputFiles({ name: "Report.html", mimeType: "text/html", buffer: Buffer.from("<h1>Imported report</h1>") });
  await expect(page.getByRole("heading", { name: "Report.md" })).toBeVisible();
  await page.getByLabel("Recent chats").getByRole("button").first().click();
  await expect(page.getByRole("button", { name: /Report\.md Open converted note/i })).toBeVisible();
  await page.getByRole("textbox", { name: "Message Second Brain", exact: true }).fill("Summarize attachment");
  const request = page.waitForRequest(r => r.url().endsWith("/api/chat") && r.method() === "POST");
  await page.getByRole("button", { name: /Send (message|quick message)/ }).click();
  expect((await request).postDataJSON().docPath).toBe("00 Inbox/report.md");
});
