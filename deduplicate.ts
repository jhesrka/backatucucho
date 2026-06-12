import "reflect-metadata";
import "dotenv/config";
import { envs } from "./src/config";
import { PostgresDatabase } from "./src/data";
import { CategoriaServicio } from "./src/data/postgres/models/CategoriaServicio";

async function deduplicate() {
  const postgres = new PostgresDatabase({
    username: envs.DB_USERNAME,
    password: envs.DB_PASSWORD,
    host: envs.DB_HOST,
    database: envs.DB_DATABASE,
    port: envs.DB_PORT,
  });

  await postgres.connect();
    
    const categories = await CategoriaServicio.find();
    
    // Group by name
    const groups: { [key: string]: CategoriaServicio[] } = {};
    for (const cat of categories) {
        if (!groups[cat.nombre]) groups[cat.nombre] = [];
        groups[cat.nombre].push(cat);
    }
    
    let deletedCount = 0;
    for (const name in groups) {
        const group = groups[name];
        if (group.length > 1) {
            // Sort by createdAt ASC (keep the first one)
            group.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            
            // Delete all except the first one
            for (let i = 1; i < group.length; i++) {
                console.log(`Borrando duplicado de ${name} con ID ${group[i].id}`);
                await CategoriaServicio.remove(group[i]);
                deletedCount++;
            }
        }
    }
    
    console.log(`Limpieza completada. ${deletedCount} duplicados eliminados.`);
    process.exit(0);
}

deduplicate().catch(err => {
    console.error(err);
    process.exit(1);
});
