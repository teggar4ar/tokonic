import { parseProvisionEnv } from "./lib/provision-env";
import { provisionAdmin } from "./lib/provision-admin";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const env = parseProvisionEnv(process.env);

  if (dryRun) {
    console.log("Dry run: environment validated successfully.");
    console.log(`Target: ${env.API_URL}`);
    console.log(`Admin email: ${env.CI_ADMIN_EMAIL}`);
    console.log(`Store slug: ${env.CI_ADMIN_STORE_SLUG}`);
    return;
  }

  const result = await provisionAdmin(env);

  const action = result.created ? "Created" : "Updated";
  console.log(`${action} CI admin (auth_user_id: ${result.authUserId})`);
  console.log(`Linked seller row (seller_id: ${result.sellerId})`);
}

main().catch((err) => {
  console.error("Provisioning failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
