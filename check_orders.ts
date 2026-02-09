
import { DataSource } from 'typeorm';
import { envs } from './src/config/envs';
import { Pedido } from './src/data/postgres/models/Pedido';
import { Negocio } from './src/data/postgres/models/Negocio';
import { User } from './src/data/postgres/models/user.model';
import { ProductoPedido } from './src/data/postgres/models/ProductoPedido';
// Add basic entities to avoid relation errors if strict

const AppDataSource = new DataSource({
    type: 'postgres',
    url: envs.POSTGRES_URL,
    entities: [Pedido, Negocio, User, ProductoPedido], // Minimal set
    synchronize: false,
    ssl: false,
});

async function checkOrders() {
    try {
        await AppDataSource.initialize();
        const businessId = '36a53408-4d75-4f96-928b-a8ffb840e753';

        console.log('Checking Business:', businessId);
        const business = await Negocio.findOne({ where: { id: businessId } });
        console.log('Business Found:', business ? business.nombre : 'Not Found');

        if (business) {
            const orders = await Pedido.find({
                where: { negocio: { id: businessId } },
                order: { createdAt: 'DESC' }
            });
            console.log('Total Orders found:', orders.length);
            orders.forEach(o => {
                console.log(`Order ${o.id.slice(0, 8)}: Status=${o.estado} | Created=${o.createdAt}`);
            });
        }
    } catch (error) {
        console.error("Error:", error);
    } finally {
        if (AppDataSource.isInitialized) await AppDataSource.destroy();
    }
}

checkOrders();
