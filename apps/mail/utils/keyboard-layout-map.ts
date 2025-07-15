/**
 * Keyboard Layout Map utility for mapping physical key codes to layout-specific key values
 * Uses the KeyboardLayoutMap API: https://wicg.github.io/keyboard-map/
 * Enhanced with comprehensive layout detection and Dvorak support
 */

export interface KeyboardLayoutMapAPI {
  get(keyCode: string): string | undefined;
  has(keyCode: string): boolean;
  keys(): IterableIterator<string>;
  values(): IterableIterator<string>;
  entries(): IterableIterator<[string, string]>;
  forEach(callback: (value: string, key: string) => void): void;
  readonly size: number;
}

declare global {
  interface Navigator {
    keyboard?: {
      getLayoutMap(): Promise<KeyboardLayoutMapAPI>;
    };
  }
}

/**
 * Keyboard layout types and detection
 */
export type KeyboardLayout = 'qwerty' | 'dvorak' | 'colemak' | 'azerty' | 'qwertz' | 'unknown';

export interface LayoutDetectionResult {
  layout: KeyboardLayout;
  confidence: number;
  method: 'api' | 'language' | 'fallback';
}

/**
 * Comprehensive layout mapping tables
 */
export const layoutMappings = {
  dvorak: {
    // Dvorak to QWERTY mapping
    toQwerty: {
      a: 'a',
      b: 'x',
      c: 'j',
      d: 'e',
      e: '.',
      f: 'u',
      g: 'i',
      h: 'd',
      i: 'c',
      j: 'h',
      k: 't',
      l: 'n',
      m: 'm',
      n: 'b',
      o: 'r',
      p: 'l',
      q: "'",
      r: 'p',
      s: 'o',
      t: 'k',
      u: 'g',
      v: 'q',
      w: ',',
      x: 'z',
      y: 'f',
      z: ';',
      ';': 's',
      "'": '-',
      ',': 'w',
      '.': 'v',
      '/': 'z',
      '-': '[',
      '[': '/',
      ']': '=',
      '=': ']',
    },
    // QWERTY to Dvorak mapping (reversed)
    fromQwerty: {} as Record<string, string>,
    // Physical key codes to Dvorak keys
    physicalMap: {
      KeyA: 'a',
      KeyB: 'x',
      KeyC: 'j',
      KeyD: 'e',
      KeyE: '.',
      KeyF: 'u',
      KeyG: 'i',
      KeyH: 'd',
      KeyI: 'c',
      KeyJ: 'h',
      KeyK: 't',
      KeyL: 'n',
      KeyM: 'm',
      KeyN: 'b',
      KeyO: 'r',
      KeyP: 'l',
      KeyQ: "'",
      KeyR: 'p',
      KeyS: 'o',
      KeyT: 'k',
      KeyU: 'g',
      KeyV: 'q',
      KeyW: ',',
      KeyX: 'z',
      KeyY: 'f',
      KeyZ: ';',
      Semicolon: 's',
      Quote: '-',
      Comma: 'w',
      Period: 'v',
      Slash: 'z',
      Minus: '[',
      BracketLeft: '/',
      BracketRight: '=',
      Equal: ']',
    },
  },
  colemak: {
    physicalMap: {
      KeyD: 'g',
      KeyE: 'f',
      KeyF: 'e',
      KeyG: 'd',
      KeyI: 'l',
      KeyJ: 'u',
      KeyK: 'y',
      KeyL: ';',
      KeyN: 'k',
      KeyO: ';',
      KeyP: 'r',
      KeyR: 's',
      KeyS: 'r',
      KeyT: 'g',
      KeyU: 'l',
      KeyY: 'j',
      Semicolon: 'o',
    },
  },
  azerty: {
    physicalMap: {
      KeyA: 'q',
      KeyQ: 'a',
      KeyW: 'z',
      KeyZ: 'w',
      KeyM: ',',
      Comma: 'm',
      Period: ';',
      Semicolon: '.',
      Digit1: '&',
      Digit2: 'é',
      Digit3: '"',
      Digit4: "'",
      Digit5: '(',
      Digit6: '-',
      Digit7: 'è',
      Digit8: '_',
      Digit9: 'ç',
      Digit0: 'à',
    },
  },
  qwertz: {
    physicalMap: {
      KeyY: 'z',
      KeyZ: 'y',
      Semicolon: 'ö',
      Quote: 'ä',
      BracketLeft: 'ü',
      BracketRight: '+',
      Backslash: '#',
      Minus: 'ß',
      Equal: '´',
    },
  },
};

// Initialize reverse mappings
layoutMappings.dvorak.fromQwerty = Object.entries(layoutMappings.dvorak.toQwerty).reduce(
  (acc, [dvorak, qwerty]) => {
    acc[qwerty] = dvorak;
    return acc;
  },
  {} as Record<string, string>,
);

class KeyboardLayoutMapper {
  private layoutMap: KeyboardLayoutMapAPI | null = null;
  private isInitialized = false;
  private detectedLayout: LayoutDetectionResult | null = null;

  /**
   * Initialize the keyboard layout map
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      if ('keyboard' in navigator && navigator.keyboard?.getLayoutMap) {
        this.layoutMap = await navigator.keyboard.getLayoutMap();
        this.detectedLayout = await this.detectLayout();
        this.isInitialized = true;
      } else {
        console.warn('KeyboardLayoutMap API is not supported in this browser');
        this.detectedLayout = this.detectLayoutFallback();
      }
    } catch (error) {
      console.error('Failed to initialize KeyboardLayoutMap:', error);
      this.detectedLayout = this.detectLayoutFallback();
    }
  }

  /**
   * Detect keyboard layout using multiple methods
   */
  private async detectLayout(): Promise<LayoutDetectionResult> {
    // Method 1: Use KeyboardLayoutMap API
    if (this.layoutMap) {
      const layoutResult = this.analyzeLayoutFromAPI();
      if (layoutResult.confidence > 0.8) {
        return layoutResult;
      }
    }

    // Method 2: Language-based detection
    const languageResult = this.detectLayoutFromLanguage();
    if (languageResult.confidence > 0.6) {
      return languageResult;
    }

    // Method 3: Fallback detection
    return this.detectLayoutFallback();
  }

  /**
   * Analyze layout from KeyboardLayoutMap API
   */
  private analyzeLayoutFromAPI(): LayoutDetectionResult {
    if (!this.layoutMap) {
      return { layout: 'unknown', confidence: 0, method: 'api' };
    }

    // Check key signatures for different layouts
    const keySignatures = {
      dvorak: new Set([
        { code: 'KeyQ', expected: "'" },
        { code: 'KeyW', expected: ',' },
        { code: 'KeyE', expected: '.' },
        { code: 'KeyR', expected: 'p' },
        { code: 'KeyT', expected: 'y' },
      ]),
      colemak: new Set([
        { code: 'KeyE', expected: 'f' },
        { code: 'KeyR', expected: 'p' },
        { code: 'KeyT', expected: 'g' },
        { code: 'KeyY', expected: 'j' },
      ]),
      azerty: new Set([
        { code: 'KeyQ', expected: 'a' },
        { code: 'KeyA', expected: 'q' },
        { code: 'KeyW', expected: 'z' },
        { code: 'KeyZ', expected: 'w' },
      ]),
      qwertz: new Set([
        { code: 'KeyY', expected: 'z' },
        { code: 'KeyZ', expected: 'y' },
      ]),
    };

    for (const [layout, signatures] of Object.entries(keySignatures)) {
      let matches = 0;
      for (const { code, expected } of signatures) {
        if (this.layoutMap!.get(code) === expected) {
          matches++;
        }
      }

      const confidence = matches / signatures.size;
      if (confidence > 0.8) {
        return { layout: layout as KeyboardLayout, confidence, method: 'api' };
      }
    }

    // Default to QWERTY if no specific layout detected
    return { layout: 'qwerty', confidence: 0.5, method: 'api' };
  }

  /**
   * Detect layout from language/locale settings
   */
  private detectLayoutFromLanguage(): LayoutDetectionResult {
    const language = navigator.language || navigator.languages?.[0] || '';
    const languages = navigator.languages || [language];

    // Check for explicit Dvorak indicators
    const dvorakIndicators = new Set(['DV', 'dvorak']);
    if (
      languages.some(
        (lang) => dvorakIndicators.has(lang) || lang.includes('DV') || lang.includes('dvorak'),
      )
    ) {
      return { layout: 'dvorak', confidence: 0.9, method: 'language' };
    }

    // Check document language
    const docLang = document.documentElement.lang;
    if (
      (docLang && dvorakIndicators.has(docLang)) ||
      docLang?.includes('DV') ||
      docLang?.includes('dvorak')
    ) {
      return { layout: 'dvorak', confidence: 0.8, method: 'language' };
    }

    // Regional layout detection using Set for faster lookups
    const layoutByRegion = new Map<string, KeyboardLayout>([
      ['fr', 'azerty'],
      ['de', 'qwertz'],
      ['at', 'qwertz'],
      ['ch', 'qwertz'],
    ]);

    const region = language.split('-')[0];
    if (layoutByRegion.has(region)) {
      return { layout: layoutByRegion.get(region)!, confidence: 0.7, method: 'language' };
    }

    return { layout: 'qwerty', confidence: 0.3, method: 'language' };
  }

  /**
   * Fallback layout detection
   */
  private detectLayoutFallback(): LayoutDetectionResult {
    // Check for common Dvorak indicators in existing code
    if (typeof window !== 'undefined') {
      const dvorakLocales = new Set(['en-DV']);
      const languageSet = new Set(navigator.languages || []);

      const isDvorakFromExisting =
        dvorakLocales.has(navigator.language) ||
        languageSet.has('en-DV') ||
        dvorakLocales.has(document.documentElement.lang);

      if (isDvorakFromExisting) {
        return { layout: 'dvorak', confidence: 0.6, method: 'fallback' };
      }
    }

    return { layout: 'qwerty', confidence: 0.4, method: 'fallback' };
  }

  /**
   * Get detected layout information
   */
  getDetectedLayout(): LayoutDetectionResult | null {
    return this.detectedLayout;
  }

  /**
   * Get the mapped key value for a given key code
   * @param keyCode - The physical key code (e.g., 'KeyA', 'Space', 'Enter')
   * @returns The mapped key value or the original key code if mapping fails
   */
  getKeyForCode(keyCode: string): string {
    // Try KeyboardLayoutMap API first
    if (this.layoutMap) {
      const mappedKey = this.layoutMap.get(keyCode);
      if (mappedKey) return mappedKey;
    }

    // Fallback to detected layout mapping
    if (this.detectedLayout) {
      const layoutMapping = this.getLayoutMapping(this.detectedLayout.layout);
      if (layoutMapping && layoutMapping[keyCode]) {
        return layoutMapping[keyCode];
      }
    }

    return keyCode;
  }

  /**
   * Get layout-specific mapping table
   */
  private getLayoutMapping(layout: KeyboardLayout): Record<string, string> | null {
    switch (layout) {
      case 'dvorak':
        return layoutMappings.dvorak.physicalMap;
      case 'colemak':
        return layoutMappings.colemak.physicalMap;
      case 'azerty':
        return layoutMappings.azerty.physicalMap;
      case 'qwertz':
        return layoutMappings.qwertz.physicalMap;
      default:
        return null;
    }
  }

  /**
   * Convert a key from one layout to another
   */
  convertKey(key: string, fromLayout: KeyboardLayout, toLayout: KeyboardLayout): string {
    if (fromLayout === toLayout) return key;

    // Special case for Dvorak <-> QWERTY conversion
    if (fromLayout === 'dvorak' && toLayout === 'qwerty') {
      return (
        layoutMappings.dvorak.toQwerty[
          key.toLowerCase() as keyof typeof layoutMappings.dvorak.toQwerty
        ] || key
      );
    }
    if (fromLayout === 'qwerty' && toLayout === 'dvorak') {
      return (
        layoutMappings.dvorak.fromQwerty[
          key.toLowerCase() as keyof typeof layoutMappings.dvorak.fromQwerty
        ] || key
      );
    }

    // For other layouts, use physical mapping
    const fromMapping = this.getLayoutMapping(fromLayout);
    const toMapping = this.getLayoutMapping(toLayout);

    if (fromMapping && toMapping) {
      // Find the physical key code for the source key
      const physicalKey = Object.entries(fromMapping).find(
        ([_, mappedKey]) => mappedKey.toLowerCase() === key.toLowerCase(),
      )?.[0];

      if (physicalKey && toMapping[physicalKey]) {
        return toMapping[physicalKey];
      }
    }

    return key;
  }

  /**
   * Map an array of key codes to their layout-specific values
   * @param keyCodes - Array of key codes to map
   * @returns Array of mapped key values
   */
  mapKeys(keyCodes: string[]): string[] {
    return keyCodes.map((keyCode) => this.getKeyForCode(keyCode));
  }

  /**
   * Check if the keyboard layout map is available and initialized
   */
  isAvailable(): boolean {
    return this.layoutMap !== null;
  }

  /**
   * Get all available key mappings
   */
  getAllMappings(): Record<string, string> {
    if (!this.layoutMap) return {};

    const mappings: Record<string, string> = {};
    this.layoutMap.forEach((value, key) => {
      mappings[key] = value;
    });
    return mappings;
  }

  /**
   * Get all key codes as a Set for efficient lookups
   */
  getKeyCodesSet(): Set<string> {
    if (!this.layoutMap) return new Set();
    return new Set(this.layoutMap.keys());
  }

  /**
   * Get all key values as a Set for efficient lookups
   */
  getKeyValuesSet(): Set<string> {
    if (!this.layoutMap) return new Set();
    return new Set(this.layoutMap.values());
  }

  /**
   * Check if a key code exists in the current layout
   */
  hasKeyCode(keyCode: string): boolean {
    return this.layoutMap?.has(keyCode) ?? false;
  }

  /**
   * Check if a key value exists in the current layout
   */
  hasKeyValue(keyValue: string): boolean {
    if (!this.layoutMap) return false;
    for (const value of this.layoutMap.values()) {
      if (value === keyValue) return true;
    }
    return false;
  }

  /**
   * Get intersection of two key sets
   */
  getKeySetIntersection(setA: Set<string>, setB: Set<string>): Set<string> {
    return new Set([...setA].filter((key) => setB.has(key)));
  }

  /**
   * Get union of two key sets
   */
  getKeySetUnion(setA: Set<string>, setB: Set<string>): Set<string> {
    return new Set([...setA, ...setB]);
  }

  /**
   * Get difference between two key sets
   */
  getKeySetDifference(setA: Set<string>, setB: Set<string>): Set<string> {
    return new Set([...setA].filter((key) => !setB.has(key)));
  }
}

// Export a singleton instance
export const keyboardLayoutMapper = new KeyboardLayoutMapper();

/**
 * Common key code mappings for reference
 */
export const commonKeyCodes = {
  // Letters
  KeyA: 'KeyA',
  KeyB: 'KeyB',
  KeyC: 'KeyC',
  KeyD: 'KeyD',
  KeyE: 'KeyE',
  KeyF: 'KeyF',
  KeyG: 'KeyG',
  KeyH: 'KeyH',
  KeyI: 'KeyI',
  KeyJ: 'KeyJ',
  KeyK: 'KeyK',
  KeyL: 'KeyL',
  KeyM: 'KeyM',
  KeyN: 'KeyN',
  KeyO: 'KeyO',
  KeyP: 'KeyP',
  KeyQ: 'KeyQ',
  KeyR: 'KeyR',
  KeyS: 'KeyS',
  KeyT: 'KeyT',
  KeyU: 'KeyU',
  KeyV: 'KeyV',
  KeyW: 'KeyW',
  KeyX: 'KeyX',
  KeyY: 'KeyY',
  KeyZ: 'KeyZ',

  // Numbers
  Digit1: 'Digit1',
  Digit2: 'Digit2',
  Digit3: 'Digit3',
  Digit4: 'Digit4',
  Digit5: 'Digit5',
  Digit6: 'Digit6',
  Digit7: 'Digit7',
  Digit8: 'Digit8',
  Digit9: 'Digit9',
  Digit0: 'Digit0',

  // Special keys
  Space: 'Space',
  Enter: 'Enter',
  Escape: 'Escape',
  Backspace: 'Backspace',
  Tab: 'Tab',

  // Modifiers
  ShiftLeft: 'ShiftLeft',
  ShiftRight: 'ShiftRight',
  ControlLeft: 'ControlLeft',
  ControlRight: 'ControlRight',
  AltLeft: 'AltLeft',
  AltRight: 'AltRight',
  MetaLeft: 'MetaLeft',
  MetaRight: 'MetaRight',
} as const;

/**
 * Initialize the keyboard layout mapper on module load
 */
if (typeof window !== 'undefined') {
  keyboardLayoutMapper.init().catch(console.error);
}
