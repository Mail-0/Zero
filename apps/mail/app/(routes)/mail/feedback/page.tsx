import { SettingsCard } from '@/components/settings/settings-card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { authProxy } from '@/lib/auth-proxy';
import { useState } from 'react';
import { m } from '@/paraglide/messages';
import type { Route } from './+types/page';

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const session = await authProxy.api.getSession({ headers: request.headers });

  if (!session) {
    return Response.redirect(`${import.meta.env.VITE_PUBLIC_APP_URL}/login`);
  }

  return null;
}

export default function FeedbackPage() {
  const [feedback, setFeedback] = useState('');

  const handleSend = () => {
    // TODO_doorman:need to implement
    alert('Sending feedback complete');
    setFeedback('');
  };

  return (
    <div className="flex h-full items-start justify-center overflow-y-auto p-4 md:p-8">
      <div className="bg-panelLight dark:bg-panelDark w-full max-w-2xl rounded-2xl border border-border p-6 shadow-sm md:p-8">
        <SettingsCard
          title={m['navigation.sidebar.feedback']()}
          description="Share your thoughts, report issues, or suggest improvements."
          footer={
            <div className="flex justify-end">
              <Button onClick={handleSend} disabled={!feedback.trim()}>
                Send
              </Button>
            </div>
          }
        >
          <div className="space-y-2">
            <Label htmlFor="feedback-message">Your feedback</Label>
            <Textarea
              id="feedback-message"
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              placeholder="Tell us what you think..."
              className="min-h-[200px] resize-y"
            />
          </div>
        </SettingsCard>
      </div>
    </div>
  );
}
