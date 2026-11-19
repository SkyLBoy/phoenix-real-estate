import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { rejectUnauthorizedAdmin, supabaseAdmin } from '../admin-access';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const esperar = (ms: number) => new Promise((res) => setTimeout(res, ms));

function generarScriptsRespaldo(datos: {
  ciudad_zona: string;
  precio: string | number;
  arv?: string | number | null;
  beds?: string | number | null;
  baths?: string | number | null;
  sqft?: string | number | null;
}) {
  const precioFmt = `$${Number(datos.precio).toLocaleString()} USD`;
  const specs = [
    datos.beds ? `${datos.beds} recámaras` : null,
    datos.baths ? `${datos.baths} baños` : null,
    datos.sqft ? `${datos.sqft} sqft` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return {
    script_fb_es: `🏡 OPORTUNIDAD EN ${datos.ciudad_zona.toUpperCase()} — ${precioFmt}\n${specs ? `✨ ${specs}\n` : ''}✅ Aceptamos ITIN o Pasaporte\n✅ Desde 15% de enganche\n✅ Financiamiento privado directo (sin banco)\n📲 Mándame mensaje directo o WhatsApp para enviarte fotos y ubicación.`,
    script_fb_en: `🔥 OFF-MARKET DEAL IN ${datos.ciudad_zona.toUpperCase()} — ${precioFmt}${datos.arv ? ` (Est. ARV: $${Number(datos.arv).toLocaleString()})` : ''}\n${specs ? `📐 ${specs}\n` : ''}Fast closing · Cash or Private Financing available. DM for photos, comps & exact address.`,
    script_wa_vip: `🚨 *NUEVA PROPIEDAD DISPONIBLE*\n📍 Zona: *${datos.ciudad_zona}*\n💰 Precio: *${precioFmt}*\n${specs ? `🏠 Detalles: ${specs}\n` : ''}📲 Responde este mensaje para recibir dirección exacta y agendar visita.`,
    script_filtro_curiosos: `¡Hola! Sí, sigue disponible en ${datos.ciudad_zona} (${precioFmt}). Antes de pasarte la dirección exacta y el folder de fotos, platícame rápido: ¿buscas comprar de contado o con financiamiento usando ITIN / enganche?`,
  };
}

export async function POST(req: Request) {
  try {
    const denied = await rejectUnauthorizedAdmin(req);
    if (denied) return denied;

    const body = await req.json();
    const {
      direccion_privada,
      ciudad_zona,
      precio,
      arv,
      beds,
      baths,
      sqft,
      lot_size,
      year_built,
      drive_url,
      imagen_portada,
      notas_extra,
    } = body;

    const prompt = `
Eres un experto en marketing inmobiliario (Wholesaling / Fix & Flip / Owner Finance) en Arizona (Phoenix y alrededores).
Genera 4 textos persuasivos y listos para copiar basados en esta propiedad:

- Zona pública (NUNCA reveles la calle ni número exacto): ${ciudad_zona}
- Precio: $${precio} USD
- ARV estimado: ${arv ? `$${arv} USD` : 'No especificado'}
- Características: ${beds || '?'} recámaras, ${baths || '?'} baños, ${sqft || '?'} sqft, Lote: ${lot_size || 'N/A'}, Año: ${year_built || 'N/A'}
- Notas adicionales: ${notas_extra || 'Ninguna'}

Reglas obligatorias:
1. NUNCA menciones la dirección exacta (${direccion_privada}), solo la ciudad/código postal (${ciudad_zona}).
2. script_fb_es: Post para Facebook Marketplace / Grupos en español enfocado en familias trabajadoras e inversionistas latinos. Destaca: Aceptamos ITIN o Pasaporte, desde 15% de enganche, financiamiento privado directo sin banco y entrega rápida. Incluye llamado a acción para pedir información por WhatsApp.
3. script_fb_en: Post corto, directo y de alto impacto en inglés para cash buyers e inversionistas (destaca margen vs ARV, potencial de renta/remodelación y cierre rápido).
4. script_wa_vip: Mensaje corto con emojis estructurados para enviar al grupo VIP de WhatsApp anunciando que acaba de entrar esta propiedad al catálogo.
5. script_filtro_curiosos: Respuesta rápida para contestar mensajes de Facebook tipo "¿Sigue disponible?" o "¿Dónde está?", filtrando si buscan compra de contado o financiamiento con ITIN/enganche antes de soltar la ubicación exacta.
`;

    // Modelos vigentes confirmados para llaves nuevas (el lite es mucho más rápido y estable)
    const modelos = ['gemini-3.5-flash-lite', 'gemini-3.8-flash'];
    let scripts: {
      script_fb_es: string;
      script_fb_en: string;
      script_wa_vip: string;
      script_filtro_curiosos: string;
    } | null = null;

    for (const modelo of modelos) {
      for (let intento = 1; intento <= 2; intento++) {
        try {
          const response = await ai.models.generateContent({
            model: modelo,
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  script_fb_es: { type: Type.STRING },
                  script_fb_en: { type: Type.STRING },
                  script_wa_vip: { type: Type.STRING },
                  script_filtro_curiosos: { type: Type.STRING },
                },
                required: [
                  'script_fb_es',
                  'script_fb_en',
                  'script_wa_vip',
                  'script_filtro_curiosos',
                ],
              },
            },
          });

          if (response.text) {
            scripts = JSON.parse(response.text);
            break;
          }
        } catch (err) {
          console.warn(`Fallo en ${modelo} (intento ${intento}):`, err);
          if (intento < 2) await esperar(1500);
        }
      }
      if (scripts) break;
    }

    // Si Google está 100% saturado, usa plantilla automática para nunca perder la captura
    if (!scripts) {
      scripts = generarScriptsRespaldo({
        ciudad_zona,
        precio,
        arv,
        beds,
        baths,
        sqft,
      });
    }

    const { data, error } = await supabaseAdmin
      .from('propiedades')
      .insert([
        {
          direccion_privada,
          ciudad_zona,
          precio: Number(precio),
          arv: arv ? Number(arv) : null,
          beds: beds ? Number(beds) : null,
          baths: baths ? Number(baths) : null,
          sqft: sqft ? Number(sqft) : null,
          lot_size: lot_size || null,
          year_built: year_built ? Number(year_built) : null,
          drive_url: drive_url || null,
          imagen_portada: imagen_portada || null,
          ...scripts,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, propiedad: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}