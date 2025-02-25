import { SettingsCard } from "@/components/settings/settings-card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { KeyRoundIcon } from "lucide-react";

export default function SecurityPage() {
  return (
    <div className="grid gap-6">
      <SettingsCard
        title="Security"
        description="Manage your security preferences and account protection."
        footer={
          <div className="flex items-center gap-2">
            <Button className="text-xs sm:text-base" variant="outline">
              <KeyRoundIcon className="mr-2 h-4 w-4" />
              Change Password
            </Button>
            <Button className="text-xs sm:text-base" variant="destructive">
              Delete Account
            </Button>
          </div>
        }
      >
        <div className="grid gap-6">
          <div className="flex flex-col gap-6 divide-y">
            <div className="flex items-center justify-between pt-2">
              <div className="space-y-1">
                <Label className="text-base">Two-Factor Authentication</Label>
                <p className="text-sm text-muted-foreground">
                  Add an extra layer of security to your account
                </p>
              </div>
              <Switch id="2fa" />
            </div>
            <div className="flex items-center justify-between pt-6">
              <div className="space-y-1">
                <Label className="text-base">Login Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified about new login attempts
                </p>
              </div>
              <Switch id="login-notifications" defaultChecked />
            </div>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}
