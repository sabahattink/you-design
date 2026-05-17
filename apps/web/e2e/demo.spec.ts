import { test, expect } from '@playwright/test';

function sseEvents(events: Array<{ event: string; data: unknown }>): string {
  return (
    events.map((e) => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`).join('') +
    'event: finish\ndata: {"finishReason":"stop"}\n\n'
  );
}

test('intent quiz with domain -> approve -> mocked designer writes -> critic finds an issue -> Fix', async ({
  page,
}) => {
  let intentTurn = 0;
  let designerTurn = 0;
  let criticTurn = 0;

  await page.route('**/api/v1/llm/stream', async (route) => {
    const body = route.request().postDataJSON() as { system: string };
    const sys = body.system;

    let payload: string;
    if (sys.includes('Intent Agent')) {
      intentTurn += 1;
      if (intentTurn < 5) {
        payload = sseEvents([
          {
            event: 'text-delta',
            data: { type: 'text-delta', text: 'Next question please.' },
          },
        ]);
      } else {
        payload = sseEvents([
          {
            event: 'tool-call',
            data: {
              type: 'tool-call',
              toolCallId: 'tc1',
              toolName: 'summarize_contract',
              input: {
                persona: 'indie SaaS founder',
                primaryAction: 'start free trial',
                emotion: 'confident, minimal',
                successMetric: 'trial CVR > 5%',
                domain: 'saas-landing',
              },
            },
          },
        ]);
      }
    } else if (sys.includes('Designer Agent')) {
      designerTurn += 1;
      payload = sseEvents([
        {
          event: 'tool-call',
          data: {
            type: 'tool-call',
            toolCallId: `dc${designerTurn}`,
            toolName: 'write_page',
            input: {
              path: '/',
              title: 'Home',
              html: `<html><head></head><body><h1 class="text-3xl p-8">${
                designerTurn === 1 ? 'Welcome!' : 'Ship faster.'
              }</h1></body></html>`,
            },
          },
        },
      ]);
    } else if (sys.includes('Honest Critic')) {
      criticTurn += 1;
      payload = sseEvents([
        {
          event: 'tool-call',
          data: {
            type: 'tool-call',
            toolCallId: `cc${criticTurn}`,
            toolName: 'report_issues',
            input: {
              issues:
                criticTurn === 1
                  ? [
                      {
                        severity: 'warning',
                        category: 'copy',
                        message: 'Hero says "Welcome!" — drifts from confident/minimal emotion.',
                        suggestion: 'Replace with an outcome-focused headline.',
                      },
                    ]
                  : [],
            },
          },
        },
      ]);
    } else {
      payload = sseEvents([]);
    }

    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: payload,
    });
  });

  await page.goto('/app');
  await expect(page.getByText('Quick — who is this for?')).toBeVisible();

  for (let i = 0; i < 5; i += 1) {
    await page
      .getByRole('textbox')
      .first()
      .fill(`answer ${i + 1}`);
    await page.getByRole('button', { name: 'Send' }).click();
    if (i < 4) {
      await expect(page.getByText('Next question please.').first()).toBeVisible({
        timeout: 10_000,
      });
    }
  }

  await expect(page.getByText('Intent Contract')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Approve & build' }).click();

  const iframe = page.frameLocator('iframe[title="Preview"]');
  await expect(iframe.getByText('Welcome!')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('drifts from confident/minimal emotion.')).toBeVisible({
    timeout: 15_000,
  });

  await page
    .getByRole('button', { name: /Critic/i })
    .first()
    .click();
  await page.getByRole('button', { name: 'Fix' }).first().click();

  await expect(iframe.getByText('Ship faster.')).toBeVisible({ timeout: 15_000 });
});
