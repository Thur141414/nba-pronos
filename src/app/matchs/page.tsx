"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Team = {
  id: number;
  name: string;
  abbreviation: string;
  logo_url?: string | null;
  wins?: number;
  losses?: number;
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
  home_score: number | null;
  away_score: number | null;
  status: string;
  homeTeam?: Team;
  awayTeam?: Team;
  homeOdds?: number;
  awayOdds?: number;
  selectedTeamId?: number | null;
  selectedLockedOdds?: number | null;
  predictionPoints?: number;
  lockTime?: string | null;
};

function getInitialDate() {
  const now = new Date();

  const franceNow = new Date(
    now.toLocaleString("en-US", {
      timeZone: "Europe/Paris",
    })
  );

  const seasonStart = new Date("2026-10-20T06:00:00");

  // Avant le début de la saison :
  // on affiche la première journée.
  if (franceNow < seasonStart) {
    return "2026-10-20";
  }

  // Entre minuit et 05:59 :
  // on est encore dans la journée NBA précédente.
  if (franceNow.getHours() < 6) {
    franceNow.setDate(franceNow.getDate() - 1);
  }

  const year = franceNow.getFullYear();
  const month = String(
    franceNow.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    franceNow.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function GamesPage() {
  const router = useRouter();

  const [player, setPlayer] = useState<Player | null>(null);
  const [seasonId, setSeasonId] = useState<number | null>(null);
  const [date, setDate] = useState(getInitialDate);

  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [savingAll, setSavingAll] = useState(false);
const [savedAll, setSavedAll] = useState(false);

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
      setSavedAll(false);

      const { data: dayBounds, error: dayBoundsError } =
        await supabase.rpc("get_nba_day_bounds", {
          p_date: date,
        });

      if (dayBoundsError || !dayBounds?.[0]) {
        setError(
          dayBoundsError?.message ||
            "Impossible de calculer la journée NBA."
        );
        setLoading(false);
        return;
      }

      const start = dayBounds[0].start_time;
      const end = dayBounds[0].end_time;
        

      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select(
        "id, game_date, home_team_id, away_team_id, home_score, away_score, status"
        )
        .eq("season_id", currentSeasonId)
        .gte("game_date", start)
        .lt("game_date", end)
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
        .select("id, name, abbreviation, logo_url")
        .in("id", teamIds);

      if (teamsError || !teams) {
        setError(
          teamsError?.message || "Impossible de charger les équipes."
        );
        setLoading(false);
        return;
      }

      const { data: rankings, error: rankingsError } =
        await supabase
          .from("team_rankings")
          .select("team_id, wins, losses")
          .eq("season_id", currentSeasonId)
          .in("team_id", teamIds);

      if (rankingsError) {
        setError(rankingsError.message);
        setLoading(false);
        return;
      }

      const teamsWithRecords: Team[] = teams.map((team) => {
        const ranking = rankings?.find(
          (item) => item.team_id === team.id
        );

        return {
          ...team,
          wins: ranking?.wins ?? 0,
          losses: ranking?.losses ?? 0,
        };
      });

      const gameIds = gameData.map((game) => game.id);

      const { data: predictions } = await supabase
        .from("predictions")
        .select("game_id, team_id, locked_odds, points")
        .eq("user_id", currentPlayer.user_id)
        .in("game_id", gameIds);

      const completedGames: Game[] = await Promise.all(
        gameData.map(async (game) => {
          const homeTeam = teamsWithRecords.find(
            (team) => team.id === game.home_team_id
          );

          const awayTeam = teamsWithRecords.find(
            (team) => team.id === game.away_team_id
          );

          const { data: oddsData } = await supabase.rpc(
            "get_game_odds",
            {
              p_game_id: game.id,
            }
          );

          const odds = oddsData?.[0];

          const { data: lockTimeData } = await supabase.rpc(
            "get_prediction_lock_time",
            {
              p_game_id: game.id,
            }
          );

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
            selectedLockedOdds:
              prediction?.locked_odds !== null &&
              prediction?.locked_odds !== undefined
                ? Number(prediction.locked_odds)
                : null,

            predictionPoints: Number(prediction?.points ?? 0),
            lockTime:
              lockTimeData !== null
                ? String(lockTimeData)
                : null,
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

    setSavedAll(false);
  }

  async function saveAllPredictions() {
  if (!player) return;

  const gamesToSave = games.filter((game) => {
    const isFinished = game.status === "finished";

    const isLocked =
      game.lockTime !== null &&
      game.lockTime !== undefined &&
      new Date() >= new Date(game.lockTime);

    return (
      !isFinished &&
      !isLocked &&
      game.selectedTeamId
    );
  });

  if (gamesToSave.length === 0) return;

  setSavingAll(true);
  setSavedAll(false);
  setError("");

  for (const game of gamesToSave) {
    const { data: lockTime, error: lockError } =
      await supabase.rpc(
        "get_prediction_lock_time",
        {
          p_game_id: game.id,
        }
      );

    if (lockError) {
      setError(lockError.message);
      setSavingAll(false);
      return;
    }

    if (new Date() >= new Date(lockTime)) {
      continue;
    }

    const { error: predictionError } =
      await supabase
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
      setSavingAll(false);
      return;
    }
  }

  setSavingAll(false);
  setSavedAll(true);
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
    <main className="min-h-screen bg-[#0B1F1D] text-white">
      <div className="mx-auto min-h-screen max-w-md bg-[#0B1F1D]">
        <header className="px-5 pb-4 pt-8">
          <p className="text-sm text-[#A9C2BD]">
            {player?.username || "..."}
          </p>

          <h1 className="mt-1 text-3xl font-black text-[#F8F6EF]">
            Matchs 🏀
          </h1>
        </header>

        <section className="px-5 pb-28">
          <div className="mb-5 flex items-center justify-between rounded-2xl bg-[#265550] p-2 text-[#F8F6EF]">
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

              <p className="text-xs text- [#A9C2BD0">
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

  const isFinished = game.status === "finished";

  const isLocked =
    game.lockTime !== null &&
    game.lockTime !== undefined &&
    new Date() >= new Date(game.lockTime);

  const winnerTeamId =
    isFinished &&
    game.home_score !== null &&
    game.away_score !== null
      ? game.home_score > game.away_score
        ? game.home_team_id
        : game.away_team_id
      : null;

  const predictionCorrect =
    game.selectedTeamId !== null &&
    game.selectedTeamId !== undefined &&
    game.selectedTeamId === winnerTeamId;

  return (
    <div
      key={game.id}
      className="rounded-2xl bg-[#265550] px-3 py-3 text-[#8F6EF]"
    >
      {/* HEURE / STATUT */}
      <p className="mb-2 text-center text-xs font-semibold text-[#B9CBC7]">

        {isFinished
          ? "Terminé"
          : formatTime(game.game_date)}
      </p>

      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
        {/* EXTÉRIEUR */}
        <button
          type="button"
          onClick={() => {
            if (!isLocked && !isFinished) {
              selectTeam(
                game.id,
                game.away_team_id
              );
            }
          }}
          disabled={isLocked || isFinished}
          className={`relative rounded-xl px-3 py-2.5 transition ${
            awaySelected && !isFinished
              ? "bg-[#3F7D76] text-[#F8F6EF]"
              : "bg-[#0B1F1D] text-[#F3F0E8]"
          }`}
        >
          {awaySelected && !isFinished && (
            <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#0B1F1D] text-[10px] font-black text-[#F8F6EF]">
              ✓
            </div>
          )}

          <div className="flex items-center justify-center gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center">
              {game.awayTeam?.logo_url ? (
                <img
                  src={game.awayTeam.logo_url}
                  alt={game.awayTeam.name}
                  className="h-9 w-9 object-contain"
                />
              ) : (
                <span className="text-xs font-black">
                  {game.awayTeam?.abbreviation}
                </span>
              )}
            </div>

            <span className="text-base font-black">
              {game.awayTeam?.abbreviation}
            </span>
          </div>

          <div className="mt-2 space-y-0.5 text-xs">
            <p className="text-[#A9C2BD]">
              Bilan{" "}
              <span className="font-bold text-[#E2ECE9]">
                {game.awayTeam?.wins ?? 0}-
                {game.awayTeam?.losses ?? 0}
              </span>
            </p>

            <p className="text-[#A9C2BD]">
              Cote{" "}
              <span className="text-base font-black text-[#F8F6EF]">
                {game.awayOdds}
              </span>
            </p>
          </div>
        </button>

        {/* @ */}
        <div className="flex items-center px-1 text-sm font-bold text-[#A9C2BD]">
          @
        </div>

        {/* DOMICILE */}
        <button
          type="button"
          onClick={() => {
            if (!isLocked && !isFinished) {
              selectTeam(
                game.id,
                game.home_team_id
              );
            }
          }}
          disabled={isLocked || isFinished}
          className={`relative rounded-xl px-3 py-2.5 transition ${
            homeSelected && !isFinished
              ? "bg-[#3F7D76] text-[#F8F6EF]"
              : "bg-[#0B1F1D] text-[#F3F0E8]"
          }`}
        >
          {homeSelected && !isFinished && (
            <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#0B1F1D] text-[10px] font-black text-[#F8F6EF]">
              ✓
            </div>
          )}

          <div className="flex items-center justify-center gap-2">
            <span className="text-base font-black">
              {game.homeTeam?.abbreviation}
            </span>

            <div className="flex h-10 w-10 shrink-0 items-center justify-center">
              {game.homeTeam?.logo_url ? (
                <img
                  src={game.homeTeam.logo_url}
                  alt={game.homeTeam.name}
                  className="h-9 w-9 object-contain"
                />
              ) : (
                <span className="text-xs font-black">
                  {game.homeTeam?.abbreviation}
                </span>
              )}
            </div>
          </div>

          <div className="mt-2 space-y-0.5 text-xs">
            <p className="text-[#A9C2BD]">
              Bilan{" "}
              <span className="font-bold text-[#E2ECE9]">
                {game.homeTeam?.wins ?? 0}-
                {game.homeTeam?.losses ?? 0}
              </span>
            </p>

            <p className="text-[#A9C2BD]">
              Cote{" "}
              <span className="text-base font-black text-[#F8F6EF]">
                {game.homeOdds}
              </span>
            </p>
          </div>
        </button>
      </div>

      {/* MATCH TERMINÉ */}
      {isFinished && game.selectedTeamId && (
        <div className="mt-2 border-t border-slate-100 pt-2 text-center text-xs font-semibold">
          <span
            className={
              predictionCorrect
                ? "text-green-600"
                : "text-red-500"
            }
          >
            {predictionCorrect ? "✓" : "✕"}
          </span>

          <span className="ml-2 text-[#A9C2BD]">
            {game.predictionPoints &&
            game.predictionPoints > 0
              ? `+${game.predictionPoints} pts`
              : "0 pt"}
          </span>
        </div>
      )}

      

      {/* VERROUILLÉ */}
      {isLocked && !isFinished && (
        <p className="mt-2 text-center text-xs font-medium text-slate-400">
          🔒 Pronostics verrouillés
        </p>
      )}

      
    </div>
  );
})}
          </div>
          {games.length > 0 && (
  <div className="sticky bottom-20 z-20 mt-4">
    <button
      type="button"
      onClick={saveAllPredictions}
      disabled={
        savingAll ||
        games.filter(
          (game) =>
            game.status !== "finished" &&
            game.selectedTeamId
        ).length === 0
      }
      className="w-full rounded-2xl bg-[#3F7D76] px-4 py-3.5 font-bold text-[#F8F6EF] shadow-lg disabled:opacity-40"
    >
      {savingAll
        ? "Enregistrement..."
        : `Enregistrer mes pronos · ${
            games.filter(
              (game) =>
                game.status !== "finished" &&
                game.selectedTeamId
            ).length
          }/${
            games.filter(
              (game) =>
                game.status !== "finished"
            ).length
          }`}
    </button>

    {savedAll && (
      <p className="mt-2 text-center text-xs font-semibold text-[#A9C2BD]">
        Pronostics enregistrés ✓
      </p>
    )}
  </div>
)}
        </section>

        <nav className="fixed bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 border-t border-slate-800 bg-[#0B1F1D]/95 px-4 py-3 backdrop-blur">
          <div className="grid grid-cols-3 text-center text-xs font-semibold">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="py-3 text-[#A9C2BD]"
            >
              Accueil
            </button>

            <button
              type="button"
              className="rounded-2xl bg-[#265550] px-3 py-3 text-[#F3F0E8]"

            >
              Matchs
            </button>

            <button
                type="button"
                onClick={() => router.push("/classement")}
                className="py-3 text-[#A9C2BD]"
            >
                Classement
                </button>
          </div>
        </nav>
      </div>
    </main>
  );
}