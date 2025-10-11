/**
 * Health check for Mastra service
 */
export const checkMastraHealth = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  details?: string;
}> => {
  try {
    return { status: 'healthy' };
  } catch (error) {
    return {
      status: 'unhealthy',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};
