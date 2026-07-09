import "reflect-metadata";
import { PostgresDatabase } from "./src/data/postgres/init";
import { envs } from "./src/config";
import { Negocio } from "./src/data/postgres/models/Negocio";
import { Pedido } from "./src/data/postgres/models/pedido.model";

async function main() {
  await PostgresDatabase.connect({
    host: envs.DB_HOST,
    port: envs.DB_PORT,
    username: envs.DB_USERNAME,
    password: envs.DB_PASSWORD,
    database: envs.DB_DATABASE,
  });

  const negocios = await Negocio.find();
  for (const n of negocios) {
    const result = await Pedido.createQueryBuilder("pedido")
      .select("AVG(pedido.ratingNegocio)", "avg")
      .addSelect("COUNT(pedido.id)", "count")
      .where("pedido.negocioId = :id", { id: n.id })
      .andWhere("pedido.ratingNegocio IS NOT NULL")
      .getRawOne();
      
    const newAvg = Number(result?.avg) || 0;
    const newCount = Number(result?.count) || 0;
    
    n.ratingPromedio = newAvg;
    n.totalResenas = newCount;
    await n.save();
    console.log("Negocio " + n.nombre + ": avg " + newAvg + ", count " + newCount);
  }
  process.exit(0);
}
main();
