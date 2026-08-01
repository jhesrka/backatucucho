import { AppDataSource } from "./src/data/postgres/data-source";

async function addColumns() {
  try {
    await AppDataSource.initialize();
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    
    // Add columns if they don't exist
    await queryRunner.query(`ALTER TABLE "negocio" ADD COLUMN IF NOT EXISTS "modo_operacion" character varying DEFAULT 'MANUAL'`);
    await queryRunner.query(`ALTER TABLE "negocio" ADD COLUMN IF NOT EXISTS "hora_apertura" character varying`);
    await queryRunner.query(`ALTER TABLE "negocio" ADD COLUMN IF NOT EXISTS "hora_cierre" character varying`);
    
    console.log("Columns added successfully!");
    
    await queryRunner.release();
    await AppDataSource.destroy();
  } catch (error) {
    console.error("Error adding columns:", error);
  }
}

addColumns();
