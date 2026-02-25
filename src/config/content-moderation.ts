export const FORBIDDEN_WORDS = [
    // Groserías / Insultos
    "mierda", "puto", "puta", "hijo de puta", "cabron", "pendejo", "idiota", "estupido", "maldito",
    // Sexual explícito
    "sexo", "porno", "pornografia", "ereccion", "vagina", "pene", "coito", "follar", "chupar",
    // Violencia / Amenazas
    "matar", "asesinar", "morir", "sangre", "golpear", "arma", "pistola", "muerte",
    // Estafas
    "gana dinero facil", "cripto", "inversion segura", "duplica tu dinero", "estafa",
    // Jerga local (Ecuador)
    "verga", "careverga", "chucha", "huevon", "cholo", "longo"
];

export const CONTENT_MODERATION_THRESHOLD = 3;

export const normalizeContent = (text: string): string => {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Eliminar tildes
        .replace(/[^a-z0-9 ]/g, "") // Eliminar símbolos
        .replace(/7/g, "t")
        .replace(/0/g, "o")
        .replace(/1/g, "i")
        .replace(/3/g, "e")
        .replace(/4/g, "a")
        .replace(/5/g, "s");
};

export const containsForbiddenWords = (text: string): boolean => {
    const normalized = normalizeContent(text);
    return FORBIDDEN_WORDS.some(word => {
        const normalizedWord = normalizeContent(word);
        return normalized.includes(normalizedWord);
    });
};
