// src/presentation/services/post.service.ts
import { ILike, LessThan } from "typeorm";
import { envs } from "../../config";
import { getIO } from "../../config/socket";
import { UploadFilesCloud } from "../../config/upload-files-cloud-adapter";
import { Post, StatusPost, Like } from "../../data";
import { CreateDTO, CreatePostDTO, CustomError, UpdateDTO } from "../../domain";
import { UserService } from "./usuario/user.service";
import { SubscriptionService } from "./postService/subscription.service";
import { FreePostTrackerService } from "./postService/free-post-tracker.service";
import { validate as uuidValidate } from "uuid";

export class PostService {
  constructor(
    public readonly userService: UserService,
    public readonly subscriptionService: SubscriptionService,
    public readonly freePostTrackerService: FreePostTrackerService
  ) { }
  //este ya esta funcionando

  async findAllPostPaginated(page: number, limit: number, userId?: string) {
    try {
      const skip = (page - 1) * limit;
      const now = new Date();

      // 1. Consulta base con condiciones de expiración
      const query = Post.createQueryBuilder("post")
        .leftJoinAndSelect("post.user", "user")
        .where("post.statusPost = :status", { status: StatusPost.PUBLICADO })
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

      // Limpiar nulos (posts eliminados)
      const validPosts = filteredPosts.filter((p) => p !== null);

      // 2. Procesar posts expirados en segundo plano
      this.processExpiredPosts().catch((error) => {
        console.error("Error al procesar posts expirados:", error);
      });

      // 3. Procesamiento optimizado de imágenes + CHECK LIKES
      const formattedPosts = await Promise.all(
        validPosts.map(async (post) => {
          const [imgs, userImage, isLiked] = await Promise.all([
            Promise.all(
              (post.imgpost ?? []).map((img) =>
                UploadFilesCloud.getFile({
                  bucketName: envs.AWS_BUCKET_NAME,
                  key: img,
                })
              )
            ),
            post.user?.photoperfil
              ? UploadFilesCloud.getFile({
                bucketName: envs.AWS_BUCKET_NAME,
                key: post.user.photoperfil,
              })
              : null,
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
            isLiked, // <--- Nueva propiedad
          };
        })
      );

      return {
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        posts: formattedPosts,
      };
    } catch (error) {
      throw CustomError.internalServer("Error al obtener posts paginados");
    }
  }

  // Método para manejar posts expirados
  private async processExpiredPosts() {
    const now = new Date();

    // Buscar posts públicos gratuitos que hayan expirado
    const expiredPosts = await Post.createQueryBuilder("post")
      .where("post.statusPost = :status", { status: StatusPost.PUBLICADO })
      .andWhere("post.isPaid = false")
      .andWhere("post.expiresAt <= :now", { now })
      .getMany();

    if (expiredPosts.length > 0) {
      // Actualizar todos los posts expirados en una sola operación
      await Post.createQueryBuilder()
        .update()
        .set({ statusPost: StatusPost.ELIMINADO })
        .whereInIds(expiredPosts.map((p) => p.id))
        .execute();

      // Emitir eventos de socket para cada post eliminado
      expiredPosts.forEach((post) => {
        getIO().emit("postChanged", {
          action: "delete",
          postId: post.id,
        });
      });
    }
  }


  async searchPost(searchTerm: string, userId?: string) {
    try {
      const posts = await Post.find({
        where: [
          { title: ILike(`%${searchTerm}%`) },
          { subtitle: ILike(`%${searchTerm}%`) },
          { user: { name: ILike(`%${searchTerm}%`) } },
          { user: { surname: ILike(`%${searchTerm}%`) } },
        ],
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
        order: { createdAt: "DESC" },
      });

      // Resolviendo imágenes + LIKES
      const resolvedPosts = await Promise.all(
        posts.map(async (post) => {
          const [resolvedImgs, userImage, isLiked] = await Promise.all([
            Promise.all(
              (post.imgpost ?? []).map(async (img) => {
                return await UploadFilesCloud.getFile({
                  bucketName: envs.AWS_BUCKET_NAME,
                  key: img,
                });
              })
            ),
            UploadFilesCloud.getFile({
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
            imgpost: resolvedImgs,
            user: {
              ...post.user,
              photoperfil: userImage,
            },
            isLiked, // <--- return stat
          };
        })
      );

      return resolvedPosts;
    } catch (error) {
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
          return await UploadFilesCloud.getFile({
            bucketName: envs.AWS_BUCKET_NAME,
            key: img,
          });
        })
      ),
      UploadFilesCloud.getFile({
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
      imgpost: resolvedImgs,
      user: {
        ...post.user,
        photoperfil: userImage,
      },
      isLiked,
    };
  }

  async createPostPlan(postData: CreatePostDTO, imgs?: Express.Multer.File[]) {
    try {
      // 1. Validar usuario
      const user = await this.userService.findOneUser(postData.userId);
      if (!user) throw CustomError.notFound("Usuario no encontrado");

      // 2. Validar suscripción si es post pago
      if (postData.isPaid) {
        const hasActiveSub =
          await this.subscriptionService.hasActiveSubscription(user.id);
        if (!hasActiveSub) {
          throw CustomError.forbiden(
            "Requieres suscripción activa para posts pagos"
          );
        }
      }

      // 3. Manejar posts gratuitos (límite mensual)
      let freePostTracker;

      if (!postData.isPaid) {
        freePostTracker = await this.freePostTrackerService.getOrCreateTracker(
          user.id
        );
        if (freePostTracker.count >= 5) {
          throw CustomError.forbiden(
            "Límite de posts gratuitos alcanzado (5/mes)"
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

        // Obtener URLs firmadas
        urls = await Promise.all(
          keys.map((key) =>
            UploadFilesCloud.getFile({
              bucketName: envs.AWS_BUCKET_NAME,
              key,
            })
          )
        );
      }

      // 5. Crear y guardar el post
      const post = new Post();
      post.title = postData.title.toLowerCase().trim();
      post.subtitle = postData.subtitle.toLowerCase().trim();
      post.content = postData.content.trim();
      post.user = user;
      post.isPaid = postData.isPaid || false;
      post.imgpost = keys;

      // Configurar expiración para posts gratuitos

      if (!post.isPaid && freePostTracker) {
        post.expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutos
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
        user: {
          id: user.id,
          name: user.name,
          surname: user.surname,
          photoperfil: user.photoperfil,
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

      throw CustomError.internalServer("Error al crear el post");
    }
  }
  async deleteExpiredPosts(): Promise<{ deletedCount: number }> {
    try {
      // 1. Buscar posts gratuitos expirados (ELIMINADOS o con expiresAt pasado)
      const expiredPosts = await Post.find({
        where: [
          { statusPost: StatusPost.ELIMINADO }, // Posts ya marcados como eliminados
          {
            isPaid: false,
            expiresAt: LessThan(new Date()), // Posts gratuitos que ya expiraron
          },
        ],
        relations: ["user"], // Opcional: si necesitas info del usuario
      });

      if (expiredPosts.length === 0) {
        return { deletedCount: 0 };
      }

      let deletedCount = 0;

      // 2. Procesar cada post para borrado permanente
      for (const post of expiredPosts) {
        try {
          // 2.1. Eliminar imágenes de AWS si existen
          if (post.imgpost && post.imgpost.length > 0) {
            await Promise.all(
              post.imgpost.map((key) =>
                UploadFilesCloud.deleteFile({
                  bucketName: envs.AWS_BUCKET_NAME,
                  key: key,
                }).catch((error) =>
                  console.error(`Error al borrar imagen ${key}:`, error)
                )
              )
            );
          }

          // 2.2. Borrar el post de la base de datos (hard delete)
          await Post.remove(post);
          deletedCount++;
        } catch (postError) {
          console.error(`Error procesando post ${post.id}:`, postError);
          continue; // Continuar con el siguiente post si falla uno
        }
      }

      // 3. Emitir evento para actualizar clients (opcional)
      getIO().emit("postsCleaned", { count: deletedCount });

      return { deletedCount };
    } catch (error) {
      console.error("Error en deleteExpiredPosts:", error);
      throw CustomError.internalServer("Error al limpiar posts expirados");
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

    return post.statusPost === StatusPost.ELIMINADO
      ? await this.hardDeletePost(post)
      : await this.softDeletePost(post);
  }

  private async softDeletePost(post: Post): Promise<{ message: string }> {
    post.statusPost = StatusPost.ELIMINADO;
    post.deletedAt = new Date();
    await post.save();

    getIO().emit("postChanged", {
      action: "delete",
      postId: post.id,
    });

    return { message: "Post marcado como eliminado" };
  }

  private async hardDeletePost(post: Post): Promise<{ message: string }> {
    if (post.imgpost?.length > 0) {
      await Promise.all(
        post.imgpost.map((key) =>
          UploadFilesCloud.deleteFile({
            bucketName: envs.AWS_BUCKET_NAME,
            key: key,
          })
        )
      );
    }

    await Post.remove(post);

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

  //ADMINISTRADOR

  // Cuenta posts pagados activos (autor con suscripción vigente)
  async countActivePaidPosts(): Promise<number> {
    try {
      // 1) Traer solo lo necesario: id del post y del usuario
      const paidPosts = await Post.createQueryBuilder("post")
        .leftJoin("post.user", "user")
        .select(["post.id", "user.id"])
        .where("post.statusPost = :status", { status: StatusPost.PUBLICADO })
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
        .where("post.statusPost = :status", { status: StatusPost.PUBLICADO })
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
        .where("post.statusPost = :status", { status: StatusPost.PUBLICADO })
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

      // Toggle: si está bloqueado -> PUBLICADO; si no, BLOQUEADO
      const wasBlocked = post.statusPost === StatusPost.BLOQUEADO;

      post.statusPost = wasBlocked
        ? StatusPost.PUBLICADO
        : StatusPost.BLOQUEADO;
      await post.save();

      getIO().emit("postChanged", {
        action: wasBlocked ? "unblock" : "block",
        postId: post.id,
        status: post.statusPost,
      });

      return {
        message: wasBlocked
          ? "Post desbloqueado correctamente"
          : "Post bloqueado correctamente",
        status: post.statusPost,
      };
    } catch (error) {
      if (error instanceof CustomError) throw error;
      throw CustomError.internalServer("Error al bloquear/desbloquear el post");
    }
  }
  // ADMINISTRADOR - Borrar permanentemente posts ELIMINADO (> 3 días) y sus imágenes
  async purgeDeletedPostsOlderThan3Days(): Promise<{ deletedCount: number }> {
    try {
      const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

      // Buscar posts ELIMINADO con deletedAt <= cutoff
      const posts = await Post.find({
        where: {
          statusPost: StatusPost.ELIMINADO,
          deletedAt: LessThan(cutoff),
        },
      });

      if (posts.length === 0) {
        return { deletedCount: 0 };
      }

      let deletedCount = 0;

      for (const post of posts) {
        try {
          // 1) Borrar imágenes en AWS (si existen)
          if (post.imgpost?.length) {
            await Promise.all(
              post.imgpost.map(
                (key) =>
                  UploadFilesCloud.deleteFile({
                    bucketName: envs.AWS_BUCKET_NAME,
                    key,
                  }).catch(() => undefined) // tolerante a fallos
              )
            );
          }

          // 2) Borrado permanente en BD
          await Post.remove(post);
          deletedCount++;
        } catch {
          continue; // si falla un post, sigue con el siguiente
        }
      }

      return { deletedCount };
    } catch {
      throw CustomError.internalServer(
        "Error al purgar posts eliminados mayores a 3 días"
      );
    }
  }
}
