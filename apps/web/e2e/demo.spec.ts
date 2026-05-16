import { test, expect } from '@playwright/test';

function sseEvents(events: Array<{ event: string; data: unknown }>): string {
  return events
    .map((e) => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`)
    .join('');
}

test('intent quiz -> approve -> mocked designer writes homepage -> click element', async ({
  page,
}) => {
  let intentTurn = 0;

  await page.route('**/api/v1/llm/stream', async (route) => {
    const body = route.request().postDataJSON() as {
      system: string;
      messages: Array<unknown>;
    };
    const isIntent = body.system.includes('Intent Agent');

    let payload: string;
    if (isIntent) {
      intentTurn += 1;
      if (intentTurn < 2) {
        payload = sseEvents([
          {
            event: 'final',
            data: {
              content: [{ type: 'text', text: 'And what action should they take?' }],
            },
          },
        ]);
      } else {
        payload = sseEvents([
          {
            event: 'final',
            data: {
              content: [
                {
                  type: 'tool_use',
                  name: 'summarize_contract',
                  input: {
                    persona: 'indie dev shipping a SaaS',
                    primaryAction: 'start free trial',
                    emotion: 'confident, minimal',
                    successMetric: 'trial CVR > 5%',
                    domain: 'general',
                  },
                },
              ],
            },
          },
        ]);
      }
    } else {
      // designer agent first turn
      payload = sseEvents([
        {
          event: 'final',
          data: {
            content: [
              {
                type: 'tool_use',
                name: 'write_page',
                input: {
                  path: '/',
                  title: 'Home',
                  html: '<html><head></head><body><h1 class="text-3xl p-8">Hello World</h1></body></html>',
                },
              },
            ],
          },
        },
      ]);
    }

    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: payload,
    });
  });

  await page.goto('/app');

  // Initial prompt visible
  await expect(page.getByText('Quick — who is this for?')).toBeVisible();

  // First answer
  await page.getByRole('textbox').first().fill('indie devs building SaaS');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('And what action should they take?')).toBeVisible({
    timeout: 10_000,
  });

  // Second answer triggers summarize_contract
  await page.getByRole('textbox').first().fill('start free trial');
  await page.getByRole('button', { name: 'Send' }).click();

  // Contract card appears
  await expect(page.getByText('Intent Contract')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Approve & build' }).click();

  // Designer auto-triggers, iframe should render Hello World
  const iframe = page.frameLocator('iframe[title="Preview"]');
  await expect(iframe.getByText('Hello World')).toBeVisible({ timeout: 15_000 });

  // Page list shows /
  await expect(page.locator('aside[data-testid="sidebar"]').getByText('/')).toBeVisible();
});
