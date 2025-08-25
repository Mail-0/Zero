// Thin client wrappers calling Workers API routes under /api/plugins

export async function getPluginSettings(pluginId: string) {
  const res = await fetch(`/api/plugins/settings/${encodeURIComponent(pluginId)}`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return { enabled: false, added: false };
  return (await res.json()) as { enabled: boolean; added: boolean };
}

export async function setPluginSettings(pluginId: string, enabled: boolean) {
  const res = await fetch(`/api/plugins/settings/${encodeURIComponent(pluginId)}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error("Failed to set plugin settings");
  return { success: true } as const;
}

export async function getAllPluginSettings() {
  const res = await fetch(`/api/plugins/settings`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return {} as Record<string, { enabled: boolean; added: boolean }>;
  return (await res.json()) as Record<string, { enabled: boolean; added: boolean }>;
}
