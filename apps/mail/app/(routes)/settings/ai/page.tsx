import { AssistantChannels } from '@/components/ai-settings/assistant-channels';
import { AiSettingsPanel } from '@/components/ai-settings/ai-settings-panel';
import { SettingsCard } from '@/components/settings/settings-card';
import { m } from '@/paraglide/messages';

export default function AiSettingsPage() {
  return (
    <SettingsCard
      title={m['pages.settings.ai.title']()}
      description={m['pages.settings.ai.description']()}
    >
      <AiSettingsPanel />
      <AssistantChannels />
    </SettingsCard>
  );
}
