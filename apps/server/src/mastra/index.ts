import { weatherAgent } from './agents/weather-agent';
import { Mastra } from '@mastra/core/mastra';

export const mastra = new Mastra({
  agents: { weatherAgent },
  observability: {
    default: { enabled: true },
  },
});

/**
 * Health check for Mastra service
 */
export const checkMastraHealth = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  details?: string;
}> => {
  try {
    const response = await mastra
      .getAgent('weatherAgent')
      .generate('What is the weather in Tokyo?');

    return { status: 'healthy', details: response.text };
  } catch (error) {
    return {
      status: 'unhealthy',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};
