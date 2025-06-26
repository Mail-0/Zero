import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useLoaderData, useNavigate } from 'react-router';
import { Loader2, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';
import { authProxy } from '@/lib/auth-proxy';
import type { Route } from './+types/page';
import React, { useState } from 'react';
import { toast } from 'sonner';

export async function clientLoader({ params, request }: Route.ClientLoaderArgs) {
  if (!params.invitationToken)
    return Response.redirect(`${import.meta.env.VITE_PUBLIC_APP_URL}/mail/inbox`);

  const session = await authProxy.api.getSession({ headers: request.headers });

  if (!session)
    return Response.redirect(
      `${import.meta.env.VITE_PUBLIC_APP_URL}/login?redirect=${request.url}`,
    );

  const invitation = await authClient.organization.getInvitation({
    query: {
      id: params.invitationToken,
    },
  });

  if (invitation.error) {
    return Response.redirect(
      `${import.meta.env.VITE_PUBLIC_APP_URL}/settings/general?error=${invitation.error.message}`,
    );
  }

  return {
    invitationToken: params.invitationToken,
    invitation,
  };
}

export default async function page() {
  const { invitationToken, invitation } = useLoaderData<typeof clientLoader>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<'accept' | 'decline' | null>(null);

  const handleAccept = async () => {
    setIsLoading(true);
    setLoadingAction('accept');
    try {
      await authClient.organization.acceptInvitation({
        invitationId: invitationToken,
      });
      toast.success('You have successfully joined the organization.');
      navigate('/mail/inbox');
    } catch (error: any) {
      toast.error(error.message || 'Something went wrong. Please try again.');
    } finally {
    }
  };

  const handleDecline = async () => {
    setIsLoading(true);
    setLoadingAction('decline');
    try {
      await authClient.organization.rejectInvitation({
        invitationId: invitationToken,
      });
      toast.success('You have declined the organization invitation.');
      navigate('/mail/inbox');
    } catch (error: any) {
      toast.error(error.message || 'Something went wrong. Please try again.');
    } finally {
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="border-border bg-panelLight dark:bg-panelDark w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Organization Invitation
          </CardTitle>
          <CardDescription>
            You've been invited to join an organization. Would you like to accept this invitation?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            By accepting this invitation, you'll become a member of the organization and gain access
            to its resources.
          </p>
        </CardContent>
        <CardFooter className="flex gap-3">
          <Button onClick={handleDecline} variant="outline" disabled={isLoading} className="flex-1">
            {loadingAction === 'decline' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Declining...
              </>
            ) : (
              <>
                <X className="mr-2 h-4 w-4" />
                Decline
              </>
            )}
          </Button>
          <Button onClick={handleAccept} disabled={isLoading} className="flex-1">
            {loadingAction === 'accept' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Accepting...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Accept Invitation
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
