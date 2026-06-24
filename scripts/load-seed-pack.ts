import { getSeedPack, listSeedPacks } from "../tests/fixtures/seed-packs";

function main() {
  const name = process.argv[2];
  if (!name) {
    console.log("Available seed packs:");
    for (const p of listSeedPacks()) {
      console.log(`  ${p.name} — ${p.description}`);
    }
    process.exit(1);
  }
  const pack = getSeedPack(name);
  if (!pack) {
    console.error(`Unknown seed pack "${name}".`);
    console.log("Available:", listSeedPacks().map((p) => p.name).join(", "));
    process.exit(1);
  }
  console.log(`Loaded seed pack: ${pack.name}`);
  console.log(`  Description: ${pack.description}`);
  console.log(`  Outages: ${pack.outages.length}`);
  console.log(`  Webhooks: ${pack.webhooks.length}`);
  console.log(`  Deliveries: ${pack.deliveries.length}`);
}

main();
