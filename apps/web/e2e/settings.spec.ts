import { test, expect, type Page } from '@playwright/test';

// Same isolation as demo.spec.ts: nothing reaches a real LLM or API.
async function mockBackend(page: Page): Promise<void> {
  await page.route('**/api/v1/llm/stream', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: 'event: finish\ndata: {"finishReason":"stop"}\n\n',
    });
  });
  await page.route('**/api/v1/projects', async (route) => {
    await route.fulfill({ status: 200, json: { projects: [] } });
  });
}

async function openWorkspace(page: Page): Promise<void> {
  await page.goto('/app');
  // First-run project picker (no project in localStorage yet).
  await page.getByRole('button', { name: 'Continue without saving' }).click();
}

test('settings: open from gear, switch sections, close with Escape', async ({ page }) => {
  await mockBackend(page);
  await openWorkspace(page);

  const gear = page.getByRole('button', { name: 'Settings', exact: true });
  await gear.click();

  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog).toBeVisible();

  const providersTab = dialog.getByRole('tab', { name: /LLM providers/ });
  const analyticsTab = dialog.getByRole('tab', { name: /Analytics/ });
  await expect(providersTab).toHaveAttribute('aria-selected', 'true');
  await expect(providersTab).toBeFocused();
  await expect(dialog.getByRole('tabpanel')).toContainText('Configured models');

  // Mouse switch.
  await analyticsTab.click();
  await expect(analyticsTab).toHaveAttribute('aria-selected', 'true');
  await expect(dialog.getByRole('tabpanel', { name: /Analytics/ })).toContainText(
    'Analytics (PostHog)',
  );

  // Keyboard switch (roving tabindex).
  await page.keyboard.press('ArrowUp');
  await expect(providersTab).toBeFocused();
  await expect(providersTab).toHaveAttribute('aria-selected', 'true');

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(gear).toBeFocused();
});

test('settings: fits a phone-sized viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await mockBackend(page);
  await openWorkspace(page);

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog).toBeVisible();

  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
    expect(box.y + box.height).toBeLessThanOrEqual(667);
  }
  await expect(dialog.getByRole('button', { name: 'Close settings' })).toBeInViewport();
});
