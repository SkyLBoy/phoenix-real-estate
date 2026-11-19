'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { CAMPOS_PUBLICOS, enlacePortada, enlaceWhatsApp, type PropiedadPublica } from '@/lib/propiedades-publicas';
import {
  MapPin,
  BedDouble,
  Bath,
  Maximize,
  FolderOpen,
  MessageCircle,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';

export default function CatalogoPublico() {
  const [propiedades, setPropiedades] = useState<PropiedadPublica[]>([]);
  const [filtroZona, setFiltroZona] = useState('');
  const [cargando, setCargando] = useState(true);

  // Formulario de registro VIP
  const [nombre, setNombre] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [perfil, setPerfil] = useState<'familia_vivienda' | 'inversionista'>('familia_vivienda');
  const [tieneItin, setTieneItin] = useState(false);
  const [leadEnviado, setLeadEnviado] = useState(false);

  useEffect(() => {
    const cargar = async () => {
      const { data } = await supabase
        .from('propiedades_publicas')
        .select(CAMPOS_PUBLICOS)
        .neq('estado', 'vendida')
        .order('created_at', { ascending: false });

      if (data) setPropiedades(data);
      setCargando(false);
    };
    cargar();
  }, []);

  const registrarLead = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('leads_compradores').insert([
      {
        nombre,
        whatsapp,
        perfil,
        tiene_itin: tieneItin,
      },
    ]);
    if (!error) {
      setLeadEnviado(true);
      setNombre('');
      setWhatsapp('');
    }
  };

  const filtradas = propiedades.filter((p) =>
    p.ciudad_zona.toLowerCase().includes(filtroZona.trim().toLowerCase())
  );

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Hero */}
      <section className="border-b border-zinc-800 bg-zinc-900/60 px-4 py-10">
        <div className="max-w-5xl mx-auto space-y-4">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full">
            <ShieldCheck size={14} /> Oportunidades Off-Market en Arizona
          </span>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Propiedades Disponibles Esta Semana
          </h1>
          <p className="text-zinc-400 max-w-2xl text-sm md:text-base">
            Compra de contado para inversión o adquiere tu casa con{' '}
            <strong className="text-zinc-200">ITIN / Pasaporte</strong> y desde{' '}
            <strong className="text-zinc-200">15% de enganche</strong> con financiamiento
            privado directo.
          </p>

          <div className="pt-2 max-w-md">
            <input
              type="text"
              placeholder="Filtrar por ciudad o código postal (ej. Phoenix, 85033)..."
              value={filtroZona}
              onChange={(e) => setFiltroZona(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>
      </section>

      {/* Grid de Propiedades */}
      <section className="max-w-5xl mx-auto px-4 py-8">
        {cargando ? (
          <p className="text-center text-zinc-500 py-12">Cargando inventario...</p>
        ) : filtradas.length === 0 ? (
          <p className="text-center text-zinc-500 py-12">
            No hay propiedades que coincidan con tu búsqueda en este momento.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtradas.map((prop) => {
              const portada = enlacePortada(prop);
              return (
                <article
                  key={prop.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    <div className="h-44 bg-zinc-800 relative flex items-center justify-center overflow-hidden">
                      {portada ? (
                        <img
                          src={portada}
                          loading="lazy"
                          alt={prop.ciudad_zona}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs text-zinc-500">
                          Fotos disponibles en carpeta Drive
                        </span>
                      )}
                      {prop.estado === 'en_contrato' && (
                        <span className="absolute top-3 right-3 bg-amber-500 text-zinc-950 text-xs font-bold px-2.5 py-1 rounded-full">
                          Bajo Contrato
                        </span>
                      )}
                    </div>

                    <div className="p-4 space-y-3">
                      <div className="flex items-center gap-1.5 text-xs text-amber-400 font-medium">
                        <MapPin size={14} /> {prop.ciudad_zona}
                      </div>

                      <div>
                        <p className="text-2xl font-bold text-zinc-100">
                          ${Number(prop.precio).toLocaleString()}{' '}
                          <span className="text-xs font-normal text-zinc-400">USD</span>
                        </p>
                        {prop.arv && (
                          <p className="text-xs text-emerald-400">
                            ARV Estimado: ${Number(prop.arv).toLocaleString()}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-xs text-zinc-300 border-t border-zinc-800 pt-3">
                        {prop.beds && (
                          <span className="flex items-center gap-1">
                            <BedDouble size={14} className="text-zinc-500" /> {prop.beds} Rec
                          </span>
                        )}
                        {prop.baths && (
                          <span className="flex items-center gap-1">
                            <Bath size={14} className="text-zinc-500" /> {prop.baths} Baños
                          </span>
                        )}
                        {prop.sqft && (
                          <span className="flex items-center gap-1">
                            <Maximize size={14} className="text-zinc-500" /> {prop.sqft} sqft
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 pt-0 space-y-2">
                    <Link href={`/propiedades/${prop.id}`} className="block text-center text-sm text-amber-300">
                      Ver ficha
                    </Link>
                    {prop.drive_url && (
                      <a
                        href={prop.drive_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition"
                      >
                        <FolderOpen size={15} /> Ver Fotos y Videos (Drive)
                      </a>
                    )}
                    <a
                      href={enlaceWhatsApp(prop)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition"
                    >
                      <MessageCircle size={15} /> Pedir Dirección y Cita
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Captura de Compradores VIP (independiente de Facebook) */}
      <section className="max-w-xl mx-auto px-4 pb-16">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-bold">
            Recibe las casas nuevas antes que en Facebook
          </h2>
          <p className="text-sm text-zinc-400">
            Déjanos tu WhatsApp y te enviamos las oportunidades directo en cuanto entran.
          </p>

          {leadEnviado ? (
            <div className="bg-emerald-950/40 border border-emerald-800 text-emerald-300 p-4 rounded-xl flex items-center gap-2 text-sm">
              <CheckCircle2 size={18} /> ¡Listo! Ya quedaste registrado en nuestra lista
              prioritaria.
            </div>
          ) : (
            <form onSubmit={registrarLead} className="space-y-3">
              <input
                type="text"
                placeholder="Tu nombre completo"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="tel"
                placeholder="Tu número de WhatsApp (ej. 602-555-1234)"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
              />
              <select
                value={perfil}
                onChange={(e) =>
                  setPerfil(e.target.value as 'familia_vivienda' | 'inversionista')
                }
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
              >
                <option value="familia_vivienda">Busco casa para vivir (ITIN / Enganche)</option>
                <option value="inversionista">Soy inversionista (Cash / Fix & Flip)</option>
              </select>
              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tieneItin}
                  onChange={(e) => setTieneItin(e.target.checked)}
                  className="accent-amber-500"
                />
                Cuento con ITIN / Pasaporte o enganche listo
              </label>
              <button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold py-2.5 rounded-lg text-sm transition cursor-pointer"
              >
                Unirme a la Lista Prioritaria
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}