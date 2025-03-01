"use client";

import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SettingsCard } from "@/components/settings/settings-card";
import { ModeToggle } from "@/components/theme/theme-switcher";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { useState } from "react";
import * as z from "zod";

// TODO: More customization options
const formSchema = z.object({
  inboxType: z.enum(["default", "important", "unread"]),
});

export default function AppearancePage() {
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      inboxType: "default",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSaving(true);
    setTimeout(() => {
      console.log(values);
      setIsSaving(false);
    }, 1000);
  }

  return (
    <div className="grid gap-6">
      <SettingsCard
        title="Appearance"
        description="Customize colors, fonts and view options."
      >
        <Form {...form}>
          <form id="appearance-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Theme</Label>
                <ModeToggle className="w-36 bg-popover" />
              </div>
            </div>
          </form>
        </Form>
      </SettingsCard>
    </div>
  );
}
