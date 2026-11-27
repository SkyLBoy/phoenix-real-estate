import { cache } from 'react';

// Comparte un solo instante durante el renderizado de cada solicitud.
export const horaDeSolicitud = cache(Date.now);
