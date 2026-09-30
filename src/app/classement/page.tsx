"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Player = {
  user_id: string;
  username: string;
};

type RankingPlayer = {
  user_id: string;
  username: string;
  total_points: number;
  correct_predictions: number;
  finished_predictions: number;
  success_percentage: number;
  ranking_position: number;
};

export default function ClassementPage() {
  const router = useRouter();

  const [player, setPlayer] = useState<Player | null>(null);
  const [ranking, setRanking] = useState<RankingPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const savedPlayer = localStorage.getItem("nba_pronos_player");

    if (!savedPlayer) {
      router.replace("/login");
      return;
    }

    try {
      setPlayer(JSON.parse(savedPlayer));
    } catch {
      localStorage.removeItem("nba_pronos_player");
      router.replace("/login");
      return;
    }

    async function loadRanking() {
      setLoading(true);

      const { data, error } = await supabase.rpc(
        "get_players_ranking"
      );

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      setRanking(data || []);
      setLoading(false);
    }

    loadRanking();
  }, [router]);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto min-h-screen max-w-md bg-slate-900">
        <header className="px-5 pb-5 pt-8">
          <p className="text-sm text-slate-400">
            Classement général
          </p>

          <h1 className="mt-1 text-3xl font-black">
            NBA PRONOS 🏆
          </h1>
        </header>

        <section className="space-y-3 px-5 pb-28">
          {loading && (
            <div className="rounded-3xl bg-slate-800 p-6 text-center">
              <p className="text-slate-400">
                Chargement du classement...
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-3xl bg-red-950 p-5">
              <p className="font-bold text-red-300">
                Erreur
              </p>

              <p className="mt-2 text-sm text-red-200">
                {error}
              </p>
            </div>
          )}

          {!loading &&
            ranking.map((rankingPlayer) => {
              const isCurrentPlayer =
                rankingPlayer.user_id === player?.user_id;

              return (
                <div
                  key={rankingPlayer.user_id}
                  className={`rounded-3xl p-5 ${
                    isCurrentPlayer
                      ? "bg-white text-slate-950"
                      : "bg-slate-800 text-white"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl font-black ${
                        isCurrentPlayer
                          ? "bg-slate-950 text-white"
                          : "bg-slate-700"
                      }`}
                    >
                      {rankingPlayer.ranking_position}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg font-black">
                        {rankingPlayer.username}
                        {isCurrentPlayer && (
                          <span className="ml-2 text-xs font-semibold text-slate-500">
                            TOI
                          </span>
                        )}
                      </p>

                      <p
                        className={`mt-1 text-xs ${
                          isCurrentPlayer
                            ? "text-slate-500"
                            : "text-slate-400"
                        }`}
                      >
                        {rankingPlayer.correct_predictions}/
                        {rankingPlayer.finished_predictions} bons pronos
                        {" · "}
                        {Number(
                          rankingPlayer.success_percentage
                        ).toFixed(1)}
                        %
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-2xl font-black">
                        {rankingPlayer.total_points}
                      </p>

                      <p
                        className={`text-xs ${
                          isCurrentPlayer
                            ? "text-slate-500"
                            : "text-slate-400"
                        }`}
                      >
                        points
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
        </section>

        <nav className="fixed bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 border-t border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
          <div className="grid grid-cols-4 text-center text-xs font-semibold">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="py-3 text-slate-400"
            >
              Accueil
            </button>

            <button
              type="button"
              onClick={() => router.push("/matchs")}
              className="py-3 text-slate-400"
            >
              Matchs
            </button>

            <button
              type="button"
              className="rounded-2xl bg-white py-3 text-slate-950"
            >
              Classement
            </button>
            <button
                  type="button"
                  onClick={() => router.push("/stats")}
                  className="py-3 text-[#A9C2BD]"
            >
                  Stats
                </button>
          </div>
        </nav>
      </div>
    </main>
  );
}