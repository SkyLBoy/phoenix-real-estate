export const camposPegables = {
  direccionPrivada: ['Dirección exacta', 'dirección privada', 'dirección', 'property address', 'address'],
  ciudadZona: ['Zona pública', 'ciudad/zona', 'ciudad', 'zona', 'city'],
  precio: ['Precio', 'price', 'asking price', 'precio usd', 'price usd'],
  arv: ['ARV', 'ARV estimado', 'estimated ARV', 'after repair value'],
  beds: ['Recámaras', 'habitaciones', 'dormitorios', 'bed', 'beds', 'bedrooms'],
  baths: ['Baños', 'bath', 'baths', 'bathrooms'],
  sqft: ['Superficie', 'sq ft', 'sqft', 'living area', 'square feet', 'superficie habitable'],
  lotSize: ['Tamaño del lote', 'lot size', 'lot sqft', 'lote', 'superficie del lote'],
  yearBuilt: ['Año de construcción', 'año construcción', 'year built', 'año', 'year'],
} as const;

export type CampoPegable = keyof typeof camposPegables;

const campos = Object.keys(camposPegables) as CampoPegable[];

function normalizarEtiqueta(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

const etiquetasZip = new Set(['zip', 'zipcode', 'codigopostal']);

const porEtiqueta = new Map(campos.flatMap((campo) =>
  camposPegables[campo].map((etiqueta) => [normalizarEtiqueta(etiqueta), campo] as const),
));

function valorDeCampo(campo: CampoPegable, valor: string) {
  if (!valor || /^(?:n\/?a|pendiente|[-–—]+)$/i.test(valor)) return null;
  if (campo === 'direccionPrivada' || campo === 'ciudadZona' || campo === 'lotSize') return valor;

  let numero = valor;
  if (campo === 'precio' || campo === 'arv') {
    numero = numero.replace(/^(?:USD\s*)?\$?\s*/i, '').replace(/\s*USD$/i, '');
    if (campo === 'arv') numero = numero.replace(/\s*\+$/, '');
  }
  if (campo === 'sqft') numero = numero.replace(/\s*(?:sq\.?\s*ft\.?|square feet|ft²)$/i, '');
  const formato = /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/;
  if (!formato.test(numero)) return null;

  const cantidad = Number(numero.replaceAll(',', ''));
  if (!Number.isFinite(cantidad)) return null;
  if (campo === 'yearBuilt' && !/^\d{4}$/.test(numero)) return null;
  if ((campo === 'beds' || campo === 'sqft') && !Number.isSafeInteger(cantidad)) return null;
  return String(cantidad);
}

export function leerDatosPegados(bloque: string) {
  const valores: Partial<Record<CampoPegable, string>> = {};
  const revisar = new Set<CampoPegable>();
  let arvConMas = false;
  let zip: string | undefined;
  let zipAmbiguo = false;

  for (const linea of bloque.split(/\r?\n/)) {
    const separador = linea.search(/[:：]/);
    if (separador === -1) continue;
    const etiqueta = normalizarEtiqueta(linea.slice(0, separador));
    const original = linea.slice(separador + 1).trim();
    if (etiquetasZip.has(etiqueta)) {
      if (!/^\d{5}(?:-\d{4})?$/.test(original) || (zip !== undefined && zip !== original)) {
        zipAmbiguo = true;
      } else {
        zip = original;
      }
      continue;
    }
    const campo = porEtiqueta.get(etiqueta);
    if (!campo || revisar.has(campo)) continue;

    const valor = valorDeCampo(campo, original);
    if (valor === null || (valores[campo] !== undefined && valores[campo] !== valor)) {
      delete valores[campo];
      revisar.add(campo);
      continue;
    }
    valores[campo] = valor;
    if (campo === 'arv' && /\+\s*(?:USD)?$/i.test(original)) arvConMas = true;
  }

  if (zipAmbiguo) revisar.add('ciudadZona');
  if (zip && !revisar.has('ciudadZona')) {
    const zona = valores.ciudadZona;
    const zipEnZona = zona?.match(/\b\d{5}(?:-\d{4})?\b/)?.[0];
    if (!zona) valores.ciudadZona = zip;
    else if (!zipEnZona) valores.ciudadZona = `${zona}, ${zip}`;
    else if (zipEnZona !== zip) {
      delete valores.ciudadZona;
      revisar.add('ciudadZona');
    }
  }

  return { valores, revisar: [...revisar], arvConMas: arvConMas && valores.arv !== undefined };
}
