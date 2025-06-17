import {
  BaseSubscriptionFactory,
  type SubscriptionData,
  type UnsubscriptionData,
} from './base-subscription.factory';
import { c, getNotificationsUrl } from '../../lib/utils';
import jwt from '@tsndr/cloudflare-worker-jwt';
import { env } from 'cloudflare:workers';
import { EProviders } from '../../types';

interface GoogleServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
}

interface IamPolicy {
  bindings?: { role: string; members: string[] }[];
}

class GoogleSubscriptionFactory extends BaseSubscriptionFactory {
  readonly providerId = EProviders.google;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private serviceAccount: GoogleServiceAccount | null = null;
  private pubsubServiceAccount: string = 'serviceAccount:gmail-api-push@system.gserviceaccount.com';

  private getServiceAccount(): GoogleServiceAccount {
    if (!this.serviceAccount) {
      const serviceAccountJson = env.GOOGLE_S_ACCOUNT;
      if (!serviceAccountJson) {
        throw new Error('GOOGLE_S_ACCOUNT environment variable is required');
      }

      try {
        this.serviceAccount = JSON.parse(serviceAccountJson);
      } catch (error) {
        throw new Error('Invalid GOOGLE_S_ACCOUNT JSON format');
      }
      return this.serviceAccount as GoogleServiceAccount;
    }

    return this.serviceAccount;
  }

  private async getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    // Return cached token if still valid (with 5 minute buffer)
    if (this.accessToken && this.tokenExpiry > now + 300) {
      return this.accessToken;
    }

    const serviceAccount = this.getServiceAccount();

    const payload = {
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    };

    const signedJWT = await jwt.sign(payload, serviceAccount.private_key, {
      algorithm: 'RS256',
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: signedJWT,
      }),
    });

    if (!response.ok) {
      const error = (await response.json()) as { error?: string };
      throw new Error(`Failed to get access token: ${error.error}`);
    }

    const data = (await response.json()) as { access_token: string };
    this.accessToken = data.access_token;
    this.tokenExpiry = now + 3600;

    return this.accessToken;
  }

  private async makeAuthenticatedRequest(
    url: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const token = await this.getAccessToken();

    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  }

  private async resourceExists(url: string): Promise<boolean> {
    const response = await this.makeAuthenticatedRequest(url);
    return response.ok;
  }

  private async setupPubSubTopic(topicName: string): Promise<void> {
    const serviceAccount = this.getServiceAccount();
    const baseUrl = `https://pubsub.googleapis.com/v1/projects/${serviceAccount.project_id}`;
    const topicUrl = `${baseUrl}/topics/${topicName}`;

    // Delete subscription if it exists
    const subUrl = `${baseUrl}/subscriptions/${topicName}`;
    if (await this.resourceExists(subUrl)) {
      await this.makeAuthenticatedRequest(subUrl, { method: 'DELETE' });
    }

    // Create topic if it doesn't exist
    if (!(await this.resourceExists(topicUrl))) {
      const createResponse = await this.makeAuthenticatedRequest(topicUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!createResponse.ok) {
        throw new Error(`Failed to create topic: ${await createResponse.text()}`);
      }
    }

    // Set IAM policy
    await this.setTopicIamPolicy(topicName);
  }

  private async setTopicIamPolicy(topicName: string): Promise<void> {
    const serviceAccount = this.getServiceAccount();
    const baseUrl = `https://pubsub.googleapis.com/v1/projects/${serviceAccount.project_id}/topics/${topicName}`;

    // Get current policy
    const policyResponse = await this.makeAuthenticatedRequest(`${baseUrl}:getIamPolicy`);

    if (!policyResponse.ok) {
      throw new Error(`Failed to fetch IAM policy: ${await policyResponse.text()}`);
    }

    const policy: IamPolicy = await policyResponse.json();
    policy.bindings = policy.bindings || [];
    policy.bindings.push({
      role: 'roles/pubsub.publisher',
      members: [this.pubsubServiceAccount],
    });

    // Update policy
    const updateResponse = await this.makeAuthenticatedRequest(`${baseUrl}:setIamPolicy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ policy }),
    });

    if (!updateResponse.ok) {
      throw new Error(`Failed to update IAM policy: ${await updateResponse.text()}`);
    }
  }

  private async createPubSubSubscription(
    subscriptionName: string,
    pushEndpoint: string,
  ): Promise<void> {
    const serviceAccount = this.getServiceAccount();
    const url = `https://pubsub.googleapis.com/v1/projects/${serviceAccount.project_id}/subscriptions/${subscriptionName}`;

    const requestBody = {
      topic: `projects/${serviceAccount.project_id}/topics/${subscriptionName}`,
      pushConfig: {
        oidcToken: {
          serviceAccountEmail: serviceAccount.client_email,
        },
        pushEndpoint,
        noWrapper: {
          writeMetadata: true,
        },
      },
    };

    const response = await this.makeAuthenticatedRequest(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Failed to create subscription: ${await response.text()}`);
    }
  }

  private async setupGmailWatch(connectionData: any, topicName: string): Promise<void> {
    // Create Gmail client with OAuth2
    const { OAuth2Client } = await import('google-auth-library');
    const auth = new OAuth2Client({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    });

    auth.setCredentials({
      refresh_token: connectionData.refreshToken,
      scope: 'https://www.googleapis.com/auth/gmail.readonly',
    });

    // Refresh access token
    const { credentials } = await auth.refreshAccessToken();
    if (credentials.access_token) {
      auth.setCredentials({
        access_token: credentials.access_token,
        scope: 'https://www.googleapis.com/auth/gmail.readonly',
      });
    }

    // Setup Gmail watch using direct API call instead of heavy googleapis package
    const accessToken = credentials.access_token || auth.credentials.access_token;
    const serviceAccount = this.getServiceAccount();

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/watch', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        labelIds: ['INBOX'],
        topicName: `projects/${serviceAccount.project_id}/topics/${topicName}`,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to setup Gmail watch: ${await response.text()}`);
    }
  }

  public async subscribe(data: { body: SubscriptionData }): Promise<Response> {
    const { connectionId } = data.body;

    if (!connectionId) {
      return c.json({ error: 'connectionId is required' }, { status: 400 });
    }

    try {
      console.log(`[SUBSCRIPTION] Getting connection data for: ${connectionId}`);
      const connectionData = await this.getConnectionFromDb(connectionId);
      if (!connectionData) {
        console.log(`[SUBSCRIPTION] Connection not found: ${connectionId}`);
        return c.json({ error: 'connection not found' }, { status: 400 });
      }

      const pubSubName = `notifications__${connectionData.id}`;
      const pushEndpoint = getNotificationsUrl(EProviders.google);
      console.log(`[SUBSCRIPTION] Generated PubSub name: ${pubSubName}`);
      console.log(`[SUBSCRIPTION] Using push endpoint: ${pushEndpoint}`);

      try {
        console.log(`[SUBSCRIPTION] Setting up PubSub topic: ${pubSubName}`);
        await this.setupPubSubTopic(pubSubName);

        console.log(`[SUBSCRIPTION] Creating PubSub subscription for endpoint: ${pushEndpoint}`);
        await this.createPubSubSubscription(pubSubName, pushEndpoint);

        console.log(`[SUBSCRIPTION] Setting up Gmail watch for connection: ${connectionData.id}`);
        await this.setupGmailWatch(connectionData, pubSubName);

        await env.gmail_sub_age.put(
          `${connectionId}__${EProviders.google}`,
          new Date().toISOString(),
        );

        console.log(`[SUBSCRIPTION] Initializing labels for connection: ${connectionId}`);
        await this.initializeConnectionLabels(connectionId);

        console.log(`[SUBSCRIPTION] Setup completed successfully for connection: ${connectionId}`);
        return c.json({});
      } catch (error) {
        console.error('[SUBSCRIPTION] Setup failed:', error);

        // Clean up on failure using base class method
        // await this.cleanupOnFailure(connectionId, env);

        if (error instanceof Error && error.message.includes('Already Exists')) {
          console.log('Resource already exists, continuing...');
          return c.json({});
        }

        throw error;
      }
    } catch (error) {
      console.error('[SUBSCRIPTION] Error:', error);

      // Clean up on error using base class method
      //   await this.cleanupOnFailure(connectionId, env);

      return c.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  public async unsubscribe(data: {
    body: { connectionId?: string; providerId?: EProviders };
  }): Promise<Response> {
    const connectionId = data.body.connectionId;
    const providerId = data.body.providerId;

    if (!connectionId) {
      return c.json({ error: 'connectionId is required' }, { status: 400 });
    }

    const existingState = await env.subscribed_accounts.get(`${connectionId}__${providerId}`);

    if (!existingState || existingState === 'pending') {
      return c.json({ message: 'not subscribed' }, { status: 200 });
    }

    await env.subscribed_accounts.delete(`${connectionId}__${providerId}`);
    return c.json({});
  }

  public async verifyToken(token: string): Promise<boolean> {
    try {
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return !!data;
    } catch {
      return false;
    }
  }
}

// Export class for registry use
export { GoogleSubscriptionFactory };
