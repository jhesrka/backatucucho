import { Negocio, User } from "./src/data";
import { DataSource } from "typeorm";
import { envs } from "./src/config";

const main = async () => {
    const ds = new DataSource({
        type: "postgres",
        host: envs.POSTGRES_HOST,
        port: envs.POSTGRES_PORT,
        username: envs.POSTGRES_USER,
        password: envs.POSTGRES_PASSWORD,
        database: envs.POSTGRES_DB,
        entities: [Negocio, User],
        synchronize: false,
    });

    await ds.initialize();

    // Usamos query cruda para evitar problemas de Enum en TypeORM
    const results = await ds.query('SELECT n.*, u.email as user_email FROM negocio n LEFT JOIN "user" u ON n."usuarioId" = u.id WHERE n.nombre IN (\'Gjhgvhgfj\', \'Zasfood\', \'La hueca parrillera\')');

    console.log("Businesses Found (RAW):");
    console.log(JSON.stringify(results, null, 2));

    const owners = [...new Set(results.map(r => r.user_email))];
    for (const owner of owners) {
        const allUserBusinesses = await ds.query('SELECT * FROM negocio WHERE "usuarioId" = (SELECT id FROM "user" WHERE email = $1)', [owner]);
        console.log(`\nUser ${owner} has ${allUserBusinesses.length} businesses in DB:`);
        console.log(JSON.stringify(allUserBusinesses, null, 2));
    }

    await ds.destroy();
};

main().catch(console.error);
