'use client';

import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import type { Propiedad } from '@/lib/propiedad-admin';
import type { FotoDrivePanel as FotoDrive } from '@/lib/fotos-drive';
import { etiquetaDisponibilidad, type EstadoDisponibilidad } from '@/lib/disponibilidad';
import { esZonaPublica } from '@/lib/zona-publica';
import { requisitosTextos, type TextosFicha } from '@/lib/textos-propiedad';
import { solicitar } from '@/lib/api-admin';
import { RevisionMaterial, type MaterialRevisado } from './revision-material';
import { CorregirPrecio } from './corregir-precio';
import { CopiarEnlaceFicha } from './aviso-whatsapp';
import { TextosDeFicha } from './textos-ficha';
import { type DescargarFotosDrive, DescargarFotoDrive, DescargarSeleccionDrive } from './fotos-drive';

type Props = {
  prop: Propiedad; userId: string; ahora: number | null; editando: string | null;
  revisandoFicha: boolean; actualizando: boolean; publicando: boolean;
  setRevisando: (id: string | null) => void;
  cargarFormulario: (prop?: Propiedad) => void;
  eliminarPropiedad: (id: string) => Promise<void>;
  cambiarEstado: (id: string, estado: EstadoDisponibilidad) => Promise<void>;
  publicar: (prop: Propiedad, material: MaterialRevisado) => Promise<void>;
  actualizarFicha: (id: string, cambios: Partial<Propiedad>, actualizarAviso?: boolean) => void;
  abrirFoto: (foto: FotoDrive, signal?: AbortSignal) => Promise<Blob>;
  abrirOriginal: DescargarFotosDrive;
};

export function FichaInventario({ prop,userId,ahora,editando,revisandoFicha,actualizando,publicando,
  setRevisando,cargarFormulario,eliminarPropiedad,cambiarEstado,publicar,actualizarFicha,abrirFoto,abrirOriginal }: Props) {
            const fotoPortada = prop.fotos_drive?.find(({ id }) => id === prop.portada_drive_id);
            const tienePortada = Boolean(fotoPortada || prop.imagen_portada);
            const faltantesPublicacion = [
              !esZonaPublica(prop.ciudad_zona) && 'la ciudad o ZIP en la zona pública',
              !(Number(prop.precio) > 0) && 'precio mayor que cero',
              !tienePortada && 'portada',
            ].filter(Boolean);
            
            const puedeRevisar = faltantesPublicacion.length === 0 && editando !== prop.id;
            const etiqueta = etiquetaDisponibilidad(prop.estado, prop.ultima_confirmacion, ahora);
            
            const rutaFicha = `/propiedades/${encodeURIComponent(prop.id)}`;
  return (
              <div
                                className="inventario-ficha space-y-4 rounded-2xl border border-[var(--admin-soft)] bg-[var(--admin-surface)] p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--admin-soft)] pb-3">
                  <div>
                    <span className="text-sm font-semibold text-[var(--admin-accent)]">
                      {prop.ciudad_zona}
                    </span>
                    <h3 className="text-lg font-bold text-[var(--admin-ink)]">
                      {prop.direccion_privada || 'Ficha sin dirección'}{' '}
                      <span className="text-xs font-normal text-[var(--admin-muted)]">
                        (Solo visible aquí)
                      </span>
                    </h3>
                    <p className="text-sm text-[var(--admin-body)]">
                      Precio: <strong className="text-lg tabular-nums tracking-tight">{prop.precio == null ? 'Pendiente' : `$${Number(prop.precio).toLocaleString()}`}</strong>
                      {prop.arv && ` · Precio del Mercado: $${Number(prop.arv).toLocaleString()}`}
                      {prop.beds && ` · ${prop.beds} bd`}
                      {prop.baths && ` / ${prop.baths} ba`}
                      {prop.sqft && ` · ${prop.sqft} sqft`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => eliminarPropiedad(prop.id)}
                      className="min-w-11 p-2 text-[var(--admin-muted)] hover:text-[var(--admin-danger-hover)] cursor-pointer"
                      aria-label="Eliminar propiedad"
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {prop.publicada_en ? (
                  <div className="space-y-3 text-sm">
                    <Link href={rutaFicha} className="text-[var(--admin-link)]">
                      Publicada · Ver ficha
                    </Link>
                    <CopiarEnlaceFicha ruta={rutaFicha} />
                    {prop.precio != null && (
                      <CorregirPrecio precio={prop.precio} guardar={async (precio) => {
                        const { ficha } = await solicitar<{ ficha: Partial<Propiedad> & { precio: number } }>(
                          userId, '/api/admin/propiedades', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              id: prop.id, accion: 'corregir_precio', precio, precio_anterior: prop.precio,
                            }),
                          },
                        );
                        actualizarFicha(prop.id, ficha, true);
                      }} />
                    )}
                    <p aria-live="polite" className={`status-pill ${etiqueta === 'Por confirmar' ? 'status-pending' : prop.estado !== 'disponible' ? 'status-inactive' : ''}`}>
                      {actualizando ? 'Actualizando disponibilidad…' : etiqueta}
                    </p>
                    {etiqueta === 'Por confirmar' && (
                      <p className="text-[var(--admin-secondary)]">Verifica que la propiedad siga disponible.</p>
                    )}
                    <div role="group" aria-label="Actualizar disponibilidad"
                      className="flex flex-wrap gap-2 [&>button]:min-h-11 [&>button]:rounded-lg [&>button]:bg-[var(--admin-soft)] [&>button]:px-3 [&>button:disabled]:opacity-50">
                      <button type="button" disabled={actualizando} onClick={() => cambiarEstado(prop.id, 'disponible')}>
                        {prop.estado === 'disponible' ? 'Confirmar disponible' : 'Volver a disponible'}
                      </button>
                      {prop.estado === 'disponible' && (
                        <button type="button" disabled={actualizando} onClick={() => cambiarEstado(prop.id, 'en_contrato')}>
                          Marcar en contrato
                        </button>
                      )}
                      {prop.estado !== 'vendida' && (
                        <button type="button" disabled={actualizando} onClick={() => cambiarEstado(prop.id, 'vendida')}>
                          Marcar ya no disponible
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 text-sm">
                    <p className="status-pill status-inactive">Borrador privado</p>
                    <a href="#formulario-ficha" onClick={() => { cargarFormulario(prop); setRevisando(null); }} className="public-action">Editar borrador</a>
                    <button type="button" className="public-action" disabled={!puedeRevisar} onClick={() => setRevisando(prop.id)}>Revisar ficha y fotos</button>
                    {faltantesPublicacion.length > 0 && <p>Completa y guarda: {faltantesPublicacion.join(', ')}.</p>}
                  </div>
                )}
                {prop.publicada_en && <button type="button" className="public-action" onClick={() => setRevisando(prop.id)}>Actualizar fotos públicas</button>}
                {revisandoFicha && puedeRevisar && <RevisionMaterial key={`${prop.id}-${prop.ficha_version}`} ficha={prop} userId={userId}
                  publicar={(material) => publicar(prop, material)} ocupado={publicando} />}

                {Boolean(prop.fotos_drive?.length) && (
                  <details className="space-y-2 text-sm">
                    <summary className="cursor-pointer text-[var(--admin-link)]">Fotos elegidas para Facebook ({prop.fotos_drive.length})</summary>
                    <DescargarSeleccionDrive fotos={prop.fotos_drive} abrirOriginal={abrirOriginal} nombrePropiedad={prop.direccion_privada || prop.ciudad_zona || undefined} />
                    <ul className="space-y-2">
                      {prop.fotos_drive.map((foto) => (
                        <li key={foto.id} className="flex flex-wrap items-center gap-3">
                          <span className="break-all">{foto.name}</span>
                          <DescargarFotoDrive foto={foto} abrir={abrirFoto} />
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                <TextosDeFicha
                  ficha={prop}
                  estado={prop.estado}
                  zona={prop.ciudad_zona ?? 'esta zona'}
                  requisitos={requisitosTextos(prop)}
                  editarBorrador={prop.publicada_en ? undefined : () => {
                    cargarFormulario(prop);
                    setRevisando(null);
                  }}
                  guardar={async (version, peticion) => {
                    const respuesta = await solicitar<{ textos: TextosFicha; origen?: string }>(
                      userId, '/api/admin/textos', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: prop.id, version, ...peticion }),
                      },
                    );
                    actualizarFicha(prop.id, respuesta.textos);
                    return respuesta;
                  }}
                />
              </div>
  );
}
