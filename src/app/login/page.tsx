"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Mode = "login" | "create";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function changeMode(newMode: Mode) {
    setMode(newMode);
    setError("");
    setUsername("");
    setPin("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    setError("");
    setLoading(true);

    const functionName =
      mode === "login" ? "login_player" : "create_player";

    const { data, error } = await supabase.rpc(functionName, {
      p_username: username.trim(),
      p_pin: pin,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const player = data?.[0];

    if (!player) {
      setError(
        mode === "login"
          ? "Pseudo ou PIN incorrect."
          : "Impossible de créer le joueur."
      );
      setLoading(false);
      return;
    }

    localStorage.setItem(
      "nba_pronos_player",
      JSON.stringify(player)
    );

    router.push("/");
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-slate-900 px-6">
        <div className="mb-8 text-center">
          <div className="text-5xl">🏀</div>

          <h1 className="mt-4 text-4xl font-black">
            NBA PRONOS
          </h1>

          <p className="mt-2 text-slate-400">
            {mode === "login"
              ? "Entre dans la compétition"
              : "Crée ton joueur"}
          </p>
        </div>

        <div className="mb-4 grid grid-cols-2 rounded-2xl bg-slate-800 p-1">
          <button
            type="button"
            onClick={() => changeMode("login")}
            className={`rounded-xl py-3 text-sm font-bold ${
              mode === "login"
                ? "bg-white text-slate-950"
                : "text-slate-400"
            }`}
          >
            Connexion
          </button>

          <button
            type="button"
            onClick={() => changeMode("create")}
            className={`rounded-xl py-3 text-sm font-bold ${
              mode === "create"
                ? "bg-white text-slate-950"
                : "text-slate-400"
            }`}
          >
            Nouveau joueur
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl bg-white p-6 text-slate-900"
        >
          <label className="text-sm font-bold">
            Pseudo
          </label>

          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Ton pseudo"
            autoComplete="username"
            maxLength={20}
            className="mt-2 w-full rounded-2xl bg-slate-100 px-4 py-4 outline-none"
          />

          <label className="mt-5 block text-sm font-bold">
            PIN
          </label>

          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) =>
              setPin(e.target.value.replace(/\D/g, ""))
            }
            placeholder="••••"
            className="mt-2 w-full rounded-2xl bg-slate-100 px-4 py-4 text-2xl tracking-[0.5em] outline-none"
          />

          {mode === "create" && (
            <p className="mt-3 text-xs text-slate-500">
              Choisis un pseudo et un PIN à 4 chiffres.
              Garde ton PIN en mémoire pour tes prochaines connexions.
            </p>
          )}

          {error && (
            <p className="mt-4 text-sm font-semibold text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={
              loading ||
              username.trim().length < 2 ||
              pin.length !== 4
            }
            className="mt-6 w-full rounded-2xl bg-slate-900 py-4 font-bold text-white disabled:opacity-40"
          >
            {loading
              ? "Chargement..."
              : mode === "login"
                ? "Se connecter"
                : "Créer mon joueur"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Saison NBA 2026-27
        </p>
      </div>
    </main>
  );
}