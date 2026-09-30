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

type PublicPick = {
  team_id: number;
  username: string;
};

type Game = {
  id: number;
  game_date: string;
  home_team_id: number;
  away_team_id: number;
  homeTeam?: Team;
  awayTeam?: Team;
  selectedTeamId: number | null;
  selectedOdds: number | null;
  lockTime: string | null;
  publicPicks: PublicPick[];
};


type YesterdayPrediction = {
  gameId: number;
  gameDate: string;
  awayTeam?: Team;
  homeTeam?: Team;
  awayScore: number | null;
  homeScore: number | null;
  selectedTeamId: number;
  points: number;
  isCorrect: boolean;
  publicPicks: PublicPick[]
};

export default function Home() {
  const router = useRouter();

  const [player, setPlayer] = useState<Player | null>(null);
  const [seasonName, setSeasonName] = useState("");
  const [games, setGames] = useState<Game[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rankingPosition, setRankingPosition] = useState<number | null>(null);
  const [playersCount, setPlayersCount] = useState(0);
  const [successPercentage, setSuccessPercentage] = useState(0);
  const [yesterdayPredictions, setYesterdayPredictions] = useState<
  YesterdayPrediction[]
    >([]); 
    const [yesterdayGamesCount, setYesterdayGamesCount] = useState(0);

    const [expandedPicks, setExpandedPicks] = useState<number | null>(null);



  useEffect(() => {
    const savedPlayer = localStorage.getItem("nba_pronos_player");

    if (!savedPlayer) {
      router.replace("/login");
      return;
    }

    let currentPlayer: Player;

    try {
      currentPlayer = JSON.parse(savedPlayer);
      setPlayer(currentPlayer);
    } catch {
      localStorage.removeItem("nba_pronos_player");
      router.replace("/login");
      return;
    }

    async function loadData() {
      setLoading(true);
      setError("");

      const { data: season, error: seasonError } = await supabase
        .from("seasons")
        .select("id, name")
        .eq("is_active", true)
        .single();

      if (seasonError || !season) {
        setError(
          seasonError?.message ||
            "Impossible de trouver la saison active."
        );
        setLoading(false);
        return;
      }

      setSeasonName(season.name);

      const { data: pointsData } = await supabase.rpc(
        "get_player_total_points",
        {
          p_user_id: currentPlayer.user_id,
        }
      );

      if (pointsData !== null) {
        setTotalPoints(Number(pointsData));
      }

      const { data: rankingData, error: rankingError } =
        await supabase.rpc("get_players_ranking");

      if (!rankingError && rankingData) {
        setPlayersCount(rankingData.length);

        const playerRanking = rankingData.find(
          (rankingPlayer: {
            user_id: string;
            total_points: number;
            ranking_position: number;
            success_percentage: number;
          }) =>
            rankingPlayer.user_id === currentPlayer.user_id
        );

        if (playerRanking) {
          setTotalPoints(Number(playerRanking.total_points));
          setRankingPosition(
            Number(playerRanking.ranking_position)
          );
          setSuccessPercentage(
            Number(playerRanking.success_percentage)
          );
        }
      }

            /*
            * Pour le moment, l'application démarre sur
            * la première journée NBA de la saison.
            *
            * Journée NBA :
            * 20 octobre 06:00 -> 21 octobre 05:59.
            */
            // Première journée de la saison
      const now = new Date();

      const franceNow = new Date(
        now.toLocaleString("en-US", {
          timeZone: "Europe/Paris",
        })
      );

      const seasonStart = new Date("2026-10-20T06:00:00");

      let nbaDay: Date;

      // Avant le début de la saison,
      // on affiche automatiquement la première journée.
      if (franceNow < seasonStart) {
        nbaDay = new Date("2026-10-20T12:00:00");
      } else {
        // Entre minuit et 05:59,
        // on appartient encore à la journée NBA précédente.
        if (franceNow.getHours() < 6) {
          franceNow.setDate(franceNow.getDate() - 1);
        }

        nbaDay = franceNow;
      }

      const year = nbaDay.getFullYear();
      const month = String(
        nbaDay.getMonth() + 1
      ).padStart(2, "0");
      const day = String(
        nbaDay.getDate()
      ).padStart(2, "0");

      const date = `${year}-${month}-${day}`;

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
        .select("id, game_date, home_team_id, away_team_id")
        .eq("season_id", season.id)
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
        .select("id, name, abbreviation")
        .in("id", teamIds);

      if (teamsError || !teams) {
        setError(
          teamsError?.message ||
            "Impossible de récupérer les équipes."
        );
        setLoading(false);
        return;
      }

      const gameIds = gameData.map((game) => game.id);

      const { data: predictions, error: predictionsError } =
        await supabase
          .from("predictions")
          .select("game_id, team_id")
          .eq("user_id", currentPlayer.user_id)
          .in("game_id", gameIds);

      if (predictionsError) {
        setError(predictionsError.message);
        setLoading(false);
        return;
      }

      const completedGames: Game[] = await Promise.all(
        gameData.map(async (game) => {
          const prediction = predictions?.find(
            (item) => item.game_id === game.id
          );

          let selectedOdds: number | null = null;

          const { data: lockTimeData } = await supabase.rpc(
            "get_prediction_lock_time",
            {
              p_game_id: game.id,
            }
          );

          const lockTime =
            lockTimeData !== null ? String(lockTimeData) : null;

          let publicPicks: PublicPick[] = [];

          const isLocked =
            lockTime !== null &&
            new Date() >= new Date(lockTime);

          if (isLocked) {
            const { data: publicPicksData } = await supabase.rpc(
              "get_game_public_picks",
              {
                p_game_id: game.id,
              }
            );

            if (publicPicksData) {
              publicPicks = publicPicksData;
            }
          }

          if (prediction) {
            const { data: oddsData } = await supabase.rpc(
              "get_prediction_current_odds",
              {
                p_game_id: game.id,
                p_team_id: prediction.team_id,
              }
            );

            if (oddsData !== null) {
              selectedOdds = Number(oddsData);
            }
          }

          return {
            ...game,

            homeTeam: teams.find(
              (team) => team.id === game.home_team_id
            ),

            awayTeam: teams.find(
              (team) => team.id === game.away_team_id
            ),

            selectedTeamId: prediction?.team_id ?? null,
            selectedOdds,
            lockTime,
            publicPicks,
          };
        })
      );

      setGames(completedGames);
      const yesterdayDay = new Date(`${date}T12:00:00`);
      yesterdayDay.setDate(yesterdayDay.getDate() - 1);

      const yesterdayYear = yesterdayDay.getFullYear();
      const yesterdayMonth = String(
        yesterdayDay.getMonth() + 1
      ).padStart(2, "0");
      const yesterdayDate = String(
        yesterdayDay.getDate()
      ).padStart(2, "0");

      const yesterday = `${yesterdayYear}-${yesterdayMonth}-${yesterdayDate}`;

      const { data: yesterdayBounds, error: yesterdayBoundsError } =
        await supabase.rpc("get_nba_day_bounds", {
          p_date: yesterday,
        });

      if (yesterdayBoundsError || !yesterdayBounds?.[0]) {
        setError(
          yesterdayBoundsError?.message ||
            "Impossible de calculer la journée NBA précédente."
        );
        setLoading(false);
        return;
      }

      const { data: yesterdayGames, error: yesterdayGamesError } =
        await supabase
          .from("games")
          .select(
            "id, game_date, home_team_id, away_team_id, home_score, away_score, status"
          )
          .eq("season_id", season.id)
          .gte(
            "game_date",
            yesterdayBounds[0].start_time
          )
          .lt(
            "game_date",
            yesterdayBounds[0].end_time
          )
          .order("game_date", { ascending: true });

      if (yesterdayGamesError) {
        setError(yesterdayGamesError.message);
        setLoading(false);
        return;
      }

      setYesterdayGamesCount(
        yesterdayGames?.length ?? 0
      );

      if (yesterdayGames && yesterdayGames.length > 0) {

        const yesterdayGameIds = yesterdayGames.map(
          (game) => game.id
        );

        const yesterdayTeamIds = [
          ...new Set(
            yesterdayGames.flatMap((game) => [
              game.home_team_id,
              game.away_team_id,
            ])
          ),
        ];

        const { data: yesterdayTeams } = await supabase
          .from("teams")
          .select("id, name, abbreviation")
          .in("id", yesterdayTeamIds);

        const { data: yesterdayPlayerPredictions } =
          await supabase
            .from("predictions")
            .select("game_id, team_id, points")
            .eq("user_id", currentPlayer.user_id)
            .in("game_id", yesterdayGameIds);

        const yesterdayResults: YesterdayPrediction[] =
          await Promise.all(
            yesterdayPlayerPredictions?.map(async (prediction) => {
            const game = yesterdayGames.find(
              (item) => item.id === prediction.game_id
            )!;

            const winnerTeamId =
              game.status === "finished"
                ? game.home_score > game.away_score
                  ? game.home_team_id
                  : game.away_team_id
                : null;

            const { data: publicPicksData } = await supabase.rpc(
              "get_game_public_picks",
              {
                p_game_id: game.id,
              }
            );

            const publicPicks: PublicPick[] =
              publicPicksData ?? [];

            return {
              gameId: game.id,
              gameDate: game.game_date,

              awayTeam: yesterdayTeams?.find(
                (team) => team.id === game.away_team_id
              ),

              homeTeam: yesterdayTeams?.find(
                (team) => team.id === game.home_team_id
              ),

              awayScore: game.away_score,
              homeScore: game.home_score,
              selectedTeamId: prediction.team_id,
              points: Number(prediction.points ?? 0),

              isCorrect:
                winnerTeamId !== null &&
                prediction.team_id === winnerTeamId,

              publicPicks,
            };
          }) ?? []
        );

        setYesterdayPredictions(yesterdayResults);
      } else {
        setYesterdayPredictions([]);
      }

      setLoading(false);
      
    }

    loadData();
  }, [router]);

  function formatTime(gameDate: string) {
    return new Intl.DateTimeFormat("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Paris",
    }).format(new Date(gameDate));
  }

  function getSelectedTeam(game: Game) {
    if (game.selectedTeamId === game.away_team_id) {
      return game.awayTeam;
    }

    if (game.selectedTeamId === game.home_team_id) {
      return game.homeTeam;
    }

    return null;
  }

  const completedPredictions = games.filter(
    (game) => game.selectedTeamId !== null
  ).length;

  const yesterdayCorrect = yesterdayPredictions.filter(
  (prediction) => prediction.isCorrect
).length;

const yesterdayPoints = yesterdayPredictions.reduce(
  (total, prediction) => total + prediction.points,
  0
);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto min-h-screen max-w-md bg-slate-900">
        <header className="px-5 pb-5 pt-8">
          <p className="text-sm text-slate-400">
            Bienvenue {player?.username || "..."} 👋
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Saison {seasonName || "..."}
          </p>

          <button
            type="button"
            onClick={() => {
              localStorage.removeItem("nba_pronos_player");
              router.replace("/login");
            }}
            className="mt-2 text-xs font-semibold text-slate-400 underline"
            >
            Se déconnecter
          </button>

          <div className="mt-2 flex items-center justify-between">
            <h1 className="text-3xl font-black">
              NBA PRONOS 🏀
            </h1>

            <div className="rounded-full bg-slate-800 px-4 py-2 text-sm font-bold">
              {totalPoints} pts
            </div>
          </div>
        </header>

        <section className="space-y-5 px-5 pb-28">
          {loading && (
            <div className="rounded-3xl bg-slate-800 p-6 text-center">
              <p className="text-slate-400">
                Chargement de tes pronostics...
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

          {!loading && !error && (
            <div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-400">
                    MES PRONOS DU SOIR
                  </p>

                  <p className="mt-1 text-xl font-black">
                    {completedPredictions}/{games.length} faits
                  </p>
                </div>

                {games.length > 0 &&
                  completedPredictions === games.length && (
                    <span className="rounded-full bg-green-950 px-3 py-2 text-xs font-bold text-green-300">
                      ✓ Complet
                    </span>
                  )}
              </div>

              <div className="mt-3 space-y-3">
                {games.map((game) => {
                  const selectedTeam = getSelectedTeam(game);

                  const isLocked =
                    game.lockTime !== null &&
                    new Date() >= new Date(game.lockTime);

                  const awayPicks = game.publicPicks.filter(
                    (pick) => pick.team_id === game.away_team_id
                  );

                  const homePicks = game.publicPicks.filter(
                    (pick) => pick.team_id === game.home_team_id
                  );

                  const picksExpanded = expandedPicks === game.id;

                  return (
                    <div
                      key={game.id}
                      className="rounded-2xl bg-white p-4 text-slate-900"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-400">
                            {formatTime(game.game_date)}
                          </p>

                          <p className="mt-1 font-black">
                            {game.awayTeam?.abbreviation}
                            <span className="mx-2 text-slate-400">
                              @
                            </span>
                            {game.homeTeam?.abbreviation}
                          </p>
                        </div>

                        {selectedTeam ? (
                          <div className="text-right">
                            <p
                              className={`text-xs font-semibold ${
                                isLocked
                                  ? "text-slate-500"
                                  : "text-green-700"
                              }`}
                            >
                              {isLocked
                                ? "🔒 PRONO VERROUILLÉ"
                                : "✓ PRONO FAIT"}
                            </p>

                            <p className="mt-1 font-black">
                              {selectedTeam.abbreviation}

                              {game.selectedOdds !== null && (
                                <span className="ml-2 text-sm text-slate-500">
                                  {game.selectedOdds} pts
                                </span>
                              )}
                            </p>
                          </div>
                        ) : (
                          <div className="text-right">
                            <p className="text-xs font-black text-orange-600">
                              À PRONOSTIQUER
                            </p>
                          </div>
                        )}
                      </div>

                      {isLocked && (
                        <div className="mt-3 border-t border-slate-200 pt-3">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedPicks(
                                picksExpanded ? null : game.id
                              )
                            }
                            className="grid w-full grid-cols-[1fr_auto_1fr] items-center text-xs font-bold"
                          >
                            <span className="text-left">
                              👥 {awayPicks.length}
                            </span>

                            <span className="px-3 text-[10px] font-semibold text-slate-400">
                              PICKS
                            </span>

                            <span className="text-right">
                              👥 {homePicks.length}
                            </span>
                          </button>

                          {picksExpanded && (
                            <div className="mt-2 grid grid-cols-2 gap-4 text-xs">
                              <div>
                                <p className="font-black">
                                  {game.awayTeam?.abbreviation}
                                </p>

                                <p className="mt-1 leading-5 text-slate-500">
                                  {awayPicks.length > 0
                                    ? awayPicks
                                        .map((pick) => pick.username)
                                        .join(" · ")
                                    : "Personne"}
                                </p>
                              </div>

                              <div className="text-right">
                                <p className="font-black">
                                  {game.homeTeam?.abbreviation}
                                </p>

                                <p className="mt-1 leading-5 text-slate-500">
                                  {homePicks.length > 0
                                    ? homePicks
                                        .map((pick) => pick.username)
                                        .join(" · ")
                                    : "Personne"}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {games.length === 0 && (
                <div className="mt-3 rounded-3xl bg-slate-800 p-6 text-center">
                  <p className="text-slate-400">
                    Aucun match cette journée.
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={() => router.push("/matchs")}
                className="mt-4 w-full rounded-2xl bg-white py-4 font-black text-slate-950"
              >
                {completedPredictions === games.length &&
                games.length > 0
                  ? "Voir / modifier mes pronos"
                  : "Faire mes pronostics"}
              </button>
            </div>
          )}

          {yesterdayPredictions.length > 0 ? (
            <div className="rounded-3xl bg-slate-800 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-400">
                    HIER SOIR
                  </p>

                  <p className="mt-1 text-lg font-black">
                    {yesterdayCorrect}/{yesterdayPredictions.length} bons pronos
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-2xl font-black">
                    +{yesterdayPoints}
                  </p>
                  <p className="text-xs text-slate-400">
                    points
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {yesterdayPredictions.map((prediction) => {
                  const selectedTeam =
                    prediction.selectedTeamId ===
                    prediction.awayTeam?.id
                      ? prediction.awayTeam
                      : prediction.homeTeam;

                  const awayPicks =
                    prediction.publicPicks.filter(
                      (pick) =>
                        pick.team_id === prediction.awayTeam?.id
                    );

                  const homePicks =
                    prediction.publicPicks.filter(
                      (pick) =>
                        pick.team_id === prediction.homeTeam?.id
                    );

                  const picksExpanded =
                    expandedPicks === prediction.gameId;

                  return (
                    <div
                      key={prediction.gameId}
                      className="rounded-2xl bg-slate-700 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-slate-400">
                            {prediction.awayTeam?.abbreviation}
                            <span className="mx-2">@</span>
                            {prediction.homeTeam?.abbreviation}
                          </p>

                          <p className="mt-1 font-bold">
                            {prediction.isCorrect ? "✓" : "✗"}{" "}
                            {selectedTeam?.abbreviation}
                          </p>
                        </div>

                        <p className="font-black">
                          {prediction.points > 0
                            ? `+${prediction.points} pts`
                            : "0 pt"}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedPicks(
                            picksExpanded
                              ? null
                              : prediction.gameId
                          )
                        }
                        className="mt-3 grid w-full grid-cols-[1fr_auto_1fr] items-center border-t border-slate-600 pt-2 text-xs font-bold"
                      >
                        <span className="text-left">
                          👥 {awayPicks.length}
                        </span>

                        <span className="px-3 text-[10px] font-semibold text-slate-400">
                          PICKS
                        </span>

                        <span className="text-right">
                          👥 {homePicks.length}
                        </span>
                      </button>

                      {picksExpanded && (
                        <div className="mt-2 grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <p className="font-black">
                              {prediction.awayTeam?.abbreviation}
                            </p>

                            <p className="mt-1 leading-5 text-slate-400">
                              {awayPicks.length > 0
                                ? awayPicks
                                    .map((pick) => pick.username)
                                    .join(" · ")
                                : "Personne"}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="font-black">
                              {prediction.homeTeam?.abbreviation}
                            </p>

                            <p className="mt-1 leading-5 text-slate-400">
                              {homePicks.length > 0
                                ? homePicks
                                    .map((pick) => pick.username)
                                    .join(" · ")
                                : "Personne"}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
              <div className="rounded-3xl bg-slate-800 p-5">
                <p className="text-sm font-semibold text-slate-400">
                  HIER SOIR
                </p>

                <p className="mt-2 font-bold text-slate-300">
                  {yesterdayGamesCount === 0
                    ? "Pas de matchs hier soir "
                    : "T'as pas fait tes pronos"}
                </p>
              </div>
            )}

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-3xl bg-slate-800 p-4 text-center">
              <p className="text-2xl font-black">
                {totalPoints}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Points
              </p>
            </div>

            <div className="rounded-3xl bg-slate-800 p-4 text-center">
              <p className="text-2xl font-black">
                {rankingPosition ?? "—"}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                sur {playersCount}
              </p>
            </div>

            <div className="rounded-3xl bg-slate-800 p-4 text-center">
              <p className="text-2xl font-black">
                {successPercentage.toFixed(1)}%
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Réussite
              </p>
            </div>
          </div>
        </section>

        <nav className="fixed bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 border-t border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
          <div className="grid grid-cols-4 text-center text-xs font-semibold">
            <button
              type="button"
              className="rounded-2xl bg-white py-3 text-slate-950"
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
              onClick={() => router.push("/classement")}
              className="py-3 text-slate-400"
            >
              Classement
            </button>

            <button
              type="button"
              onClick={() => router.push("/stats")}
              className="py-3 text-slate-400"
            >
              Stats
            </button>
          </div>
        </nav>
      </div>
    </main>
  );
}