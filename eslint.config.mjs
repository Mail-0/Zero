import config from "@zero/tsconfig/base";
import { fileURLToPath } from "url";
import { resolve } from "path";

// @ts-ignore
const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default [
  // @ts-ignore
  ...config,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json", "./apps/*/tsconfig.json", "./packages/*/tsconfig.json"],
        tsconfigRootDir: __dirname,
      },
    },
  },
];
