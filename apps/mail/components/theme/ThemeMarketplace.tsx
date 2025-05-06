import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';

export function ThemeMarketplace() {
  const [themes, setThemes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/v1/themes?public=1')
      .then((res) => res.json())
      .then((data) => setThemes(Array.isArray(data) ? data : []))
      .catch(() => setError('Failed to load public themes'))
      .finally(() => setLoading(false));
  }, []);

  const handleCopy = async (themeId: string) => {
    setCopyingId(themeId);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/v1/themes?copy=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to copy theme');
        setCopyingId(null);
        return;
      }
      setSuccess('Theme copied to your account!');
    } catch (e) {
      setError('Failed to copy theme');
    } finally {
      setCopyingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="mb-2 text-lg font-semibold">Theme Marketplace</div>
      {loading && <div>Loading...</div>}
      {error && <div className="text-sm text-red-500">{error}</div>}
      {success && <div className="text-sm text-green-600">{success}</div>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {themes.map((theme) => (
          <div key={theme.id} className="bg-muted/50 flex items-center gap-4 rounded-lg border p-3">
            <div className="flex gap-1">
              {Object.values(theme.colors)
                .slice(0, 3)
                .map((color: string, i: number) => (
                  <span
                    key={i}
                    className="h-5 w-5 rounded-full border"
                    style={{ background: color }}
                  />
                ))}
            </div>
            <div className="flex-1">
              <div className="font-medium">{theme.name}</div>
              <div className="text-muted-foreground text-xs">{theme.fonts?.body}</div>
            </div>
            <Button
              size="sm"
              onClick={() => handleCopy(theme.id)}
              disabled={copyingId === theme.id}
            >
              {copyingId === theme.id ? 'Copying...' : 'Copy'}
            </Button>
          </div>
        ))}
        {themes.length === 0 && !loading && (
          <div className="text-muted-foreground">No public themes yet.</div>
        )}
      </div>
    </div>
  );
}
