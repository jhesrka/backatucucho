
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
        console.log(`Checking deletedAt for PENDIENTE orders...`);

        // Use * to see all columns if unsure names
        const res = await client.query(`
            SELECT *
            FROM pedido 
            WHERE "negocioId" = '${businessId}' 
            AND estado = 'PENDIENTE'
            LIMIT 1
        `);

        if (res.rows.length === 0) {
            console.log("No rows found properly...?");
        } else {
            const row = res.rows[0];
            console.log("Sample Row Keys:", Object.keys(row));
            console.log("DeletedAt Value:", row.deletedAt || row.deleted_at || "Undefined in obj");
        }

    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        await client.end();
    }
})();
