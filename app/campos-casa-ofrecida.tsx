import { condicionesCasa } from '@/lib/casas-ofrecidas';
import { paisesWhatsApp } from '@/lib/compradores-vip';

const campo = 'vip-input block';

export function CamposCasaOfrecida({ ocupado, accion }: { ocupado: boolean; accion: string }) {
  return (
  <fieldset disabled={ocupado} className="grid gap-3 sm:grid-cols-2">
    <div hidden aria-hidden="true"><label>Sitio web<input name="sitio_web" tabIndex={-1} autoComplete="off" /></label></div>
    <label className="space-y-1 text-sm">Nombre del propietario
      <input name="nombre" className={campo} maxLength={120} required autoComplete="off" />
    </label>
    <label className="space-y-1 text-sm">Ciudad o ZIP
      <input name="zona" className={campo} maxLength={120} required autoComplete="off" />
    </label>
    <label className="space-y-1 text-sm">País del teléfono
      <select name="pais" defaultValue="" className={campo} required>
        <option value="" disabled>Elige México o Estados Unidos</option>
        {Object.entries(paisesWhatsApp).map(([clave, pais]) => <option key={clave} value={clave}>{pais.etiqueta}</option>)}
      </select>
    </label>
    <label className="space-y-1 text-sm">Número de WhatsApp
      <input name="whatsapp" type="tel" className={campo} maxLength={40} required autoComplete="off" />
    </label>
    <label className="space-y-1 text-sm">Condición aproximada
      <select name="condicion" defaultValue="por_confirmar" className={campo}>
        {Object.entries(condicionesCasa).map(([clave, condicion]) => <option key={clave} value={clave}>{condicion}</option>)}
      </select>
    </label>
    <label className="space-y-1 text-sm">Precio esperado en USD (opcional)
      <input name="precio_esperado" type="number" min="0.01" step="0.01" className={campo} />
    </label>
    <label className="space-y-1 text-sm">Plazo para vender (opcional)
      <input name="plazo" className={campo} maxLength={120} placeholder="Este mes…" />
    </label>
    <label className="space-y-1 text-sm">Enlace a fotos (opcional)
      <input name="fotos_url" type="url" className={campo} maxLength={2048} />
    </label>
    <label className="space-y-1 text-sm sm:col-span-2">Comentario (opcional)
      <textarea name="notas" className={campo} maxLength={1000} rows={3} />
    </label>
    <button type="submit" className="public-action public-action-primary sm:col-span-2">{ocupado ? 'Guardando…' : accion}</button>
  </fieldset>
  );
}

export function datosCasaOfrecida(formulario: HTMLFormElement) {
  const datos = Object.fromEntries(new FormData(formulario));
  return { ...datos, precio_esperado: datos.precio_esperado ? Number(datos.precio_esperado) : null };
}
