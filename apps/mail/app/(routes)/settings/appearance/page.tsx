import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingsCard } from "@/components/settings/settings-card";
import { zodResolver } from "@hookform/resolvers/zod";
import type { MessageKey } from "@/config/navigation";
import { useTRPC } from "@/providers/query-provider";
import { useSettings } from "@/hooks/use-settings";
import { Laptop, Moon, Sun } from "lucide-react";
import { ThemeEditor } from "@/components/theme/theme-editor";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PlusIcon, Trash2 } from "lucide-react"; // Added Trash2 icon for delete button
import { useTranslations } from "use-intl";
import { useForm } from "react-hook-form";
import { useTheme } from "next-themes";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import * as z from "zod";

import { trpcClient } from "@/providers/query-provider";
import { useQueryClient } from "@tanstack/react-query";
import type { Theme, ServerTheme } from "@/types/theme";
import { defaultTheme } from "@/types/theme";

type ThemePreference = "dark" | "light" | "system" | "custom";

interface Settings {
  colorTheme: ThemePreference;
  language: string;
  timezone: string;
  customPrompt: string;
  zeroSignature: boolean;
  externalImages: boolean;
  dynamicContent?: boolean;
  trustedSenders?: string[];
  isOnboarded?: boolean;
  primaryColor?: string;
  bodyFont?: string;
  headingFont?: string;
}

type SaveSettingsMutationInput = {
  colorTheme?: "dark" | "light" | "system";
  language?: string;
  timezone?: string;
  customPrompt?: string;
  zeroSignature?: boolean;
  externalImages?: boolean;
  dynamicContent?: boolean;
  trustedSenders?: string[];
  isOnboarded?: boolean;
  primaryColor?: string;
  bodyFont?: string;
  headingFont?: string;
};

const formSchema = z.object({
  colorTheme: z.enum(["dark", "light", "system", "custom"]),
});

export default function AppearancePage() {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const t = useTranslations();
  const { data, refetch } = useSettings();
  const { theme, systemTheme, resolvedTheme, setTheme } = useTheme();
  const trpc = useTRPC();

  const { mutateAsync: saveUserSettings } = useMutation({
    mutationFn: (settings: SaveSettingsMutationInput) =>
      trpcClient.settings.save.mutate(settings),
  });

  const { data: serverThemes, refetch: refetchThemes } = useQuery<ServerTheme[]>({
    queryKey: ["themes"],
    queryFn: async () => {
      const themes = await trpcClient.theme.getThemes.query({ publicOnly: false });
      return themes;
    },
    refetchOnWindowFocus: false,
    staleTime: 0,
    gcTime: 0,
  });

  // Local state to track updated themes
  const [localThemes, setLocalThemes] = useState<Theme[]>([]);

  // Initialize localThemes when serverThemes changes
  useEffect(() => {
    if (serverThemes) {
      const themes = serverThemes.map((serverTheme: ServerTheme): Theme => ({
        id: serverTheme.id,
        name: serverTheme.name,
        colors: {
          primary: serverTheme.colors.primary,
          primaryForeground: serverTheme.colors.primaryForeground,
          background: serverTheme.colors.background,
          foreground: serverTheme.colors.foreground,
          card: serverTheme.colors.card,
          cardForeground: serverTheme.colors.cardForeground,
          popover: serverTheme.colors.popover,
          popoverForeground: serverTheme.colors.popoverForeground,
          border: serverTheme.colors.border,
          input: serverTheme.colors.input,
          ring: serverTheme.colors.ring,
          success: serverTheme.colors.success,
          warning: serverTheme.colors.warning,
          error: serverTheme.colors.error,
        },
        fonts: {
          body: serverTheme.fonts.body,
          heading: serverTheme.fonts.heading,
          mono: serverTheme.fonts.mono,
        },
        spacing: {
          default: serverTheme.spacing.base,
          sm: serverTheme.spacing.section,
          md: serverTheme.spacing.card,
          lg: serverTheme.spacing.button,
        },
        radius: {
          default: serverTheme.radius.base,
          sm: serverTheme.radius.button,
          md: serverTheme.radius.card,
          lg: serverTheme.radius.input,
        },
        shadows: {
          default: serverTheme.shadows.base,
          sm: serverTheme.shadows.card,
          md: serverTheme.shadows.button,
          lg: serverTheme.shadows.base,
        },
        isPublic: serverTheme.isPublic,
        isDefault: serverTheme.isDefault,
      }));
      setLocalThemes(themes);
      console.log("Initialized Local Themes:", themes);
    }
  }, [serverThemes]);

  const userThemes = useMemo(() => {
    return localThemes;
  }, [localThemes]);

  const selectedTheme = userThemes?.length > 0 ? userThemes[0] : null;
  const primaryColor = selectedTheme?.colors.primary || (data?.settings as Settings)?.primaryColor || "purple";
  console.log("Primary Color Fetched:", primaryColor);

  const form = useForm<z.infer<typeof formSchema>>({  
    resolver: zodResolver(formSchema),
    defaultValues: {
      colorTheme: primaryColor && primaryColor !== "purple" ? "custom" : ((data?.settings?.colorTheme || theme || "system") as ThemePreference),
    },
  });

  useEffect(() => {
    if (selectedTheme?.colors.primary && selectedTheme.colors.primary !== primaryColor) {
      console.log("Selected theme primary color changed:", selectedTheme.colors.primary);
    }
  }, [selectedTheme, form, primaryColor]);

  useEffect(() => {
    const currentTheme = form.getValues("colorTheme");
    console.log("Current Selected Theme:", currentTheme);

    if (currentTheme === "custom" && primaryColor && selectedTheme) {
      console.log("Applying Custom Theme with Primary Color:", primaryColor);
      // Removed secondary color application
      
      document.documentElement.style.setProperty("--primary-color", primaryColor, "important");
      document.documentElement.style.setProperty("background-color", primaryColor, "important");
      document.documentElement.style.setProperty("--background", primaryColor, "important");
      document.body.style.backgroundColor = primaryColor;

      const bodyFont = selectedTheme.fonts.body || (data?.settings as Settings)?.bodyFont || "Inter";
      const headingFont = selectedTheme.fonts.heading || (data?.settings as Settings)?.headingFont || "Inter";
      const baseSpacing = selectedTheme.spacing.default || "1rem";
      const cornerRadius = selectedTheme.radius.default || "0.5rem";

      console.log("Applying Body Font:", bodyFont);
      console.log("Applying Heading Font:", headingFont);
      console.log("Applying Base Spacing:", baseSpacing);
      console.log("Applying Corner Radius:", cornerRadius);

      document.documentElement.style.setProperty("--font-sans", `"${bodyFont}", var(--font-geist-sans)`, "important");
      document.documentElement.style.setProperty("--font-heading", `"${headingFont}", var(--font-geist-sans)`, "important");
      document.documentElement.style.setProperty("--spacing-base", baseSpacing, "important");
      document.documentElement.style.setProperty("--radius-base", cornerRadius, "important");

      document.documentElement.classList.remove("light", "dark");
      document.documentElement.setAttribute("data-theme", "custom");
      document.documentElement.style.color = "white";
    } else {
      console.log("Applying Non-Custom Theme:", currentTheme);
      document.documentElement.removeAttribute("data-theme");
      document.documentElement.style.removeProperty("background-color");
      document.documentElement.style.removeProperty("--background");
      document.documentElement.style.removeProperty("--primary-color");
      document.documentElement.style.removeProperty("--secondary-color"); // Clean up
      document.documentElement.style.removeProperty("--font-sans");
      document.documentElement.style.removeProperty("--font-heading");
      document.documentElement.style.removeProperty("--spacing-base");
      document.documentElement.style.removeProperty("--radius-base");
      document.body.style.removeProperty("background-color");
      document.documentElement.style.removeProperty("color");
    }
  }, [form.watch("colorTheme"), primaryColor, selectedTheme, data?.settings]);

  async function handleThemeChange(newTheme: string) {
    console.log("Theme Change Triggered to:", newTheme);
    const validTheme = ["dark", "light", "system", "custom"].includes(newTheme)
      ? (newTheme as ThemePreference)
      : "system";
    let nextResolvedTheme = validTheme;

    if (validTheme === "system" && systemTheme) {
      nextResolvedTheme = systemTheme as ThemePreference;
    }

    function update() {
      setTheme(validTheme === "custom" ? "system" : validTheme);
      form.setValue("colorTheme", validTheme, { shouldValidate: true });
    }

    if (document.startViewTransition && nextResolvedTheme !== resolvedTheme) {
      document.startViewTransition(update).finished.then(() => {
        document.documentElement.style.viewTransitionName = "";
      });
      document.documentElement.style.viewTransitionName = "theme-transition";
    } else {
      update();
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (data) {
      setIsSaving(true);

      const selectedTheme = values.colorTheme === "custom" && userThemes?.length > 0 
        ? userThemes[0]
        : null;

      console.log("Selected Theme on Submit:", selectedTheme);

      const themeColor = selectedTheme?.colors?.primary || primaryColor;

      const settingsToSave: SaveSettingsMutationInput = {
        ...(data.settings as Settings),
        colorTheme: values.colorTheme === "custom" ? "system" : values.colorTheme,
        primaryColor: values.colorTheme === "custom" ? themeColor : undefined,
        bodyFont: values.colorTheme === "custom" && selectedTheme ? selectedTheme.fonts.body : undefined,
        headingFont: values.colorTheme === "custom" && selectedTheme ? selectedTheme.fonts.heading : undefined,
      };

      console.log("Settings to Save:", settingsToSave);

      toast.promise(
        saveUserSettings(settingsToSave),
        {
          success: t("common.settings.saved"),
          error: t("common.settings.failedToSave"),
          finally: async () => {
            await refetch();
            setIsSaving(false);
          },
        },
      );
    }
  }

  if (!data?.settings) {
    console.log("Settings Data Not Available");
    return null;
  }

  const { mutateAsync: createTheme } = useMutation({
    mutationFn: (theme: Theme) =>
      trpcClient.theme.create.mutate({
        ...theme,
        spacing: {
          base: theme.spacing.default,
          section: theme.spacing.sm,
          card: theme.spacing.md,
          button: theme.spacing.lg,
        },
        radius: {
          base: theme.radius.default,
          button: theme.radius.sm,
          card: theme.radius.md,
          input: theme.radius.lg,
        },
        shadows: {
          base: theme.shadows.default,
          card: theme.shadows.sm,
          button: theme.shadows.md,
        },
        fonts: theme.fonts,
      }),
  });

  const { mutateAsync: updateTheme } = useMutation({
    mutationFn: (theme: ServerTheme) => {
      const updateData = {
        id: theme.id,
        name: theme.name,
        colors: {
          primary: theme.colors.primary || "purple",
          // Removed secondary and secondaryForeground
          primaryForeground: theme.colors.primaryForeground || "#FFFFFF",
          background: theme.colors.background || "#FFFFFF",
          foreground: theme.colors.foreground || "#18181B",
          card: theme.colors.card || "#FFFFFF",
          cardForeground: theme.colors.cardForeground || "#18181B",
          popover: theme.colors.popover || "#FFFFFF",
          popoverForeground: theme.colors.popoverForeground || "#18181B",
          border: theme.colors.border || "#E4E4E7",
          input: theme.colors.input || "#E4E4E7",
          ring: theme.colors.ring || "#0091FF",
          success: theme.colors.success,
          warning: theme.colors.warning,
          error: theme.colors.error,
        },
        fonts: {
          body: theme.fonts.body || "Inter",
          heading: theme.fonts.heading || "Inter",
          mono: theme.fonts.mono || "JetBrains Mono",
        },
        spacing: {
          base: theme.spacing.base || "1rem",
          section: theme.spacing.section || "0.5rem",
          card: theme.spacing.card || "1rem",
          button: theme.spacing.button || "1.5rem",
        },
        radius: {
          base: theme.radius.base || "0.5rem",
          button: theme.radius.button || "0.25rem",
          card: theme.radius.card || "0.5rem",
          input: theme.radius.input || "1rem",
        },
        shadows: {
          base: theme.shadows.base || "0 1px 3px rgba(0,0,0,0.12)",
          card: theme.shadows.card || "0 1px 2px rgba(0,0,0,0.08)",
          button: theme.shadows.button || "0 4px 6px rgba(0,0,0,0.12)",
        },
        isPublic: theme.isPublic,
        isDefault: theme.isDefault,
      };
      console.log("Sending theme update with data:", updateData);
      return trpcClient.theme.update.mutate(updateData);
    },
    onSuccess: (updatedTheme) => {
      console.log("Theme updated successfully:", updatedTheme);
    },
    onError: (error) => {
      console.error("Error updating theme:", error);
    },
  });

  // Add deleteTheme mutation
  const { mutateAsync: deleteTheme } = useMutation({
    mutationFn: (themeId: string) =>
      trpcClient.theme.delete.mutate({ id: themeId }),
    onSuccess: () => {
      console.log("Theme deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["themes"] });
      refetchThemes();
      toast.success(t("common.settings.themeDeleted"));
    },
    onError: (error) => {
      console.error("Error deleting theme:", error);
      toast.error(t("common.settings.failedToDeleteTheme"));
    },
  });

  const handleCreateTheme = async () => {
    try {
      await createTheme({ ...defaultTheme, id: crypto.randomUUID() });
      await queryClient.invalidateQueries({ queryKey: ["themes"] });
      await refetchThemes();
      toast.success(t("common.settings.saved"));
    } catch (error) {
      toast.error(t("common.settings.failedToSave"));
    }
  };

  // Function to update a specific theme in localThemes
  const updateLocalTheme = (themeId: string, updates: Partial<Theme>) => {
    setLocalThemes((prevThemes) =>
      prevThemes.map((theme) =>
        theme.id === themeId ? { ...theme, ...updates } : theme
      )
    );
  };

  // Function to handle theme deletion
  const handleDeleteTheme = async (themeId: string) => {
    if (confirm(t("common.actions.confirmDeleteTheme"))) {
      await deleteTheme(themeId);
    }
  };

  return (
    <div className="grid gap-6">
      <SettingsCard
        title={t("pages.settings.appearance.title")}
        description={t("pages.settings.appearance.description")}
        footer={
          <Button type="submit" form="appearance-form" disabled={isSaving}>
            {isSaving
              ? t("common.actions.saving")
              : t("common.actions.saveChanges")}
          </Button>
        }
      >
        <style>
          {`
            [data-theme="custom"] {
              background-color: var(--primary-color) !important;
              color: white !important;
            }
            [data-theme="custom"] .grid,
            [data-theme="custom"] .space-y-4,
            [data-theme="custom"] .space-y-8,
            [data-theme="custom"] .max-w-sm,
            [data-theme="custom"] * {
              background-color: transparent !important;
            }
          `}
        </style>
        <Form {...form}>
          <form
            id="appearance-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-8"
          >
            <div className="space-y-4">
              <div className="max-w-sm space-y-2">
                <FormField
                  control={form.control}
                  name="colorTheme"
                  render={({ field }) => {
                    console.log("Rendering Dropdown with Value:", field.value);
                    return (
                      <FormItem>
                        <FormLabel>{t("pages.settings.appearance.theme")}</FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={handleThemeChange}
                            defaultValue={field.value}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select theme">
                                <div className="flex items-center gap-2 capitalize">
                                  {field.value === "dark" && (
                                    <Moon className="h-4 w-4" />
                                  )}
                                  {field.value === "light" && (
                                    <Sun className="h-4 w-4" />
                                  )}
                                  {field.value === "system" && (
                                    <Laptop className="h-4 w-4" />
                                  )}
                                  {field.value === "custom" && (
                                    <Laptop className="h-4 w-4" />
                                  )}
                                  {field.value === "custom"
                                    ? `Custom - Primary Color: ${primaryColor || "Not Set"}`
                                    : t(`common.themes.${field.value}` as MessageKey)}
                                </div>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="dark">
                                <div className="flex items-center gap-2">
                                  <Moon className="h-4 w-4" />
                                  {t("common.themes.dark")}
                                </div>
                              </SelectItem>
                              <SelectItem value="system">
                                <div className="flex items-center gap-2">
                                  <Laptop className="h-4 w-4" />
                                  {t("common.themes.system")}
                                </div>
                              </SelectItem>
                              <SelectItem value="light">
                                <div className="flex items-center gap-2">
                                  <Sun className="h-4 w-4" />
                                  {t("common.themes.light")}
                                </div>
                              </SelectItem>
                              <SelectItem value="custom">
                                <div className="flex items-center gap-2">
                                  <Laptop className="h-4 w-4" />
                                  Custom - Primary Color: {primaryColor || "Not Set"}
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>
            </div>
          </form>
        </Form>
      </SettingsCard>

      <div className="mt-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium">Custom Themes</h3>
          <Button onClick={handleCreateTheme} size="sm">
            <PlusIcon className="w-4 h-4 mr-2" />
            Create Theme
          </Button>
        </div>
        {userThemes && userThemes.length > 0 ? (
          userThemes.map((theme) => (
            <div key={theme.id} className="p-4 border rounded-lg">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-md font-medium">{theme.name}</h4>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteTheme(theme.id)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
              <ThemeEditor
                theme={theme}
                onChange={(updates: Partial<Theme>) => {
                  console.log("ThemeEditor onChange called with updates:", updates);
                  updateLocalTheme(theme.id, updates);

                  if (updates.colors?.primary) {
                    console.log("Primary Color Updated in ThemeEditor:", updates.colors.primary);
                    document.documentElement.style.setProperty("--primary-color", updates.colors.primary, "important");
                  }
                  // Removed secondary color handling
                  if (updates.fonts?.body) {
                    console.log("Body Font Updated in ThemeEditor:", updates.fonts.body);
                    document.documentElement.style.setProperty("--font-sans", `"${updates.fonts.body}", var(--font-geist-sans)`, "important");
                  }
                  if (updates.fonts?.heading) {
                    console.log("Heading Font Updated in ThemeEditor:", updates.fonts.heading);
                    document.documentElement.style.setProperty("--font-heading", `"${updates.fonts.heading}", var(--font-geist-sans)`, "important");
                  }
                  if (updates.spacing?.default) {
                    console.log("Base Spacing Updated in ThemeEditor:", updates.spacing.default);
                    document.documentElement.style.setProperty("--spacing-base", updates.spacing.default, "important");
                  }
                  if (updates.radius?.default) {
                    console.log("Corner Radius Updated in ThemeEditor:", updates.radius.default);
                    document.documentElement.style.setProperty("--radius-base", updates.radius.default, "important");
                  }
                }}
                onSave={() => {
                  const updatedTheme = userThemes.find((t) => t.id === theme.id);
                  if (!updatedTheme) return;

                  console.log("Saving Theme with Data:", updatedTheme);
                  updateTheme({
                    id: updatedTheme.id,
                    name: updatedTheme.name,
                    colors: {
                      primary: updatedTheme.colors.primary || "purple",
                      // Removed secondary and secondaryForeground
                      primaryForeground: updatedTheme.colors.primaryForeground || "#FFFFFF",
                      background: updatedTheme.colors.background || "#FFFFFF",
                      foreground: updatedTheme.colors.foreground || "#18181B",
                      card: updatedTheme.colors.card || "#FFFFFF",
                      cardForeground: updatedTheme.colors.cardForeground || "#18181B",
                      popover: updatedTheme.colors.popover || "#FFFFFF",
                      popoverForeground: updatedTheme.colors.popoverForeground || "#18181B",
                      border: updatedTheme.colors.border || "#E4E4E7",
                      input: updatedTheme.colors.input || "#E4E4E7",
                      ring: updatedTheme.colors.ring || "#0091FF",
                      success: updatedTheme.colors.success,
                      warning: updatedTheme.colors.warning,
                      error: updatedTheme.colors.error,
                    },
                    fonts: {
                      body: updatedTheme.fonts.body || "Inter",
                      heading: updatedTheme.fonts.heading || "Inter",
                      mono: updatedTheme.fonts.mono || "JetBrains Mono",
                    },
                    spacing: {
                      base: updatedTheme.spacing.default || "1rem",
                      section: updatedTheme.spacing.sm || "0.5rem",
                      card: updatedTheme.spacing.md || "1rem",
                      button: updatedTheme.spacing.lg || "1.5rem",
                    },
                    radius: {
                      base: updatedTheme.radius.default || "0.5rem",
                      button: updatedTheme.radius.sm || "0.25rem",
                      card: updatedTheme.radius.md || "0.5rem",
                      input: updatedTheme.radius.lg || "1rem",
                    },
                    shadows: {
                      base: updatedTheme.shadows.default || "0 1px 3px rgba(0,0,0,0.12)",
                      card: updatedTheme.shadows.sm || "0 1px 2px rgba(0,0,0,0.08)",
                      button: updatedTheme.shadows.md || "0 4px 6px rgba(0,0,0,0.12)",
                    },
                    isPublic: updatedTheme.isPublic,
                    isDefault: updatedTheme.isDefault,
                  }).then(() => {
                    queryClient.invalidateQueries({ queryKey: ["themes"] });
                    refetchThemes();
                    toast.success(t("common.settings.saved"));
                  }).catch((error) => {
                    console.error("Error saving theme:", error);
                    toast.error(t("common.settings.failedToSave"));
                  });
                }}
              />
            </div>
          ))
        ) : (
          <div className="p-4 border rounded-lg text-center text-gray-500">
            No custom themes available. Create one to get started.
          </div>
        )}
      </div>
    </div>
  );
}