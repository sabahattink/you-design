import Link from 'next/link';
import { ProviderConfig } from '@/components/setup/ProviderConfig';
import { AnalyticsConfig } from '@/components/setup/AnalyticsConfig';

export const metadata = {
  title: 'Setup',
};

export default function SetupPage() {
  return (
    <main className="min-h-screen px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Setup</h1>
        <p className="text-[color:var(--color-muted)] mb-2">
          Add the LLM providers and models you want to use. Local-first, BYOK — your keys never
          leave this browser and the API server you run.
        </p>
        <p className="text-sm text-[color:var(--color-muted)] mb-8">
          You can also reach these settings from the ⚙ button in the workspace header.{' '}
          <Link href="/app" className="underline">
            Go to workspace →
          </Link>
        </p>
        <ProviderConfig />
        <AnalyticsConfig />
      </div>
    </main>
  );
}
