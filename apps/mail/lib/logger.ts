/**
 * Simple logging utility that adjusts verbosity based on environment
 */
export const logger = {
  error: (message: string, ...args: any[]) => console.error(message, ...args),
  warn: (message: string, ...args: any[]) => console.warn(message, ...args),
  info: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV !== 'production' || process.env.LOG_LEVEL === 'info') {
      console.log(message, ...args);
    }
  },
  debug: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV !== 'production' && 
        (process.env.LOG_LEVEL === 'debug' || process.env.DEBUG === 'true')) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }
};