// Un ZIP solo o una localidad, con estado y ZIP opcionales. Los números de
// calle, unidades y cruces no pertenecen al encabezado del catálogo.
const formatoZona = /^(?:[0-9]{5}(?:-[0-9]{4})?|[A-Za-zÀ-ÖØ-öø-ÿ]+(?:(?:\.? |[’'-])[A-Za-zÀ-ÖØ-öø-ÿ]+)*(?:, (?:AZ|Arizona))?(?:,? [0-9]{5}(?:-[0-9]{4})?)?)$/i;

export function esZonaPublica(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.length <= 100 && formatoZona.test(valor.trim());
}
