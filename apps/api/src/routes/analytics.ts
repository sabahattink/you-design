import type { FastifyInstance } from 'fastify';

interface PostHogTrend {
  count: number;
  action?: { name: string };
}

export async function analyticsRoutes(app: FastifyInstance) {
  app.get('/analytics/summary', async (req, reply) => {
    const q = req.query as {
      postHogApiKey?: string;
      postHogProjectId?: string;
      postHogHost?: string;
      days?: string;
    };

    if (!q.postHogApiKey || !q.postHogProjectId) {
      reply.code(400);
      return {
        error: 'MISSING_PARAMS',
        message: 'postHogApiKey and postHogProjectId are required',
      };
    }

    const host = q.postHogHost ?? 'https://app.posthog.com';
    const days = Math.min(parseInt(q.days ?? '7', 10), 90);
    const period = `Last ${days} days`;

    try {
      const res = await fetch(`${host}/api/projects/${q.postHogProjectId}/insights/trend/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${q.postHogApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          events: [{ id: '$pageview', name: '$pageview', type: 'events' }],
          breakdown: '$current_url',
          breakdown_type: 'event',
          date_from: `-${days}d`,
          display: 'ActionsTable',
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        reply.code(502);
        return {
          error: 'POSTHOG_ERROR',
          message: `PostHog API returned ${res.status}: ${text.slice(0, 200)}`,
        };
      }

      const data = (await res.json()) as { result: PostHogTrend[] };
      const results = data.result ?? [];

      const pages = results.map((r) => {
        const url = r.action?.name ?? '';
        let path = url;
        try {
          path = new URL(url).pathname;
        } catch {
          path = url.startsWith('/') ? url : `/${url}`;
        }
        return { path, views: r.count ?? 0, clicks: 0, ctr: 0 };
      });

      const totalViews = pages.reduce((sum, p) => sum + p.views, 0);
      return { pages, totalViews, period };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      reply.code(502);
      return { error: 'POSTHOG_FETCH_FAILED', message };
    }
  });
}
