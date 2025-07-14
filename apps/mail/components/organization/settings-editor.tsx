import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Palette, Settings as SettingsIcon } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Separator } from '@/components/ui/separator';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTRPC } from '@/providers/query-provider';
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
  const trpc = useTRPC();

  const {
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

  // TRPC query for fetching settings
  const { data: settingsData } = useQuery({
    ...trpc.organization.getSettings.queryOptions({ organizationId: orgId || '' }),
    enabled: !!orgId,
  });

  // TRPC mutations
  const updateSettingsMutation = useMutation(trpc.organization.updateSettings.mutationOptions());
  const updateOrgMutation = useMutation(trpc.organization.update.mutationOptions());

  useEffect(() => {
    if (settingsData?.settings) {
      // Merge with defaults to handle missing fields
      const settings = { ...defaultValues, ...settingsData.settings };
      reset(settings);
    }
  }, [settingsData, reset]);

  async function onSubmit(values: z.infer<typeof schema>) {
    if (!orgId) return;

    try {
      await updateSettingsMutation.mutateAsync({
        organizationId: orgId,
        settings: values,
      });

      // Also persist the logo URL at the organization level so it can be displayed everywhere
      if (values.branding.logoUrl) {
        try {
          await updateOrgMutation.mutateAsync({
            organizationId: orgId,
            logo: values.branding.logoUrl,
          });
        } catch (err) {
          console.error('Failed to update organization logo:', err);
        }
      }

      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
      console.error(error);
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
