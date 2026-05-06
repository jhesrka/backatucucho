// src/server.ts
import express, { Router } from "express";
import cors from "cors";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { setIO, initRedisAdapter } from "../config/socket";
import { envs } from "../config";
import fs from "fs"; // Importa el módulo fs
import path from "path"; // Importa el módulo path
import helmet from "helmet";
import hpp from "hpp";
import { UserMotorizado } from "../data";

// Caché en memoria para la última ubicación conocida de cada pedido
const trackingMemoria = new Map<string, any>();

interface Options {
  port: number;
  routes: Router;
}

export class Server {
  private readonly app = express();
  private readonly server;
  private readonly io: SocketIOServer;
  private readonly port: number;
  private readonly routes: Router;
  private readonly acceptedOrigins: string[] = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://192.168.100.19:5173",
    "http://192.168.100.19:5174",
    "https://atucuchoshop.vercel.app",
    "https://atucucho-web-front.vercel.app"
  ];

  constructor(options: Options) {
    this.port = options.port;
    this.routes = options.routes;
    this.server = http.createServer(this.app); // Crear servidor HTTP
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: [
          "http://localhost:5173",
          "http://localhost:5174",
          "http://192.168.100.19:5173",
          "http://192.168.100.19:5174",
          "https://atucuchoshop.vercel.app",
          "https://atucucho-web-front.vercel.app"
        ], // ✅ CORS para Socket.IO (desarrollo y producción)
        methods: ["GET", "POST"],
      },
    }); // Crear instancia de Socket.IO con configuración de CORS

    setIO(this.io); // 🔥 Guardamos la instancia globalmente

    // 🔴 Redis adapter (activo solo si REDIS_URL está en el .env)
    initRedisAdapter(envs.REDIS_URL);
  }

  async start() {
    // Asegurarse de que el directorio "uploads" exista
    const uploadsPath = path.join(__dirname, "uploads"); // Obtiene la ruta absoluta para 'uploads'
    if (!fs.existsSync(uploadsPath)) {
      // Verifica si el directorio 'uploads' existe
      fs.mkdirSync(uploadsPath); // Si no existe, lo crea
    }

    this.app.use(
      cors({
        origin: (origin, callback) => {
          if (!origin) {
            return callback(null, true);
          }
          if (this.acceptedOrigins.includes(origin)) {
            return callback(null, true);
          }
          return callback(new Error("Not allwed by CORS"));
        },
      })
    );
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    this.app.use(hpp());
    this.app.use(helmet()); // esto es una seguridad
    this.app.use(this.routes);


    // Servir archivos estáticos
    this.app.use("/uploads", express.static(uploadsPath));
    this.app.use("/comprobantes", express.static(path.join(uploadsPath, "comprobantes")));

    this.io.on("connection", (socket) => {
      socket.on("join_motorizado", async (motorizadoId: string) => {
        socket.join(motorizadoId);
        try {
          // Usamos query builder directo para evitar que se dispare @UpdateDateColumn
          await UserMotorizado.getRepository().createQueryBuilder()
            .update()
            .set({ lastSeenAt: new Date() })
            .where("id = :id", { id: motorizadoId })
            .execute();
        } catch (e) {
          console.error("Error updating motorizado lastSeenAt", e);
        }
      });
      socket.on("join_business", (businessId: string) => {
        console.log(`🏠 [Socket] Negocio unido a la sala: ${businessId}`);
        socket.join(businessId);
      });
      socket.on("join_user", (userId: string) => {
        socket.join(userId);
      });

      // --- TRACKING TIEMPO REAL MOTORIZADOS ---
      socket.on("join_pedido_room", (pedidoId: string) => {
        socket.join(`pedido_${pedidoId}`);
        // Si hay una última ubicación guardada en memoria, enviarla inmediatamente al cliente
        if (trackingMemoria.has(pedidoId)) {
          socket.emit("ubicacion_actualizada", trackingMemoria.get(pedidoId));
        }
      });

      socket.on("leave_pedido_room", (pedidoId: string) => {
        socket.leave(`pedido_${pedidoId}`);
        // Opcional: Podríamos borrar de trackingMemoria aquí, pero mejor mantenerla 
        // por si el cliente cierra y abre la tarjeta rápido.
      });

      socket.on("ubicacion_motorizado", (data: { pedidoId: string; lat: number; lng: number; accuracy: number; timestamp: number }) => {
        // Guardar la última ubicación conocida
        trackingMemoria.set(data.pedidoId, data);
        // Retransmitir la ubicación a la sala
        socket.to(`pedido_${data.pedidoId}`).emit("ubicacion_actualizada", data);
      });

      socket.on("pedir_ubicacion_forzada", (pedidoId: string) => {
        // Enviar un ping silencioso a los motorizados en esta sala para que envíen sus coordenadas
        socket.to(`pedido_${pedidoId}`).emit("forzar_gps");
      });
    });

    this.server.listen(this.port, "0.0.0.0", () => {
      console.log(`Server started on port ${this.port}`);
    });
  }
}
