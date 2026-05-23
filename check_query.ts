import { AppDataSource } from "./src/data/postgres/data-source";
import { RechargeRequest } from "./src/data/postgres/models/rechargeStatus.model";

async function run() {
    await AppDataSource.initialize();
    
    const twoHoursAgo = new Date();
    twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);

    const qb = RechargeRequest.createQueryBuilder()
        .update(RechargeRequest)
        .set({ 
            status: "RECHAZADO" as any, 
            admin_comment: "Expirado automáticamente por inactividad" 
        })
        .where("status = :status AND created_at < :limitDate AND payment_method = 'CARD'", { 
            status: "PENDIENTE", 
            limitDate: twoHoursAgo 
        });

    console.log(qb.getQueryAndParameters());
    process.exit(0);
}

run().catch(console.error);
