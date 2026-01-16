import {
    Negocio,
    Status,
    User,
} from "../../data";
import {
    CustomError,
    LoginUserDTO,
} from "../../domain";
import { encriptAdapter, envs, JwtAdapter } from "../../config";
import { UploadFilesCloud } from "../../config/upload-files-cloud-adapter";

export class BusinessService {
    constructor() { }

    async loginBusiness(credentials: LoginUserDTO) {
        // 1. Buscar usuario
        const user = await User.findOne({
            where: {
                email: credentials.email,
                status: Status.ACTIVE,
            },
            relations: ["negocios"],
        });

        if (!user) {
            throw CustomError.unAuthorized("Usuario o contraseña inválidos");
        }

        // 2. Validar contraseña
        const isMatching = encriptAdapter.compare(
            credentials.password,
            user.password
        );
        if (!isMatching)
            throw CustomError.unAuthorized("Usuario o contraseña inválidos");

        // 3. Validar si tiene negocios
        if (!user.negocios || user.negocios.length === 0) {
            throw CustomError.forbiden(
                "Debes crear primero un negocio para poder ingresar al panel de negocios de Atucucho Shop"
            );
        }

        // 4. Generar JWT
        const token = await JwtAdapter.generateToken(
            { id: user.id },
            envs.JWT_EXPIRE_IN
        );
        if (!token) throw CustomError.internalServer("Error generando Jwt");

        // 5. Preparar respuesta con foto
        let urlPhoto = "";
        if (user.photoperfil) {
            urlPhoto = await UploadFilesCloud.getFile({
                bucketName: envs.AWS_BUCKET_NAME,
                key: user.photoperfil,
            });
        }

        // Resolver imagenes de negocios
        const negociosWithImages = await Promise.all(user.negocios.map(async (n) => {
            let img = "";
            if (n.imagenNegocio) {
                try {
                    img = await UploadFilesCloud.getFile({
                        bucketName: envs.AWS_BUCKET_NAME,
                        key: n.imagenNegocio,
                    });
                } catch (e) { console.log("Error imagen negocio", e); }
            }
            return {
                id: n.id,
                nombre: n.nombre,
                imagenNegocio: img,
                statusNegocio: n.statusNegocio,
                modeloMonetizacion: n.modeloMonetizacion
            };
        }));

        // Retornamos token, usuario y sus negocios (para que seleccione)
        return {
            token,
            user: {
                id: user.id,
                name: user.name,
                surname: user.surname,
                email: user.email,
                photoperfil: urlPhoto,
            },
            negocios: negociosWithImages
        };
    }

    async getMyBusinesses(userId: string) {
        const user = await User.findOne({
            where: { id: userId },
            relations: ["negocios"],
        });

        if (!user) throw CustomError.notFound("Usuario no encontrado");

        // Mapear respuesta
        const negociosWithImages = await Promise.all(user.negocios.map(async (n) => {
            let img = "";
            if (n.imagenNegocio) {
                try {
                    img = await UploadFilesCloud.getFile({
                        bucketName: envs.AWS_BUCKET_NAME,
                        key: n.imagenNegocio,
                    });
                } catch (e) { console.log("Error imagen negocio", e); }
            }
            return {
                id: n.id,
                nombre: n.nombre,
                descripcion: n.descripcion,
                imagenNegocio: img,
                statusNegocio: n.statusNegocio,
                modeloMonetizacion: n.modeloMonetizacion
            };
        }));

        return negociosWithImages;
    }

    // ==========================================
    // 📦 GESTIÓN DE PEDIDOS (Business)
    // ==========================================

    async getOrdersByBusiness(businessId: string, status?: string | string[], page: number = 1, limit: number = 10) {
        // Validar que el negocio exista
        const negocio = await Negocio.findOne({ where: { id: businessId } });
        if (!negocio) throw CustomError.notFound("Negocio no encontrado");

        // Construir query
        const queryOrder: any = {
            negocio: { id: businessId },
        };

        if (status) {
            if (Array.isArray(status)) {
                // Si es array, usar In()
                const { In } = await import("typeorm");
                queryOrder.estado = In(status);
            } else if (status === 'NOT_PENDING') {
                // Filtro especial para historial (Todo lo que NO sea PENDIENTE)
                const { Not } = await import("typeorm");
                const EstadoPedido = (await import("../../data")).EstadoPedido;
                queryOrder.estado = Not(EstadoPedido.PENDIENTE);
            } else {
                queryOrder.estado = status;
            }
        }

        const skip = (page - 1) * limit;

        const [orders, total] = await import("../../data").then(({ Pedido }) => Pedido.findAndCount({
            where: queryOrder,
            relations: ["productos", "productos.producto", "cliente", "motorizado"],
            order: { createdAt: "DESC" },
            take: limit,
            skip: skip
        }));

        return {
            orders,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        };
    }

    async updateOrderStatus(businessId: string, orderId: string, status: string, motivoCancelacion?: string) {
        // Validar que el pedido pertenezca al negocio
        const Pedido = (await import("../../data")).Pedido;
        const EstadoPedido = (await import("../../data")).EstadoPedido;

        const order = await Pedido.findOne({
            where: { id: orderId, negocio: { id: businessId } },
            relations: ["cliente"]
        });

        if (!order) throw CustomError.notFound("Pedido no encontrado o no pertenece a este negocio");

        // Reglas de negocio: Solo puede pasar a PREPARANDO o CANCELADO
        if (status === EstadoPedido.PREPARANDO) {
            if (order.estado !== EstadoPedido.PENDIENTE) {
                throw CustomError.badRequest("Solo se pueden aceptar pedidos en estado PENDIENTE");
            }
            order.estado = EstadoPedido.PREPARANDO;
        } else if (status === EstadoPedido.CANCELADO) {
            if (!motivoCancelacion) throw CustomError.badRequest("Se requiere un motivo para cancelar");
            order.estado = EstadoPedido.CANCELADO;
            order.motivoCancelacion = motivoCancelacion;
            // TODO: Notificar al usuario (Socket/Push)
        } else {
            throw CustomError.badRequest("Estado no permitido para el negocio");
        }

        await order.save();
        return order;
    }

    // ==========================================
    // 💰 GESTIÓN FINANCIERA
    // ==========================================

    async getFinanceSummary(businessId: string, date?: string) {
        const { Between, FindOperator } = await import("typeorm");
        const { Pedido, MetodoPago, BalanceNegocio, EstadoBalance } = await import("../../data");

        // 1. Definir rango de fecha (Día específico)
        const targetDate = date ? new Date(date) : new Date();
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        // 2. Buscar si ya existe un Balance Snapshot para este día
        let balanceSnapshot = await BalanceNegocio.findOne({
            where: {
                negocio: { id: businessId } as any,
                fecha: Between(startOfDay, endOfDay) as any
            }
        });

        // 3. Calcular en tiempo real (siempre recalculamos para mantener consistencia hasta que esté LIQUIDADO)
        // NOTA: Si está LIQUIDADO, podríamos retornar el snapshot, pero si hay cambios en pedidos post-cierre, 
        // lo mejor es recalcular o bloquear cambios. Por ahora recalculamos para mostrar siempre la verdad.

        const orders = await Pedido.find({
            where: {
                negocio: { id: businessId },
                createdAt: Between(startOfDay, endOfDay),
            },
            relations: ["productos", "productos.producto"]
        });

        const validOrders = orders.filter(o => o.estado !== "CANCELADO");

        let totalVendido = 0; // Productos
        let totalComision = 0;
        let totalDelivery = 0;

        let totalEfectivo = 0;      // (Prod + Delivery) recibido en efectivo
        let totalTransferencia = 0; // (Prod + Delivery) recibido por transferencia

        let deudaNegocioApp = 0; // El negocio tiene el dinero (Efectivo), debe dar comisión + delivery a App (si aplica)
        // Corrección Lógica User:
        // Caso Efectivo: Negocio tiene (Productos + Domicilio).
        // App debe pagar al negocio: La comisión? No.
        // User dice: "Caso 2: Solo efectivo... La app debe pagar al negocio la comisión correspondiente". 
        // WAIT. Si es Efectivo, el CLIENTE le dio el dinero al Chofer o al Negocio?
        // En este sistema, 'Efectivo' suele ser Contraentrega. El motorizado cobra.
        // Si Motorizado cobra (es App), entonces App tiene el dinero.
        // PERO user request dice: "El negocio ya entregó: Productos, Domicilio. En este caso: La app debe pagar al negocio".
        // Esto implica que el negocio NO recibió el dinero directamente.

        let deudaAppNegocio = 0; // La app tiene el dinero, debe pagar al negocio.

        validOrders.forEach(order => {
            const totalProd = Number(order.total) || 0; // Total productos
            const delivery = Number(order.costoEnvio) || 0;
            const comision = Number(order.comisionTotal) || 0;

            // "Total Pagado" = Productos + Domicilio (User says: "Total pagado ✅ Incluye productos + costo de domicilio")
            const totalPagado = totalProd + delivery;

            totalVendido += totalProd;
            totalComision += comision;
            totalDelivery += delivery;

            // Lógica Global: El negocio SIEMPRE debe la comisión a la App
            deudaNegocioApp += comision;

            if (order.metodoPago === MetodoPago.EFECTIVO) {
                totalEfectivo += totalPagado;

                // Caso Efectivo:
                // El dinero (Prod + Del) lo tiene el Motorizado/App.
                // La App tiene el dinero de los Productos del Negocio.
                // App debe devolver el valor de los productos al negocio.
                deudaAppNegocio += totalProd;

            } else {
                // Caso Transferencia:
                // El dinero (Prod + Del) entra a la cuenta del Negocio.
                totalTransferencia += totalPagado;

                // El Negocio tiene el dinero del Delivery (que es del Motorizado/App).
                // Negocio debe pagar el Delivery a la App.
                deudaNegocioApp += delivery;
            }
        });

        // Caso 3: Transferencia + Efectivo (Balance Neto)
        // "Sumar lo que negocio debe a app (deudaNegocioApp) - Restar lo que app debe a negocio (deudaAppNegocio)"
        // Balance Final = deudaNegocioApp - deudaAppNegocio.
        // Si Positivo: Negocio debe pagar a App.
        // Si Negativo: App debe pagar a Negocio.
        // User Example: "Balance Neto... Puede ser: El negocio debe pagar / La app debe pagar".

        const balanceFinal = deudaNegocioApp - deudaAppNegocio;

        // Guardar o Actualizar Snapshot
        // Solo creamos/actualizamos si no está pagado/liquidado (o si queremos actualizar montos en PENDIENTE)
        if (!balanceSnapshot) {
            balanceSnapshot = new BalanceNegocio();
            balanceSnapshot.negocio = { id: businessId } as any;
            balanceSnapshot.fecha = startOfDay;
        }

        if (balanceSnapshot.estado !== EstadoBalance.LIQUIDADO) {
            balanceSnapshot.totalVendido = totalVendido;
            balanceSnapshot.totalComision = totalComision;
            balanceSnapshot.totalDelivery = totalDelivery;
            balanceSnapshot.totalEfectivo = totalEfectivo;
            balanceSnapshot.totalTransferencia = totalTransferencia;
            balanceSnapshot.balanceFinal = balanceFinal;
            await balanceSnapshot.save();
        }

        return {
            snapshot: balanceSnapshot, // Contains id, status, balance, etc.
            detail: {
                totalVendido,
                totalComision,
                totalDelivery,
                totalEfectivo,
                totalTransferencia,
                deudaNegocioApp,
                deudaAppNegocio,
                balanceFinal
            },
            orders: validOrders.map(o => ({
                id: o.id,
                totalProductos: Number(o.total),
                totalPagado: Number(o.total) + Number(o.costoEnvio),
                metodoPago: o.metodoPago,
                estado: o.estado,
                comision: Number(o.comisionTotal),
                createdAt: o.createdAt
            }))
        };
    }



    async registerPayment(businessId: string, date: string, file: any) {
        const { BalanceNegocio, EstadoBalance } = await import("../../data");
        const { Between } = await import("typeorm");

        const targetDate = new Date(date);
        const startOfDay = new Date(targetDate); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate); endOfDay.setHours(23, 59, 59, 999);

        let balanceSnapshot = await BalanceNegocio.findOne({
            where: {
                negocio: { id: businessId },
                fecha: Between(startOfDay, endOfDay) as any
            }
        });

        if (!balanceSnapshot) {
            throw CustomError.badRequest("No existe reporte financiero para esta fecha.");
        }

        // Subir archivo
        let urlComprobante = "";
        if (file) {
            const fileKey = `comprobantes/${Date.now()}_${file.name}`;
            urlComprobante = await UploadFilesCloud.uploadSingleFile({
                bucketName: envs.AWS_BUCKET_NAME,
                key: fileKey,
                body: file.data,
                contentType: file.mimetype
            });
            // Guardamos la URL prefirmada? O la KEY?
            // El modelo espera string. Guardemos la Key para persistencia a largo plazo, 
            // pero para mostrarla necesitamos firmarla cada vez.
            // Por simplicidad en esta demo, guardemos la KEY.
            // Para verla en frontend, necesitariamos un endpoint que resuelva la URL o firmarla al obtener el balance.
            // En `loginBusiness` resolvemos las imagenes. Hagamos lo mismo en `getFinanceSummary`?
            // Mejor: UploadFilesCloud.getFile devuelve URL firmada.
            // Guardamos KEY en DB.
            balanceSnapshot.comprobanteUrl = fileKey;
        }

        balanceSnapshot.estado = EstadoBalance.PAGADO;
        // User request: "Una vez pagado... marca dia como liquidado"
        balanceSnapshot.estado = EstadoBalance.LIQUIDADO;

        await balanceSnapshot.save();

        return balanceSnapshot;
    }
}
