import type { Locale, IntlMessages } from './config';

interface TranslationChunk {
  id: string;
  messages: Record<string, any>;
  priority: 'critical' | 'high' | 'normal' | 'low';
}

const CHUNK_DEFINITIONS = {
  critical: [
    'common.actions',
    'common.navigation', 
    'common.errors',
    'pages.login',
    'pages.loading'
  ],
  high: [
    'mail.compose',
    'mail.inbox',
    'mail.read'
  ],
  normal: [
    'settings',
    'preferences'
  ],
  low: [
    'help',
    'about',
    'legal'
  ]
} as const;

class ChunkedTranslationLoader {
  private loadedChunks = new Map<string, TranslationChunk>();
  private loadingPromises = new Map<string, Promise<TranslationChunk>>();
  
  constructor(private baseMessages: IntlMessages) {}
  
  async loadChunk(chunkId: string, locale: Locale): Promise<TranslationChunk> {
    const cacheKey = `${locale}:${chunkId}`;
    
    // Return cached chunk if available
    if (this.loadedChunks.has(cacheKey)) {
      return this.loadedChunks.get(cacheKey)!;
    }
    
    // Return existing loading promise
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey)!;
    }
    
    // Start loading chunk
    const loadPromise = this.fetchChunk(chunkId, locale);
    this.loadingPromises.set(cacheKey, loadPromise);
    
    try {
      const chunk = await loadPromise;
      this.loadedChunks.set(cacheKey, chunk);
      return chunk;
    } finally {
      this.loadingPromises.delete(cacheKey);
    }
  }
  
  async loadCriticalChunks(locale: Locale): Promise<Record<string, any>> {
    const criticalPaths = CHUNK_DEFINITIONS.critical;
    const messages: Record<string, any> = {};
    
    // Load all critical chunks in parallel
    const chunkPromises = criticalPaths.map(path => 
      this.loadChunk(`critical-${path}`, locale)
    );
    
    const chunks = await Promise.all(chunkPromises);
    
    // Merge chunk messages
    for (const chunk of chunks) {
      Object.assign(messages, chunk.messages);
    }
    
    return messages;
  }
  
  async preloadHighPriorityChunks(locale: Locale): Promise<void> {
    // Fire and forget high priority chunks
    const highPaths = CHUNK_DEFINITIONS.high;
    const promises = highPaths.map(path => 
      this.loadChunk(`high-${path}`, locale).catch(() => null)
    );
    
    // Don't await - let them load in background
    Promise.all(promises);
  }
  
  private async fetchChunk(chunkId: string, locale: Locale): Promise<TranslationChunk> {
    try {
      // Try to fetch from dedicated chunk endpoint
      const response = await fetch(`/api/i18n/chunks/${locale}/${chunkId}`);
      if (response.ok) {
        const data = await response.json();
        return {
          id: chunkId,
          messages: data.messages,
          priority: data.priority || 'normal'
        };
      }
    } catch (error) {
      console.warn(`Failed to load chunk ${chunkId} for ${locale}:`, error);
    }
    
    // Fallback: extract from base messages
    const pathSegments = chunkId.replace(/^(critical|high|normal|low)-/, '').split('.');
    const messages = this.extractNestedPath(this.baseMessages, pathSegments);
    
    return {
      id: chunkId,
      messages: { [pathSegments.join('.')]: messages },
      priority: this.getPriorityFromChunkId(chunkId)
    };
  }
  
  private extractNestedPath(obj: any, path: string[]): any {
    return path.reduce((current, key) => current?.[key], obj);
  }
  
  private getPriorityFromChunkId(chunkId: string): TranslationChunk['priority'] {
    if (chunkId.startsWith('critical-')) return 'critical';
    if (chunkId.startsWith('high-')) return 'high';
    if (chunkId.startsWith('normal-')) return 'normal';
    return 'low';
  }
  
  // Create a minimal translation object with only critical chunks
  createMinimalTranslations(criticalMessages: Record<string, any>): IntlMessages {
    return {
      ...this.baseMessages,
      ...criticalMessages
    } as IntlMessages;
  }
}

export { ChunkedTranslationLoader, type TranslationChunk };
