"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Team = {
  id: number;
  name: string;
  abbreviation: string;
};

type Player = {
  user_id: string;
  username: string;
};

type Game = {
  id: number;
  game_date: string;
  home_team_id: number;
  away_team_id: number;
  homeTeam?: Team;
  awayTeam?: Team;
  homeOdds?: number;
  awayOdds?: number;
  selectedTeamId?: number | null;
};

export default function GamesPage() {
  const router = useRouter();

  const [player, setPlayer] = useState<Player | null>(null);
  const [seasonId, setSeasonId] = useState<number | null>(null);
  const [date, setDate] = useState("2026-10-20");

  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [savingGameId, setSavingGameId] = useState<number | null>(null);
  const [savedGameId, setSavedGameId] = useState<number | null>(null);

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
    }
  }, [router]);

  useEffect(() => {
    async function loadSeason() {
      const { data, error } = await supabase
        .from("seasons")
        .select("id")
        .eq("is_active", true)
        .single();

      if (error || !data) {
        setError(error?.message || "Saison introuvable.");
        return;
      }

      setSeasonId(data.id);
    }

    loadSeason();
  }, []);

  useEffect(() => {
    if (!seasonId || !player) return;

    const currentSeasonId = seasonId;
    const currentPlayer = player;

    async function loadGames() {
      setLoading(true);
      setError("");
      setSavedGameId(null);

      const start = new Date(`${date}T06:00:00+02:00`);

        const nextDay = new Date(`${date}T12:00:00`);
        nextDay.setDate(nextDay.getDate() + 1);

        const nextYear = nextDay.getFullYear();
        const nextMonth = String(nextDay.getMonth() + 1).padStart(2, "0");
        const nextDate = String(nextDay.getDate()).padStart(2, "0");

        const end = new Date(
        `${nextYear}-${nextMonth}-${nextDate}T05:59:59+02:00`
        );
        15

      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select("id, game_date, home_team_id, away_team_id")
        .eq("season_id", currentSeasonId)
        .gte("game_date", start.toISOString())
        .lte("game_date", end.toISOString())
        .order("game_date", { ascending: true });

      if (gameError) {
        setError(gameError.message);
        setLoading(false);
        return;
      }

      if (!gameData || gameData.length === 0) {
        setGames([]);
        setLoading(false);
        return;
      }

      const teamIds = [
        ...new Set(
          gameData.flatMap((game) => [
            game.home_team_id,
            game.away_team_id,
          ])
        ),
      ];

      const { data: teams, error: teamsError } = await supabase
        .from("teams")
        .select("id, name, abbreviation")
        .in("id", teamIds);

      if (teamsError || !teams) {
        setError(
          teamsError?.message || "Impossible de charger les équipes."
        );
        setLoading(false);
        return;
      }

      const gameIds = gameData.map((game) => game.id);

      const { data: predictions } = await supabase
        .from("predictions")
        .select("game_id, team_id")
        .eq("user_id", currentPlayer.user_id)
        .in("game_id", gameIds);

      const completedGames: Game[] = await Promise.all(
        gameData.map(async (game) => {
          const homeTeam = teams.find(
            (team) => team.id === game.home_team_id
          );

          const awayTeam = teams.find(
            (team) => team.id === game.away_team_id
          );

          const { data: oddsData } = await supabase.rpc(
            "get_game_odds",
            {
              p_game_id: game.id,
            }
          );

          const odds = oddsData?.[0];

          const prediction = predictions?.find(
            (prediction) => prediction.game_id === game.id
          );

          return {
            ...game,
            homeTeam,
            awayTeam,
            homeOdds: odds?.home_odds,
            awayOdds: odds?.away_odds,
            selectedTeamId: prediction?.team_id ?? null,
          };
        })
      );

      setGames(completedGames);
      setLoading(false);
    }

    loadGames();
  }, [seasonId, date, player]);

  function selectTeam(gameId: number, teamId: number) {
    setGames((currentGames) =>
      currentGames.map((game) =>
        game.id === gameId
          ? {
              ...game,
              selectedTeamId: teamId,
            }
          : game
      )
    );

    setSavedGameId(null);
  }

  async function savePrediction(game: Game) {
    if (!player || !game.selectedTeamId) return;

    setSavingGameId(game.id);
    setSavedGameId(null);
    setError("");

    const { data: lockTime, error: lockError } = await supabase.rpc(
      "get_prediction_lock_time",
      {
        p_game_id: game.id,
      }
    );

    if (lockError) {
      setError(lockError.message);
      setSavingGameId(null);
      return;
    }

    if (new Date() >= new Date(lockTime)) {
      setError("Les pronostics de ce match sont clôturés.");
      setSavingGameId(null);
      return;
    }

    const { error: predictionError } = await supabase
      .from("predictions")
      .upsert(
        {
          user_id: player.user_id,
          game_id: game.id,
          team_id: game.selectedTeamId,
          locked_odds: null,
          points: 0,
        },
        {
          onConflict: "user_id,game_id",
        }
      );

    if (predictionError) {
      setError(predictionError.message);
      setSavingGameId(null);
      return;
    }

    setSavingGameId(null);
    setSavedGameId(game.id);
  }

  function changeDate(days: number) {
    const current = new Date(`${date}T12:00:00`);
    current.setDate(current.getDate() + days);

    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, "0");
    const day = String(current.getDate()).padStart(2, "0");

    setDate(`${year}-${month}-${day}`);
  }

  function formatDay() {
    return new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date(`${date}T12:00:00`));
  }

  function formatTime(gameDate: string) {
    return new Intl.DateTimeFormat("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Paris",
    }).format(new Date(gameDate));
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto min-h-screen max-w-md bg-slate-900">
        <header className="px-5 pb-4 pt-8">
          <p className="text-sm text-slate-400">
            {player?.username || "..."}
          </p>

          <h1 className="mt-1 text-3xl font-black">
            Matchs 🏀
          </h1>
        </header>

        <section className="px-5 pb-28">
          <div className="mb-5 flex items-center justify-between rounded-2xl bg-slate-800 p-2">
            <button
              type="button"
              onClick={() => changeDate(-1)}
              className="rounded-xl px-4 py-3 text-xl font-bold"
            >
              ‹
            </button>

            <div className="text-center">
              <p className="capitalize font-bold">
                {formatDay()}
              </p>

              <p className="text-xs text-slate-400">
                {games.length} match{games.length > 1 ? "s" : ""}
              </p>
            </div>

            <button
              type="button"
              onClick={() => changeDate(1)}
              className="rounded-xl px-4 py-3 text-xl font-bold"
            >
              ›
            </button>
          </div>

          {loading && (
            <p className="py-10 text-center text-slate-400">
              Chargement...
            </p>
          )}

          {error && (
            <div className="mb-4 rounded-2xl bg-red-950 p-4 text-red-200">
              {error}
            </div>
          )}

          {!loading && !error && games.length === 0 && (
            <div className="rounded-3xl bg-slate-800 p-8 text-center">
              <p className="text-3xl">🏀</p>
              <p className="mt-3 font-bold">
                Aucun match
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Pas de match NBA cette journée.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {games.map((game) => {
              const awaySelected =
                game.selectedTeamId === game.away_team_id;

              const homeSelected =
                game.selectedTeamId === game.home_team_id;

              return (
                <div
                  key={game.id}
                  className="rounded-3xl bg-white p-4 text-slate-900"
                >
                  <p className="text-center text-sm font-bold text-slate-500">
                    {formatTime(game.game_date)}
                  </p>

                  <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        selectTeam(game.id, game.away_team_id)
                      }
                      className={`rounded-2xl p-2 text-center transition ${
                        awaySelected
                          ? "bg-slate-900 text-white ring-4 ring-slate-300"
                          : "bg-slate-50 text-slate-900"
                      }`}
                    >
                      <div
                        className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full font-black ${
                          awaySelected
                            ? "bg-white text-slate-900"
                            : "bg-slate-200"
                        }`}
                      >
                        {game.awayTeam?.abbreviation}
                      </div>

                      <p className="mt-2 text-sm font-bold">
                        {game.awayTeam?.name}
                      </p>

                      <p
                        className={`mt-1 text-xs ${
                          awaySelected
                            ? "text-slate-300"
                            : "text-slate-400"
                        }`}
                      >
                        Extérieur
                      </p>

                      <div
                        className={`mt-2 rounded-xl py-2 ${
                          awaySelected
                            ? "bg-white text-slate-900"
                            : "bg-slate-900 text-white"
                        }`}
                      >
                        <span className="text-xs opacity-60">
                          Cote{" "}
                        </span>
                        <span className="font-black">
                          {game.awayOdds}
                        </span>
                      </div>

                      {awaySelected && (
                        <p className="mt-2 text-xs font-black">
                          ✓ TON PRONO
                        </p>
                      )}
                    </button>

                    <div className="text-xl font-black text-slate-400">
                      @
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        selectTeam(game.id, game.home_team_id)
                      }
                      className={`rounded-2xl p-2 text-center transition ${
                        homeSelected
                          ? "bg-slate-900 text-white ring-4 ring-slate-300"
                          : "bg-slate-50 text-slate-900"
                      }`}
                    >
                      <div
                        className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full font-black ${
                          homeSelected
                            ? "bg-white text-slate-900"
                            : "bg-slate-200"
                        }`}
                      >
                        {game.homeTeam?.abbreviation}
                      </div>

                      <p className="mt-2 text-sm font-bold">
                        {game.homeTeam?.name}
                      </p>

                      <p
                        className={`mt-1 text-xs ${
                          homeSelected
                            ? "text-slate-300"
                            : "text-slate-400"
                        }`}
                      >
                        Domicile
                      </p>

                      <div
                        className={`mt-2 rounded-xl py-2 ${
                          homeSelected
                            ? "bg-white text-slate-900"
                            : "bg-slate-900 text-white"
                        }`}
                      >
                        <span className="text-xs opacity-60">
                          Cote{" "}
                        </span>
                        <span className="font-black">
                          {game.homeOdds}
                        </span>
                      </div>

                      {homeSelected && (
                        <p className="mt-2 text-xs font-black">
                          ✓ TON PRONO
                        </p>
                      )}
                    </button>
                  </div>

                  {game.selectedTeamId && (
                    <button
                      type="button"
                      onClick={() => savePrediction(game)}
                      disabled={savingGameId === game.id}
                      className="mt-4 w-full rounded-2xl bg-slate-900 py-3 font-bold text-white disabled:opacity-50"
                    >
                      {savingGameId === game.id
                        ? "Enregistrement..."
                        : "Enregistrer mon prono"}
                    </button>
                  )}

                  {savedGameId === game.id && (
                    <div className="mt-3 rounded-xl bg-green-100 p-3 text-center text-sm font-bold text-green-800">
                      Pronostic enregistré ✓
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <nav className="fixed bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 border-t border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
          <div className="grid grid-cols-3 text-center text-xs font-semibold">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="py-3 text-slate-400"
            >
              Accueil
            </button>

            <button
              type="button"
              className="rounded-2xl bg-white py-3 text-slate-950"
            >
              Matchs
            </button>

            <button
                type="button"
                onClick={() => router.push("/classement")}
                className="py-3 text-slate-400"
            >
                Classement
                </button>
          </div>
        </nav>
      </div>
    </main>
  );
}