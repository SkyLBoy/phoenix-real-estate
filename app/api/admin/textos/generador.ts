import { registrarAviso } from '../../../../lib/diagnostico';
import { ApiError, GoogleGenAI, Type } from '@google/genai';
import {
  canalesTexto, clavesCondiciones, clavesRasgos, MAX_TEXTO, publicosTexto, rasgosPublicos, requisitosTextos,
  type CanalTexto, type CondicionesTexto,
} from '../../../../lib/textos-propiedad';

export const camposAnuncio = ['ciudad_zona', 'precio', 'arv', 'beds', 'baths', 'sqft', 'lot_size', 'year_built', 'estado'] as const;

export type FichaAnuncio = Partial<Record<(typeof camposAnuncio)[number], unknown>>;

export function validarCondiciones(valor: unknown): CondicionesTexto {
  if (valor == null) return {};
  if (typeof valor !== 'object' || Array.isArray(valor)) throw new Error('Revisa las condiciones marcadas');
  const entrada = valor as Record<string, unknown>;
  const condiciones: CondicionesTexto = {};
  for (const campo of clavesCondiciones) {
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
  if (entrada.publico != null) {
    if (typeof entrada.publico !== 'string' || !Object.hasOwn(publicosTexto, entrada.publico)) {
      throw new Error('Elige uno de los públicos de la ficha');
    }
    if (entrada.publico !== 'mixto') condiciones.publico = entrada.publico as keyof typeof publicosTexto;
  }
  if (entrada.rasgos != null) {
    const rasgos = entrada.rasgos;
    if (!Array.isArray(rasgos) || !rasgos.every((rasgo) => typeof rasgo === 'string' && Object.hasOwn(rasgosPublicos, rasgo))) {
      throw new Error('Selecciona características públicas de la lista');
    }
    const confirmados = clavesRasgos.filter((rasgo) => rasgos.includes(rasgo));
    if (confirmados.length > 2) throw new Error('Elige hasta dos características para destacar.');
    if (confirmados.length) condiciones.rasgos = confirmados;
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
  const { publico = 'mixto', rasgos = [], incluirArv, ...comerciales } = condiciones;
  return {
    zona,
    precio,
    arv: incluirArv ? numeroPublico(ficha.arv) : undefined,
    recamaras: numeroPublico(ficha.beds),
    banos: numeroPublico(ficha.baths),
    superficie: numeroPublico(ficha.sqft),
    lote,
    anio: numeroPublico(ficha.year_built),
    publico,
    rasgos: rasgos.map((rasgo) => rasgosPublicos[rasgo]),
    condiciones: comerciales,
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
    c.habitable && 'Casa habitable',
    c.contado && 'Compra de contado disponible',
    c.financiamiento && 'Financiamiento privado disponible',
    c.itin && 'Se acepta ITIN',
    c.pasaporte && 'Se acepta pasaporte',
    c.arreglos && 'Financiamiento para arreglos disponible',
    c.enganche && `Enganche: ${c.enganche}%`,
  ].filter(Boolean).map((condicion) => `✅ ${condicion}`).join('\n');
  const en = [
    c.habitable && 'Livable property',
    c.contado && 'Cash purchase available',
    c.financiamiento && 'Private financing available',
    c.itin && 'ITIN accepted',
    c.pasaporte && 'Passport accepted',
    c.arreglos && 'Repair financing available',
    c.enganche && `Down payment: ${c.enganche}%`,
  ].filter(Boolean).map((condicion) => `✅ ${condicion}`).join('\n');
  const precioMercado = datos.arv ? usd(datos.arv) : '';
  const unir = (...lineas: string[]) => lineas.filter(Boolean).join('\n');
  const ganchos = {
    vivienda: [`🏡 ¿Buscas casa para vivir en ${datos.zona}?`, `🏡 Looking for a place to call home in ${datos.zona}?`],
    inversion: [`🏡 ¿Estás comparando inversiones en ${datos.zona}? Revisa las cifras de esta casa.`, `🏡 Comparing deals in ${datos.zona}? Take a look at these numbers.`],
    mixto: [`🏡 Te tengo una casa en ${datos.zona}. ¿La quieres conocer?`, `🏡 Take a look at this home in ${datos.zona}.`],
  };
  const [aperturaEs, aperturaEn] = ganchos[datos.publico];
  const destacadosEs = datos.rasgos.map((rasgo) => rasgo.es).join(' · ');
  const destacadosEn = datos.rasgos.map((rasgo) => rasgo.en).join(' · ');
  const secciones = (...partes: string[]) => partes.filter(Boolean).join('\n\n');
  return {
    script_fb_es: secciones(
      unir(aperturaEs, destacadosEs && `✨ ${destacadosEs}`),
      unir(`Price: ${precio}`, precioMercado && `Precio del Mercado: ${precioMercado}`, specs), es,
      c.paraFlippers && datos.publico !== 'vivienda' ? '🔨 Pregúntame por esta opción para Fix & Flip.' : '',
      c.asesoria ? '💡 Te acompaño durante el proceso de compra.' : '',
      '📲 Escríbeme para ver fotos y coordinar una visita.',
    ),
    script_fb_en: secciones(
      unir(aperturaEn, destacadosEn && `✨ ${destacadosEn}`),
      unir(`Asking price: ${precio}`, precioMercado && `Market Price: ${precioMercado}`, specs), en,
      c.paraFlippers && datos.publico !== 'vivienda' ? '🔨 Ask me about this fix-and-flip option.' : '',
      c.asesoria ? '💡 I can guide you through the buying process.' : '',
      '📲 Message me for photos and to schedule a walkthrough.',
    ),
    script_wa_vip: unir(`📍 *${datos.zona}* · *${precio}*`, datos.rasgos[0]?.es ?? (datos.recamaras && datos.banos ? `${datos.recamaras} recámaras · ${datos.banos} baños` : ''), '¿Te interesa? Respóndeme y te paso las fotos.'),
    script_filtro_curiosos: `¡Hola! Tengo tu mensaje sobre la de ${datos.zona} por ${precio}. ${{
      vivienda: '¿Qué te gustaría ver primero de la casa?',
      inversion: '¿Qué dato te falta para evaluar la compra?',
      mixto: '¿La estás buscando para vivir o para invertir?',
    }[datos.publico]}`,
  };
}

function incluyeAfirmacionesSinRespaldo(texto: string) {
  const normalizado = texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  return /\b(?:todos califican|everyone qualifies|guaranteed approval|aprobacion garantizada)\b/u.test(normalizado)
    || /\b(?:financiamiento|credito|prestamo)\s+(?:bancario|tradicional|convencional)|\b(?:bank|conventional|standard|traditional)\s+(?:financing|loan|mortgage)|\b(?:necesita|requiere|ocupa)\s+(?:(?:algunos?|varios?|unas?|de)\s+)?(?:arreglos?|reparaciones?|remodelacion|renovacion)|\b(?:needs?|requires?|requiring)\s+(?:(?:some|minor|major|a few)\s+)?(?:repairs?|renovations?|work|fixes|tlc)/u.test(normalizado);
}

export async function generarTextos(datos: DatosAnuncio, canal?: CanalTexto) {
  const solicitados = canal ? [canal] : canalesTexto;
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) registrarAviso('textos.gemini', 'SIN_API_KEY');
  if (apiKey) {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Eres el asistente editorial de un vendedor de casas en Phoenix. Escribe como una persona que conoce su inventario y le habla directamente al comprador.
Para Facebook, escribe con el ritmo de un vendedor que publica para su comunidad: una primera línea con 🏡 y un gancho de una o dos frases; un bloque de datos, uno por línea (Price, Precio del Mercado en español o Market Price en inglés si está disponible, Beds, Baths, Sq Ft, Lot Size y Year Built según estén disponibles); un bloque de condiciones con ✅, una por línea; y un cierre con 📲 para pedir fotos o agendar visita. Usa primera persona y frases cortas. No escribas todo en un párrafo ni uses mayúsculas sostenidas.
Referencia de VOZ, no de datos: «🏡 ¡Te tengo una casa en [zona]! ¿Estás buscando dónde hacer tu primer Fix & Flip?» Solo usa el ángulo Fix & Flip si está confirmado para esa ficha. Otro cierre de referencia: «📲 Mándame mensaje y te paso las fotos. ¿En qué parte de Phoenix estás buscando?». Adapta la apertura a cada casa y evita repetir el ejemplo de forma literal.
Elige para cada canal el dato confirmado más relevante. Abre con ese dato, una pregunta concreta o dos cifras útiles. Evita ganchos genéricos como «gran oportunidad» y «no dejes pasar». Alterna entre pregunta y afirmación según el dato; evita que las cuatro piezas comiencen igual.

El público seleccionado en «publico» es el mismo en ambos idiomas. Para vivienda destaca un rasgo confirmado que el comprador pueda imaginar al visitar. Para inversión presenta cifras confirmadas, con el Precio del Mercado como estimación si está disponible. El campo «arv» del JSON se presenta como «Precio del Mercado» en español y «Market Price» en inglés. Para un público mixto combina una característica física y el precio. Usa «rasgos» como detalles confirmados para distinguir la publicación. Evita inferir utilidad, reparaciones o rentabilidad.
- script_fb_es: anuncio en español con apertura personal, bloque escaneable de cifras y una invitación a pedir fotos o coordinar visita.
- script_fb_en: anuncio en inglés natural con una apertura propia, datos escaneables y una invitación a conversar.
- script_wa_vip: mensaje individual breve, de dos o tres líneas. Incluye zona y precio, a lo sumo un dato adicional y una invitación a responder.
- script_filtro_curiosos: contesta en tono de conversación; identifica la ficha y haz una sola pregunta útil, como si busca vivienda o inversión. Evita formato de anuncio, bloques y listas.

Reglas literales para las condiciones del JSON:
- financiamiento: si está confirmado, menciona «financiamiento privado» o «private financing». Jamás lo describas como bancario, estándar, tradicional o convencional.
- arreglos: confirma únicamente que hay una opción de financiamiento para arreglos («financing available for repairs»). El estado físico es desconocido salvo que se confirme «habitable». Evita afirmar que necesita reparaciones.
- habitable: permite decir «habitable» o «livable». No implica que esté remodelada o que esté lista para mudarse sin hacer cambios.
- paraFlippers: permite orientar el anuncio a Fix & Flip. Evita afirmar que hay daños o garantizar rentabilidad.
- asesoria: permite ofrecer acompañamiento personal durante la compra. No lo menciones si no está confirmado.
- enganche: si aparece, conserva el porcentaje y nómbralo «enganche indicado» o «down payment». Evita «mínimo», «desde» u «obligatorio» si no se especifican.
- ITIN: si se confirma, expresa que se acepta ITIN como condición comercial. Evita presentarlo como un tipo de crédito o como una garantía de aprobación.

Omite datos ausentes. Usa solo los hechos y condiciones confirmadas del JSON. Evita prometer aprobación, enganches o plazos no confirmados, o inventar el estado del inmueble, cercanía a servicios, fotos, enlaces o la dirección exacta. Usa únicamente la ciudad o el ZIP para la ubicación.
Redacta solo estos canales: ${solicitados.join(', ')}.
Datos públicos: ${JSON.stringify(datos)}`;

    for (const modelo of ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.8-flash']) {
      try {
        const respuesta = await ai.models.generateContent({
          model: modelo,
          contents: prompt,
          config: {
            httpOptions: { timeout: 15000, retryOptions: { attempts: 1 } },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: Object.fromEntries(solicitados.map((nombre) => [nombre, { type: Type.STRING }])),
              required: solicitados,
              propertyOrdering: solicitados,
            },
          },
        });
        const json = JSON.parse(respuesta.text ?? '');
        const borradores = solicitados.map((canal) => {
          const texto = json?.[canal];
          return [canal, typeof texto === 'string' ? texto.trim() : ''] as const;
        });
        if (borradores.every(([, texto]) => texto && texto.length <= MAX_TEXTO)) {
          if (borradores.some(([, texto]) => incluyeAfirmacionesSinRespaldo(texto))) {
            registrarAviso('textos.gemini', 'AFIRMACIONES_SIN_RESPALDO', { modelo });
            continue;
          }
          return { textos: Object.fromEntries(borradores), origen: 'gemini' as const };
        }
        registrarAviso('textos.gemini', 'RESPUESTA_INVALIDA', { modelo });
      } catch (error) {
        const codigo = error instanceof ApiError ? 'ERROR_HTTP'
          : error instanceof SyntaxError ? 'JSON_INVALIDO' : 'ERROR_INESPERADO';
        registrarAviso('textos.gemini', codigo, { modelo, estado: error instanceof ApiError ? error.status : undefined });
      }
    }
  }
  const respaldo = plantillas(datos);
  return { textos: canal ? { [canal]: respaldo[canal] } : respaldo, origen: 'plantillas' as const };
}
