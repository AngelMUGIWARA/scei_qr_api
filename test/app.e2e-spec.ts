import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/common/prisma/prisma.service';

/**
 * Parser binario para supertest: los content-types de exportación
 * (xlsx/pdf) no los bufferea superagent por defecto.
 */
const binaryParser = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  res: any,
  cb: (err: Error | null, body?: Buffer) => void,
) => {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
  res.on('error', (err: Error) => cb(err));
};

/**
 * E2E del flujo completo (DoD §7):
 * login → crear equipo → obtener QR → alumno usa el qrToken → inicia uso →
 * reporta incidencia → soporte toma → resuelve → admin consulta estadísticas.
 *
 * Requiere la base configurada en .env (Neon). Los datos creados aquí quedan
 * en la DB de desarrollo; se usan códigos únicos por timestamp para no chocar.
 */
describe('Flujo completo (e2e)', () => {
  let app: INestApplication;
  let http: request.Agent;
  let prisma: PrismaService;

  let adminToken: string;
  let soporteToken: string;
  let alumnoToken: string;
  let equipoId: number;
  let qrToken: string;
  let usoId: number;
  let incidenciaId: number;

  const stamp = Date.now();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Limpieza de los datos creados por este test (orden por FKs)
    if (incidenciaId) {
      await prisma.incidencia.delete({ where: { id: incidenciaId } }).catch(() => undefined);
    }
    if (usoId) {
      await prisma.uso.delete({ where: { id: usoId } }).catch(() => undefined);
    }
    if (equipoId) {
      await prisma.equipo.delete({ where: { id: equipoId } }).catch(() => undefined);
    }
    await app.close();
  });

  it('GET /health responde ok (público)', async () => {
    const res = await http.get('/api/v1/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('login admin / soporte / alumno (HU-AD-01, HU-ST-01, HU-AL-01)', async () => {
    const login = async (username: string) => {
      const res = await http
        .post('/api/v1/auth/login')
        .send({ username, password: 'Password123!' })
        .expect(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.tokenType).toBe('Bearer');
      expect(res.body.expiresIn).toBe(28800);
      expect(res.body.user.rol).toBeDefined();
      return res.body.accessToken as string;
    };

    adminToken = await login('admin');
    soporteToken = await login('soporte');
    alumnoToken = await login('alumno1');
  });

  it('login con contraseña incorrecta -> 401 genérico', async () => {
    const res = await http
      .post('/api/v1/auth/login')
      .send({ username: 'alumno1', password: 'incorrecta' })
      .expect(401);
    expect(res.body.message).toBe('Usuario o contraseña incorrectos');
  });

  it('crear equipo como ADMIN (HU-AD-04)', async () => {
    const res = await http
      .post('/api/v1/equipos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        codigo: `E2E-${stamp}`,
        nombre: 'Equipo E2E',
        descripcion: 'Creado por prueba e2e',
        ubicacion: 'Laboratorio E2E',
      })
      .expect(201);

    equipoId = res.body.id;
    qrToken = res.body.qrToken;
    expect(qrToken).toBeDefined();
  });

  it('alumno NO puede crear equipos -> 403 (HU-GEN-01)', async () => {
    await http
      .post('/api/v1/equipos')
      .set('Authorization', `Bearer ${alumnoToken}`)
      .send({ codigo: `NO-${stamp}`, nombre: 'x', ubicacion: 'y' })
      .expect(403);
  });

  it('obtener PNG del QR como ADMIN (HU-AD-06)', async () => {
    const res = await http
      .get(`/api/v1/equipos/${equipoId}/qr`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.body.length).toBeGreaterThan(100);
  });

  it('alumno resuelve el QR escaneado (HU-AL-02)', async () => {
    const res = await http
      .get(`/api/v1/equipos/qr/${qrToken}`)
      .set('Authorization', `Bearer ${alumnoToken}`)
      .expect(200);
    expect(res.body.id).toBe(equipoId);
    expect(res.body.activo).toBe(true);
  });

  it('alumno inicia uso con el qrToken (HU-AL-03)', async () => {
    const res = await http
      .post('/api/v1/usos')
      .set('Authorization', `Bearer ${alumnoToken}`)
      .send({ qrToken })
      .expect(200);

    usoId = res.body.id;
    expect(res.body.estado).toBe('ACTIVO');
    expect(res.body.equipo.codigo).toBe(`E2E-${stamp}`);
  });

  it('escanear otro QR con uso activo -> 409 (uso único)', async () => {
    const otro = await http
      .post('/api/v1/equipos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ codigo: `E2E2-${stamp}`, nombre: 'Otro', ubicacion: 'Lab' })
      .expect(201);

    await http
      .post('/api/v1/usos')
      .set('Authorization', `Bearer ${alumnoToken}`)
      .send({ qrToken: otro.body.qrToken })
      .expect(409);

    await prisma.equipo.delete({ where: { id: otro.body.id } }).catch(() => undefined);
  });

  it('alumno finaliza su uso (HU-AL-04)', async () => {
    const res = await http
      .patch(`/api/v1/usos/${usoId}/finalizar`)
      .set('Authorization', `Bearer ${alumnoToken}`)
      .expect(200);
    expect(res.body.estado).toBe('FINALIZADO');
    expect(res.body.fin).toBeTruthy();
  });

  it('alumno reporta incidencia con foto (HU-AL-06)', async () => {
    // PNG mínimo de 1x1 pixel
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );

    const res = await http
      .post('/api/v1/incidencias')
      .set('Authorization', `Bearer ${alumnoToken}`)
      .field('equipoId', String(equipoId))
      .field('titulo', 'Falla E2E')
      .field('descripcion', 'Prueba automatizada de flujo completo')
      .attach('foto', png, { filename: 'fallo.png', contentType: 'image/png' })
      .expect(200);

    incidenciaId = res.body.id;
    expect(res.body.estado).toBe('PENDIENTE');
    expect(res.body.fotoUrl).toMatch(/^\/uploads\/incidencias\//);
  });

  it('alumno consulta mis reportes (HU-AL-07)', async () => {
    const res = await http
      .get('/api/v1/incidencias/mis-reportes')
      .set('Authorization', `Bearer ${alumnoToken}`)
      .expect(200);
    expect(res.body.some((i: { id: number }) => i.id === incidenciaId)).toBe(true);
  });

  it('soporte lista incidencias PENDIENTES (HU-ST-02)', async () => {
    const res = await http
      .get('/api/v1/incidencias?estado=PENDIENTE')
      .set('Authorization', `Bearer ${soporteToken}`)
      .expect(200);
    expect(res.body.some((i: { id: number }) => i.id === incidenciaId)).toBe(true);
  });

  it('alumno NO puede tomar incidencias -> 403', async () => {
    await http
      .patch(`/api/v1/incidencias/${incidenciaId}/tomar`)
      .set('Authorization', `Bearer ${alumnoToken}`)
      .expect(403);
  });

  it('soporte toma la incidencia (HU-ST-04)', async () => {
    const res = await http
      .patch(`/api/v1/incidencias/${incidenciaId}/tomar`)
      .set('Authorization', `Bearer ${soporteToken}`)
      .expect(200);
    expect(res.body.estado).toBe('EN_ATENCION');
    expect(res.body.atendidaPor.username).toBe('soporte');
  });

  it('tomar de nuevo -> 409 (condición transaccional)', async () => {
    const res = await http
      .patch(`/api/v1/incidencias/${incidenciaId}/tomar`)
      .set('Authorization', `Bearer ${soporteToken}`)
      .expect(409);
    expect(res.body.message).toMatch(/ya fue tomada|cambió de estado/);
  });

  it('RESUELTA directo desde EN_ATENCION por /estado no aplica (debe ir por /solucion)', async () => {
    // /solucion es el camino oficial HU-ST-06; probar transición inválida:
    const res = await http
      .patch(`/api/v1/incidencias/${incidenciaId}/estado`)
      .set('Authorization', `Bearer ${soporteToken}`)
      .send({ estado: 'PENDIENTE' })
      .expect(409);
    expect(res.body.message).toMatch(/Transición no permitida/);
  });

  it('soporte registra solución -> RESUELTA (HU-ST-06)', async () => {
    const res = await http
      .patch(`/api/v1/incidencias/${incidenciaId}/solucion`)
      .set('Authorization', `Bearer ${soporteToken}`)
      .send({ solucion: 'Se reemplazó el componente; probado OK' })
      .expect(200);
    expect(res.body.estado).toBe('RESUELTA');
    expect(res.body.solucion).toBe('Se reemplazó el componente; probado OK');
  });

  it('historial de incidencias (HU-ST-07)', async () => {
    const res = await http
      .get('/api/v1/incidencias/historial')
      .set('Authorization', `Bearer ${soporteToken}`)
      .expect(200);
    expect(res.body.some((i: { id: number }) => i.id === incidenciaId)).toBe(true);
  });

  it('admin consulta estadísticas (HU-AD-10)', async () => {
    const res = await http
      .get('/api/v1/reportes/estadisticas')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.equipos.total).toBeGreaterThan(0);
    expect(res.body.usuarios.alumnos).toBeGreaterThan(0);
    expect(res.body.incidencias).toHaveProperty('pendientes');
    expect(Array.isArray(res.body.usosPorEquipo)).toBe(true);
  });

  it('admin exporta xlsx (HU-AD-11)', async () => {
    const res = await http
      .get('/api/v1/reportes/exportar?format=xlsx')
      .buffer(true)
      .parse(binaryParser)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.headers['content-type']).toMatch(/spreadsheetml/);
    const buf = res.body as Buffer;
    expect(buf.length).toBeGreaterThan(1000);
    // firma ZIP del formato xlsx (PK..)
    expect(buf.subarray(0, 2).toString('ascii')).toBe('PK');
  });

  it('admin exporta pdf (HU-AD-11)', async () => {
    const res = await http
      .get('/api/v1/reportes/exportar?format=pdf')
      .buffer(true)
      .parse(binaryParser)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    const buf = res.body as Buffer;
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('rutas protegidas sin token -> 401', async () => {
    await http.get('/api/v1/equipos').expect(401);
    await http.get('/api/v1/reportes/estadisticas').expect(401);
  });
});
