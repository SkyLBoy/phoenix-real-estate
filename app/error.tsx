'use client';

export default function ErrorPagina({ retry }: { retry: () => void }) {
  return (
    <main className="public-shell">
      <section className="public-wrap py-10">
        <div className="public-panel space-y-4 p-6">
          <h1 className="editorial-title text-3xl">No pudimos cargar esta página</h1>
          <p>Intenta volver a cargarla.</p>
          <button type="button" className="public-action" onClick={retry}>Reintentar</button>
        </div>
      </section>
    </main>
  );
}
