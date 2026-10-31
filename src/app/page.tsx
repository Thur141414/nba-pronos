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

  selectedTeamId: number | null;

  points: number;

  maxPoints: number | null;

  isCorrect: boolean | null;

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
  const [showChangelog, setShowChangelog] = useState(false);

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

      if (!gameData) {

        setGames([]);

      }

      const teamIds = [

        ...new Set(

          gameData.flatMap((game) => [

            game.home_team_id,

            game.away_team_id,

          ])

        ),

      ];

            const { data: teams, error: teamsError } =

        teamIds.length > 0

          ? await supabase

              .from("teams")

              .select("id, name, abbreviation")

              .in("id", teamIds)

          : { data: [] as Team[], error: null };

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

        gameIds.length > 0

          ? await supabase

              .from("predictions")

              .select("game_id, team_id, locked_odds")

              .eq("user_id", currentPlayer.user_id)

              .in("game_id", gameIds)

          : { data: [], error: null };

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

            if (isLocked && prediction.locked_odds !== null) {

              selectedOdds = Number(prediction.locked_odds);

            } else {

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

            "id, game_date, home_team_id, away_team_id, home_score, away_score, status, locked_home_odds, locked_away_odds"

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

            yesterdayGames.map(async (game) => {

              const prediction = yesterdayPlayerPredictions?.find(

                (item) => item.game_id === game.id

              );

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

              // Les cotes figées sont prioritaires pour le maximum historique.
              // Si elles manquent, on ne présente pas un maximum inexact.
              const maxPoints =
  winnerTeamId === game.home_team_id && game.locked_home_odds != null
    ? Number(game.locked_home_odds)
    : winnerTeamId === game.away_team_id && game.locked_away_odds != null
      ? Number(game.locked_away_odds)
      : null;

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

                selectedTeamId: prediction?.team_id ?? null,

                points: Number(prediction?.points ?? 0),

                maxPoints,

                isCorrect:

                  prediction === undefined || winnerTeamId === null

                    ? null

                    : prediction.team_id === winnerTeamId,

                publicPicks,

              };

            })

          );

        setYesterdayPredictions(yesterdayResults);

      } else {

        setYesterdayPredictions([]);

      }

      setLoading(false);

    }

    loadData();

  }, [router]);

  function getTeamLogo(abbreviation?: string) {
    if (!abbreviation) return "";
    return `/logos/${abbreviation.toUpperCase()}.png`;
  }

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

const yesterdayMaxPoints = yesterdayPredictions.every(
  (prediction) => prediction.maxPoints !== null
)
  ? yesterdayPredictions.reduce(
      (total, prediction) => total + (prediction.maxPoints ?? 0),
      0
    )
  : null;

  return (

    <main className="min-h-screen bg-[#0B1F1D] text-[#F8F6EF]">

      <div className="mx-auto min-h-screen max-w-md bg-[#0B1F1D]">

        <header className="px-5 pb-5 pt-8">

          <p className="text-sm text-[#A9C2BD]">

            Bienvenue {player?.username || "..."} 👋

          </p>

          <p className="mt-1 text-xs text-[#A9C2BD]">

            Saison {seasonName || "..."}

          </p>

                    <div className="mt-2 flex items-center gap-4">

            <button

              type="button"

              onClick={() => router.push("/regles")}

              className="text-xs font-semibold text-[#A9C2BD] underline"

            >

              ➡️ Règles ⬅️

            </button>

            <button

              type="button"

              onClick={() => {

                localStorage.removeItem("nba_pronos_player");

                sessionStorage.removeItem("nba_pronos_admin");

                sessionStorage.removeItem("nba_pronos_admin_pin");

                router.replace("/login");

              }}

              className="text-xs font-semibold text-[#A9C2BD] underline"

            >

              Se déconnecter 🔌

            </button>

          </div>

          <div className="mt-2 flex items-center justify-between">

            <h1 className="text-3xl font-black">

              PRONOS 2K26 🐐

            </h1>

            <div className="rounded-full bg-[#265550] px-4 py-2 text-sm font-bold">

              {totalPoints} pts

            </div>

          </div>

        </header>

        <section className="space-y-5 px-5 pb-28">
          {/* NOUVEAUTÉS — 24 OCTOBRE 2026 */}
          <div className="overflow-hidden rounded-3xl border border-[#3F7D76] bg-[#265550]">
            <button
              type="button"
              onClick={() => setShowChangelog((open) => !open)}
              aria-expanded={showChangelog}
              aria-controls="home-changelog"
              className="flex w-full items-center justify-between gap-3 p-4 text-left"
            >
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#A9C2BD]">24 octobre 2026</p>
                <p className="mt-1 text-base font-black text-[#F8F6EF]">🆕 Dernière MAJ </p>
                {!showChangelog && (
                  <p className="mt-1 text-xs text-[#E2ECE9]">Classements, stats et récap de la nuit</p>
                )}
              </div>
              <span aria-hidden="true" className="shrink-0 text-xl text-[#A9C2BD]">
                {showChangelog ? "⌃" : "⌄"}
              </span>
            </button>
            {showChangelog && (
              <div id="home-changelog" className="space-y-3 border-t border-[#3F7D76] px-4 pb-4 pt-3 text-sm text-[#E2ECE9]">
  <p><span className="font-bold text-[#F8F6EF]">Classements améliorés :</span> ajout des classements par équipe et par conférence Est / Ouest, avec les filtres Général, Semaine et Mois.</p>

  <p><span className="font-bold text-[#F8F6EF]">Correction des classements :</span> calcul et tri corrigés selon les points réellement gagnés. Le total Est + Ouest correspond au classement général.</p>

  <p><span className="font-bold text-[#F8F6EF]">Mes Stats :</span> ajout du rang et du pourcentage de réussite pour chacune des 30 équipes NBA, en comptant les pronostics pour et contre.</p>

  <p><span className="font-bold text-[#F8F6EF]">Accueil amélioré :</span> remplacement des abréviations à trois lettres par les logos des équipes pour afficher les pronostics du soir.</p>

  <p><span className="font-bold text-[#F8F6EF]">Correction des matchs de la veille :</span> l'équipe pronostiquée est désormais clairement mise en avant avec un contour vert en cas de victoire et rouge en cas de défaite.</p>

  <p><span className="font-bold text-[#F8F6EF]">Récap de la nuit :</span> ajout d'un tableau comparatif des pronostics de tous les joueurs, avec les équipes choisies, les cotes, les résultats et les points gagnés.</p>

  <p><span className="font-bold text-[#F8F6EF]">Partage du récap :</span> possibilité de générer une image du récapitulatif pour la partager sur Messenger.</p>
</div>
            )}
          </div>

          {loading && (

            <div className="rounded-3xl bg-[#265550] p-6 text-center">

              <p className="text-[#A9C2BD]">

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

                  <p className="text-sm font-semibold text-[#A9C2BD]">

                    MES PRONOS DU SOIR

                  </p>

                  <p className="mt-1 text-xl font-black">

                    {completedPredictions}/{games.length} faits

                  </p>

                </div>

                {games.length > 0 &&

                  completedPredictions === games.length && (

                    <span className="rounded-full bg-[#265550] px-3 py-2 text-xs font-bold text-[#F8F6EF]">

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

                      className="rounded-2xl bg-[#265550] p-4 text-[#F8F6EF]"

                    >

                      <div className="flex items-center justify-between gap-3">

                        <div className="min-w-0">

                          <p className="text-xs font-semibold text-[#A9C2BD]">

                            {formatTime(game.game_date)}

                          </p>

                          <div className="mt-2 flex items-center gap-3">
  {game.awayTeam && <img src={getTeamLogo(game.awayTeam.abbreviation)} alt={game.awayTeam.name} className="h-10 w-10 object-contain" />}
  <span className="font-bold text-[#A9C2BD]">@</span>
  {game.homeTeam && <img src={getTeamLogo(game.homeTeam.abbreviation)} alt={game.homeTeam.name} className="h-10 w-10 object-contain" />}
</div>

                        </div>

                        {selectedTeam ? (

                          <div className="text-right">

                            <p

                              className={`text-xs font-semibold ${

                                isLocked

                                  ? "text-[#A9C2BD]"

                                  : "text-[#F8F6EF]"

                              }`}

                            >

                              {isLocked

                                ? "🔒 PRONO VERROUILLÉ"

                                : "✓ PRONO FAIT"}

                            </p>

                            <div className="mt-1 flex items-center justify-end gap-2">
                              <img
                                src={getTeamLogo(selectedTeam.abbreviation)}
                                alt={selectedTeam.name}
                                className="h-9 w-9 object-contain"
                              />
                              {game.selectedOdds !== null && (
                                <span className="text-sm font-bold text-[#A9C2BD]">
                                  {game.selectedOdds} pts
                                </span>
                              )}
                            </div>

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

                        <div className="mt-3 border-t border-[#3F7D76] pt-3">

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

                            <span className="px-3 text-[10px] font-semibold text-[#A9C2BD]">

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

                                <p className="mt-1 leading-5 text-[#A9C2BD]">

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

                                <p className="mt-1 leading-5 text-[#A9C2BD]">

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

                <div className="mt-3 rounded-3xl bg-[#265550] p-6 text-center">

                  <p className="text-[#A9C2BD]">

                    Aucun match cette journée.

                  </p>

                </div>

              )}

              <button

                type="button"

                onClick={() => router.push("/matchs")}

                className="mt-4 w-full rounded-2xl bg-[#3F7D76] py-4 font-black text-[#F8F6EF]"

              >

                {completedPredictions === games.length &&

                games.length > 0

                  ? "Voir / modifier mes pronos"

                  : "Faire mes pronostics"}

              </button>

            </div>

          )}

          {yesterdayPredictions.length > 0 ? (

            <div className="rounded-3xl bg-[#265550] p-5">

              <div className="flex items-center justify-between">

                <div>

                  <p className="text-sm font-semibold text-[#A9C2BD]">

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

                  <p className="text-xs text-[#A9C2BD]">
                    {yesterdayMaxPoints !== null
                      ? `/ ${yesterdayMaxPoints} pts possibles`
                      : "points"}
                  </p>

                </div>

              </div>

              <div className="mt-4 space-y-2">

                {yesterdayPredictions.map((prediction) => {

                  const selectedTeam =

                    prediction.selectedTeamId === null

                      ? null

                      : prediction.selectedTeamId === prediction.awayTeam?.id

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

                      className="rounded-2xl bg-[#265550] p-3"

                    >

                      <div className="flex items-center justify-between">

                        <div>

                          <div className="flex items-center gap-2">
  {prediction.awayTeam && (
    <div
      className={`flex h-11 w-11 items-center justify-center rounded-full ${
        prediction.selectedTeamId === prediction.awayTeam.id
          ? prediction.isCorrect === true
            ? "bg-green-500/20 ring-2 ring-green-400 shadow-[0_0_12px_rgba(74,222,128,0.6)]"
            : prediction.isCorrect === false
              ? "bg-red-500/20 ring-2 ring-red-400 shadow-[0_0_12px_rgba(248,113,113,0.6)]"
              : ""
          : ""
      }`}
    >
      <img
        src={getTeamLogo(prediction.awayTeam.abbreviation)}
        alt={prediction.awayTeam.name}
        className="h-8 w-8 object-contain"
      />
    </div>
  )}

  <span className="text-xs text-[#A9C2BD]">@</span>

  {prediction.homeTeam && (
    <div
      className={`flex h-11 w-11 items-center justify-center rounded-full ${
        prediction.selectedTeamId === prediction.homeTeam.id
          ? prediction.isCorrect === true
            ? "bg-green-500/20 ring-2 ring-green-400 shadow-[0_0_12px_rgba(74,222,128,0.6)]"
            : prediction.isCorrect === false
              ? "bg-red-500/20 ring-2 ring-red-400 shadow-[0_0_12px_rgba(248,113,113,0.6)]"
              : ""
          : ""
      }`}
    >
      <img
        src={getTeamLogo(prediction.homeTeam.abbreviation)}
        alt={prediction.homeTeam.name}
        className="h-8 w-8 object-contain"
      />
    </div>
  )}
</div>

                          <p className="mt-1 font-bold">

                            {prediction.selectedTeamId === null ? (

                              <span className="text-[#A9C2BD]">

                                Pas de prono

                              </span>

                            ) : (

                              <>

                                {prediction.isCorrect === null

                                  ? "⏳"

                                  : prediction.isCorrect

                                    ? "✓"

                                    : "✗"}{" "}

                                {selectedTeam?.abbreviation}

                              </>

                            )}

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

                        className="mt-3 grid w-full grid-cols-[1fr_auto_1fr] items-center border-t border-[#3F7D76] pt-2 text-xs font-bold"

                      >

                        <span className="text-left">

                          👥 {awayPicks.length}

                        </span>

                        <span className="px-3 text-[10px] font-semibold text-[#A9C2BD]">

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

                            <p className="mt-1 leading-5 text-[#A9C2BD]">

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

                            <p className="mt-1 leading-5 text-[#A9C2BD]">

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

              <div className="rounded-3xl bg-[#265550] p-5">

                <p className="text-sm font-semibold text-[#A9C2BD]">

                  HIER SOIR

                </p>

                <p className="mt-2 font-bold text-[#E2ECE9]">

                  {yesterdayGamesCount === 0

                    ? "Pas de matchs hier soir "

                    : "T'as pas fait tes pronos"}

                </p>

              </div>

                       )}

            {/* ACCÈS AU RÉCAP NBA */}
            
              

              

             

              <button
                type="button"
                onClick={() => router.push("/recap")}
                className="mt-4 w-full rounded-2xl bg-[#3F7D76] py-4 font-black text-[#F8F6EF]"
              >
                Récap de la nuit 👀
              </button>
            

            <div className="grid grid-cols-3 gap-3">

            <div className="rounded-3xl bg-[#265550] p-4 text-center">

              <p className="text-2xl font-black">

                {totalPoints}

              </p>

              <p className="mt-1 text-xs text-[#A9C2BD]">

                Points

              </p>

            </div>

            <div className="rounded-3xl bg-[#265550] p-4 text-center">

              <p className="text-2xl font-black">

                {rankingPosition ?? "—"}

              </p>

              <p className="mt-1 text-xs text-[#A9C2BD]">

                sur {playersCount}

              </p>

            </div>

            <div className="rounded-3xl bg-[#265550] p-4 text-center">

              <p className="text-2xl font-black">

                {successPercentage.toFixed(1)}%

              </p>

              <p className="mt-1 text-xs text-[#A9C2BD]">

                Réussite

              </p>

            </div>

          </div>

        </section>

        <nav className="fixed bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 border-t border-[#265550] bg-[#0B1F1D]/95 px-4 py-3 backdrop-blur">

          <div className="grid grid-cols-4 text-center text-xs font-semibold">

            <button

              type="button"

              className="rounded-2xl bg-[#265550] py-3 text-[#F8F6EF]"

            >

              Accueil

            </button>

            <button

              type="button"

              onClick={() => router.push("/matchs")}

              className="py-3 text-[#A9C2BD]"

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