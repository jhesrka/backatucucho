import { CustomError } from "../../../domain";
import { CategoriaServicio, SubcategoriaServicio, Servicio, StatusServicio } from "../../../data/postgres/models/index";
import { Status } from "../../../data/postgres/models/user.model";
import { MoreThan } from "typeorm";

export class ServiceCategoryService {
  constructor() {}

  // ==============================
  // PUBLIC METHODS
  // ==============================

  async getPublicCategories() {
    try {
      const now = new Date();

      // Buscar categorías que tengan servicios aprobados y vigentes
      const categorias = await CategoriaServicio.createQueryBuilder("cat")
        .innerJoin("servicio", "srv", "srv.categoriaId = cat.id")
        .where("cat.estado = :status", { status: Status.ACTIVE })
        .andWhere("srv.statusServicio = :srvStatus", { srvStatus: StatusServicio.APROBADO })
        .andWhere("srv.fechaFinSuscripcion > :now", { now })
        .select(["cat.id", "cat.nombre", "cat.icono"])
        .distinct(true)
        .orderBy("cat.nombre", "ASC")
        .getMany();

      return categorias;
    } catch (error) {
      throw CustomError.internalServer("Error al obtener categorías públicas de servicios");
    }
  }

  async getPublicSubcategoriesByCategory(categoryId: string) {
    try {
      const now = new Date();

      // Buscar subcategorías que tengan servicios aprobados y vigentes
      const subcategorias = await SubcategoriaServicio.createQueryBuilder("subcat")
        .innerJoin("servicio", "srv", "srv.subcategoriaId = subcat.id")
        .where("subcat.categoriaId = :categoryId", { categoryId })
        .andWhere("subcat.estado = :status", { status: Status.ACTIVE })
        .andWhere("srv.statusServicio = :srvStatus", { srvStatus: StatusServicio.APROBADO })
        .andWhere("srv.fechaFinSuscripcion > :now", { now })
        .select(["subcat.id", "subcat.nombre", "subcat.icono"])
        .distinct(true)
        .orderBy("subcat.nombre", "ASC")
        .getMany();

      return subcategorias;
    } catch (error) {
      throw CustomError.internalServer("Error al obtener subcategorías públicas de servicios");
    }
  }

  async getActiveCategoriesForCreation() {
    try {
      const categorias = await CategoriaServicio.find({
        where: { estado: Status.ACTIVE },
        order: { nombre: "ASC" }
      });
      
      const categoriasConSub = await Promise.all(categorias.map(async (cat) => {
        const subcategorias = await SubcategoriaServicio.find({
            where: { categoria: { id: cat.id }, estado: Status.ACTIVE },
            order: { nombre: "ASC" }
        });
        return {
            ...cat,
            subcategorias
        }
      }));

      return categoriasConSub;
    } catch (error: any) {
      console.error("Error original getActiveCategoriesForCreation:", error);
      throw CustomError.internalServer(error.message || "Error al obtener categorías activas para creación");
    }
  }

  // ==============================
  // ADMIN METHODS
  // ==============================

  async getAllCategoriesAdmin() {
    try {
      const categorias = await CategoriaServicio.find({
        order: { nombre: "ASC" }
      });
      
      const categoriasConSub = await Promise.all(categorias.map(async (cat) => {
        const subcategorias = await SubcategoriaServicio.find({
            where: { categoria: { id: cat.id } },
            order: { nombre: "ASC" }
        });
        return {
            ...cat,
            subcategorias
        }
      }));

      return categoriasConSub;
    } catch (error) {
      throw CustomError.internalServer("Error al obtener categorías de servicios");
    }
  }

  async createCategory(nombre: string) {
    try {
      const category = new CategoriaServicio();
      category.nombre = nombre;
      await category.save();
      return category;
    } catch (error) {
      throw CustomError.internalServer("Error al crear la categoría de servicio");
    }
  }

  async updateCategory(id: string, nombre?: string, estado?: Status) {
    try {
      const category = await CategoriaServicio.findOne({ where: { id } });
      if (!category) throw CustomError.notFound("Categoría no encontrada");

      if (nombre) category.nombre = nombre;
      if (estado) category.estado = estado;

      await category.save();
      return category;
    } catch (error) {
      if (error instanceof CustomError) throw error;
      throw CustomError.internalServer("Error al actualizar la categoría");
    }
  }

  async createSubcategory(categoriaId: string, nombre: string, icono?: string) {
    try {
      const category = await CategoriaServicio.findOne({ where: { id: categoriaId } });
      if (!category) throw CustomError.notFound("Categoría no encontrada");

      const subcategory = new SubcategoriaServicio();
      subcategory.nombre = nombre;
      subcategory.categoria = category;
      if (icono) subcategory.icono = icono;
      await subcategory.save();

      return subcategory;
    } catch (error) {
      if (error instanceof CustomError) throw error;
      throw CustomError.internalServer("Error al crear la subcategoría de servicio");
    }
  }

  async updateSubcategory(id: string, nombre?: string, estado?: Status, icono?: string) {
    try {
      const subcategory = await SubcategoriaServicio.findOne({ where: { id } });
      if (!subcategory) throw CustomError.notFound("Subcategoría no encontrada");

      if (nombre) subcategory.nombre = nombre;
      if (estado) subcategory.estado = estado;
      if (icono) subcategory.icono = icono;

      await subcategory.save();
      return subcategory;
    } catch (error) {
      if (error instanceof CustomError) throw error;
      throw CustomError.internalServer("Error al actualizar la subcategoría");
    }
  }

  async deleteCategory(id: string) {
    try {
      const category = await CategoriaServicio.findOne({ where: { id } });
      if (!category) throw CustomError.notFound("Categoría no encontrada");
      
      const subcategoriesCount = await SubcategoriaServicio.count({ where: { categoria: { id } } });
      if (subcategoriesCount > 0) {
        throw CustomError.badRequest("No se puede eliminar la categoría porque aún tiene subcategorías. Elimine las subcategorías primero.");
      }

      await category.remove();
      return { message: "Categoría eliminada correctamente" };
    } catch (error) {
      if (error instanceof CustomError) throw error;
      throw CustomError.internalServer("Error al eliminar la categoría");
    }
  }

  async deleteSubcategory(id: string) {
    try {
      const subcategory = await SubcategoriaServicio.findOne({ where: { id } });
      if (!subcategory) throw CustomError.notFound("Subcategoría no encontrada");

      const activeServicesCount = await Servicio.count({
        where: {
          subcategoria: { id },
          statusServicio: StatusServicio.APROBADO
        }
      });

      if (activeServicesCount > 0) {
        throw CustomError.badRequest("No se puede eliminar la subcategoría porque hay publicaciones de usuarios activas usándola.");
      }

      await subcategory.remove();
      return { message: "Subcategoría eliminada correctamente" };
    } catch (error) {
      if (error instanceof CustomError) throw error;
      throw CustomError.internalServer("Error al eliminar la subcategoría");
    }
  }

  async seedCategories() {
    const categoriesData = [
      { name: "Hogar y Construcción", icon: "FaHammer", subs: [
        {name: "Albañiles", icon: "FaHardHat"}, {name: "Electricistas", icon: "FaBolt"}, {name: "Plomeros", icon: "FaWrench"}, 
        {name: "Carpinteros", icon: "FaHammer"}, {name: "Pintores", icon: "FaPaintRoller"}, {name: "Soldadores", icon: "FaFire"}, 
        {name: "Cerrajeros", icon: "FaKey"}, {name: "Techadores", icon: "FaHouseDamage"}, {name: "Instaladores", icon: "FaTools"}, 
        {name: "Remodelaciones", icon: "FaHome"}
      ]},
      { name: "Profesionales", icon: "FaUserTie", subs: [
        {name: "Abogados", icon: "FaBalanceScale"}, {name: "Contadores", icon: "FaCalculator"}, 
        {name: "Arquitectos", icon: "FaDraftingCompass"}, {name: "Ingenieros", icon: "FaHardHat"}
      ]},
      { name: "Tecnología", icon: "FaLaptopCode", subs: [
        {name: "Técnicos de computadoras", icon: "FaDesktop"}, {name: "Técnicos de celulares", icon: "FaMobileAlt"}, 
        {name: "Programadores", icon: "FaCode"}, {name: "Diseñadores web", icon: "FaPalette"}, 
        {name: "Soporte técnico", icon: "FaHeadset"}
      ]},
      { name: "Internet y Telecomunicaciones", icon: "FaWifi", subs: [
        {name: "Asesores de internet", icon: "FaNetworkWired"}, 
        {name: "Redes WiFi", icon: "FaWifi"}
      ]},
      { name: "Transporte y Carga", icon: "FaTruck", subs: [
        {name: "Fletes", icon: "FaDolly"}, {name: "Alquiler de camionetas", icon: "FaTruckPickup"}, 
        {name: "Alquiler de camiones", icon: "FaTruckMoving"}, {name: "Transporte escolar", icon: "FaBus"}, 
        {name: "Mudanzas", icon: "FaBoxOpen"}
      ]},
      { name: "Automotriz", icon: "FaCar", subs: [
        {name: "Mecánicos", icon: "FaWrench"}, {name: "Vulcanizadoras", icon: "FaTire"}, 
        {name: "Lavado de vehículos", icon: "FaShower"}, {name: "Electricistas automotrices", icon: "FaCarBattery"}
      ]},
      { name: "Salud", icon: "FaHeartbeat", subs: [
        {name: "Médicos", icon: "FaStethoscope"}, {name: "Odontólogos", icon: "FaTooth"}, 
        {name: "Psicólogos", icon: "FaBrain"}, {name: "Enfermeros", icon: "FaUserNurse"}, 
        {name: "Fisioterapeutas", icon: "FaWheelchair"}
      ]},
      { name: "Belleza", icon: "FaSpa", subs: [
        {name: "Peluquerías", icon: "FaCut"}, {name: "Barberías", icon: "FaStoreAlt"}, 
        {name: "Manicuristas", icon: "FaHandSparkles"}, {name: "Maquilladoras", icon: "FaMagic"}, 
        {name: "Cosmetología", icon: "FaSpa"}
      ]},
      { name: "Educación", icon: "FaGraduationCap", subs: [
        {name: "Profesores particulares", icon: "FaChalkboardTeacher"}, {name: "Cursos", icon: "FaBook"}, 
        {name: "Tutorías", icon: "FaUserGraduate"}, {name: "Academias", icon: "FaSchool"}
      ]},
      { name: "Deportes", icon: "FaRunning", subs: [
        {name: "Gimnasios", icon: "FaDumbbell"}, {name: "Clubes de fútbol", icon: "FaFutbol"}, 
        {name: "Clubes de taekwondo", icon: "FaFistRaised"}, {name: "Clubes de kickboxing", icon: "FaMitten"}, 
        {name: "Clubes de boxeo", icon: "FaBox"}, {name: "Clubes de danza", icon: "FaMusic"}, 
        {name: "Clubes de natación", icon: "FaSwimmer"}, {name: "Entrenadores personales", icon: "FaHeartbeat"}
      ]},
      { name: "Música y Arte", icon: "FaMusic", subs: [
        {name: "Clases de música", icon: "FaGuitar"}, {name: "Bandas musicales", icon: "FaDrum"}, 
        {name: "Mariachis", icon: "FaGuitar"}, {name: "DJs", icon: "FaHeadphones"}, 
        {name: "Artistas", icon: "FaPalette"}
      ]},
      { name: "Eventos", icon: "FaGlassCheers", subs: [
        {name: "Decoración", icon: "FaStar"}, {name: "Animación", icon: "FaSmile"}, 
        {name: "Fotografía", icon: "FaCamera"}, {name: "Video", icon: "FaVideo"}, 
        {name: "Sonido e iluminación", icon: "FaLightbulb"}
      ]},
      { name: "Mascotas", icon: "FaPaw", subs: [
        {name: "Veterinarios", icon: "FaSyringe"}, {name: "Peluquería canina", icon: "FaCut"}, 
        {name: "Paseadores de mascotas", icon: "FaWalking"}, {name: "Adiestramiento", icon: "FaBone"}
      ]},
      { name: "Limpieza y Mantenimiento", icon: "FaBroom", subs: [
        {name: "Limpieza de casas", icon: "FaBroom"}, {name: "Limpieza de oficinas", icon: "FaBuilding"}, 
        {name: "Lavado de muebles", icon: "FaCouch"}, {name: "Jardinería", icon: "FaLeaf"}, 
        {name: "Fumigación", icon: "FaBug"}
      ]},
      { name: "Servicios Temporales", icon: "FaClock", subs: [
        {name: "Cuidado de adultos mayores", icon: "FaBlind"}, {name: "Niñeras por horas", icon: "FaBaby"}, 
        {name: "Cocineros a domicilio", icon: "FaUtensils"}, {name: "Ayudantes para eventos", icon: "FaHandsHelping"}, 
        {name: "Ayudantes de mudanza", icon: "FaBoxOpen"}
      ]},
      { name: "Seguridad Electrónica", icon: "FaShieldAlt", subs: [
        {name: "Instalación de cámaras", icon: "FaVideo"}, {name: "Alarmas", icon: "FaBell"}, 
        {name: "Cercas eléctricas", icon: "FaBolt"}
      ]},
      { name: "Turismo", icon: "FaPlane", subs: [
        {name: "Guías turísticos", icon: "FaMapMarkedAlt"}, {name: "Transporte turístico", icon: "FaBusAlt"}
      ]},
      { name: "Diseño y Publicidad", icon: "FaPaintBrush", subs: [
        {name: "Diseñadores gráficos", icon: "FaPencilRuler"}, {name: "Impresión publicitaria", icon: "FaPrint"}, 
        {name: "Community managers", icon: "FaUsers"}, {name: "Fotógrafos comerciales", icon: "FaCameraRetro"}, 
        {name: "Creadores de contenido", icon: "FaFilm"}
      ]}
    ];

    try {
      for (const catData of categoriesData) {
        let category = await CategoriaServicio.findOne({ where: { nombre: catData.name } });
        if (!category) {
          category = new CategoriaServicio();
          category.nombre = catData.name;
          category.icono = catData.icon;
          await category.save();
        } else if (!category.icono) {
          category.icono = catData.icon;
          await category.save();
        }

        for (const subData of catData.subs) {
          let exists = await SubcategoriaServicio.findOne({ where: { nombre: subData.name, categoria: { id: category.id } } });
          if (!exists) {
            exists = new SubcategoriaServicio();
            exists.nombre = subData.name;
            exists.categoria = category;
            exists.icono = subData.icon;
            await exists.save();
          } else if (!exists.icono) {
            exists.icono = subData.icon;
            await exists.save();
          }
        }
      }
      return { message: "Seed de categorías completado." };
    } catch (error) {
      console.error(error);
      throw CustomError.internalServer("Error al hacer seed de categorías");
    }
  }
}
