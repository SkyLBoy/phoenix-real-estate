import { Suspense } from 'react';
import { connection } from 'next/server';
import { cargarCatalogo } from '@/lib/catalogo';
import { registrarFallo } from '@/lib/diagnostico';
import { horaDeSolicitud } from '@/lib/hora-de-solicitud';
import { CatalogoPublico } from './catalogo-publico';

async function InventarioPublico() {
  await connection();
  const { datos, error } = await cargarCatalogo();
  if (error) registrarFallo('catalogo.inicial', error);
  return <CatalogoPublico datosIniciales={datos} ahoraInicial={horaDeSolicitud()} />;
}

export default function Inicio() {
  return (
    <Suspense fallback={<main className="public-shell">
      <p role="status" className="public-wrap py-12">Cargando inventario…</p>
    </main>}>
      <InventarioPublico />
    </Suspense>
  );
}
