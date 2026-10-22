/**
 * Seed: usuarios de prueba (3 roles) y equipos demo.
 * Corre con: npx prisma db seed
 * Los usuarios siguen el contrato del cliente Flutter (arquitectura §6, Iteración 1).
 */
import { PrismaClient, Rol } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Sembrando datos de prueba...');

  // --- Usuarios (HU-AL-01, HU-ST-01, HU-AD-01) ---
  const password = 'Password123!';
  const passwordHash = await bcrypt.hash(password, 10);

  const usuarios = [
    { username: 'admin', fullName: 'Ana Torres (Administradora)', rol: Rol.ADMIN },
    { username: 'soporte', fullName: 'Carlos Mena (Soporte técnico)', rol: Rol.SOPORTE },
    { username: 'alumno1', fullName: 'Lucía Fernández (Alumna)', rol: Rol.ALUMNO },
    { username: 'alumno2', fullName: 'Mateo Ruiz (Alumno)', rol: Rol.ALUMNO },
  ];

  for (const u of usuarios) {
    await prisma.usuario.upsert({
      where: { username: u.username },
      update: {},
      create: { ...u, passwordHash },
    });
  }
  console.log(`   ✔ ${usuarios.length} usuarios creados (contraseña: ${password})`);

  // --- Equipos demo (HU-AD-04/06) ---
  const equipos = [
    {
      codigo: 'LAB-PC-001',
      nombre: 'PC Dell OptiPlex 7090',
      descripcion: 'Equipo de cómputo para talleres de programación',
      ubicacion: 'Laboratorio de Cómputo 1, Fila A',
    },
    {
      codigo: 'LAB-PC-002',
      nombre: 'PC HP ProDesk 400',
      descripcion: 'Equipo de diseño gráfico',
      ubicacion: 'Laboratorio de Cómputo 1, Fila B',
    },
    {
      codigo: 'LAB-MON-001',
      nombre: 'Monitor Samsung 24"',
      descripcion: 'Monitor externo para estaciones',
      ubicacion: 'Laboratorio de Electrónica, Mesa 3',
    },
    {
      codigo: 'TALL-PROY-001',
      nombre: 'Proyector Epson X49',
      descripcion: 'Proyector para salones',
      ubicacion: 'Salón 201',
    },
  ];

  for (const e of equipos) {
    await prisma.equipo.upsert({
      where: { codigo: e.codigo },
      update: {},
      create: { ...e, qrToken: crypto.randomUUID() },
    });
  }
  console.log(`   ✔ ${equipos.length} equipos demo creados`);

  console.log('✅ Seed completado.');
  console.log('   Login: admin / soporte / alumno1 / alumno2  →  Password123!');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
