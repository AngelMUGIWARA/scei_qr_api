import { Injectable } from '@nestjs/common';
import { EstadoIncidencia, EstadoUso, Rol } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfmake';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PDF_FONTS } from './pdf-fonts';

@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * HU-AD-10: estadísticas generales para el panel del administrador.
   */
  async getEstadisticas() {
    const [
      totalEquipos,
      equiposActivos,
      totalUsuarios,
      alumnos,
      soportes,
      admins,
      usosActivos,
      usosFinalizados,
      incidenciasPendientes,
      incidenciasEnAtencion,
      incidenciasResueltas,
      usosPorEquipo,
      incidenciasPorTecnico,
    ] = await Promise.all([
      this.prisma.equipo.count(),
      this.prisma.equipo.count({ where: { activo: true } }),
      this.prisma.usuario.count(),
      this.prisma.usuario.count({ where: { rol: Rol.ALUMNO } }),
      this.prisma.usuario.count({ where: { rol: Rol.SOPORTE } }),
      this.prisma.usuario.count({ where: { rol: Rol.ADMIN } }),
      this.prisma.uso.count({ where: { estado: EstadoUso.ACTIVO } }),
      this.prisma.uso.count({ where: { estado: EstadoUso.FINALIZADO } }),
      this.prisma.incidencia.count({ where: { estado: EstadoIncidencia.PENDIENTE } }),
      this.prisma.incidencia.count({ where: { estado: EstadoIncidencia.EN_ATENCION } }),
      this.prisma.incidencia.count({ where: { estado: EstadoIncidencia.RESUELTA } }),
      this.groupByEquipo(),
      this.groupByTecnico(),
    ]);

    return {
      equipos: { total: totalEquipos, activos: equiposActivos },
      usuarios: { total: totalUsuarios, alumnos, soportes, admins },
      usos: { activos: usosActivos, finalizados: usosFinalizados },
      incidencias: {
        pendientes: incidenciasPendientes,
        enAtencion: incidenciasEnAtencion,
        resueltas: incidenciasResueltas,
      },
      usosPorEquipo,
      incidenciasPorTecnico,
    };
  }

  private async groupByEquipo() {
    const grouped = await this.prisma.uso.groupBy({
      by: ['equipoId'],
      _count: { _all: true },
      orderBy: { _count: { equipoId: 'desc' } },
      take: 10,
    });
    const equipos = await this.prisma.equipo.findMany({
      where: { id: { in: grouped.map((g) => g.equipoId) } },
      select: { id: true, codigo: true, nombre: true },
    });
    const map = new Map(equipos.map((e) => [e.id, e]));
    return grouped.map((g) => ({
      equipo: map.get(g.equipoId),
      totalUsos: g._count._all,
    }));
  }

  private async groupByTecnico() {
    const grouped = await this.prisma.incidencia.groupBy({
      by: ['atendidaPorId'],
      _count: { _all: true },
      where: { atendidaPorId: { not: null } },
    });
    const tecnicos = await this.prisma.usuario.findMany({
      where: { id: { in: grouped.map((g) => g.atendidaPorId!).filter(Boolean) } },
      select: { id: true, username: true, fullName: true },
    });
    const map = new Map(tecnicos.map((t) => [t.id, t]));
    return grouped.map((g) => ({
      tecnico: g.atendidaPorId ? map.get(g.atendidaPorId) : null,
      totalAtendidas: g._count._all,
    }));
  }

  /**
   * HU-AD-11: exportación de reportes en xlsx o pdf.
   */
  async exportar(formato: 'xlsx' | 'pdf'): Promise<{
    buffer: Buffer;
    filename: string;
    contentType: string;
  }> {
    const [equipos, usos, incidencias] = await Promise.all([
      this.prisma.equipo.findMany({ include: { _count: { select: { usos: true, incidencias: true } } } }),
      this.prisma.uso.findMany({
        include: {
          equipo: { select: { codigo: true, nombre: true } },
          alumno: { select: { username: true, fullName: true } },
        },
        orderBy: { inicio: 'desc' },
      }),
      this.prisma.incidencia.findMany({
        include: {
          equipo: { select: { codigo: true } },
          reportadaPor: { select: { fullName: true } },
          atendidaPor: { select: { fullName: true } },
        },
        orderBy: { creadaEn: 'desc' },
      }),
    ]);

    const fecha = new Date().toISOString().slice(0, 10);
    if (formato === 'pdf') {
      const doc = this.buildPdf({ equipos, usos, incidencias });
      const printer = new PDFDocument(PDF_FONTS);
      const chunks: Buffer[] = [];
      const pdfDoc = printer.createPdfKitDocument(doc as TDocumentDefinitions);
      return await new Promise((resolve, reject) => {
        pdfDoc.on('data', (c: Buffer) => chunks.push(c));
        pdfDoc.on('end', () =>
          resolve({
            buffer: Buffer.concat(chunks),
            filename: `reporte-scei-qr-${fecha}.pdf`,
            contentType: 'application/pdf',
          }),
        );
        pdfDoc.on('error', reject);
        pdfDoc.end();
      });
    }

    const buffer = await this.buildXlsx({ equipos, usos, incidencias });
    return {
      buffer,
      filename: `reporte-scei-qr-${fecha}.xlsx`,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  private async buildXlsx(data: {
    equipos: unknown[];
    usos: unknown[];
    incidencias: unknown[];
  }): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'scei_qr_api';
    wb.created = new Date();

    const wsEq = wb.addWorksheet('Equipos');
    wsEq.columns = [
      { header: 'Código', key: 'codigo', width: 15 },
      { header: 'Nombre', key: 'nombre', width: 30 },
      { header: 'Ubicación', key: 'ubicacion', width: 30 },
      { header: 'Activo', key: 'activo', width: 10 },
      { header: 'Usos', key: 'usos', width: 10 },
      { header: 'Incidencias', key: 'incidencias', width: 12 },
    ];
    for (const e of data.equipos as Array<{
      codigo: string;
      nombre: string;
      ubicacion: string;
      activo: boolean;
      _count: { usos: number; incidencias: number };
    }>) {
      wsEq.addRow({
        codigo: e.codigo,
        nombre: e.nombre,
        ubicacion: e.ubicacion,
        activo: e.activo ? 'Sí' : 'No',
        usos: e._count.usos,
        incidencias: e._count.incidencias,
      });
    }
    this.styleHeader(wsEq);

    const wsUsos = wb.addWorksheet('Usos');
    wsUsos.columns = [
      { header: 'Alumno', key: 'alumno', width: 30 },
      { header: 'Equipo', key: 'equipo', width: 20 },
      { header: 'Inicio', key: 'inicio', width: 22 },
      { header: 'Fin', key: 'fin', width: 22 },
      { header: 'Estado', key: 'estado', width: 12 },
    ];
    for (const u of data.usos as Array<{
      alumno: { fullName: string };
      equipo: { codigo: string };
      inicio: Date;
      fin: Date | null;
      estado: string;
    }>) {
      wsUsos.addRow({
        alumno: u.alumno.fullName,
        equipo: u.equipo.codigo,
        inicio: u.inicio,
        fin: u.fin ?? '-',
        estado: u.estado,
      });
    }
    this.styleHeader(wsUsos);

    const wsInc = wb.addWorksheet('Incidencias');
    wsInc.columns = [
      { header: 'Equipo', key: 'equipo', width: 15 },
      { header: 'Título', key: 'titulo', width: 35 },
      { header: 'Reportada por', key: 'reportada', width: 25 },
      { header: 'Atendida por', key: 'atendida', width: 25 },
      { header: 'Estado', key: 'estado', width: 15 },
      { header: 'Solución', key: 'solucion', width: 40 },
      { header: 'Creada', key: 'creada', width: 22 },
    ];
    for (const i of data.incidencias as Array<{
      equipo: { codigo: string };
      titulo: string;
      reportadaPor: { fullName: string };
      atendidaPor: { fullName: string } | null;
      estado: string;
      solucion: string | null;
      creadaEn: Date;
    }>) {
      wsInc.addRow({
        equipo: i.equipo.codigo,
        titulo: i.titulo,
        reportada: i.reportadaPor.fullName,
        atendida: i.atendidaPor?.fullName ?? '-',
        estado: i.estado,
        solucion: i.solucion ?? '-',
        creada: i.creadaEn,
      });
    }
    this.styleHeader(wsInc);

    const out = await wb.xlsx.writeBuffer();
    return Buffer.from(out as ArrayBuffer);
  }

  private styleHeader(ws: ExcelJS.Worksheet): void {
    const row = ws.getRow(1);
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2F54EB' },
    };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  }

  private buildPdf(data: {
    equipos: unknown[];
    usos: unknown[];
    incidencias: unknown[];
  }): TDocumentDefinitions {
    const fecha = new Date().toLocaleString('es-EC');
    return {
      pageOrientation: 'landscape',
      pageSize: 'A4',
      content: [
        { text: 'Reporte General - scei_qr', style: 'header' },
        { text: `Generado: ${fecha}`, style: 'subheader', margin: [0, 0, 0, 10] },
        {
          table: {
            headerRows: 1,
            widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto'],
            body: [
              ['Código', 'Nombre', 'Ubicación', 'Activo', 'Usos', 'Incidencias'],
              ...(data.equipos as Array<{
                codigo: string;
                nombre: string;
                ubicacion: string;
                activo: boolean;
                _count: { usos: number; incidencias: number };
              }>).map((e) => [
                e.codigo,
                e.nombre,
                e.ubicacion,
                e.activo ? 'Sí' : 'No',
                String(e._count.usos),
                String(e._count.incidencias),
              ]),
            ],
          },
        },
        {
          text: `Totales: ${data.equipos.length} equipos · ${data.usos.length} usos · ${data.incidencias.length} incidencias`,
          margin: [0, 10, 0, 0],
          bold: true,
        },
      ],
      styles: {
        header: { fontSize: 16, bold: true, margin: [0, 0, 0, 4] },
        subheader: { fontSize: 10, color: '#666666' },
      },
      defaultStyle: { fontSize: 9 },
    };
  }
}
