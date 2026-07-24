import { z } from "zod";

const provisionEnvSchema = z.object({
  API_URL: z
    .string()
    .url()
    .refine(
      (url) => {
        const hostname = new URL(url).hostname;
        return (
          hostname === "127.0.0.1" ||
          hostname === "localhost" ||
          hostname === "::1"
        );
      },
      { message: "Provisioning requires a loopback Supabase URL." },
    ),
  SERVICE_ROLE_KEY: z.string().min(1),
  CI_ADMIN_EMAIL: z.string().email(),
  CI_ADMIN_PASSWORD: z.string().min(8),
  CI_ADMIN_STORE_NAME: z.string().min(1).max(120),
  CI_ADMIN_STORE_SLUG: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  CI_ADMIN_WHATSAPP_PHONE: z.string().regex(/^[1-9][0-9]{7,14}$/),
  CI_ADMIN_ORIGIN_LABEL: z.string().min(1).max(255),
  CI_ADMIN_ORIGIN_ADDRESS: z.string().min(1).max(500),
  CI_ADMIN_ORIGIN_RAJAONGKIR_ID: z.string().min(1),
  CI_ADMIN_ORIGIN_RAJAONGKIR_LEVEL: z.enum(["district", "subdistrict"]),
});

export type ProvisionEnv = z.infer<typeof provisionEnvSchema>;

export function parseProvisionEnv(env: Record<string, string | undefined>): ProvisionEnv {
  if (env.GITHUB_ACTIONS !== "true") {
    throw new Error(
      "Provisioning may run only in GitHub Actions (GITHUB_ACTIONS=true).",
    );
  }

  return provisionEnvSchema.parse({
    API_URL: env.API_URL,
    SERVICE_ROLE_KEY: env.SERVICE_ROLE_KEY,
    CI_ADMIN_EMAIL: env.CI_ADMIN_EMAIL,
    CI_ADMIN_PASSWORD: env.CI_ADMIN_PASSWORD,
    CI_ADMIN_STORE_NAME: env.CI_ADMIN_STORE_NAME,
    CI_ADMIN_STORE_SLUG: env.CI_ADMIN_STORE_SLUG,
    CI_ADMIN_WHATSAPP_PHONE: env.CI_ADMIN_WHATSAPP_PHONE,
    CI_ADMIN_ORIGIN_LABEL: env.CI_ADMIN_ORIGIN_LABEL,
    CI_ADMIN_ORIGIN_ADDRESS: env.CI_ADMIN_ORIGIN_ADDRESS,
    CI_ADMIN_ORIGIN_RAJAONGKIR_ID: env.CI_ADMIN_ORIGIN_RAJAONGKIR_ID,
    CI_ADMIN_ORIGIN_RAJAONGKIR_LEVEL: env.CI_ADMIN_ORIGIN_RAJAONGKIR_LEVEL,
  });
}
