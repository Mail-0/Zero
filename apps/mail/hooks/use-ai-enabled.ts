import { useSettings } from './use-settings';

/**
 * Whether AI features should be shown. False until settings load, so users who
 * turned AI off never see AI UI flash in (or open the chat socket).
 */
export function useAiEnabled() {
  const { data } = useSettings();
  return !!data && !data.settings.ai?.disabled;
}

/**
 * True only once settings have loaded and the user has turned AI off. Use this
 * (not `!useAiEnabled()`) for side effects like clearing persisted chat state,
 * which must not fire while settings are still loading.
 */
export function useAiDisabled() {
  const { data } = useSettings();
  return !!data && !!data.settings.ai?.disabled;
}
