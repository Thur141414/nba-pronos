"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Player = { user_id: string; username: string };
type RankingPlayer = {
  user_id: string;
  username: string;
  total_points: number;
  correct_predictions: number;
  finished_predictions: number;
  success_percentage: number;
  ranking_position: number;
};
type Extras = {
  user_id: string;
  week_points: number;
  month_points: number;
  week_correct: number;
  week_finished: number;
  month_correct: number;
  month_finished: number;
  current_streak: number;
  week_movement: number;
  previous_week_points: number;
  previous_week_rank: number;
};
type Period = "general" | "week" | "month";

export default function ClassementPage() {
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [ranking, setRanking] = useState<RankingPlayer[]>([]);
  const [extras, setExtras] = useState<Extras[]>([]);
  const [period, setPeriod] = useState<Period>("general");
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
      setError("");
      const [rankingResult, extrasResult] = await Promise.all([
        supabase.rpc("get_players_ranking"),
        supabase.rpc("get_ranking_extras"),
      ]);
      if (rankingResult.error || extrasResult.error) {
        setError(rankingResult.error?.message || extrasResult.error?.message || "Erreur de chargement.");
        setLoading(false);
        return;
      }
      setRanking(rankingResult.data || []);
      setExtras(extrasResult.data || []);
      setLoading(false);
    }
    loadRanking();
  }, [router]);

  const extrasById = new Map(extras.map((item) => [item.user_id, item]));
  const getExtra = (id: string) => extrasById.get(id);
  const pointsFor = (p: RankingPlayer) =>
    period === "general" ? Number(p.total_points) : Number(getExtra(p.user_id)?.[period === "week" ? "week_points" : "month_points"] ?? 0);
  const correctFor = (p: RankingPlayer) =>
    period === "general" ? Number(p.correct_predictions) : Number(getExtra(p.user_id)?.[period === "week" ? "week_correct" : "month_correct"] ?? 0);
  const finishedFor = (p: RankingPlayer) =>
    period === "general" ? Number(p.finished_predictions) : Number(getExtra(p.user_id)?.[period === "week" ? "week_finished" : "month_finished"] ?? 0);
  const sorted = [...ranking].sort((a, b) => pointsFor(b) - pointsFor(a) || a.ranking_position - b.ranking_position);
  const previousWeekWinner = [...ranking]
    .filter((p) => Number(getExtra(p.user_id)?.previous_week_points ?? 0) > 0)
    .sort((a, b) => Number(getExtra(b.user_id)?.previous_week_points ?? 0) - Number(getExtra(a.user_id)?.previous_week_points ?? 0) || a.username.localeCompare(b.username))[0];

  return (
    <main className="min-h-screen bg-[#0B1F1D] text-[#F8F6EF]">
      <div className="mx-auto min-h-screen max-w-md bg-[#0B1F1D]">
        <header className="px-5 pb-5 pt-8">
          <p className="text-sm text-[#A9C2BD]">Classement des joueurs</p>
          <h1 className="mt-1 text-3xl font-black text-[#F8F6EF]">NBA PRONOS 🏆</h1>
        </header>

        <section className="space-y-4 px-5 pb-28">
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-[#265550] p-1">
            {([ ["general", "Général"], ["week", "Semaine"], ["month", "Mois"] ] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setPeriod(value)}
                className={`rounded-xl px-2 py-3 text-sm font-bold transition-colors ${period === value ? "bg-[#3F7D76] text-[#F8F6EF]" : "text-[#A9C2BD]"}`}>
                {label}
              </button>
            ))}
          </div>

          {loading && <div className="rounded-3xl bg-[#265550] p-6 text-center text-[#A9C2BD]">Chargement du classement...</div>}
          {error && <div className="rounded-3xl bg-red-950 p-5 text-red-200">Erreur : {error}</div>}

          {!loading && !error && (
            <>
              <div className="rounded-2xl bg-[#265550] px-4 py-3 text-sm text-[#E2ECE9]">
                {period === "general" ? "🏆 Classement de la saison" : period === "week" ? "📅 Cette semaine · lundi à dimanche" : "📅 Ce mois-ci"}
                <span className="block pt-1 text-xs text-[#A9C2BD]">Les périodes suivent la journée NBA (06 h, heure de Paris).</span>
              </div>

              <div className="rounded-3xl border border-[#3F7D76] bg-[#265550] p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[#A9C2BD]">🏅 Joueur de la semaine passée</p>
                {previousWeekWinner ? (
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="truncate text-lg font-black">{previousWeekWinner.username}</p>
                    <p className="shrink-0 font-black">{getExtra(previousWeekWinner.user_id)?.previous_week_points} pts</p>
                  </div>
                ) : <p className="mt-2 text-sm text-[#E2ECE9]">Pas encore de vainqueur pour la semaine passée.</p>}
              </div>

              {sorted.length === 0 && <p className="py-8 text-center text-[#A9C2BD]">Aucun joueur pour le moment.</p>}
              {sorted.map((rankingPlayer, index) => {
                const isCurrentPlayer = rankingPlayer.user_id === player?.user_id;
                const extra = getExtra(rankingPlayer.user_id);
                const pts = pointsFor(rankingPlayer);
                const finished = finishedFor(rankingPlayer);
                const correct = correctFor(rankingPlayer);
                const pct = finished > 0 ? (100 * correct / finished).toFixed(1) : "0.0";
                const previous = sorted[index - 1];
                const position = period === "general" ? rankingPlayer.ranking_position : previous && pointsFor(previous) === pts ? sorted.findIndex((p) => pointsFor(p) === pts) + 1 : index + 1;
                const movement = Number(extra?.week_movement ?? 0);
                return (
                  <div key={rankingPlayer.user_id} className={`rounded-3xl p-5 text-[#F8F6EF] ${isCurrentPlayer ? "bg-[#3F7D76] ring-2 ring-[#A9C2BD]" : "bg-[#265550]"}`}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0B1F1D] text-lg font-black text-[#F8F6EF]">
                        {position === 1 ? "🥇" : position === 2 ? "🥈" : position === 3 ? "🥉" : position}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-black">
                          {rankingPlayer.username}
                          {isCurrentPlayer && <span className="ml-2 text-xs font-semibold text-[#E2ECE9]">TOI</span>}
                        </p>
                        <p className="mt-1 text-xs text-[#E2ECE9]">{correct}/{finished} bons pronos · {pct}%</p>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-[#F8F6EF]">
                          <span>🔥 {Number(extra?.current_streak ?? 0)} de suite</span>
                          {period === "week" && (
                            <span className={movement > 0 ? "text-[#F8F6EF]" : "text-[#E2ECE9]"}>
                              {movement > 0 ? `▲ ${movement} place${movement > 1 ? "s" : ""}` : movement < 0 ? `▼ ${Math.abs(movement)} place${movement < -1 ? "s" : ""}` : "— Stable"}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-2xl font-black">{pts}</p>
                        <p className="text-xs text-[#E2ECE9]">points</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <p className="text-center text-xs text-[#A9C2BD]">🔥 Série calculée sur les pronostics terminés, du plus récent au plus ancien.</p>
            </>
          )}
        </section>

        <nav className="fixed bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 border-t border-[#265550] bg-[#0B1F1D]/95 px-4 py-3 backdrop-blur">
          <div className="grid grid-cols-4 text-center text-xs font-semibold">
            <button type="button" onClick={() => router.push("/")} className="py-3 text-[#A9C2BD]">Accueil</button>
            <button type="button" onClick={() => router.push("/matchs")} className="py-3 text-[#A9C2BD]">Matchs</button>
            <button type="button" className="rounded-2xl bg-[#265550] px-2 py-3 text-[#F3F0E8]">Classement</button>
            <button type="button" onClick={() => router.push("/stats")} className="py-3 text-[#A9C2BD]">Stats</button>
          </div>
        </nav>
      </div>
    </main>
  );
}
