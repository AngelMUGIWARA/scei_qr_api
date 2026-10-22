import vfs = require('pdfmake/build/vfs_fonts');
import type { TFontDictionary } from 'pdfmake/interfaces';

/**
 * Fuentes Roboto incluidas en el paquete pdfmake (build/vfs_fonts, base64).
 * Se decodifican a Buffer para usarlas directamente con PdfPrinter en Node,
 * sin necesidad de archivos .ttf en disco (pdfkit acepta buffers como fuente).
 */
const decode = (filename: string): Buffer => {
  const base64 = vfs[filename];
  if (!base64) {
    throw new Error(`Fuente "${filename}" no encontrada en pdfmake/build/vfs_fonts`);
  }
  return Buffer.from(base64, 'base64');
};

export const PDF_FONTS: TFontDictionary = {
  Roboto: {
    normal: decode('Roboto-Regular.ttf'),
    bold: decode('Roboto-Medium.ttf'), // el paquete no incluye Bold; Medium es su equivalente
    italics: decode('Roboto-Italic.ttf'),
    bolditalics: decode('Roboto-MediumItalic.ttf'),
  },
};
