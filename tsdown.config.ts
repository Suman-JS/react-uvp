import { defineConfig } from "tsdown";
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ["@sumanjs/uvp", "react", "react-dom", "react/jsx-runtime"],
  css: { inject: true, fileName: "player.css" },
});
