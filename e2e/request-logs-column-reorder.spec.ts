import { expect, test, type Page } from "@playwright/test";

const setAuthed = async (page: Page) => {
  await page.addInitScript(() => {
    localStorage.removeItem("codeProxy.dataTable.columnOrder.v1.request-logs");
    localStorage.setItem(
      "code-proxy-admin-auth",
      JSON.stringify({
        apiBase: "http://127.0.0.1:8317",
        managementKey: "test-management-key",
        rememberPassword: true,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      }),
    );
  });
};

const mockRequestLogsApis = async (page: Page) => {
  await page.route("**/v0/management/**", async (route) => {
    const url = route.request().url();

    if (url.includes("/v0/management/usage/logs?")) {
      const items = Array.from({ length: 12 }, (_, index) => ({
        id: 2000 + index,
        timestamp: `2026-06-14T08:${String(index).padStart(2, "0")}:00Z`,
        api_key: `sk-test-${String(index).padStart(4, "0")}`,
        api_key_name: `QA Key ${index + 1}`,
        model: index % 2 ? "claude-sonnet-4" : "gpt-4.1",
        source: "openai",
        channel_name: index % 2 ? "Anthropic" : "OpenAI",
        auth_index: `auth-${index + 1}`,
        failed: index === 4,
        latency_ms: 850 + index * 120,
        first_token_ms: 90 + index * 8,
        input_tokens: 120 + index,
        output_tokens: 240 + index * 3,
        reasoning_tokens: 0,
        cached_tokens: index % 3 === 0 ? 40 : 0,
        total_tokens: 360 + index * 4,
        cost: 0.0123 + index * 0.001,
        has_content: true,
      }));

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items,
          total: items.length,
          page: 1,
          size: 50,
          filters: {
            api_keys: items.map((item) => item.api_key),
            api_key_names: Object.fromEntries(
              items.map((item) => [item.api_key, item.api_key_name]),
            ),
            models: ["gpt-4.1", "claude-sonnet-4"],
            channels: ["OpenAI", "Anthropic"],
          },
          stats: {
            total: items.length,
            success_rate: 91.7,
            total_tokens: 4560,
            total_cost: 0.42,
            cache_rate: 18.5,
          },
        }),
      });
      return;
    }

    if (url.endsWith("/v0/management/config")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
};

const readTableState = async (page: Page) =>
  page.evaluate(() => {
    const scroller = document.querySelector(".table-scrollbar");
    return {
      order: [...document.querySelectorAll("th[data-vt-column-key]")].map((th) =>
        th.getAttribute("data-vt-column-key"),
      ),
      scrollLeft: scroller?.scrollLeft ?? 0,
      scrollWidth: scroller?.scrollWidth ?? 0,
      clientWidth: scroller?.clientWidth ?? 0,
      draggingCells: document.querySelectorAll("[data-vt-column-dragging-cell]").length,
      shiftedCells: document.querySelectorAll("[data-vt-column-shifted-cell]").length,
      storedOrder: localStorage.getItem("codeProxy.dataTable.columnOrder.v1.request-logs"),
    };
  });

test("Request Logs: column reorder follows the pointer and auto-scrolls horizontally", async ({
  page,
}) => {
  await setAuthed(page);
  await mockRequestLogsApis(page);

  await page.goto("/manage/#/monitor/request-logs");
  await page.locator('th[data-vt-column-key="timestamp"]').waitFor({ state: "visible" });

  const before = await readTableState(page);
  expect(before.scrollWidth).toBeGreaterThan(before.clientWidth);

  const dragStart = await page
    .locator('th[data-vt-column-key="timestamp"] [data-vt-column-reorder-handle]')
    .evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });
  const scrollerRect = await page.locator(".table-scrollbar").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { right: rect.right };
  });

  await page.mouse.move(dragStart.x, dragStart.y);
  await page.mouse.down();
  await page.waitForTimeout(230);
  await page.mouse.move(scrollerRect.right - 10, dragStart.y, { steps: 12 });
  await page.waitForTimeout(520);

  const during = await readTableState(page);
  expect(during.draggingCells).toBeGreaterThan(0);
  expect(during.shiftedCells).toBeGreaterThan(0);
  expect(during.scrollLeft).toBeGreaterThan(before.scrollLeft);

  await page.mouse.up();

  await expect
    .poll(async () => {
      const state = await readTableState(page);
      return state.order.at(-1);
    })
    .toBe("timestamp");

  const after = await readTableState(page);
  expect(after.draggingCells).toBe(0);
  expect(after.shiftedCells).toBe(0);
  expect(after.storedOrder).toContain('"timestamp"');
});
