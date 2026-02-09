
import { AppDataSource } from "./src/data/postgres/data-source";

async function verify() {
    try {
        await AppDataSource.initialize();
        const queryRunner = AppDataSource.createQueryRunner();
        const columns = await queryRunner.query(`
            SELECT column_name
            FROM information_schema.columns 
            WHERE table_name = 'financial_closings';
        `);
        console.log("COLUMNS:" + columns.map((c: any) => c.column_name).join(", "));
        await queryRunner.release();
        await AppDataSource.destroy();
    } catch (error) {
        console.error("Error verifying database:", error);
    }
}

verify();
