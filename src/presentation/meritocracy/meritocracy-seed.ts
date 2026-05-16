import { Pedido, UserMotorizado, EstadoPedido, PriceSettings } from "../../data";
import { v4 as uuidv4 } from 'uuid';

export const seedMockPedidos = async () => {
    const motorizados = await UserMotorizado.find();
    if (motorizados.length < 3) {
        console.log("No hay suficientes motorizados para el seed");
        return;
    }

    const config = await PriceSettings.findOne({ where: {} });
    const startDate = config?.lastRankingUpdate || new Date();
    startDate.setDate(startDate.getDate() - 5); // 5 días atrás

    console.log(`Generando pedidos ficticios desde ${startDate.toISOString()}`);

    // Distribución: 23, 25, 10, 2 (Total 60)
    const counts = [23, 25, 10, 2];
    
    for (let i = 0; i < counts.length; i++) {
        const moto = motorizados[i % motorizados.length];
        const count = counts[i];

        console.log(`Creando ${count} pedidos para ${moto.name}`);

        for (let j = 0; j < count; j++) {
            const pedido = new Pedido();
            pedido.id = uuidv4();
            pedido.estado = EstadoPedido.ENTREGADO;
            pedido.motorizado = moto;
            pedido.costoEnvio = 2.50;
            pedido.total = 10.00;
            pedido.ganancia_motorizado = 2.00;
            pedido.comision_app_domicilio = 0.50;
            pedido.porcentaje_motorizado_aplicado = 80;
            pedido.porcentaje_app_aplicado = 20;
            
            // Variar fechas dentro de los últimos 5 días
            const fecha = new Date(startDate);
            fecha.setHours(fecha.getHours() + Math.floor(Math.random() * 120));
            pedido.createdAt = fecha;
            pedido.updatedAt = fecha;

            await pedido.save();
        }
    }

    console.log("Seed completado con éxito");
};
