import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);

// Ejecuta los handlers y el estado de los componentes sin red ni DOM.
function pantalla(archivo, nombre, props, inventario = false, precargados = []) {
  const estados = [];
  let indice = 0;
  const react = {
    useState(inicial) {
      const posicion = indice++;
      if (!(posicion in estados)) estados[posicion] = posicion in precargados ? precargados[posicion] : inventario && posicion === 1
        ? [] : typeof inicial === 'function' ? inicial() : inicial;
      return [estados[posicion], (valor) => {
        estados[posicion] = typeof valor === 'function' ? valor(estados[posicion]) : valor;
      }];
    },
    useRef: () => ({ current: null }),
    useId: () => "vista-fotos-prueba",
    useCallback: (fn) => fn,
    useEffect() {},
  };
  const cache = new Map();
  function cargar(ruta) {
    if (cache.has(ruta)) return cache.get(ruta);
    const fuente = readFileSync(ruta, 'utf8');
    const { outputText } = ts.transpileModule(fuente, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    } });
    const modulo = { exports: {} };
    const importar = (id) => {
      if (id === 'react') return react;
      if (id === 'react/jsx-runtime') return require(id);
      if (id.includes('use-reloj-disponibilidad')) return { useRelojDisponibilidad: () => null };
      if (id.startsWith('@/lib/') || id.endsWith('/datos-pegados')) {
        const base = id.startsWith('@/') ? resolve(root, id.slice(2)) : resolve(dirname(ruta), id);
        if (existsSync(base + '.ts')) return cargar(base + '.ts');
      }
      return new Proxy({}, { get: (_objeto, clave) => clave === '__esModule' ? true : () => null });
    };
    new Function('require', 'module', 'exports', outputText)(importar, modulo, modulo.exports);
    cache.set(ruta, modulo.exports);
    return modulo.exports;
  }
  const componente = cargar(resolve(root, archivo))[nombre];
  return (cambios = {}) => { indice = 0; return componente({ ...props, ...cambios }); };
}

function nodos(arbol) {
  if (!arbol || typeof arbol !== 'object') return [];
  if (Array.isArray(arbol)) return arbol.flatMap(nodos);
  return [arbol, ...nodos(arbol.props?.children)];
}

function texto(nodo) {
  if (typeof nodo === 'string') return nodo;
  if (Array.isArray(nodo)) return nodo.map(texto).join('');
  return texto(nodo?.props?.children ?? '');
}

test('el formulario conserva ciudad al escribir, borrar y corregir ZIP y al cambiar de ciudad', () => {
  const render = pantalla('app/admin/formulario-ficha.tsx', 'FormularioFicha', { userId: 'vendedor', drive: {} });
  const ciudad = () => nodos(render()).find((n) => typeof n.type === 'function' && typeof n.props?.onChange === 'function' && 'value' in n.props);
  const zip = () => nodos(render()).find((n) => n.type === 'input' && n.props.inputMode === 'numeric');
  ciudad().props.onChange('Peoria');
  for (const valor of ['8', '85', '853', '8534', '85345', '8534', '', '85281']) {
    zip().props.onChange({ target: { value: valor } });
    assert.equal(ciudad().props.value, 'Peoria');
    assert.equal(zip().props.value, valor);
  }
  ciudad().props.onChange('Tempe');
  assert.equal(ciudad().props.value, 'Tempe');
  assert.equal(zip().props.value, '85281');
});

test('una ficha aprobada pierde la copia de anuncios al retirarse y ofrece una respuesta alternativa', () => {
  const ficha = { textos_version: 1, condiciones_texto: {}, script_fb_es: 'Casa disponible', script_fb_es_aprobado: true };
  const render = pantalla('app/admin/textos-ficha.tsx', 'TextosDeFicha', {
    ficha, estado: 'disponible', zona: 'Peoria', requisitos: [], guardar: async () => ({}),
  });
  function editor(arbol) {
    const elemento = nodos(arbol).find((n) => n.props?.canal === 'script_fb_es');
    return elemento.type(elemento.props);
  }
  function boton(arbol) {
    return nodos(arbol).find((n) => n.type === 'button' && texto(n) === 'Copiar texto final');
  }
  assert.equal(boton(editor(render())).props.disabled, false);
  for (const estado of ['en_contrato', 'vendida']) {
    const arbol = render({ estado });
    assert.equal(boton(editor(arbol)).props.disabled, true);
    const respuesta = nodos(arbol).find((n) => n.props?.['aria-label'] === 'Respuesta sobre la propiedad retirada');
    assert.match(respuesta.props.value, /Peoria.*otra opción/);
    assert.match(respuesta.props.value, estado === 'en_contrato' ? /en contrato/ : /ya no está disponible/);
  }
  assert.equal(boton(editor(render({ estado: 'disponible' }))).props.disabled, false);
});

test('los cambios de revisión conservan la página visible de la cola', () => {
  const ficha = { id: 'casa-2', ciudad_zona: 'Mesa', direccion_privada: null, ultima_confirmacion: null };
  const render = pantalla('app/admin/cola-disponibilidad.tsx', 'ColaDisponibilidad', {
    revision: 0, ocupadas: new Set(), cargar: async () => ({ propiedades: [], hayMas: false }), actualizar: async () => {},
  }, false, [1, 0, { propiedades: [ficha], hayMas: true }]);
  for (const revision of [0, 1]) {
    const arbol = render({ revision });
    const indicador = nodos(arbol).find((n) => n.type === 'span' && texto(n).startsWith('Página '));
    assert.deepEqual(indicador.props.children, ['Página ', 2]);
    assert.match(texto(arbol), /Mesa/);
    assert.equal(nodos(arbol).find((n) => n.type === 'button' && texto(n) === 'Anterior').props.disabled, false);
  }
});

test('los textos conservan el enganche local al corregir el precio y lo sincronizan al cambiar en el servidor', () => {
  const ficha = { textos_version: 1, condiciones_texto: { enganche: 10 }, script_fb_es: 'Casa disponible', script_fb_es_aprobado: true };
  const render = pantalla('app/admin/textos-ficha.tsx', 'TextosDeFicha', {
    ficha, estado: 'disponible', zona: 'Peoria', requisitos: [], guardar: async () => ({}),
  });
  const enganche = (arbol) => nodos(arbol).find((n) => n.type === 'input' && n.props.type === 'number');
  assert.equal(enganche(render()).props.value, '10');
  enganche(render()).props.onChange({ target: { value: '15' } });
  assert.equal(enganche(render({ ficha: { ...ficha, textos_version: 2, script_fb_es_aprobado: false } })).props.value, '15');

  const actualizada = { ...ficha, textos_version: 3, condiciones_texto: { enganche: 20 } };
  render({ ficha: actualizada });
  const arbol = render({ ficha: actualizada });
  assert.equal(enganche(arbol).props.value, '20');
  const editor = nodos(arbol).find((n) => n.props?.canal === 'script_fb_es');
  assert.equal(editor.props.condicionesEditadas, false);
});

test('las vistas de Drive reintentan con la alternativa y después con la descarga privada', () => {
  const foto = { id: 'foto-1', name: 'Sala.jpg', miniaturaDrive: 'https://drive.test/thumb', miniaturaUrl: 'https://images.test/photo' };
  const render = pantalla('app/admin/fotos-drive.tsx', 'VistaFotoDrive', { foto, abrir: async () => new Blob(['imagen']) });
  const imagen = () => nodos(render()).find((n) => n.type === 'img');
  assert.equal(imagen().props.src, foto.miniaturaDrive);
  imagen().props.onError();
  assert.equal(imagen().props.src, foto.miniaturaUrl);
  imagen().props.onError();
  assert.ok(nodos(render()).some((n) => n.props?.role === 'status'), 'debe recuperar la imagen mediante el endpoint privado');
  assert.equal(nodos(render()).some((n) => n.props?.role === 'alert'), false);
});


test('cada tarjeta del selector muestra una vista con recuperación de miniaturas', () => {
  const fotos = [{ id: 'a', name: 'Sala.jpg', miniaturaUrl: 'https://images.test/a' }, { id: 'b', name: 'Patio.jpg' }];
  const render = pantalla('app/admin/fotos-drive.tsx', 'SelectorFotosDrive', {
    carpeta: '', seleccionadas: fotos, portada: null, alSeleccionar() {}, alElegirPortada() {},
    listar: async () => fotos, abrir: async () => new Blob(), abrirOriginal: async () => new Blob(),
  });
  const vistas = nodos(render()).filter((n) => n.type?.name === 'VistaFotoDrive');
  assert.equal(vistas.length, 2);
  assert.ok(vistas.every((n) => n.props.miniatura === true));
});

test('el selector integrado filtra sin modificar la ciudad y confirma con Enter', () => {
  const elegidas = [];
  const render = pantalla('app/selector-ciudad.tsx', 'SelectorCiudad', { value: 'Peoria', onChange: (ciudad) => elegidas.push(ciudad) });
  const input = () => nodos(render()).find((n) => n.props?.role === 'combobox');
  assert.equal(input().props.value, 'Peoria');
  input().props.onFocus();
  input().props.onChange({ target: { value: 'tem' } });
  assert.deepEqual(elegidas, []);
  assert.deepEqual(nodos(render()).filter((n) => n.props?.role === 'option').map(texto), ['Tempe']);
  const lista = nodos(render()).find((n) => n.props?.role === 'listbox');
  assert.match(lista.props.className, /240px.*overflow-y-auto/);
  input().props.onKeyDown({ key: 'Enter', preventDefault() {} });
  assert.deepEqual(elegidas, ['Tempe']);
  assert.equal(input().props['aria-expanded'], false);
  input().props.onFocus();
  input().props.onChange({ target: { value: 'no-existe' } });
  assert.ok(nodos(render()).some((n) => n.props?.role === 'status'));
  input().props.onKeyDown({ key: 'Escape', preventDefault() {} });
  assert.equal(input().props.value, 'Peoria');
  assert.deepEqual(elegidas, ['Tempe']);
});


test('el carrusel avanza, retrocede y permite deslizar sin abrir otras páginas', () => {
  const fotos = ['/foto/1','/foto/2','/foto/3'];
  const render = pantalla('app/galeria-publica.tsx', 'GaleriaPublica', { propiedad: 'casa-1', zona: 'Peoria', detalle: true }, false, [fotos]);
  const boton = (nombre) => nodos(render()).find((n) => n.type === 'button' && n.props['aria-label'] === nombre);
  const foto = () => nodos(render()).find((n) => n.props?.descripcion)?.props.src;
  assert.equal(foto(), '/foto/1');
  boton('Foto siguiente').props.onClick();
  assert.equal(foto(), '/foto/2');
  boton('Foto anterior').props.onClick();
  assert.equal(foto(), '/foto/1');
  boton('Foto anterior').props.onClick();
  assert.equal(foto(), '/foto/3');
  boton('Ver foto 2').props.onClick();
  assert.equal(foto(), '/foto/2');
  const tactil = nodos(render()).find((n) => n.props?.onTouchStart);
  tactil.props.onTouchStart({ touches: [{ clientX: 220, clientY: 100 }] });
  tactil.props.onTouchEnd({ changedTouches: [{ clientX: 100, clientY: 105 }] });
  assert.equal(foto(), '/foto/3');
});
