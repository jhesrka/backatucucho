import { AppDataSource } from "./src/data/postgres/data-source";

async function run() {
  try {
    await AppDataSource.initialize();
    console.log("Connected");
    await AppDataSource.query(`ALTER TABLE "negocio" ADD COLUMN IF NOT EXISTS "costoLead" numeric(10,2) NOT NULL DEFAULT '0.50'`);
    console.log("Success");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
