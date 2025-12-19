// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  assetsInclude: ["**/*.geojson"],

  // 🔥 IMPORTANT FIX - Hide source files in production
  build: {
    sourcemap: false,        // ❌ Disable source maps (hides source files)
    minify: "terser",        // ✔ Use terser for better obfuscation (hides code structure)
    outDir: "dist",          // ✔ Ensure only build output is created
    
    // Terser options for better obfuscation - REMOVES ALL SOURCE REFERENCES
    terserOptions: {
      compress: {
        drop_console: false,  // Keep console logs (set to true to remove all)
        drop_debugger: true,  // Remove debugger statements
        pure_funcs: ['console.debug'], // Remove specific console methods
        // Remove source file references
        module: true,
        passes: 3,            // Multiple passes for better minification
      },
      format: {
        comments: false,      // Remove ALL comments (including source references)
        preserve_annotations: false,
      },
      mangle: {
        toplevel: true,       // Obfuscate top-level names
        reserved: [],         // Don't reserve any names
        properties: {
          regex: /^_/,        // Mangle properties starting with _
          reserved: [],       // Don't reserve property names
        },
        keep_classnames: false,  // Obfuscate class names
        keep_fnames: false,      // Obfuscate function names
      },
      keep_classnames: false,
      keep_fnames: false,
    },
    
    // 📦 Code Splitting - Split large bundles with COMPLETELY GENERIC names
    rollupOptions: {
      output: {
        // COMPLETELY GENERIC file names - NO source hints
        chunkFileNames: 'assets/chunk-[hash].js',
        entryFileNames: 'assets/entry-[hash].js',
        assetFileNames: 'assets/asset-[hash].[ext]',
        
        // Sanitize any file paths that might leak source structure
        sanitizeFileName(name) {
          // Remove any path separators or source references
          return name.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
        },
        
        // Manual chunks with COMPLETELY GENERIC names
        manualChunks(id) {
          // Remove all source path information
          const cleanId = id.split('?')[0]; // Remove query params
          
          if (cleanId.includes('node_modules')) {
            // Use ONLY numbers/letters - NO library names visible
            if (cleanId.includes('react') || cleanId.includes('react-dom') || cleanId.includes('react-router')) {
              return 'v1';
            }
            if (cleanId.includes('leaflet')) {
              return 'v2';
            }
            if (cleanId.includes('recharts')) {
              return 'v3';
            }
            if (cleanId.includes('lucide-react') || cleanId.includes('react-icons') || cleanId.includes('framer-motion')) {
              return 'v4';
            }
            if (cleanId.includes('axios') || cleanId.includes('lodash') || cleanId.includes('date-fns') || cleanId.includes('jwt-decode')) {
              return 'v5';
            }
            if (cleanId.includes('xlsx') || cleanId.includes('papaparse') || cleanId.includes('jspdf') || cleanId.includes('html2canvas')) {
              return 'v6';
            }
            if (cleanId.includes('react-calendar') || cleanId.includes('react-datepicker')) {
              return 'v7';
            }
            return 'v8';
          }
          
          // Component chunks - use generic numbers only
          if (cleanId.includes('components')) {
            if (cleanId.includes('Map') || cleanId.includes('Farm')) {
              return 'c1';
            }
            if (cleanId.includes('Dashboard') || cleanId.includes('Dash')) {
              return 'c2';
            }
            if (cleanId.includes('List') || cleanId.includes('list')) {
              return 'c3';
            }
            return 'c4';
          }
        },
        
        // Remove source file paths from output
        generatedCode: {
          preset: 'es2015',
          constBindings: true,
        },
      },
      
      // Externalize nothing - bundle everything to hide dependencies
      external: [],
    },
    
    // Chunk size warning threshold
    chunkSizeWarningLimit: 600,
    
    // Report compressed size (gzipped)
    reportCompressedSize: true,
    
    // Don't emit asset files with source info
    assetsInlineLimit: 4096,
  },
  
  // Hide source file references in production
  define: {
    __DEV__: false,
    'process.env.NODE_ENV': '"production"',
  },
  
  // Disable dev source maps completely
  server: {
    sourcemapIgnoreList: () => {
      return true; // Ignore all source maps in dev too
    },
  },
});
