'use client';

import { LogoMarca } from '../logo-marca';

import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Lock } from 'lucide-react';
import { supabaseAdminAuth } from '@/lib/supabase-admin-auth';
import { Inventario } from './inventario';

export default function AdminPanel() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const { data: { subscription } } = supabaseAdminAuth.auth.onAuthStateChange(
      (_event, nextSession) => setSession(nextSession),
    );
    return () => subscription.unsubscribe();
  }, []);

  const iniciarSesion = async (event: React.FormEvent) => {
    event.preventDefault();
    setEntrando(true);
    setError('');

    try {
      const { error } = await supabaseAdminAuth.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setError('No se pudo iniciar sesión. Revisa tu correo y contraseña.');
      } else {
        setPassword('');
      }
    } catch {
      setError('No se pudo conectar. Intenta de nuevo.');
    } finally {
      setEntrando(false);
    }
  };

  const cerrarSesion = useCallback(async () => {
    setSaliendo(true);
    setError('');
    try {
      const { error } = await supabaseAdminAuth.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch {
      setError('No se pudo cerrar la sesión. Intenta de nuevo.');
    } finally {
      setSaliendo(false);
    }
  }, []);

  if (session === undefined) {
    return (
      <main className="admin-shell min-h-screen bg-[var(--admin-canvas)] text-[var(--admin-ink)] grid place-items-center" role="status">
        Comprobando sesión…
      </main>
    );
  }

  if (session) {
    return (
      <Inventario
        key={session.user.id}
        userId={session.user.id}
        cerrarSesion={cerrarSesion}
        saliendo={saliendo}
        errorSesion={error}
      />
    );
  }

  return (
    <main className="admin-shell min-h-screen bg-[var(--admin-canvas)] text-[var(--admin-ink)] flex items-center justify-center p-4">
      <form
        onSubmit={iniciarSesion}
        className="bg-[var(--admin-surface)] border border-[var(--admin-soft)] p-6 rounded-2xl max-w-md w-full space-y-4 sm:p-8"
      >
        <h1 className="flex items-center gap-2 text-[var(--admin-accent)] font-bold text-lg">
          <Lock size={20} /> Acceso privado
        </h1>
        <div className="flex items-center gap-3"><LogoMarca /><p className="text-sm font-medium text-[var(--admin-secondary)]">Sergio Orantes | House FixAndFlip</p></div>
        <label className="block space-y-1">
          <span className="text-sm">Correo electrónico</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="w-full bg-[var(--admin-canvas)] border border-[var(--admin-soft)] rounded-lg px-3 py-2.5 text-[var(--admin-ink)] focus:outline-none focus:border-[var(--admin-accent)]"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm">Contraseña</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="w-full bg-[var(--admin-canvas)] border border-[var(--admin-soft)] rounded-lg px-3 py-2.5 text-[var(--admin-ink)] focus:outline-none focus:border-[var(--admin-accent)]"
          />
        </label>
        {error && <p role="alert" className="text-sm text-[var(--admin-danger)]">{error}</p>}
        <button
          type="submit"
          disabled={entrando}
          className="w-full bg-[var(--admin-primary)] hover:bg-[var(--admin-accent)] disabled:opacity-50 text-[var(--admin-canvas)] font-semibold py-2.5 rounded-lg transition cursor-pointer"
        >
          {entrando ? 'Iniciando sesión…' : 'Entrar al panel'}
        </button>
      </form>
    </main>
  );
}
