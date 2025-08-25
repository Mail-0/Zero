// Thin client wrapper: toggle plugin enabled state by using the settings endpoint
export async function togglePlugin(pluginId: string) {
  if (!pluginId) throw new Error("Plugin ID is required");

  // Get current state
  const getRes = await fetch(`/api/plugins/settings/${encodeURIComponent(pluginId)}`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!getRes.ok) {
    const text = await getRes.text().catch(() => "");
    throw new Error(text || "Failed to fetch plugin settings");
  }
  const curr = (await getRes.json()) as { enabled: boolean; added: boolean };
  if (!curr.added) throw new Error("Plugin not added to user account");

  // Set flipped state
  const postRes = await fetch(`/api/plugins/settings/${encodeURIComponent(pluginId)}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ enabled: !curr.enabled }),
  });
  if (!postRes.ok) {
    const text = await postRes.text().catch(() => "");
    throw new Error(text || "Failed to toggle plugin");
  }
  return { success: true } as const;
}
