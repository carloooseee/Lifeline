import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const isGitHub = process.env.NODE_ENV === "production";

export default defineConfig({
  base: isGitHub ? "/Lifeline/" : "/",

  plugins: [
    react(),

    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Lifeline",
        short_name: "Lifeline",
        theme_color: "#000000",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/Lifeline/",
        scope: "/Lifeline/",
        icons: [
          { src: "logo192.png", sizes: "192x192", type: "image/png" },
          { src: "logo512.png", sizes: "512x512", type: "image/png" },
        ],
      },

      workbox: {
        globIgnores: [
          "**/models/*",
          "**/onnx/*",
        ],
      },
    }),
  ],
});
