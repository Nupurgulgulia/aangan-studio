import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  functions: {
    aangan: {
      name: "Aangan voice agent tools",
      source: "src/index.ts",
      env: {
        AGENT_API_KEY: process.env.AGENT_API_KEY!,
        TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN!,
        TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET!,
        HUBSPOT_TOKEN: process.env.HUBSPOT_TOKEN!,
      },
    },
  },
});
