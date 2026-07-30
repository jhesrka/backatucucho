import rateLimit from "express-rate-limit";

// Escudo para endpoints de autenticación (Login, Registro, Recuperación)
export const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 5, // Limita cada IP a 5 peticiones por `window` (por minuto)
  message: {
    message: "Demasiados intentos de acceso desde esta IP, por favor inténtalo de nuevo después de un minuto."
  },
  standardHeaders: true, // Devuelve información del límite en los headers `RateLimit-*`
  legacyHeaders: false, // Deshabilita los headers `X-RateLimit-*`
});
