export const getBrowserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export const isValidTimezone = (timezone: string) => {
  try {
    return Intl.supportedValuesOf('timeZone').includes(timezone);
  } catch (error) {
    return false;
  }
};