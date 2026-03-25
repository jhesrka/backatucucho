import { AppDataSource } from '../src/data/postgres/data-source';

async function fix() {
    console.log("Initializing data source...");
    await AppDataSource.initialize();
    console.log("Connected to DB");
    await AppDataSource.query('ALTER TABLE campaign_log ADD COLUMN IF NOT EXISTS "dynamicAttributes" JSONB;');
    console.log("Column added successfully");
    await AppDataSource.destroy();
}

fix().catch(console.error);
