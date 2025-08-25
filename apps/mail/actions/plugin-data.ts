// Thin client wrappers that call Workers API routes under /api/plugins/data

export async function getPluginData(pluginId: string, key: string) {
  const res = await fetch(`/api/plugins/data/${encodeURIComponent(pluginId)}?key=${encodeURIComponent(key)}`, {
    method: "GET",
    credentials: "include",
    headers: { "Accept": "application/json" },
  });
  if (!res.ok) return null;
  return await res.json();
}

export async function setPluginData(pluginId: string, key: string, data: any) {
  const res = await fetch(`/api/plugins/data/${encodeURIComponent(pluginId)}?key=${encodeURIComponent(key)}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to set plugin data");
}

export async function deletePluginData(pluginId: string, key: string) {
  const res = await fetch(`/api/plugins/data/${encodeURIComponent(pluginId)}?key=${encodeURIComponent(key)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to delete plugin data");
}
