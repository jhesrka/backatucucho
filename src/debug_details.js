
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
        console.log(`Checking details for PENDIENTE orders WITHOUT deletedAt...`);

        const res = await client.query(`
            SELECT id, estado, "negocioId"
            FROM pedido 
            WHERE "negocioId" = '${businessId}' 
            AND estado = 'PENDIENTE'
            LIMIT 5
        `);

        console.log(`Found ${res.rowCount} PENDIENTE rows.`);
        res.rows.forEach(r => {
            console.log(`- ID: ${r.id}, NegocioFK: ${r.negocioId}`);
        });

    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        await client.end();
    }
})();
