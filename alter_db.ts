import { AppDataSource } from './src/data/postgres/data-source';

async function run() {
    await AppDataSource.initialize();
    await AppDataSource.query(`ALTER TABLE "user" ALTER COLUMN "birthday" DROP NOT NULL;`);
    console.log("Success");
    process.exit(0);
}

run().catch(console.error);
