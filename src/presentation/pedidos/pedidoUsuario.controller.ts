import { Request, Response } from "express";
import { CreatePedidoDTO, CustomError, CalificarPedidoDTO } from "../../domain";
import { PedidoUsuarioService } from "../services/pedidosServices/pedidoUsuario.service";
import { PayphoneService } from "../services/payphone.service";
import { Pedido, Negocio } from "../../data";

export class PedidoUsuarioController {
  constructor(private readonly pedidoUsuarioService: PedidoUsuarioService) { }

  private handleError = (error: any, res: Response) => {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    
    // Check if it's an Axios/Payphone error
    if (error?.response?.data) {
        return res.status(400).json({ 
            message: "Error al preparar pago con Payphone", 
            error: error.response.data 
        });
    }

    console.error("Unhandled error:", error);
    return res.status(500).json({ message: "Something went very wrong", detail: error.message });
  };
  // ======================== Calcular envío ========================
  calcularEnvio = async (req: Request, res: Response) => {
    try {
      const { negocioId, lat, lng } = req.body;

      if (!negocioId || !lat || !lng) {
        return res
          .status(400)
          .json({ message: "Faltan datos: negocioId, lat o lng" });
      }

      const result = await PedidoUsuarioService.calcularEnvio({
        negocioId,
        lat,
        lng,
      });

      return res.status(200).json(result); // { distanciaKm, costoEnvio }
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  // ======================== Subir Comprobante ========================
  subirComprobante = async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "No se subió ningún archivo" });
      }

      const result = await this.pedidoUsuarioService.subirComprobante(file);
      return res.status(200).json(result);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  // ======================== Crear pedido ========================
  crearPedido = async (req: Request, res: Response) => {
    try {
      const fs = require('fs');
      const logPath = 'c:/Users/jhesr/OneDrive/Escritorio/academlo/proyectReales/atucuchoShop/atucuchoFull/atucuchoBack/tmp/order_debug.log';
      fs.appendFileSync(logPath, `[${new Date().toISOString()}] CONTROLLER: request body=${JSON.stringify(req.body)}\n`);

      // Validar y tipar el body con tu patrón de DTO
      const [err, dto] = CreatePedidoDTO.create(req.body);
      if (err) {
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] CONTROLLER ERROR: ${err}\n`);
        return res.status(400).json({ message: err });
      }

      fs.appendFileSync(logPath, `[${new Date().toISOString()}] CONTROLLER SUCCESS: calling service\n`);
      const pedido = await this.pedidoUsuarioService.crearPedido(dto!);
      return res.status(201).json(pedido);
    } catch (error) {
      return this.handleError(error, res);
    }
  };
  // ======================== Obtener pedidos de un cliente ========================
  obtenerPedidosCliente = (req: Request, res: Response) => {
    const clienteId = req.params.clienteId;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 5;

    const filters = {
      estado: req.query.estado as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    };

    if (!clienteId) {
      return res.status(400).json({ message: "Falta el ID del cliente" });
    }

    this.pedidoUsuarioService
      .obtenerPedidosCliente(clienteId, page, limit, filters)
      .then((result) => res.status(200).json(result))
      .catch((error) => this.handleError(error, res));
  };

  // ======================== Eliminar pedido del cliente ========================
  eliminarPedidoCliente = (req: Request, res: Response) => {
    const pedidoId = req.params.pedidoId;
    const clienteId = req.params.clienteId; // 👈 igual que en obtenerPedidosCliente

    if (!pedidoId) {
      return res.status(400).json({ message: "Falta el ID del pedido" });
    }
    if (!clienteId) {
      return res.status(400).json({ message: "Falta el ID del cliente" });
    }

    this.pedidoUsuarioService
      .eliminarPedidoCliente(pedidoId, clienteId)
      .then((result) => res.status(200).json(result))
      .catch((error) => this.handleError(error, res));
  };

  notificarYaVoy = (req: Request, res: Response) => {
    const { pedidoId, clienteId } = req.body;

    if (!pedidoId || !clienteId) {
      return res.status(400).json({ message: "Faltan datos: pedidoId o clienteId" });
    }

    this.pedidoUsuarioService
      .notificarYaVoy(pedidoId, clienteId)
      .then((result) => res.status(200).json(result))
      .catch((error) => this.handleError(error, res));
  };

  calificarPedido = (req: Request, res: Response) => {
    const [err, dto] = CalificarPedidoDTO.create(req.body);
    if (err) return res.status(400).json({ message: err });

    this.pedidoUsuarioService
      .calificarPedido(dto!)
      .then((result) => res.status(200).json(result))
      .catch((error) => this.handleError(error, res));
  };

  confirmarPago = async (req: Request, res: Response) => {
    try {
        const { id, clientTransactionId } = req.body;
        if (!id || !clientTransactionId) {
            return res.status(400).json({ message: "Faltan id o clientTransactionId" });
        }

        const result = await this.pedidoUsuarioService.confirmarPago(+id, clientTransactionId);
        return res.status(200).json(result);
    } catch (error) {
        return this.handleError(error, res);
    }
  };

  runSqlUpdate = async (req: Request, res: Response) => {
    try {
        console.log("🛠️ RUNNING REMOTE SQL UPDATE...");
        const repo = Pedido.getRepository();
        
        // DEBUG: Listar tablas
        const tables = await repo.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
        const tableNames = tables.map((t: any) => t.table_name);
        console.log("📦 TABLES FOUND:", tableNames);

        const negocioTable = tableNames.find((t: string) => t.toLowerCase() === 'negocio' || t.toLowerCase() === 'negocios');
        if (!negocioTable) {
            return res.status(404).json({ message: "No se encontró la tabla de negocios", tables: tableNames });
        }

        // 1. Asegurar columnas en la tabla detectada
        try { await repo.query(`ALTER TABLE "${negocioTable}" ADD COLUMN IF NOT EXISTS payphone_store_id VARCHAR(255)`); } catch(e) {}
        try { await repo.query(`ALTER TABLE "${negocioTable}" ADD COLUMN IF NOT EXISTS payphone_token TEXT`); } catch(e) {}
        try { await repo.query(`ALTER TABLE "${negocioTable}" ADD COLUMN IF NOT EXISTS pago_tarjeta_habilitado_admin BOOLEAN DEFAULT false`); } catch(e) {}
        try { await repo.query(`ALTER TABLE "${negocioTable}" ADD COLUMN IF NOT EXISTS pago_tarjeta_activo_negocio BOOLEAN DEFAULT false`); } catch(e) {}

        // 2. Ejecutar los ALTER TYPE (con catch por si ya existen)
        try { await repo.query("ALTER TYPE pedido_metodopago_enum ADD VALUE 'TARJETA'"); } catch(e) {}
        try { await repo.query("ALTER TYPE pedido_estadopago_enum ADD VALUE 'PENDIENTE_PAGO'"); } catch(e) {}
        
        // 3. Ejecutar el UPDATE del Token
        const updateQuery = `
            UPDATE "${negocioTable}" 
            SET payphone_token = 'vpjt10qzGo_qil6fK0WfcyXDJGkW-cRlTjzJ-r-n2P6iC3o2zvv-KDc-TSZhQRTLgLarxFFGOutlHguWIob6YndPrEfV72Xx9CT1_z9qKGlmRTVloxwqmujlALzzLbveiYP7ujbiBI0zUOXO7hxhoSQg9A3HYLhyWpC-Ykf_KJCoUOrS45M9NuKeUxI0jXTHY5ljvwvcUWBCjH_gnkWrNM_Mxg-wiIdcPEQNV5Kts04vvDXUEoeu1Nl5krQDpfCEn79y5i_ZY_igGqAL-6SmX15IgcoiP--UNP1bDUNultg6ONT85Eb56GQiMQ64UMa4DNkHM3FVeR3QCIqi8sDMB3YRbEA', 
                payphone_store_id = 'ad2cd115-920f-47e4-98c8-d734ab3ede81',
                pago_tarjeta_habilitado_admin = true,
                pago_tarjeta_activo_negocio = true
            WHERE nombre ILIKE '%Hueca Parrillera%'
        `;
        await repo.query(updateQuery);
        
        return res.status(200).json({ 
            message: "¡SQL actualizado con éxito desde el servidor!", 
            detail: `Tabla '${negocioTable}' configurada`,
            tables: tableNames
        });
    } catch (error: any) {
        return res.status(500).json({ message: "Error al migrar SQL", error: error.message });
    }
  };
}

