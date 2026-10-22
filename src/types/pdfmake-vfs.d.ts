/**
 * Declaración de tipos para el VFS de fuentes que empaqueta pdfmake
 * (build/vfs_fonts.js exporta un objeto plano { "Roboto-Regular.ttf": base64, ... }).
 */
declare module 'pdfmake/build/vfs_fonts' {
  const vfs: Record<string, string>;
  export = vfs;
}
