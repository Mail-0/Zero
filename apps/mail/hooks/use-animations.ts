import { useSettings } from './use-settings';

export function useAnimations() {
  const { data } = useSettings();
  
  return data?.settings?.animations ?? false;
}