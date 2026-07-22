import { CategoriaNegocio, StatusCategoria } from "../data/postgres/models/CategoriaNegocio";

export const seedCreditoCategory = async () => {
    try {
        const creditoExistente = await CategoriaNegocio.findOne({ where: { esParaCredito: true } });
        if (!creditoExistente) {
            const nuevaCategoria = new CategoriaNegocio();
            nuevaCategoria.nombre = "Créditos y Servicios";
            nuevaCategoria.icono = "https://cdn-icons-png.flaticon.com/512/2830/2830284.png"; 
            nuevaCategoria.esParaCredito = true;
            nuevaCategoria.statusCategoria = StatusCategoria.ACTIVO;
            await nuevaCategoria.save();
            console.log("✅ Categoría 'Créditos y Servicios' creada automáticamente.");
        }
    } catch (error) {
        console.error("❌ Error al inicializar la categoría de crédito:", error);
    }
};
