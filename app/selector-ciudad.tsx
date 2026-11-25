'use client';

import { useId, useState } from 'react';
import { ciudadesPhoenix } from '@/lib/ciudades-phoenix';

export function SelectorCiudad({ value, onChange, label = 'Ciudad pública', ariaLabel = 'Zona pública', placeholder = 'Busca Phoenix, Peoria, Tempe…' }: { value: string; onChange: (ciudad: string) => void; label?: string; ariaLabel?: string; placeholder?: string }) {
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  const [consulta, setConsulta] = useState('');
  const [activo, setActivo] = useState(0);
  const opciones = ciudadesPhoenix.filter((ciudad) => ciudad.toLowerCase().includes(consulta.trim().toLowerCase()));
  const elegir = (ciudad: string) => { onChange(ciudad); setAbierto(false); setConsulta(''); setActivo(0); };

  return <div className="min-w-0 space-y-1 text-sm" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) { setAbierto(false); setConsulta(''); }
  }}>
    <label htmlFor={id} className="block">{label}</label>
    <div className="relative">
    <input id={id} role="combobox" aria-label={ariaLabel} aria-autocomplete="list" aria-expanded={abierto}
      aria-controls={`${id}-opciones`} aria-activedescendant={abierto && opciones[activo] ? `${id}-${activo}` : undefined}
      className="vip-input min-h-11 w-full" autoComplete="off" value={abierto ? consulta : value}
      placeholder={value || placeholder}
      onFocus={() => { setAbierto(true); setConsulta(''); setActivo(0); }}
      onClick={() => { if (!abierto) { setAbierto(true); setConsulta(''); setActivo(0); } }}
      onChange={(event) => { setConsulta(event.target.value); setActivo(0); setAbierto(true); }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') { event.preventDefault(); setAbierto(false); setConsulta(''); }
        if (event.key === 'Enter' && abierto) { event.preventDefault(); if (opciones[activo]) elegir(opciones[activo]); }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault(); setAbierto(true);
          const siguiente = !abierto ? 0 : Math.max(0, Math.min(opciones.length - 1, activo + (event.key === 'ArrowDown' ? 1 : -1)));
          setActivo(siguiente);
          document.getElementById(`${id}-${siguiente}`)?.scrollIntoView({ block: 'nearest' });
        }
      }} />
    {abierto && <div className="absolute inset-x-0 top-full z-40 mt-1 rounded-xl border border-[#dfd3c4] bg-[#fffdf8] p-1 shadow-xl">
      <div id={`${id}-opciones`} role="listbox" aria-label="Ciudades del área de Phoenix"
        className="max-h-[min(240px,35dvh)] overflow-y-auto overscroll-contain">
        {opciones.map((ciudad, indice) => <button key={ciudad} id={`${id}-${indice}`} type="button" role="option"
          aria-selected={ciudad === value} tabIndex={-1}
          className={`block min-h-11 w-full rounded-lg px-3 py-2 text-left ${indice === activo ? 'bg-[#1b3555] text-white' : 'text-[#1b3555] hover:bg-[#eee7db]'}`}
          onMouseDown={(event) => event.preventDefault()} onClick={() => elegir(ciudad)}>{ciudad}{ciudad === value ? ' ✓' : ''}</button>)}
      </div>
      {!opciones.length && <p role="status" className="p-3">No hay coincidencias. Prueba otro nombre.</p>}
    </div>}
    </div>
    {value && <button type="button" className="min-h-11 px-1 text-xs underline" onClick={() => elegir('')}>Quitar ciudad</button>}
  </div>;
}
