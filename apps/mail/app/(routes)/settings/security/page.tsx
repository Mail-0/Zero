"use client";

import { SettingsCard } from "@/components/settings/settings-card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { KeyRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import * as z from "zod";

const formSchema = z.object({
  twoFactorAuth: z.boolean(),
  loginNotifications: z.boolean(),
});

export default function SecurityPage() {
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      twoFactorAuth: false,
      loginNotifications: true,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSaving(true);

    // TODO: Save settings in user's account
    setTimeout(() => {
      console.log(values);
      setIsSaving(false);
    }, 1000);
  }

  return (
    <div className="grid gap-6">
      <SettingsCard
        title="Security"
        description="Manage your security preferences and account protection."
        footer={
          <div className="flex gap-4">
            <Button variant="destructive">Delete Account</Button>
            <Button type="submit" form="security-form" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        }
      >
        <Form {...form}>
          <form id="security-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="flex w-full items-center gap-5">
              <FormField
                control={form.control}
                name="twoFactorAuth"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border bg-popover p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Two-Factor Authentication</FormLabel>
                      <FormDescription>
                        Add an extra layer of security to your account
                      </FormDescription>
                    </div>
                    <FormControl className="ml-4">
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="loginNotifications"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border bg-popover p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Login Notifications</FormLabel>
                      <FormDescription>
                        Get notified about new login attempts
                      </FormDescription>
                    </div>
                    <FormControl className="ml-4">
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
      </SettingsCard>
    </div>
  );
}
