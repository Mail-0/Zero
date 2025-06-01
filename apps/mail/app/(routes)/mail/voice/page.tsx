import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mic } from 'lucide-react';

export default function VoicePage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              Zero AI Voice Assistant
            </CardTitle>
            <CardDescription>
              The voice assistant is now available as a floating button throughout the app
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="mb-2 font-semibold">Getting Started</h3>
              <p className="text-muted-foreground">
                Look for the floating microphone button in the bottom right corner of your screen.
                Click it to start a conversation with the AI assistant.
              </p>
            </div>

            <div>
              <h3 className="mb-2 font-semibold">Using Context</h3>
              <p className="text-muted-foreground mb-2">
                You can provide context to the AI assistant programmatically. Here's an example:
              </p>
              <pre className="bg-muted overflow-x-auto rounded-lg p-4">
                <code className="text-sm">
                  {`import { useVoice } from '@/providers/voice-provider';

function MyComponent() {
  const { startConversation } = useVoice();

  const handleClick = () => {
    startConversation({
      context: 'email_view',
      currentEmail: {
        subject: 'Meeting tomorrow',
        from: 'john@example.com'
      }
    });
  };

  return <button onClick={handleClick}>Ask AI</button>;
}`}
                </code>
              </pre>
            </div>

            <div>
              <h3 className="mb-2 font-semibold">Available Actions</h3>
              <ul className="text-muted-foreground list-inside list-disc space-y-1">
                <li>List and search emails</li>
                <li>Read email content</li>
                <li>Send replies</li>
                <li>Mark emails as read/unread</li>
                <li>Archive or delete emails</li>
                <li>Create and apply labels</li>
                <li>Search through your inbox</li>
              </ul>
            </div>

            <div>
              <h3 className="mb-2 font-semibold">Updating Context During Conversation</h3>
              <p className="text-muted-foreground mb-2">
                You can also update context while a conversation is active:
              </p>
              <pre className="bg-muted overflow-x-auto rounded-lg p-4">
                <code className="text-sm">
                  {`const { sendContext } = useVoice();

// Update context during active conversation
sendContext({
  newEmail: 'User just opened a different email',
  emailId: '12345'
});`}
                </code>
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
