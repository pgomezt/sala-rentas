export default function Home() {
  return <main>
    <p className="eyebrow">CUNDINAMARCA / SALA RENTAS</p>
    <h1>Entorno de desarrollo</h1>
    <p className="intro">La web está en ejecución. El procesamiento de tornaguías aún no está habilitado.</p>
    <section aria-labelledby="scope">
      <h2 id="scope">Estado de esta fase</h2>
      <dl>
        <div><dt>Web</dt><dd>En ejecución</dd></div>
        <div><dt>Worker</dt><dd>Proceso independiente · modo inactivo</dd></div>
        <div><dt>PostgreSQL</dt><dd>Sin consultar desde esta pantalla</dd></div>
        <div><dt>Importaciones</dt><dd>No habilitadas</dd></div>
      </dl>
      <a href="/api/health">Comprobar configuración del servidor →</a>
    </section>
    <p className="note">Esta página no representa datos reales ni verifica que el worker esté arrancado.</p>
  </main>;
}

