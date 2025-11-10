import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa' 

export default defineConfig({
  plugins: [
    react(),
    
    VitePWA({
      registerType: 'autoUpdate',
      
      includeAssets: ['logo192.png', 'logo512.png'],
      

      manifest: {
        "short_name": "Lifeline", 
        "name": "Lifeline",  
        "icons": [
          {
            "src": "logo192.png",
            "type": "image/png",
            "sizes": "192x192"
          },
          {
            "src": "logo512.png",
            "type": "image/png",
            "sizes": "512x512"
          }
        ],
        "start_url": ".",
        "display": "standalone",
        "theme_color": "#000000", // Customize this
        "background_color": "#ffffff" // Customize this
      }
    })
  ],
})
