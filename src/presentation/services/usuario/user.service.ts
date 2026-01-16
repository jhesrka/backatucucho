import { validate as isUUID } from "uuid";
// src/presentation/services/user.service.ts
import {
  FreePostTracker,
  Status,
  StatusNegocio,
  StatusPost,
  StatusProducto,
  StatusStorie,
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
  User,
  UserRole,
  Wallet,
} from "../../../data"; // Modelo de usuario
import {
  CreateUserDTO,
  UpdateUserDTO,
  CustomError,
  LoginUserDTO,
  ForgotPasswordUserDTO,
  ResetPasswordUserDTO,
  SearchUserDTO,
  UpdateUserStatusDTO,
  SendNotificationDTO,
  UpdateUserAdminDTO,
  FilterUsersByStatusDTO,
} from "../../../domain"; // DTOs
import { AdminNotification, NotificationType } from '../../../data/postgres/models/AdminNotification';
import * as geoip from 'geoip-lite';
import { getIO } from "../../../config/socket"; // Para emitir eventos a través de socket.io
import { encriptAdapter, envs, JwtAdapter } from "../../../config";
import { generateUUID } from "../../../config/uuid.adapter";
import { EmailService } from "../email.service";
import { UploadFilesCloud } from "../../../config/upload-files-cloud-adapter";
import { Parser } from "json2csv";
import { FreePostTrackerService } from "../postService/free-post-tracker.service";
import { MoreThan } from "typeorm";

type UserCSV = {
  id: string;
  name: string;
  surname: string;
  email: string;
  birthday: Date;
  whatsapp: string;
  photoperfil: string;
  created_at: Date;
  updated_at: Date;
  rol: UserRole;
  status: Status;
};
export class UserService {
  constructor(private readonly emailService: EmailService) { }

  //USUARIO

  //CREAR UN USUARIO
  async createUser(userData: CreateUserDTO, file?: Express.Multer.File) {
    const user = new User();
    let urlPhoto = "";

    // Configuración básica del usuario
    user.name = userData.name.toLowerCase().trim();
    user.surname = userData.surname.toLowerCase().trim();
    user.email = userData.email.toLowerCase().trim();
    user.password = userData.password;
    user.birthday = new Date(userData.birthday);
    user.whatsapp = userData.whatsapp.trim();

    // Manejo de imagen (código existente)
    if (file?.originalname && file.originalname.length > 0) {
      const path = `profiles/${Date.now()}-${generateUUID()}-${file.originalname}`;
      const imgName = await UploadFilesCloud.uploadSingleFile({
        bucketName: envs.AWS_BUCKET_NAME,
        key: path,
        body: file.buffer,
        contentType: file.mimetype,
      });
      user.photoperfil = imgName;
      urlPhoto = await UploadFilesCloud.getFile({
        bucketName: envs.AWS_BUCKET_NAME,
        key: path,
      });
    }

    // Crear wallet
    const wallet = new Wallet();
    wallet.balance = 0;
    user.wallet = wallet;

    try {
      // 1. Primero guarda el usuario para obtener el ID
      const newUser = await user.save();

      // 2. Crear suscripción
      const subscription = new Subscription();
      subscription.user = newUser;
      subscription.plan = SubscriptionPlan.BASIC;
      subscription.status = SubscriptionStatus.PENDIENTE;
      subscription.startDate = new Date();
      subscription.endDate = null!;

      // 3. Crear FreePostTracker con servicio
      const freePostTrackerService = new FreePostTrackerService();
      await freePostTrackerService.getOrCreateTracker(newUser.id);

      // Guardar suscripción y tracker en paralelo (tracker ya guardado dentro del servicio)
      await subscription.save();

      // Notificaciones y respuesta
      await this.sendEmailValidationLink(newUser.email);
      getIO().emit("userChanged", newUser);

      return {
        id: newUser.id,
        name: newUser.name,
        surname: newUser.surname,
        email: newUser.email,
        birthday: newUser.birthday.toISOString(),
        whatsapp: newUser.whatsapp,
        photoperfil: urlPhoto,
        create_at: newUser.createdAt,
        update_at: newUser.updated_at,
        status: newUser.status,
      };
    } catch (error: any) {
      if (error.code === "23505") {
        throw CustomError.badRequest(
          `Correo:${userData.email} o Whatsapp:${userData.whatsapp} ya existen`
        );
      }
      throw CustomError.internalServer("Error creando el Usuario");
    }
  }

  //LOGEAR UN USUARIO

  async login(credentials: LoginUserDTO) {
    let urlPhoto = "";
    //buscar el usuario
    const user = await this.findUserByEmail(credentials.email);

    // 1️⃣ VALIDACIÓN DE CREDENCIALES PRIMERO (Seguridad)
    const isMatching = encriptAdapter.compare(
      credentials.password,
      user.password
    );

    if (!isMatching)
      throw CustomError.unAuthorized("Usuario o contraseña invalidos");

    // 🔍 GEOIP CHECK (No bloqueante)
    const currentIp = credentials.ip || "127.0.0.1";
    const geoData = geoip.lookup(currentIp);
    const country = geoData ? geoData.country : "Unknown";

    // ALERTA DE SEGURIDAD (Si no es Ecuador)
    if (country !== "EC" && country !== "Unknown" && currentIp !== "127.0.0.1") {
      const notification = new AdminNotification();
      notification.message = `Inicio de sesión detectado desde ${country} (${currentIp}) para el usuario ${user.email}`;
      notification.type = NotificationType.SECURITY;
      notification.relatedUser = user;
      notification.ip = currentIp;
      notification.country = country;
      await notification.save();
    }

    // 2️⃣ CONTROL DE SESIÓN ÚNICA
    if (user.isLoggedIn) {
      if (!credentials.force) {
        // Si no es forzado, devolvemos error 409 (Conflict) para que el front muestre el modal
        throw CustomError.conflict("Tu cuenta ya tiene una sesión activa en otro dispositivo.");
      } else {
        // Si es forzado, notificamos al admin y procedemos
        const notification = new AdminNotification();
        notification.message = `Cierre de sesión FORZADO por nuevo inicio desde ${currentIp} para ${user.email}`;
        notification.type = NotificationType.WARNING;
        notification.relatedUser = user;
        notification.ip = currentIp;
        notification.country = country;
        await notification.save();
      }
    }

    //generar un jwt
    const token = await JwtAdapter.generateToken(
      { id: user.id },
      envs.JWT_EXPIRE_IN
    );
    if (!token) throw CustomError.internalServer("Error generando Jwt");

    // Actualizar estado de sesión
    user.isLoggedIn = true;
    user.lastLoginIP = currentIp;
    user.lastLoginCountry = country;
    user.lastLoginDate = new Date();
    user.currentSessionId = token as string; // O un ID único de sesión
    await user.save();

    // enviar la data
    if (user.photoperfil) {
      urlPhoto = await UploadFilesCloud.getFile({
        bucketName: envs.AWS_BUCKET_NAME,
        key: user.photoperfil,
      });
    }

    return {
      token: token,
      user: {
        id: user.id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        photoperfil: urlPhoto || user.photoperfil,
      },
    };
  }

  async logout(userId: string) {
    const user = await User.findOne({ where: { id: userId } });
    if (!user) throw CustomError.notFound("Usuario no encontrado");

    user.isLoggedIn = false;
    user.currentSessionId = null!;
    await user.save();

    return { message: "Sesión cerrada correctamente" };
  }

  async loginWithGoogle(token: string, ip: string = "127.0.0.1", force: boolean = false) {
    const { OAuth2Client } = require("google-auth-library");
    const client = new OAuth2Client(envs.GOOGLE_CLIENT_ID);

    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: envs.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (error) {
      throw CustomError.internalServer("Token de Google inválido");
    }

    const { email, given_name, family_name, picture, sub } = payload;

    if (!email) throw CustomError.internalServer("Email no disponible en token de Google");

    let user = await User.findOne({ where: { email } });

    // 🔍 GEOIP + ALERT (Antes de crear/actualizar usuario, pero después de validar token)
    // NOTA: Para usuarios nuevos, no podemos chequear "isLoggedIn" previo, así que pasamos directo.

    const geoData = geoip.lookup(ip);
    const country = geoData ? geoData.country : "Unknown";

    // Alerta GeoIP
    if (country !== "EC" && country !== "Unknown" && ip !== "127.0.0.1") {
      if (user) {
        const notification = new AdminNotification();
        notification.message = `Inicio de sesión GOOGLE detectado desde ${country} (${ip}) para ${email}`;
        notification.type = NotificationType.SECURITY;
        notification.relatedUser = user;
        notification.ip = ip;
        notification.country = country;
        await notification.save();
      }
    }

    // Si no existe, crear usuario
    if (!user) {
      user = new User();
      user.name = (given_name || "Usuario").toLowerCase();
      user.surname = (family_name || "Google").toLowerCase();
      user.email = email.toLowerCase();
      user.password = "";
      user.googleId = sub;
      // ... (Rest of creation logic matches check)
      user.photoperfil = picture || "";
      user.status = Status.ACTIVE;
      user.birthday = new Date();
      user.whatsapp = "";

      // Init Session
      user.isLoggedIn = true;
      user.currentSessionId = "init";
      user.lastLoginIP = ip;
      user.lastLoginCountry = country;
      user.lastLoginDate = new Date();

      const wallet = new Wallet();
      wallet.balance = 0;
      user.wallet = wallet;

      try {
        const newUser = await user.save();
        const subscription = new Subscription();
        subscription.user = newUser;
        subscription.plan = SubscriptionPlan.BASIC;
        subscription.status = SubscriptionStatus.PENDIENTE;
        subscription.startDate = new Date();
        subscription.endDate = null!;

        const freePostTrackerService = new FreePostTrackerService();
        await freePostTrackerService.getOrCreateTracker(newUser.id);

        await subscription.save();

        user = newUser;
      } catch (error) {
        throw CustomError.internalServer("Error creando usuario con Google");
      }
    } else {
      // 1. Enlazar googleId si no existe
      if (!user.googleId) {
        user.googleId = sub;
        await user.save();
      }

      // 2. CONTROL SESIÓN (SOLO SI EL USUARIO YA EXISTÍA)
      if (user.isLoggedIn) {
        if (!force) {
          throw CustomError.conflict("Tu cuenta ya tiene una sesión activa en otro dispositivo.");
        } else {
          const notification = new AdminNotification();
          notification.message = `Cierre de sesión FORZADO (Google) desde ${ip} para ${user.email}`;
          notification.type = NotificationType.WARNING;
          notification.relatedUser = user;
          notification.ip = ip;
          notification.country = country;
          await notification.save();
        }
      }

      // Update session info
      user.isLoggedIn = true;
      user.lastLoginIP = ip;
      user.lastLoginCountry = country;
      user.lastLoginDate = new Date();
      await user.save();
    }

    // Generar JWT y retornar
    const jwt = await JwtAdapter.generateToken({ id: user.id }, envs.JWT_EXPIRE_IN);
    if (!jwt) throw CustomError.internalServer("Error generando Jwt");

    // Update session ID with real token
    user.currentSessionId = jwt as string;
    await user.save();

    return {
      token: jwt,
      user: {
        id: user.id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        photoperfil: user.photoperfil
      }
    };
  }

  //BUSCAR USUARIO POR EMAIL ACTIVO

  async findUserByEmail(email: string) {
    const user = await User.findOne({
      where: {
        email: email,
        status: Status.ACTIVE,
      },
    });
    if (!user) {
      throw CustomError.notFound(`Usuario: ${email} o contraseña no validos`);
    }
    return user;
  }

  //OLVIDO LA CONTRASEÑA USUARIO

  async forgotPassword(dto: ForgotPasswordUserDTO) {
    const user = await User.findOne({ where: { email: dto.email } });
    if (!user) {
      return {
        message:
          "Si el usuario existe, se ha enviado un enlace de recuperación.",
      };
    }

    const token = await JwtAdapter.generateToken(
      {
        id: user.id,
        resetTokenVersion: user.resetTokenVersion,
      },
      "5m"
    );

    if (!token) throw CustomError.internalServer("Error generando token");

    const recoveryLink = `${envs.WEBSERVICE_URL_FRONT}/user/restablecer?token=${token}`;

    const html = `
  <html>
    <body style="font-family: Arial, sans-serif; color: #333;">
      <h3>Hola ${user.name} ${user.surname},</h3>
      <p>Has solicitado restablecer tu contraseña. Haz clic en el siguiente botón para continuar:</p>
      <p>
        <a href="${recoveryLink}"
           style="display: inline-block; background-color: #3498db; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">
          Restablecer contraseña
        </a>
      </p>
      <p>Este enlace expirará en 5 minutos.</p>
      <br />
      <p style="font-size: 0.9em; color: #888;">Si no solicitaste este cambio, puedes ignorar este correo.</p>
    </body>
  </html>
`;
    const sent = await this.emailService.sendEmail({
      to: user.email,
      subject: "Recuperación de contraseña - Usuario",
      htmlBody: html,
    });

    if (!sent)
      throw CustomError.internalServer(
        "No se pudo enviar el correo de recuperación"
      );

    return {
      message: "Si el usuario existe, se ha enviado un enlace de recuperación.",
    };
  }

  //RESETEAR LA CONTARSEÑA USUARIO

  async resetPassword(dto: ResetPasswordUserDTO) {
    const payload: any = await JwtAdapter.validateToken(dto.token);

    if (!payload || !payload.id || payload.resetTokenVersion === undefined) {
      throw CustomError.unAuthorized("Token inválido o expirado");
    }

    const user = await User.findOne({ where: { id: payload.id } });

    if (!user) throw CustomError.notFound("Usuario no encontrado");

    if (user.resetTokenVersion !== payload.resetTokenVersion) {
      throw CustomError.unAuthorized("Este enlace ya fue usado o es inválido.");
    }

    user.password = encriptAdapter.hash(dto.newPassword);
    user.resetTokenVersion += 1;

    await user.save();

    return { message: "Contraseña actualizada correctamente" };
  }

  //OBTIENE PERFIL DEL USUARIO LOGEADO
  async getProfileUserLogged(user: User) {
    try {
      const userData = await User.findOne({
        where: { id: user.id, status: Status.ACTIVE },
      });

      if (!userData) throw CustomError.notFound("Usuario no encontrado");

      const photoUrl = userData.photoperfil
        ? await UploadFilesCloud.getFile({
          bucketName: envs.AWS_BUCKET_NAME,
          key: userData.photoperfil,
        })
        : "";

      return {
        id: userData.id,
        name: userData.name,
        surname: userData.surname,
        email: userData.email,
        birthday: userData.birthday,
        photoperfil: photoUrl,
        whatsapp: userData.whatsapp,
        created_at: userData.createdAt,
        updated_at: userData.updated_at,
        rol: userData.rol,
        status: userData.status,
      };
    } catch (error) {
      throw CustomError.internalServer("Error obteniendo perfil del usuario");
    }
  }

  // ACTUALIZA EL USUARIO LOGEADO NOMBRE APELLIDO CUMPLEAÑOS

  async updateUser(
    id: string,
    userData: UpdateUserDTO,
    file?: Express.Multer.File
  ) {
    const user = await this.findOneUser(id);
    let photoUrl = "";

    if (userData.name) user.name = userData.name.toLowerCase().trim();
    if (userData.surname) user.surname = userData.surname.toLowerCase().trim();
    if (userData.birthday) user.birthday = new Date(userData.birthday);

    // 📷 Si se sube una nueva foto de perfil
    if (file?.originalname && file.originalname.length > 0) {
      // Borrar la imagen anterior si existe
      if (user.photoperfil) {
        await UploadFilesCloud.deleteFile({
          bucketName: envs.AWS_BUCKET_NAME,
          key: user.photoperfil,
        });
      }

      const path = `users/${Date.now()}-${generateUUID()}-${file.originalname}`;

      const imgKey = await UploadFilesCloud.uploadSingleFile({
        bucketName: envs.AWS_BUCKET_NAME,
        key: path,
        body: file.buffer,
        contentType: file.mimetype,
      });

      user.photoperfil = imgKey;

      photoUrl = await UploadFilesCloud.getFile({
        bucketName: envs.AWS_BUCKET_NAME,
        key: path,
      });
    } else if (user.photoperfil) {
      photoUrl = await UploadFilesCloud.getFile({
        bucketName: envs.AWS_BUCKET_NAME,
        key: user.photoperfil,
      });
    }

    try {
      const updatedUser = await user.save();
      getIO().emit("userChanged", updatedUser);

      return {
        id: updatedUser.id,
        name: updatedUser.name,
        surname: updatedUser.surname,
        birthday: updatedUser.birthday,
        photoperfil: photoUrl,
        created_at: updatedUser.createdAt,
        updated_at: updatedUser.updated_at,
        rol: updatedUser.rol,
        status: updatedUser.status,
      };
    } catch (error: any) {
      throw CustomError.internalServer("Error actualizando el Usuario");
    }
  }

  public sendEmailValidationLink = async (email: string) => {
    const token = await JwtAdapter.generateToken({ email }, "3000s");
    if (!token)
      throw CustomError.internalServer(
        "Error generando token para enviar email"
      );
    const link = `http://${envs.WEBSERVICE_URL}/api/user/validate-email/${token}`;
    const html = `
  <div style="font-family: Arial, sans-serif; color: #333; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
    <div style="text-align: center; margin-bottom: 20px;">
      <img src="https://tusitio.com/logo-atucucho.png" alt="Atucucho Shop" style="max-width: 150px;" />
    </div>
    <h2 style="color: #2c3e50; text-align: center;">Activa tu cuenta en Atucucho Shop</h2>
    <p>Hola,</p>
    <p>Este correo ha sido enviado para que puedas <strong>activar tu cuenta en Atucucho Shop</strong>. Para continuar, por favor haz clic en el botón a continuación:</p>
    <div style="text-align: center; margin: 20px 0;">
      <a href="${link}" style="display: inline-block; padding: 12px 24px; background-color: #3498db; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Activar cuenta</a>
    </div>
    <p><strong>Importante:</strong> este enlace es válido solo por <strong>5 minutos</strong>. Si expira, deberás solicitar uno nuevo.</p>
    <p>Si tú no solicitaste esta verificación, puedes ignorar este mensaje de forma segura.</p>
    <hr style="margin: 30px 0;" />
    <p style="font-size: 12px; color: #999; text-align: center;">Correo enviado a: ${email}</p>
    <p style="font-size: 12px; color: #999; text-align: center;">Gracias por unirte a Atucucho Shop.</p>
  </div>
`;

    const isSent = this.emailService.sendEmail({
      to: email,
      subject: "Validate your email",
      htmlBody: html,
    });
    if (!isSent) throw CustomError.internalServer("Error enviando el correo");
    return true;
  };

  validateEmail = async (token: string) => {
    const payload = await JwtAdapter.validateToken(token);
    if (!payload) throw CustomError.badRequest("Token no validado");
    const { email } = payload as { email: string };
    if (!email) throw CustomError.internalServer("Email not in token");

    const user = await User.findOne({ where: { email: email } });
    if (!user) throw CustomError.internalServer("Correo no existe");
    user.status = Status.ACTIVE;
    try {
      await user.save();
      return {
        message: "activado",
      };
    } catch (error) {
      throw CustomError.internalServer("Something went very wrong");
    }
  };

  //Devuelve el usuario logueado con sus posts y stories, incluyendo URLs de imágenes. Muy completo.
  async getFullProfile(user: User) {
    try {
      const userWithRelations = await User.findOne({
        where: { id: user.id, status: Status.ACTIVE },
        relations: ["posts", "stories"],
      });
      if (!userWithRelations)
        throw CustomError.notFound("Usuario no encontrado");
      const photoUrl = userWithRelations.photoperfil
        ? await UploadFilesCloud.getFile({
          bucketName: envs.AWS_BUCKET_NAME,
          key: userWithRelations.photoperfil,
        })
        : "";
      const posts = await Promise.all(
        userWithRelations.posts
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map(async (post) => {
            const imgpostUrls = post.imgpost
              ? await Promise.all(
                post.imgpost.map((imgKey) =>
                  UploadFilesCloud.getFile({
                    bucketName: envs.AWS_BUCKET_NAME,
                    key: imgKey,
                  })
                )
              )
              : [];
            return {
              id: post.id,
              content: post.content,
              title: post.title,
              subtitle: post.subtitle,
              createdAt: post.createdAt,
              status: post.statusPost,
              imgpost: imgpostUrls,
            };
          })
      );
      const stories = await Promise.all(
        userWithRelations.stories.map(async (storie) => {
          const imgstorieUrl = storie.imgstorie
            ? await UploadFilesCloud.getFile({
              bucketName: envs.AWS_BUCKET_NAME,
              key: storie.imgstorie,
            })
            : "";
          return {
            id: storie.id,
            description: storie.description,
            createdAt: storie.createdAt,
            status: storie.statusStorie,
            imgstorie: imgstorieUrl,
          };
        })
      );
      return {
        id: userWithRelations.id,
        name: userWithRelations.name,
        surname: userWithRelations.surname,
        email: userWithRelations.email,
        photoperfil: photoUrl,
        posts,
        stories,
      };
    } catch (error) {
      throw CustomError.internalServer("Error obteniendo perfil completo");
    }
  }

  // Obtener un usuario por ID
  async findOneUser(userId: string) {
    const result = await User.findOne({
      where: { id: userId, status: Status.ACTIVE },
    });
    if (!result) throw CustomError.notFound("Usuario no encontrado");
    return result;
  }
  //Devuelve un resumen básico del perfil del usuario (útil para mostrar en cabecera, sidebar, etc).
  async getUserProfile(user: User) {
    return {
      id: user.id,
      name: user.name,
      surname: user.surname,
      email: user.email,
      photo: user.photoperfil,
    };
  }

  //ADMINISTRADOR

  //  Listar todos los usuarios básicos
  async findAllUsers(page: number = 1) {
    const take = 5;
    const skip = (page - 1) * take;

    const [users, total] = await User.findAndCount({
      skip,
      take,
      order: {
        createdAt: "DESC", // Puedes cambiar a "ASC" si prefieres
      },
    });

    return {
      total, // total de usuarios en la base
      currentPage: page,
      totalPages: Math.ceil(total / take),
      users: users.map((user) => ({
        id: user.id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        birthday: user.birthday,
        whatsapp: user.whatsapp,
        photoperfil: user.photoperfil,
        created_at: user.createdAt,
        updated_at: user.updated_at,
        rol: user.rol,
        status: user.status,
      })),
    };
  }

  // 2. Buscar usuarios por campos: nombre, email, whatsapp
  async searchUsersByFields(dto: SearchUserDTO) {
    const query = dto.query.toLowerCase();

    const users = await User.createQueryBuilder("user")
      .where("LOWER(user.name) LIKE :query", { query: `%${query}%` })
      .orWhere("LOWER(user.surname) LIKE :query", { query: `%${query}%` })
      .orWhere("LOWER(user.email) LIKE :query", { query: `%${query}%` })
      .orWhere("user.whatsapp LIKE :query", { query: `%${query}%` })
      .getMany();

    return users.map((user) => ({
      id: user.id,
      name: user.name,
      surname: user.surname,
      email: user.email,
      birthday: user.birthday,
      whatsapp: user.whatsapp,
      photoperfil: user.photoperfil,
      created_at: user.createdAt,
      updated_at: user.updated_at,
      rol: user.rol,
      status: user.status,
    }));
  }

  // 3. Filtrar usuarios por estado
  async filterUsersByStatus(dto: FilterUsersByStatusDTO) {
    try {
      if (!dto.status) {
        throw CustomError.badRequest("El estado del usuario es requerido");
      }

      const users = await User.find({ where: { status: dto.status } });

      if (!users || users.length === 0) {
        throw CustomError.notFound("No se encontraron usuarios con ese estado");
      }

      return users.map((user) => ({
        id: user.id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        birthday: user.birthday,
        whatsapp: user.whatsapp,
        photoperfil: user.photoperfil,
        created_at: user.createdAt,
        updated_at: user.updated_at,
        rol: user.rol,
        status: user.status,
      }));
    } catch (error) {
      throw CustomError.internalServer("Error al filtrar usuarios por estado");
    }
  }

  // 4. Obtener perfil completo con posts y stories
  async getFullUserProfile(userId: string) {
    try {
      if (!isUUID(userId)) {
        throw CustomError.notFound("Usuario no encontrado");
      }
      const user = await User.findOne({
        where: { id: userId },
        relations: ["posts", "stories", "negocios", "negocios.productos"],
      });

      if (!user) throw CustomError.notFound("Usuario no encontrado");

      const photoUrl = user.photoperfil
        ? await UploadFilesCloud.getFile({
          bucketName: envs.AWS_BUCKET_NAME,
          key: user.photoperfil,
        })
        : "";

      const postCounts = {
        total: user.posts.length,
        published: user.posts.filter(
          (p) => p.statusPost === StatusPost.PUBLICADO
        ).length,
        hidden: user.posts.filter((p) => p.statusPost === StatusPost.OCULTO)
          .length,
        deleted: user.posts.filter((p) => p.statusPost === StatusPost.ELIMINADO)
          .length,
        banned: user.posts.filter((p) => p.statusPost === StatusPost.BLOQUEADO)
          .length,
      };

      const storieCounts = {
        total: user.stories.length,
        published: user.stories.filter(
          (s) => s.statusStorie === StatusStorie.PUBLISHED
        ).length,
        hidden: user.stories.filter(
          (s) => s.statusStorie === StatusStorie.HIDDEN
        ).length,
        deleted: user.stories.filter(
          (s) => s.statusStorie === StatusStorie.DELETED
        ).length,
        banned: user.stories.filter(
          (s) => s.statusStorie === StatusStorie.BANNED
        ).length,
      };

      const negocioCounts = {
        total: user.negocios.length,
        pendiente: user.negocios.filter(
          (n) => n.statusNegocio === StatusNegocio.PENDIENTE
        ).length,
        activo: user.negocios.filter(
          (n) => n.statusNegocio === StatusNegocio.ACTIVO
        ).length,
        suspendido: user.negocios.filter(
          (n) => n.statusNegocio === StatusNegocio.SUSPENDIDO
        ).length,
        bloqueado: user.negocios.filter(
          (n) => n.statusNegocio === StatusNegocio.BLOQUEADO
        ).length,
      };

      const allProductos = user.negocios.flatMap((n) => n.productos);

      const productoCounts = {
        total: allProductos.length,
        pendiente: allProductos.filter(
          (p) => p.statusProducto === StatusProducto.PENDIENTE
        ).length,
        activo: allProductos.filter(
          (p) => p.statusProducto === StatusProducto.ACTIVO
        ).length,
        suspendido: allProductos.filter(
          (p) => p.statusProducto === StatusProducto.SUSPENDIDO
        ).length,
        bloqueado: allProductos.filter(
          (p) => p.statusProducto === StatusProducto.BLOQUEADO
        ).length,
      };

      return {
        id: user.id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        photoperfil: photoUrl,
        birthday: user.birthday,
        whatsapp: user.whatsapp,
        status: user.status,
        createdAt: user.createdAt,
        postCounts,
        storieCounts,
        negocioCounts,
        productoCounts,
      };
    } catch (error) {
      throw CustomError.internalServer(
        "Error al obtener perfil completo del usuario"
      );
    }
  }

  // 5. Actualizar usuario desde admin (con foto opcional)
  async updateUserFromAdmin(
    userId: string,
    dto: UpdateUserAdminDTO,
    file?: Express.Multer.File
  ) {
    const user = await User.findOne({ where: { id: userId } });
    if (!user) throw CustomError.notFound("Usuario no encontrado");

    if (dto.name) user.name = dto.name.toLowerCase().trim();
    if (dto.surname) user.surname = dto.surname.toLowerCase().trim();
    if (dto.birthday) user.birthday = new Date(dto.birthday);
    if (dto.email) user.email = dto.email.trim().toLowerCase();
    if (dto.whatsapp) user.whatsapp = dto.whatsapp.trim();

    if (file?.originalname) {
      if (user.photoperfil) {
        await UploadFilesCloud.deleteFile({
          bucketName: envs.AWS_BUCKET_NAME,
          key: user.photoperfil,
        });
      }

      const path = `users/${Date.now()}-${file.originalname}`;
      const imgKey = await UploadFilesCloud.uploadSingleFile({
        bucketName: envs.AWS_BUCKET_NAME,
        key: path,
        body: file.buffer,
        contentType: file.mimetype,
      });
      user.photoperfil = imgKey;
    }

    try {
      const updated = await user.save();
      getIO().emit("userChanged", updated);
      return {
        id: updated.id,
        name: updated.name,
        surname: updated.surname,
        birthday: updated.birthday,
        email: updated.email,
        whatsapp: updated.whatsapp,
        photoperfil: updated.photoperfil,
        created_at: updated.createdAt,
        status: updated.status,
      };
    } catch {
      throw CustomError.internalServer("Error actualizando usuario");
    }
  }

  // 6. Cambiar estado de usuario
  async changeUserStatus(userId: string, dto: UpdateUserStatusDTO) {
    if (!isUUID(userId)) {
      throw CustomError.badRequest("ID inválido");
    }

    const user = await User.findOne({ where: { id: userId } });
    if (!user) throw CustomError.notFound("Usuario no encontrado");

    user.status = dto.status;

    try {
      const savedUser = await user.save();
      getIO().emit("userChanged", savedUser);
      return savedUser; // ✅ RETORNAS EL USUARIO ACTUALIZADO
    } catch (error) {
      console.error("Error al guardar usuario:", error);
      throw CustomError.internalServer("Error cambiando estado del usuario");
    }
  }

  // 9. Exportar usuarios a CSV
  async exportUsersToCSV() {
    const users = await User.find({ order: { createdAt: "DESC" } });

    const csvData: UserCSV[] = users.map((user) => ({
      id: user.id,
      name: user.name,
      surname: user.surname,
      email: user.email,
      birthday: user.birthday,
      whatsapp: user.whatsapp,
      photoperfil: user.photoperfil, // ✅ Faltaba esto
      rol: user.rol,
      status: user.status,
      created_at: user.createdAt,
      updated_at: user.updated_at,
    }));

    const fields = [
      { label: "ID", value: (row: UserCSV) => row.id },
      { label: "Nombre", value: (row: UserCSV) => row.name },
      { label: "Apellido", value: (row: UserCSV) => row.surname },
      { label: "Email", value: (row: UserCSV) => row.email },
      { label: "Cumpleaños", value: (row: UserCSV) => row.birthday },
      { label: "WhatsApp", value: (row: UserCSV) => row.whatsapp },
      { label: "Foto de perfil", value: (row: UserCSV) => row.photoperfil },
      { label: "Rol", value: (row: UserCSV) => row.rol },
      { label: "Estado", value: (row: UserCSV) => row.status },
      {
        label: "Creado el",
        value: (row: UserCSV) =>
          row.created_at ? row.created_at.toISOString() : "",
      },
      {
        label: "Actualizado el",
        value: (row: UserCSV) =>
          row.updated_at ? row.updated_at.toISOString() : "",
      },
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(csvData);

    return csv;
  }

  // 10. Enviar notificación al usuario
  async sendNotificationToUser(dto: SendNotificationDTO) {
    const user = await User.findOne({
      where: { id: dto.id, status: Status.ACTIVE },
    });

    if (!user) throw CustomError.notFound("Usuario no encontrado");

    const sendEmail = dto.sendEmail ?? true;

    if (sendEmail) {
      const sent = await this.emailService.sendEmail({
        to: user.email,
        subject: dto.subject,
        htmlBody: dto.message,
      });

      if (!sent) throw CustomError.internalServer("Error enviando correo");
    }
  }
  async sendNotificationToAllUsers(dto: { subject: string; message: string }) {
    // Buscar todos los usuarios activos
    const users = await User.find({ where: { status: Status.ACTIVE } });

    if (!users.length) {
      throw CustomError.notFound("No hay usuarios activos para notificar");
    }

    const { subject, message } = dto;

    // Enviar correo a cada usuario (puedes optimizar con Promise.all si quieres)
    for (const user of users) {
      const sent = await this.emailService.sendEmail({
        to: user.email,
        subject,
        htmlBody: message,
      });
      if (!sent) {
        // Opcional: loguear error pero no interrumpir el envío masivo
        console.warn(`Error enviando correo a ${user.email}`);
      }
    }

    return { message: "Notificaciones enviadas a todos los usuarios activos." };
  }

  // Eliminar un usuario (marcar como inactivo)
  async deleteUser(id: string) {
    const user = await this.findOneUser(id);
    user.status = Status.DELETED; // Cambiar a estado inactivo

    try {
      await user.save(); // Usamos `save` en vez de `remove` porque no estamos eliminando el registro, solo marcándolo
      getIO().emit("userChanged", user); // Emitir evento
    } catch (error) {
      throw CustomError.internalServer("Error eliminando el Usuario");
    }
  }

  async blockAccount() {
    return "hola";
  }
  // 1) Total de usuarios ACTIVOS
  async countActiveUsers(): Promise<number> {
    try {
      return await User.count({ where: { status: Status.ACTIVE } });
    } catch {
      throw CustomError.internalServer("Error al contar usuarios activos");
    }
  }

  // 2) Usuarios registrados en las últimas 24 horas
  async countUsersRegisteredLast24h(): Promise<number> {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return await User.count({ where: { createdAt: MoreThan(since) } });
      // Si quieres solo activos en ese rango:
      // return await User.count({ where: { status: Status.ACTIVE, createdAt: MoreThan(since) } });
    } catch {
      throw CustomError.internalServer(
        "Error al contar usuarios registrados en las últimas 24 horas"
      );
    }
  }
}
