import { GoogleGenAI, Type } from '@google/genai';
import {
  canalesTexto, condicionesTexto, MAX_TEXTO, requisitosTextos,
  type CanalTexto, type CondicionesTexto,
} from '../../../../lib/textos-propiedad';

export const camposAnuncio = ['ciudad_zona', 'precio', 'arv', 'beds', 'baths', 'sqft', 'lot_size', 'year_built', 'estado'] as const;

export type FichaAnuncio = Partial<Record<(typeof camposAnuncio)[number], unknown>>;

export function validarCondiciones(valor: unknown): CondicionesTexto {
  if (valor == null) return {};
  if (typeof valor !== 'object' || Array.isArray(valor)) throw new Error('Revisa las condiciones marcadas');
  const entrada = valor as Record<string, unknown>;
  const condiciones: CondicionesTexto = {};
  for (const campo of Object.keys(condicionesTexto) as (keyof typeof condicionesTexto)[]) {
    if (entrada[campo] === true) condiciones[campo] = true;
    else if (entrada[campo] !== undefined && entrada[campo] !== false) throw new Error('Revisa las condiciones marcadas');
  }
  if (entrada.enganche != null) {
    if (typeof entrada.enganche !== 'number' || !Number.isFinite(entrada.enganche)
      || entrada.enganche <= 0 || entrada.enganche > 100) {
      throw new Error('Indica un enganche mayor que 0 y de hasta 100%');
    }
    condiciones.enganche = entrada.enganche;
  }
  return condiciones;
}

function numeroPublico(valor: unknown) {
  if (typeof valor !== 'number' && (typeof valor !== 'string' || !valor.trim())) return undefined;
  const numero = Number(valor);
  return Number.isFinite(numero) && numero >= 0 ? numero : undefined;
}

export function datosAnuncio(ficha: FichaAnuncio, condiciones: CondicionesTexto) {
  const zona = typeof ficha.ciudad_zona === 'string' ? ficha.ciudad_zona.trim() : '';
  const precio = numeroPublico(ficha.precio);
  if (!precio || requisitosTextos(ficha).length) return null;
  const lote = typeof ficha.lot_size === 'string' && /^\d[\d,.]*\s*(?:sq\.?\s*ft\.?|sqft|ft²|acres?)?$/i.test(ficha.lot_size)
    ? ficha.lot_size : undefined;
  return {
    zona,
    precio,
    arv: condiciones.incluirArv ? numeroPublico(ficha.arv) : undefined,
    recamaras: numeroPublico(ficha.beds),
    banos: numeroPublico(ficha.baths),
    superficie: numeroPublico(ficha.sqft),
    lote,
    anio: numeroPublico(ficha.year_built),
    condiciones: {
      ...condiciones,
      incluirArv: undefined,
    },
  };
}

type DatosAnuncio = NonNullable<ReturnType<typeof datosAnuncio>>;

function plantillas(datos: DatosAnuncio): Record<CanalTexto, string> {
  const usd = (importe: number) => `$${importe.toLocaleString('en-US')} USD`;
  const precio = usd(datos.precio);
  const c = datos.condiciones;
  const specs = [
    datos.recamaras != null && `Beds: ${datos.recamaras}`,
    datos.banos != null && `Baths: ${datos.banos}`,
    datos.superficie != null && `Sq Ft: ${datos.superficie.toLocaleString('en-US')}`,
    datos.lote && `Lot Size: ${datos.lote}`,
    datos.anio != null && `Year Built: ${datos.anio}`,
  ].filter(Boolean).join('\n');
  const es = [
    c.contado && 'Compra de contado disponible',
    c.financiamiento && 'Financiamiento privado disponible',
    c.itin && 'Se acepta ITIN',
    c.pasaporte && 'Se acepta pasaporte',
    c.arreglos && 'Financiamiento para arreglos disponible',
    c.enganche && `Enganche: ${c.enganche}%`,
  ].filter(Boolean).join(' · ');
  const en = [
    c.contado && 'Cash purchase available',
    c.financiamiento && 'Private financing available',
    c.itin && 'ITIN accepted',
    c.pasaporte && 'Passport accepted',
    c.arreglos && 'Repair financing available',
    c.enganche && `Down payment: ${c.enganche}%`,
  ].filter(Boolean).join(' · ');
  const arv = datos.arv ? `ARV: ${usd(datos.arv)}` : '';
  const unir = (...lineas: string[]) => lineas.filter(Boolean).join('\n');
  return {
    script_fb_es: unir(`🏡 Casa en ${datos.zona}`, `Precio: ${precio}`, arv, specs, es, 'Escríbeme para ver fotos y coordinar una visita.'),
    script_fb_en: unir(`🏡 Property in ${datos.zona}`, `Price: ${precio}`, arv, specs, en, 'Message me for photos and to schedule a visit.'),
    script_wa_vip: unir(`🏡 *Propiedad en ${datos.zona}*`, `Precio: *${precio}*`, es, 'Responde a este mensaje para pedir fotos y coordinar una visita.'),
    script_filtro_curiosos: `¡Hola! Te puedo dar detalles de la casa en ${datos.zona} (${precio}). ¿Buscas una casa para vivir o una inversión? Si te interesa, coordinamos una visita.`,
  };
}

export async function generarTextos(datos: DatosAnuncio) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (apiKey) {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Redacta cuatro borradores inmobiliarios para publicar manualmente.
Usa un tono directo como «🏡 Venta de casa en Phoenix» y un bloque breve de precio y características.
Escribe Facebook en español e inglés para compradores e inversionistas, un mensaje individual de WhatsApp y una respuesta inicial.
Varía el enfoque según las características reales. Usa exclusivamente los datos y condiciones confirmadas del JSON.
Omite campos ausentes. No inventes daños, margen, elegibilidad, financiamiento, plazos, fotos, enlaces ni promesas de aprobación.
Usa solo ciudad o ZIP y propone coordinar una visita sin revelar el domicilio.
Datos públicos: ${JSON.stringify(datos)}`;

    for (const modelo of ['gemini-3.5-flash-lite', 'gemini-3.8-flash']) {
      try {
        const respuesta = await ai.models.generateContent({
          model: modelo,
          contents: prompt,
          config: {
            httpOptions: { timeout: 8000, retryOptions: { attempts: 1 } },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: Object.fromEntries(canalesTexto.map((canal) => [canal, { type: Type.STRING }])),
              required: canalesTexto,
            },
          },
        });
        const json = JSON.parse(respuesta.text ?? '');
        const borradores = canalesTexto.map((canal) => {
          const texto = json?.[canal];
          return [canal, typeof texto === 'string' ? texto.trim() : ''] as const;
        });
        if (borradores.every(([, texto]) => texto && texto.length <= MAX_TEXTO)) {
          return { textos: Object.fromEntries(borradores), origen: 'gemini' as const };
        }
      } catch {
        // El siguiente modelo o las plantillas conservan el flujo de revisión.
      }
    }
  }
  return { textos: plantillas(datos), origen: 'plantillas' as const };
}
