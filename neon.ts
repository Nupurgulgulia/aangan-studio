import { defineConfig } from "@neon/config/v1";

const env = (name: string) => process.env[name] ?? "";

export default defineConfig({
  functions: {
    aangan: {
      name: "Aangan voice agent tools",
      source: "src/index.ts",
      env: {
        AGENT_API_KEY: env("AGENT_API_KEY"),
        RESEND_API_KEY: env("RESEND_API_KEY"),
        EMAIL_FROM: env("EMAIL_FROM"),
        ESCALATION_EMAIL: env("ESCALATION_EMAIL"),
        APP_URL: env("APP_URL"),
        HUBSPOT_TOKEN: env("HUBSPOT_TOKEN"),
        VAANI_AGENT_URL: env("VAANI_AGENT_URL"),
        TELEGRAM_BOT_TOKEN: env("TELEGRAM_BOT_TOKEN"),
        TELEGRAM_WEBHOOK_SECRET: env("TELEGRAM_WEBHOOK_SECRET"),
      },
    },
  },
});
