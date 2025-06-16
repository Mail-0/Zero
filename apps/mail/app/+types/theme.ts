export interface Theme {
  id: string;
  userId?: string;
  name: string;
  colors: {
    primary: string;
    primaryForeground: string;
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    popover: string;
    popoverForeground: string;
    border: string;
    input: string;
    ring: string;
    success?: string;
    warning?: string;
    error?: string;
  };
  fonts?: {
    body: string;
    heading: string;
    mono: string;
  };
  isPublic?: boolean;
  isDefault?: boolean;
}