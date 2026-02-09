
require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
    host: process.env.HOST_DATABASE,
    port: process.env.PORT_DATABASE,
    user: process.env.USERNAME_DATABASE,
    password: process.env.PASSWORD_DATABASE,
    database: process.env.DATABASE,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        await client.connect();

        const businessId = '36a53408-4d75-4f96-928b-a8ffb840e753';
        console.log(`Checking counts for Business: ${businessId}`);

        const resPend = await client.query(`SELECT count(*) FROM pedido WHERE "negocioId" = '${businessId}' AND estado = 'PENDIENTE'`);
        console.log(`📊 PENDIENTE Count: ${resPend.rows[0].count}`);

        const resAcept = await client.query(`SELECT count(*) FROM pedido WHERE "negocioId" = '${businessId}' AND estado = 'ACEPTADO'`);
        console.log(`📊 ACEPTADO Count: ${resAcept.rows[0].count}`);

        const resTotal = await client.query(`SELECT count(*) FROM pedido WHERE "negocioId" = '${businessId}'`);
        console.log(`📊 TOTAL Count: ${resTotal.rows[0].count}`);

    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        await client.end();
    }
})();
