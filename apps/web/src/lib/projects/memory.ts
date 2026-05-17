import { storeMemory } from './api';
import type { IntentContract } from '@you-design/shared';
import { parse } from 'parse5';

function extractTopTags(html: string): string {
  try {
    const doc = parse(html);
    const tags: string[] = [];
    function walk(node: unknown) {
      const n = node as { nodeName?: string; childNodes?: unknown[] };
      if (
        n.nodeName &&
        !['#document', '#text', 'html', 'head', 'body', '#comment'].includes(n.nodeName)
      ) {
        tags.push(n.nodeName);
      }
      if (n.childNodes && tags.length < 8) n.childNodes.forEach(walk);
    }
    walk(doc);
    return [...new Set(tags)].slice(0, 8).join(', ');
  } catch {
    return '';
  }
}

export async function storeBuildMemory(
  projectId: string,
  contract: IntentContract,
  pagePath: string,
  html: string,
  openAiKey?: string,
): Promise<void> {
  const topTags = extractTopTags(html);
  const persona = typeof contract.persona === 'string' ? contract.persona : contract.persona.role;
  const summary =
    `Page "${pagePath}": ${contract.domain} design for ${persona}. ` +
    `Goal: ${contract.primaryAction}. Emotion: ${contract.emotion}. ` +
    (topTags ? `Key elements: ${topTags}.` : '');

  await storeMemory(projectId, summary, openAiKey);
}
