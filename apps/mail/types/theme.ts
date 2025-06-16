export interface Theme {
  id: string;
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
  fonts: {
    body: string;
    heading: string;
    mono: string;
  };
  spacing: {
    default: string;
    sm: string;
    md: string;
    lg: string;
  };
  radius: {
    default: string;
    sm: string;
    md: string;
    lg: string;
  };
  shadows: {
    default: string;
    sm: string;
    md: string;
    lg: string;
  };
  isPublic: boolean;
  isDefault: boolean;
}

export interface ServerTheme {
  id: string;
  userId?: string;
  name: string;
  colors: Theme["colors"];
  fonts: Theme["fonts"];
  spacing: {
    base: string;
    section: string;
    card: string;
    button: string;
  };
  radius: {
    base: string;
    button: string;
    card: string;
    input: string;
  };
  shadows: {
    base: string;
    card: string;
    button: string;
  };
  isPublic: boolean;
  isDefault: boolean;
  updatedAt?: Date;
}

export const defaultTheme: Theme = {
  id: "default",
  name: "Default Theme",
  colors: {
    primary: "#0091FF",
    primaryForeground: "#FFFFFF",
    background: "#FFFFFF",
    foreground: "#18181B",
    card: "#FFFFFF",
    cardForeground: "#18181B",
    popover: "#FFFFFF",
    popoverForeground: "#18181B",
    border: "#E4E4E7",
    input: "#E4E4E7",
    ring: "#0091FF",
  },
  fonts: {
    body: "Inter",
    heading: "Inter",
    mono: "JetBrains Mono",
  },
  spacing: {
    default: "1rem",
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
  },
  radius: {
    default: "0.5rem",
    sm: "0.25rem",
    md: "0.5rem",
    lg: "1rem",
  },
  shadows: {
    default: "0 1px 3px rgba(0,0,0,0.12)",
    sm: "0 1px 2px rgba(0,0,0,0.08)",
    md: "0 4px 6px rgba(0,0,0,0.12)",
    lg: "0 10px 15px rgba(0,0,0,0.12)",
  },
  isPublic: false,
  isDefault: true,
};