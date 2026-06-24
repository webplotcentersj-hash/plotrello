/** Tamaño máximo por archivo en tótem de impresión (pendrive / celular QR). */
export const TOTEM_PRINT_MAX_FILE_BYTES = 25 * 1024 * 1024

/** Cantidad máxima de archivos por solicitud. */
export const TOTEM_PRINT_MAX_FILES = 10

export const TOTEM_PRINT_MAX_FILE_MB = TOTEM_PRINT_MAX_FILE_BYTES / (1024 * 1024)
