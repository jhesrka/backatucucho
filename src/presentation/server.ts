// src/server.ts
import express, { Router } from "express";
import cors from "cors";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { setIO } from "../config/socket"; // Asegúrate de que la ruta sea correcta
import fs from "fs"; // Importa el módulo fs
import path from "path"; // Importa el módulo path
import helmet from "helmet";
import hpp from "hpp";

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
      socket.on("join_motorizado", (motorizadoId: string) => {
        socket.join(motorizadoId);
      });
      socket.on("join_business", (businessId: string) => {
        socket.join(businessId);
      });
    });

    this.server.listen(this.port, "0.0.0.0", () => {
      console.log(`Server started on port ${this.port}`);
    });
  }
}
