import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            "/users": {
                target: "http://127.0.0.1:8000",
                changeOrigin: true,
            },
            "/ballots": {
                target: "http://127.0.0.1:8000",
                changeOrigin: true,
            },
            "/candidates": {
                target: "http://127.0.0.1:8000",
                changeOrigin: true,
            },
            "/legislation": {
                target: "http://127.0.0.1:8000",
                changeOrigin: true,
            },
            "/meetings": {
                target: "http://127.0.0.1:8000",
                changeOrigin: true,
            },
            "/elections": {
                target: "http://127.0.0.1:8000",
                changeOrigin: true,
            },
            "/notifications": {
                target: "http://127.0.0.1:8000",
                changeOrigin: true,
            },
            "/ai": {
                target: "http://127.0.0.1:8000",
                changeOrigin: true,
            },
            "/polling": {
                target: "http://127.0.0.1:8000",
                changeOrigin: true,
            },
            "/health": {
                target: "http://127.0.0.1:8000",
                changeOrigin: true,
            },
        },
    },
});
