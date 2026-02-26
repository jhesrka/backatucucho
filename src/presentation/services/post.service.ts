// src/presentation/services/post.service.ts
import { ILike, LessThan, MoreThan } from "typeorm";
import { envs } from "../../config";
import { getIO } from "../../config/socket";
import { UploadFilesCloud } from "../../config/upload-files-cloud-adapter";
import { Post, StatusPost, Like } from "../../data";
import { CreateDTO, CreatePostDTO, CustomError, UpdateDTO } from "../../domain";
import { UserService } from "./usuario/user.service";
import { SubscriptionService } from "./postService/subscription.service";
import { FreePostTrackerService } from "./postService/free-post-tracker.service";
import { validate as uuidValidate } from "uuid";
import { containsForbiddenWords } from "../../config/content-moderation";
import { Status as UserStatus } from "../../data/postgres/models/user.model";
import { PostReport } from "../../data/postgres/models/PostReport";

import { GlobalSettingsService } from "./globalSettings/global-settings.service";

export class PostService {
  constructor(
    public readonly userService: UserService,
    public readonly subscriptionService: SubscriptionService,
    public readonly freePostTrackerService: FreePostTrackerService,
    public readonly globalSettingsService: GlobalSettingsService
  ) { }
  //este ya esta funcionando

  async findAllPostPaginated(page: number, limit: number, userId?: string) {
    try {
      const skip = (page - 1) * limit;
      const now = new Date();

      // 1. Consulta base con condiciones de expiración
      const query = Post.createQueryBuilder("post")
        .leftJoinAndSelect("post.user", "user")
        .where("post.statusPost = :status", { status: StatusPost.PUBLISHED })
        .andWhere(
          "(post.isPaid = true OR (post.expiresAt IS NULL OR post.expiresAt > :now))",
          { now }
        )
        .orderBy("post.createdAt", "DESC")
        .skip(skip)
        .take(limit);

      const [posts, total] = await query.getManyAndCount();

      // Filtrar los posts pagados cuyo autor no tiene suscripción activa
      const filteredPosts = await Promise.all(
        posts.map(async (post) => {
          if (!post.user) return null; // Post huérfano

          if (post.isPaid) {
            const hasSubscription =
              await this.subscriptionService.hasActiveSubscription(
                post.user.id
              );
            return hasSubscription ? post : null;
          }
          return post; // Los gratuitos se mantienen
        })
      );

      // Limpiar nulos (posts eliminados o inviables)
      const validPosts = filteredPosts.filter((p) => p !== null) as Post[];

      // 2. Procesar posts expirados en segundo plano
      this.processExpiredPosts().catch((error) => {
        console.error("Error al procesar posts expirados:", error);
      });

      // 3. Procesamiento optimizado de imágenes + CHECK LIKES
      const formattedPosts = await Promise.all(
        validPosts.map(async (post) => {
          try {
            const [imgs, userImage, isLiked] = await Promise.all([
              Promise.all(
                (post.imgpost ?? []).map((img) =>
                  UploadFilesCloud.getOptimizedUrls({
                    bucketName: envs.AWS_BUCKET_NAME,
                    key: img,
                  })
                )
              ),
              post.user?.photoperfil
                ? UploadFilesCloud.getOptimizedUrls({
                  bucketName: envs.AWS_BUCKET_NAME,
                  key: post.user.photoperfil,
                })
                : Promise.resolve(null),
              userId
                ? Like.findOne({
                  where: { post: { id: post.id }, user: { id: userId } },
                }).then((like) => !!like)
                : Promise.resolve(false),
            ]);

            return {
              ...post,
              imgpost: imgs,
              user: {
                id: post.user.id,
                name: post.user.name,
                surname: post.user.surname,
                whatsapp: post.user.whatsapp,
                photoperfil: userImage,
              },
              totalLikes: post.likesCount ?? 0,
              isLiked,
            };
          } catch (error) {
            console.error(`Error processing post ${post.id}:`, error);
            return null;
          }
        })
      );

      return {
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        posts: formattedPosts.filter(p => p !== null),
      };
    } catch (error) {
      console.error("Critical error in findAllPostPaginated:", error);
      throw CustomError.internalServer("Error al obtener posts paginados. Detalle: " + (error as Error).message);
    }
  }

  // Método para manejar posts expirados
  private async processExpiredPosts() {
    const now = new Date();

    // Buscar posts públicos gratuitos que hayan expirado
    const expiredPosts = await Post.createQueryBuilder("post")
      .where("post.statusPost = :status", { status: StatusPost.PUBLISHED })
      .andWhere("post.isPaid = false")
      .andWhere("post.expiresAt <= :now", { now })
      .getMany();

    if (expiredPosts.length > 0) {
      for (const post of expiredPosts) {
        await this.hardDeletePost(post);
      }
    }
  }


  async searchPost(searchTerm: string, userId?: string) {
    try {
      const now = new Date();

      // 1. Consulta con los MISMOS filtros que findAllPostPaginated:
      //    - Solo PUBLISHED
      //    - Posts pagados o gratuitos no expirados
      const query = Post.createQueryBuilder("post")
        .leftJoinAndSelect("post.user", "user")
        .where("post.statusPost = :status", { status: StatusPost.PUBLISHED })
        .andWhere(
          "(post.isPaid = true OR (post.expiresAt IS NULL OR post.expiresAt > :now))",
          { now }
        )
        .andWhere(
          "(LOWER(post.title) LIKE LOWER(:term) OR LOWER(post.subtitle) LIKE LOWER(:term) OR LOWER(user.name) LIKE LOWER(:term) OR LOWER(user.surname) LIKE LOWER(:term))",
          { term: `%${searchTerm}%` }
        )
        .orderBy("post.createdAt", "DESC");

      const posts = await query.getMany();

      // 2. Filtrar posts pagados sin suscripción activa + posts huérfanos
      const filteredPosts = await Promise.all(
        posts.map(async (post) => {
          if (!post.user) return null; // Post huérfano

          if (post.isPaid) {
            const hasSubscription =
              await this.subscriptionService.hasActiveSubscription(
                post.user.id
              );
            return hasSubscription ? post : null;
          }
          return post; // Gratuitos se mantienen
        })
      );

      const validPosts = filteredPosts.filter((p) => p !== null) as Post[];

      // 3. Resolviendo imágenes + LIKES (mismo formato que el feed)
      const resolvedPosts = await Promise.all(
        validPosts.map(async (post) => {
          try {
            const [resolvedImgs, userImage, isLiked] = await Promise.all([
              Promise.all(
                (post.imgpost ?? []).map((img) =>
                  UploadFilesCloud.getOptimizedUrls({
                    bucketName: envs.AWS_BUCKET_NAME,
                    key: img,
                  })
                )
              ),
              post.user?.photoperfil
                ? UploadFilesCloud.getOptimizedUrls({
                  bucketName: envs.AWS_BUCKET_NAME,
                  key: post.user.photoperfil,
                })
                : Promise.resolve(null),
              userId
                ? Like.findOne({
                  where: { post: { id: post.id }, user: { id: userId } },
                }).then((like) => !!like)
                : Promise.resolve(false),
            ]);

            return {
              ...post,
              imgpost: resolvedImgs as any,
              user: {
                id: post.user.id,
                name: post.user.name,
                surname: post.user.surname,
                whatsapp: post.user.whatsapp,
                photoperfil: userImage as any,
              },
              totalLikes: post.likesCount ?? 0,
              isLiked,
            };
          } catch (error) {
            console.error(`Error processing search post ${post.id}:`, error);
            return null;
          }
        })
      );

      return resolvedPosts.filter((p) => p !== null);
    } catch (error) {
      console.error("Error en searchPost:", error);
      throw CustomError.internalServer("Error buscando los posts");
    }
  }

  async findOnePost(id: string, userId?: string) {
    const post = await Post.findOne({
      where: { id },
      relations: ["user"],
      select: {
        user: {
          id: true,
          name: true,
          surname: true,
          photoperfil: true,
          whatsapp: true,
        },
      },
    });

    if (!post) throw CustomError.notFound("Post no encontrado");

    const [resolvedImgs, userImage, isLiked] = await Promise.all([
      Promise.all(
        (post.imgpost ?? []).map(async (img) => {
          return await UploadFilesCloud.getOptimizedUrls({
            bucketName: envs.AWS_BUCKET_NAME,
            key: img,
          });
        })
      ),
      UploadFilesCloud.getOptimizedUrls({
        bucketName: envs.AWS_BUCKET_NAME,
        key: post.user.photoperfil,
      }),
      userId
        ? Like.findOne({
          where: { post: { id: post.id }, user: { id: userId } },
        }).then((like) => !!like)
        : Promise.resolve(false),
    ]);

    return {
      ...post,
      imgpost: resolvedImgs as any,
      user: { ...post.user, photoperfil: userImage as any },
      isLiked,
    };
  }

  async createPostPlan(postData: CreatePostDTO, imgs?: Express.Multer.File[]) {
    try {
      // 1. Validar usuario
      const user = await this.userService.findOneUser(postData.userId);
      if (!user) throw CustomError.notFound("Usuario no encontrado");

      // 1.5 Validar aceptación de términos y privacidad (Versionado)
      const settings = await this.globalSettingsService.getSettings();
      if (!user.acceptedTermsVersion || user.acceptedTermsVersion !== settings.currentTermsVersion ||
        !user.acceptedPrivacyVersion || user.acceptedPrivacyVersion !== settings.currentTermsVersion) {
        throw CustomError.forbiden("Debes aceptar los términos y condiciones actualizados antes de publicar.");
      }

      // 2. Validar suscripción e imágenes si es post pago
      if (postData.isPaid) {
        const hasActiveSub =
          await this.subscriptionService.hasActiveSubscription(user.id);
        if (!hasActiveSub) {
          throw CustomError.forbiden(
            "Requieres suscripción activa para posts pagos"
          );
        }

        if (imgs && imgs.length > 5) {
          throw CustomError.badRequest("Los posts pagados permiten un máximo de 5 imágenes");
        }
      } else {
        // Validación para posts gratuitos
        if (imgs && imgs.length > 1) {
          throw CustomError.badRequest("Los posts gratuitos solo permiten 1 imagen");
        }
      }

      // 3. Manejar posts gratuitos (límite mensual y duración configurable)
      let freePostTracker;

      if (!postData.isPaid) {
        freePostTracker = await this.freePostTrackerService.getOrCreateTracker(
          user.id
        );
        if (freePostTracker.count >= settings.freePostsLimit) {
          throw CustomError.forbiden(
            `Límite de posts gratuitos alcanzado (${settings.freePostsLimit}/mes)`
          );
        }

        // Incrementar contador
        freePostTracker.count += 1;
        await freePostTracker.save();
      }

      // 4. Subir imágenes a AWS si existen
      let keys: string[] = [];
      let urls: string[] = [];
      if (imgs && imgs.length > 0) {
        keys = await Promise.all(
          imgs.map((img) =>
            UploadFilesCloud.uploadSingleFile({
              bucketName: envs.AWS_BUCKET_NAME,
              key: `posts/${Date.now()}-${img.originalname}`,
              body: img.buffer,
              contentType: img.mimetype,
            })
          )
        );

        // Obtener URLs firmadas optimizadas
        urls = (await Promise.all(
          keys.map((key) =>
            UploadFilesCloud.getOptimizedUrls({
              bucketName: envs.AWS_BUCKET_NAME,
              key,
            })
          )
        )) as any;
      }


      // 4.5. Validar contenido (Moderación automática)
      if (containsForbiddenWords(postData.title) ||
        containsForbiddenWords(postData.subtitle) ||
        containsForbiddenWords(postData.content)) {
        throw CustomError.badRequest("Tu contenido contiene texto no permitido. Corrígelo para continuar.");
      }

      // 5. Crear y guardar el post
      const post = new Post();
      post.title = postData.title.toLowerCase().trim();
      post.subtitle = postData.subtitle.toLowerCase().trim();
      post.content = postData.content.trim();
      post.statusPost = StatusPost.PUBLISHED;
      post.user = user;
      post.isPaid = postData.isPaid || false;
      post.imgpost = keys;
      post.showWhatsApp = postData.showWhatsApp ?? true;
      post.showLikes = postData.showLikes ?? true;

      // Configurar expiración para posts gratuitos

      if (!post.isPaid && freePostTracker && settings) {
        const durationMs = (settings.freePostDurationDays * 24 * 60 * 60 * 1000) +
          (settings.freePostDurationHours * 60 * 60 * 1000);
        post.expiresAt = new Date(Date.now() + durationMs);
        post.freePostTracker = freePostTracker;
      } else if (!post.isPaid) {
        throw CustomError.internalServer(
          "Error al asignar el tracker de posts gratuitos"
        );
      }
      const postSaved = await post.save();
      // 6. Preparar respuesta segura
      const safeResponse = {
        id: postSaved.id,
        title: postSaved.title,
        subtitle: postSaved.subtitle,
        content: postSaved.content,
        isPaid: postSaved.isPaid,
        imgpost: urls,
        expiresAt: postSaved.expiresAt,
        createdAt: postSaved.createdAt,
        showWhatsApp: postSaved.showWhatsApp,
        showLikes: postSaved.showLikes,
        user: {
          id: user.id,
          name: user.name,
          surname: user.surname,
          photoperfil: user.photoperfil
            ? await UploadFilesCloud.getFile({ bucketName: envs.AWS_BUCKET_NAME, key: user.photoperfil })
            : null,
        },
      };
      postSaved.imgpost = urls; // Asignar URLs para la respuesta

      // 6. Emitir evento de socket
      getIO().emit("postChanged", {
        action: "create",
        post: safeResponse,
      });

      return safeResponse;
    } catch (error) {
      // Verifica si es un error de TypeORM
      if (typeof error === "object" && error !== null && "code" in error) {
        const dbError = error as { code: string };
        if (dbError.code === "23505") {
          throw CustomError.badRequest("El post ya existe");
        } else if (dbError.code === "23502") {
          throw CustomError.badRequest("Faltan campos obligatorios");
        }
      }

      // Si ya es un CustomError
      if (error instanceof CustomError) {
        throw error;
      }

      console.error("Error creating post:", error);
      throw CustomError.internalServer("Error al crear el post");
    }
  }

  async getPostsByUser(userId: string, page: number = 1) {
    try {
      const take = 5;
      const skip = (page - 1) * take;

      // Validación adicional en el servicio
      if (!userId) throw new Error("ID de usuario no proporcionado");

      const [posts, total] = await Post.findAndCount({
        where: {
          user: { id: userId },
        },
        relations: ["user", "user.subscriptions"],
        order: { createdAt: "DESC" },
        take,
        skip,
      });

      // Procesamiento de imágenes con manejo de errores
      const processedPosts = await Promise.all(
        posts.map(async (post) => {
          try {
            const [imgs, userImage] = await Promise.all([
              Promise.all(
                (post.imgpost ?? []).map((img) =>
                  UploadFilesCloud.getFile({
                    bucketName: envs.AWS_BUCKET_NAME,
                    key: img,
                  }).catch(() => null)
                )
              ),
              post.user?.photoperfil
                ? UploadFilesCloud.getFile({
                  bucketName: envs.AWS_BUCKET_NAME,
                  key: post.user.photoperfil,
                }).catch(() => null)
                : null,
            ]);

            return {
              ...post,
              imgpost: imgs.filter((img) => img !== null),
              user: {
                id: post.user.id,
                name: post.user.name,
                surname: post.user.surname,
                photoperfil: userImage,
                whatsapp: post.user.whatsapp,
              },
              subscription: post.user.subscriptions?.length
                ? {
                  id: post.user.subscriptions[0].id, // puedes filtrar la activa
                  status: post.user.subscriptions[0].status,
                  plan: post.user.subscriptions[0].plan,
                }
                : null,

              likesCount: post.likesCount || 0,
            };
          } catch (error) {
            return null;
          }
        })
      );

      return {
        total,
        currentPage: page,
        totalPages: Math.ceil(total / take),
        posts: processedPosts.filter((post) => post !== null),
      };
    } catch (error) {
      throw error; // Re-lanzar para manejo en el controlador
    }
  }

  // ADMIN: Get all posts for a specific user (Paginated, All Statuses)
  async getPostsByUserAdmin(userId: string, page: number = 1, limit: number = 10) {
    try {
      const skip = (page - 1) * limit;

      const [posts, total] = await Post.findAndCount({
        where: { user: { id: userId } }, // No status filter implies ALL statuses
        relations: ["user", "user.subscriptions"],
        order: { createdAt: "DESC" },
        take: limit,
        skip: skip
      });

      // Process images
      const formattedPosts = await Promise.all(
        posts.map(async (post) => {
          const resolvedImgs = await Promise.all(
            (post.imgpost ?? []).map((img) =>
              UploadFilesCloud.getFile({
                bucketName: envs.AWS_BUCKET_NAME,
                key: img
              }).catch(() => null)
            )
          );

          // Subscription Status Logic for specific user
          const hasActiveSub = await this.subscriptionService.hasActiveSubscription(userId);

          return {
            ...post,
            imgpost: resolvedImgs.filter(i => i),
            hasActiveSubscription: hasActiveSub // Useful for frontend logic
          };
        })
      );

      return {
        posts: formattedPosts,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page
      };

    } catch (error) {
      console.error("Error in getPostsByUserAdmin:", error);
      throw CustomError.internalServer("Error fetching user posts for admin");
    }
  }

  async updatePostDate(
    postId: string,
    userId: string
  ): Promise<{ message: string }> {
    try {
      const post = await Post.findOne({
        where: { id: postId },
        relations: ["user"],
      });

      if (!post) {
        throw CustomError.notFound("Post no encontrado");
      }

      if (!post.user || post.user.id !== userId) {
        throw CustomError.forbiden("No autorizado para modificar este post");
      }

      post.createdAt = new Date();

      await post.save();

      return { message: "La fecha del post fue actualizada correctamente" };
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }

      throw CustomError.internalServer(
        "Ocurrió un error al actualizar la fecha del post"
      );
    }
  }

  async deletePost(id: string, userId: string): Promise<{ message: string }> {
    const post = await Post.findOne({
      where: { id },
      relations: ["user"],
    });

    if (!post) throw CustomError.notFound("Post no encontrado");
    if (post.user.id !== userId)
      throw CustomError.forbiden("No autorizado para eliminar este post");

    return await this.hardDeletePost(post);
  }

  public async hardDeletePost(post: Post): Promise<{ message: string }> {
    // 1. Eliminar imágenes de S3 primero
    if (post.imgpost?.length > 0) {
      for (const key of post.imgpost) {
        try {
          await UploadFilesCloud.deleteFile({
            bucketName: envs.AWS_BUCKET_NAME,
            key: key,
          });
        } catch (e) {
          console.error(`Error deleting post image ${key}:`, e);
          throw CustomError.internalServer("Error al eliminar las imágenes del almacenamiento S3. Operación abortada para evitar inconsistencias.");
        }
      }
    }

    // 2. Eliminar relaciones (likes, reportes)
    try {
      await Like.delete({ post: { id: post.id } });
      await PostReport.delete({ post: { id: post.id } });
    } catch (e) {
      console.error("Error deleting post relations", e);
      throw CustomError.internalServer("Error al eliminar interacciones. Operación abortada.");
    }

    // 3. Eliminar definitivamente el post de la BD
    try {
      await Post.remove(post);
    } catch (e) {
      console.error("Error deleting post from DB", e);
      throw CustomError.internalServer("Error al eliminar el post de la base de datos.");
    }

    getIO().emit("postChanged", {
      action: "hardDelete",
      postId: post.id,
    });

    return { message: "Post eliminado permanentemente" };
  }
  async updatePost(id: string, postData: UpdateDTO) {
    const post = await Post.preload({
      id,
      ...postData, // solo asigna los campos que existan
    });

    if (!post) {
      throw CustomError.notFound("Post no encontrado");
    }

    try {
      const postActualizado = await post.save();
      return postActualizado;
    } catch {
      throw CustomError.internalServer("Error actualizando el Post");
    }
  }

  // ==========================================
  // 🛡️ ADMIN METHODS (Advanced Management)
  // ==========================================

  async getAdminStats() {
    const totalPosts = await Post.count();
    const activePosts = await Post.count({ where: { statusPost: StatusPost.PUBLISHED } });
    const paidPosts = await Post.count({ where: { isPaid: true } });
    const freePosts = await Post.count({ where: { isPaid: false } });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const last30Days = await Post.count({ where: { createdAt: MoreThan(thirtyDaysAgo) } });

    return {
      totalPosts,
      activePosts,
      paidPosts,
      freePosts,
      last30Days,
      revenue: 0 // Placeholder
    };
  }



  async getAdminPosts(filters: any, page: number = 1, limit: number = 20) {
    const { id, status, type, startDate, endDate } = filters;

    const query = Post.createQueryBuilder("post")
      .leftJoinAndSelect("post.user", "user")
      .orderBy("post.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit);

    if (id) {
      query.andWhere("post.id = :id", { id });
    }
    if (status) {
      query.andWhere("post.statusPost = :status", { status });
    }
    if (type) {
      const isPaid = type === 'PAGADO';
      query.andWhere("post.isPaid = :isPaid", { isPaid });
    }
    if (startDate && endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.andWhere("post.createdAt BETWEEN :start AND :end", { start: startDate, end });
    }

    const [posts, total] = await query.getManyAndCount();

    const formattedPosts = await Promise.all(
      posts.map(async (post) => {
        const resolvedImgs = await Promise.all(
          (post.imgpost ?? []).map((img) =>
            UploadFilesCloud.getFile({
              bucketName: envs.AWS_BUCKET_NAME,
              key: img,
            }).catch(() => null)
          )
        );

        const userImage = post.user?.photoperfil
          ? await UploadFilesCloud.getFile({ bucketName: envs.AWS_BUCKET_NAME, key: post.user.photoperfil }).catch(() => null)
          : null;

        return {
          ...post,
          imgpost: resolvedImgs.filter(i => i),
          user: {
            ...post.user,
            photoperfil: userImage
          }
        };
      })
    );

    return {
      posts: formattedPosts,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page
    };
  }



  //ADMINISTRADOR

  // Cuenta posts pagados activos (autor con suscripción vigente)
  async countActivePaidPosts(): Promise<number> {
    try {
      // 1) Traer solo lo necesario: id del post y del usuario
      const paidPosts = await Post.createQueryBuilder("post")
        .leftJoin("post.user", "user")
        .select(["post.id", "user.id"])
        .where("post.statusPost = :status", { status: StatusPost.PUBLISHED })
        .andWhere("post.isPaid = :isPaid", { isPaid: true })
        .getMany();

      if (paidPosts.length === 0) return 0;

      // 2) Evitar llamadas repetidas: chequear suscripción por usuario único
      const uniqueUserIds = Array.from(
        new Set(paidPosts.map((p) => p.user?.id).filter(Boolean))
      ) as string[];

      const activeUsers = await Promise.all(
        uniqueUserIds.map(async (uid) => ({
          uid,
          active: await this.subscriptionService.hasActiveSubscription(uid),
        }))
      );

      const activeUserSet = new Set(
        activeUsers.filter((u) => u.active).map((u) => u.uid)
      );

      // 3) Contar solo posts cuyo autor tenga suscripción activa
      const total = paidPosts.reduce(
        (acc, p) => (p.user && activeUserSet.has(p.user.id) ? acc + 1 : acc),
        0
      );

      return total;
    } catch (error) {
      throw CustomError.internalServer("Error al contar posts pagados activos");
    }
  }
  // Cantidad de posts pagados activos publicados en las últimas 24 horas
  async countActivePaidPostsLast24h(): Promise<number> {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Trae solo lo necesario: id del post y del usuario
      const posts = await Post.createQueryBuilder("post")
        .leftJoinAndSelect("post.user", "user")
        .select(["post.id", "user.id"])
        .where("post.statusPost = :status", { status: StatusPost.PUBLISHED })
        .andWhere("post.isPaid = :isPaid", { isPaid: true })
        .andWhere("post.createdAt >= :since", { since })
        .getMany();

      if (posts.length === 0) return 0;

      // Verifica suscripción activa por usuario único
      const uniqueUserIds = Array.from(
        new Set(posts.map((p) => p.user?.id).filter(Boolean))
      ) as string[];

      const results = await Promise.all(
        uniqueUserIds.map(async (uid) => ({
          uid,
          active: await this.subscriptionService.hasActiveSubscription(uid),
        }))
      );

      const activeUserSet = new Set(
        results.filter((r) => r.active).map((r) => r.uid)
      );

      // Cuenta solo los posts cuyo autor tenga suscripción activa
      const total = posts.reduce(
        (acc, p) => (p.user && activeUserSet.has(p.user.id) ? acc + 1 : acc),
        0
      );

      return total;
    } catch (error) {
      throw CustomError.internalServer(
        "Error al contar posts pagados activos de las últimas 24 horas"
      );
    }
  }
  // Cantidad de posts gratuitos publicados (no expirados)
  async countFreePublishedPosts(): Promise<number> {
    try {
      const now = new Date();

      const total = await Post.createQueryBuilder("post")
        .where("post.statusPost = :status", { status: StatusPost.PUBLISHED })
        .andWhere("post.isPaid = :isPaid", { isPaid: false })
        .andWhere("(post.expiresAt IS NULL OR post.expiresAt > :now)", { now })
        .getCount();

      return total;
    } catch (error) {
      throw CustomError.internalServer(
        "Error al contar posts gratuitos publicados"
      );
    }
  }
  // Dentro de la clase PostService
  async findPostByIdAdmin(postId: string) {
    try {
      if (!postId || !uuidValidate(postId)) {
        throw CustomError.badRequest("ID de post inválido");
      }

      const post = await Post.findOne({
        where: { id: postId },
        relations: ["user"],
        select: {
          user: {
            id: true,
            name: true,
            surname: true,
            photoperfil: true,
            whatsapp: true,
            email: true,
          },
        },
      });

      if (!post) throw CustomError.notFound("Post no encontrado");

      // Resolver imágenes del post y la foto de perfil del usuario (si existen)
      const [imgs, userImage] = await Promise.all([
        Promise.all(
          (post.imgpost ?? []).map(
            (key) =>
              UploadFilesCloud.getFile({
                bucketName: envs.AWS_BUCKET_NAME,
                key,
              }).catch(() => null) // tolerante a errores de archivos faltantes
          )
        ),
        post.user?.photoperfil
          ? UploadFilesCloud.getFile({
            bucketName: envs.AWS_BUCKET_NAME,
            key: post.user.photoperfil,
          }).catch(() => null)
          : null,
      ]);

      return {
        id: post.id,
        title: post.title,
        subtitle: post.subtitle,
        content: post.content,
        statusPost: post.statusPost,
        isPaid: post.isPaid,
        createdAt: post.createdAt,
        expiresAt: post.expiresAt,
        totalLikes: post.likesCount ?? 0,
        imgpost: (imgs ?? []).filter(Boolean),
        user: {
          id: post.user.id,
          name: post.user.name,
          surname: post.user.surname,
          whatsapp: post.user.whatsapp,
          photoperfil: userImage,
          email: post.user.email,
        },
      };
    } catch (error) {
      if (error instanceof CustomError) throw error;
      throw CustomError.internalServer("Error buscando el post por ID (admin)");
    }
  }
  // ADMINISTRADOR - Bloquear post
  // ADMINISTRADOR - Bloquear/Desbloquear (toggle)
  async blockPostAdmin(
    postId: string
  ): Promise<{ message: string; status: StatusPost }> {
    try {
      if (!postId || !uuidValidate(postId)) {
        throw CustomError.badRequest("ID de post inválido");
      }

      const post = await Post.findOne({ where: { id: postId } });
      if (!post) throw CustomError.notFound("Post no encontrado");

      // Toggle: si está bloqueado -> PUBLISHED; si no, FLAGGED
      const wasBlocked = post.statusPost === StatusPost.FLAGGED;
      post.statusPost = wasBlocked
        ? StatusPost.PUBLISHED
        : StatusPost.FLAGGED;

      await post.save();

      return {
        message: wasBlocked ? "Post desbloqueado" : "Post bloqueado",
        status: post.statusPost
      }
    } catch (error) {
      throw CustomError.internalServer("Error toggling block");
    }
  }

  // ADMIN: Cambiar estado explícito
  async changeStatusPostAdmin(postId: string, status: StatusPost) {
    const post = await Post.findOne({ where: { id: postId } });
    if (!post) throw CustomError.notFound("Post no encontrado");

    post.statusPost = status;

    await post.save();
    getIO().emit("postChanged", { action: "update", postId: post.id });
    return { message: `Estado cambiado a ${status}`, status: post.statusPost };
  }

  // ADMIN: Purga definitiva
  async purgePostAdmin(postId: string) {
    const post = await Post.findOne({ where: { id: postId } });
    if (!post) throw CustomError.notFound("Post no encontrado");

    return await this.hardDeletePost(post);
  }


  async expirePosts() {
    const now = new Date();
    try {
      const expiredPosts = await Post.createQueryBuilder("post")
        .where("post.statusPost = :status", { status: StatusPost.PUBLISHED })
        .andWhere("post.isPaid = false")
        .andWhere("post.expiresAt <= :now", { now })
        .getMany();

      if (expiredPosts.length === 0) return 0;

      let deletedCount = 0;
      for (const post of expiredPosts) {
        await this.hardDeletePost(post);
        deletedCount++;
      }

      return deletedCount;
    } catch (error) {
      console.error("Error al expirar posts:", error);
      throw CustomError.internalServer("Error al procesar la expiración de posts");
    }
  }
}
