import Link from "next/link";

export default function HowToPlayPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-10">
      <section className="rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-xl">
        <h1 className="text-3xl font-black text-slate-900">Cómo jugar</h1>
        <p className="mt-2 text-slate-700">
          Objetivo: descubrir todas las cartas de tu equipo antes que el otro equipo, evitando el asesino.
        </p>

        <h2 className="mt-6 text-xl font-bold text-slate-900">Roles en la sala</h2>
        <ul className="mt-2 list-disc pl-6 text-slate-700">
          <li>Capitán rojo: juega el turno rojo.</li>
          <li>Capitán azul: juega el turno azul.</li>
          <li>Jugadores: no tocan controles de partida, pero pertenecen a equipo rojo o azul.</li>
        </ul>

        <p className="mt-2 text-slate-700">
          Cuando un capitán inicia la partida, los jugadores se reparten automáticamente entre rojo y azul.
        </p>

        <h2 className="mt-6 text-xl font-bold text-slate-900">Qué hace cada capitán</h2>
        <ul className="mt-2 list-disc pl-6 text-slate-700">
          <li>Da una pista de una palabra y un número.</li>
          <li>Revela cartas en su propio turno.</li>
          <li>Puede terminar turno manualmente.</li>
          <li>Puede pausar o reanudar el temporizador si tiene permiso.</li>
        </ul>

        <h2 className="mt-6 text-xl font-bold text-slate-900">Cómo funciona un turno</h2>
        <ul className="mt-2 list-disc pl-6 text-slate-700">
          <li>La pista se muestra para toda la sala. Ejemplo: &quot;Pista: animal, 2&quot;.</li>
          <li>Los intentos permitidos son número + 1. En el ejemplo, 3 intentos.</li>
          <li>Si se descubre una carta correcta del equipo, se puede seguir.</li>
          <li>Si se descubre una carta neutral o del otro equipo, el turno termina.</li>
          <li>Si se descubre el asesino, la partida termina inmediatamente.</li>
        </ul>

        <h2 className="mt-6 text-xl font-bold text-slate-900">Temporizador de 2 minutos</h2>
        <ul className="mt-2 list-disc pl-6 text-slate-700">
          <li>Al iniciar partida hay 1 minuto de estrategia inicial para que los capitanes planifiquen.</li>
          <li>Cada turno arranca con 2:00 para el equipo activo.</li>
          <li>Si un equipo termina antes, empieza al instante el tiempo del otro equipo.</li>
          <li>Si el tiempo llega a 0, el turno cambia automáticamente.</li>
          <li>Se puede pausar, reanudar y reiniciar según permisos de sala.</li>
        </ul>

        <h2 className="mt-6 text-xl font-bold text-slate-900">Ejemplo corto</h2>
        <p className="mt-2 text-slate-700">Pista: animal, 2</p>
        <p className="text-slate-700">Cartas posibles: perro, gato</p>
        <p className="text-slate-700">El capitán rojo descubre perro (correcta) y puede seguir.</p>
        <p className="text-slate-700">Luego descubre una carta neutral y el turno termina.</p>

        <div className="mt-8">
          <Link href="/" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">
            Volver al inicio
          </Link>
        </div>
      </section>
    </main>
  );
}
