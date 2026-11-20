const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

export function importeUsd(importe: number) {
  return usd.format(importe);
}

export function diferenciaArv(precio: number, arv: number | null) {
  if (arv == null) return null;
  const diferencia = Number(arv) - Number(precio);
  return Number.isFinite(diferencia) && diferencia > 0 ? diferencia : null;
}
