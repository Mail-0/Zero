import { Loader2, Settings as SettingsIcon, Palette, Users } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

const schema = z.object({
  branding: z.object({
    logoUrl: z.string().url().optional().or(z.literal('')),
  }),
  defaults: z.object({
    signature: z.string(),
  }),
});

interface SettingsEditorProps {
  orgId: string | undefined;
}

const defaultValues = {
  branding: {
    logoUrl: '',
  },
  defaults: {
    signature: '',
  },
};

export function SettingsEditor({ orgId }: SettingsEditorProps) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const watchedValues = watch();

  useEffect(() => {
    async function fetchSettings() {
      if (!orgId) return;
      try {
        const res = await fetch(
          `${import.meta.env.VITE_PUBLIC_BACKEND_URL}/api/organization/${orgId}/settings`,
        );
        const data = (await res.json()) as { settings: any };

        // Merge with defaults to handle missing fields
        const settings = { ...defaultValues, ...data.settings };
        reset(settings);
      } catch (error) {
        console.error('Failed to fetch settings:', error);
        reset(defaultValues);
      }
    }
    fetchSettings();
  }, [orgId]);

  async function onSubmit(values: z.infer<typeof schema>) {
    if (!orgId) return;

    const res = await fetch(
      `${import.meta.env.VITE_PUBLIC_BACKEND_URL}/api/organization/${orgId}/settings`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: values }),
      },
    );

    if (res.ok) {
      // Also persist the logo URL at the organization level so it can be displayed everywhere
      try {
        await fetch(`${import.meta.env.VITE_PUBLIC_BACKEND_URL}/api/organization/${orgId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logo: values.branding.logoUrl }),
        });
      } catch (err) {
        console.error('Failed to update organization logo:', err);
      }
      toast.success('Settings saved successfully');
    } else {
      toast.error('Failed to save settings');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SettingsIcon className="h-5 w-5" /> Organisation Settings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Branding Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              <h3 className="text-lg font-medium">Branding</h3>
            </div>

            <div className="space-y-2">
              {/* File upload */}
              <div className="space-y-2">
                <Label htmlFor="logoFile">Upload Logo</Label>
                <Input
                  className="max-w-sm"
                  id="logoFile"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      const result = reader.result as string;
                      setValue('branding.logoUrl', result, { shouldValidate: true });
                    };
                    reader.readAsDataURL(file);
                  }}
                />
                {errors.branding?.logoUrl && (
                  <p className="text-destructive text-sm">{errors.branding.logoUrl.message}</p>
                )}
              </div>
              {/* Logo preview */}
              {watchedValues.branding?.logoUrl && (
                <div className="mt-2">
                  <img
                    src={watchedValues.branding.logoUrl}
                    alt="Logo preview"
                    className="h-12 w-auto rounded border"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          <Separator />

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Settings
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
