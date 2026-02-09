
import { AppDataSource } from "./src/data/postgres/data-source";

async function fix() {
    try {
        await AppDataSource.initialize();
        console.log("Data Source initialized");

        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();

        console.log("Checking columns for financial_closings...");

        // Add totalUserBalance if missing
        await queryRunner.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='financial_closings' AND COLUMN_NAME='totalUserBalance') THEN
                    ALTER TABLE "financial_closings" ADD COLUMN "totalUserBalance" decimal(10,2) DEFAULT 0;
                END IF;
            END $$;
        `);
        console.log("Column totalUserBalance checked/added");

        // Add totalMotorizadoDebt if missing
        await queryRunner.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='financial_closings' AND COLUMN_NAME='totalMotorizadoDebt') THEN
                    ALTER TABLE "financial_closings" ADD COLUMN "totalMotorizadoDebt" decimal(10,2) DEFAULT 0;
                END IF;
            END $$;
        `);
        console.log("Column totalMotorizadoDebt checked/added");

        await queryRunner.release();
        await AppDataSource.destroy();
        console.log("Done");
    } catch (error) {
        console.error("Error updating database:", error);
    }
}

fix();
