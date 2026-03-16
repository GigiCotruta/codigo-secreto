import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-4">
      <section className="rounded-2xl border border-slate-200 bg-white/85 p-8 text-center shadow-lg">
        <h1 className="text-2xl font-black text-slate-900">Sala no encontrada</h1>
        <p className="mt-2 text-slate-600">Puede que el código no exista o que la sala ya no esté disponible.</p>
        <Link href="/" className="mt-4 inline-block rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">
          Ir al inicio
        </Link>
      </section>
    </main>
  );
}
