import { SWRConfig } from "swr";
import { CommandPaletteProvider } from "@/components/context/command-palette-context";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SWRConfig
          value={{
            // your SWR config
          }}
        >
          <CommandPaletteProvider>
            {children}
          </CommandPaletteProvider>
        </SWRConfig>
      </body>
    </html>
  );
}