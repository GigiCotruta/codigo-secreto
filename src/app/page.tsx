"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { getLastNickname, setLastNickname, setStoredPlayerToken } from "@/lib/storage";

export default function HomePage() {
  const router = useRouter();
  const [nickname, setNickname] = useState(() => getLastNickname());
  const [roomCode, setRoomCode] = useState("");
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingJoin, setLoadingJoin] = useState(false);

  const createRoom = async () => {
    if (!nickname.trim()) {
      toast.error("Escribe un apodo para crear la sala.");
      return;
    }

    setLoadingCreate(true);
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim() }),
      });

      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "No se pudo crear la sala.");
      }

      setLastNickname(nickname.trim());
      setStoredPlayerToken(payload.data.roomCode, payload.data.playerToken);
      router.push(`/room/${payload.data.roomCode}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear la sala.";
      toast.error(message);
    } finally {
      setLoadingCreate(false);
    }
  };

  const joinRoom = async () => {
    if (!nickname.trim()) {
      toast.error("Escribe un apodo para entrar.");
      return;
    }

    if (!roomCode.trim()) {
      toast.error("Introduce un código de sala.");
      return;
    }

    setLoadingJoin(true);
    const targetCode = roomCode.trim().toUpperCase();

    try {
      const response = await fetch(`/api/rooms/${targetCode}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim() }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "No se pudo entrar en la sala.");
      }

      setLastNickname(nickname.trim());
      setStoredPlayerToken(targetCode, payload.data.playerToken);
      router.push(`/room/${targetCode}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo entrar en la sala.";
      toast.error(message);
    } finally {
      setLoadingJoin(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-10">
      <section className="grid w-full gap-6 rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-2xl backdrop-blur-sm lg:grid-cols-[1.3fr_1fr] lg:p-10">
        <article>
          <p className="inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
            Multijugador en tiempo real
          </p>
          <h1 className="mt-3 text-4xl font-black leading-tight text-slate-900 sm:text-5xl">Código Secreto</h1>
          <p className="mt-3 max-w-xl text-slate-700">
            Crea una sala privada, comparte el enlace y juega online con tu familia o amigos. Solo dos capitanes juegan; el resto observa en directo.
          </p>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p>Regla clave de esta versión:</p>
            <p className="mt-1 font-semibold">
              El capitán del turno da la pista y también revela cartas. Los espectadores no pueden interactuar.
            </p>
          </div>

          <Link href="/how-to-play" className="mt-5 inline-block text-sm font-semibold text-orange-700 underline underline-offset-4">
            Ver Cómo jugar
          </Link>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Entrar en partida</h2>

          <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="nickname-home">
            Apodo
          </label>
          <input
            id="nickname-home"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-orange-400 focus:ring"
            placeholder="Ejemplo: Carlos"
            maxLength={24}
          />

          <button
            type="button"
            onClick={createRoom}
            disabled={loadingCreate}
            className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {loadingCreate ? "Creando..." : "Crear sala nueva"}
          </button>

          <div className="my-4 border-t border-dashed border-slate-300" />

          <label className="block text-sm font-semibold text-slate-700" htmlFor="room-code-home">
            Código de sala
          </label>
          <input
            id="room-code-home"
            value={roomCode}
            onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 uppercase outline-none ring-orange-400 focus:ring"
            placeholder="ABC123"
            maxLength={8}
          />

          <button
            type="button"
            onClick={joinRoom}
            disabled={loadingJoin}
            className="mt-3 w-full rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-900 disabled:opacity-50"
          >
            {loadingJoin ? "Entrando..." : "Unirse con código"}
          </button>
        </article>
      </section>
    </main>
  );
}
