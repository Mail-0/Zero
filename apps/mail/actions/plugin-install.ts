// Thin client wrapper: install a plugin for the current user via Workers API
export async function installPlugin(pluginId: string) {
  if (!pluginId) throw new Error("Plugin ID is required");
  const res = await fetch(`/api/plugins/install/${encodeURIComponent(pluginId)}`, {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Failed to install plugin");
  }
  return { success: true } as const;
}
