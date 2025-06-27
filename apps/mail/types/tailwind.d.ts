declare module 'tailwindcss/lib/util/flattenColorPalette' {
  const flattenColorPalette: (colors: Record<string, unknown>) => Record<string, string>;
  export default flattenColorPalette;
}
