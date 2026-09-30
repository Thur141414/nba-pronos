"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Player = {
  user_id: string;
  username: string;
};

type TeamStat = {
  team_id: number;
  name: string;
  team: string;
  conference: string | null;
  logo_url: string | null;

  predictions: number;
  correct: number;
  incorrect: number;
  success_percentage: number;
  points: number;
  average_points: number;

  picked_team_count: number;
  picked_team_correct: number;

  picked_against_count: number;
  picked_against_correct: number;

  team_wins_seen: number;
  team_wins_correct: number;

  team_losses_seen: number;
  team_losses_correct: number;
};

type PlayerStats = {
  total_predictions: number;
  correct_predictions: number;
  total_points: number;
  success_percentage: number;

  perfect_nights: number;
  biggest_perfect_night: number;

  biggest_win: {
    team: string;
    odds: number;
    points: number;
  } | null;

  most_picked_team: {
    team: string;
    predictions: number;
  } | null;

  teams: TeamStat[];
};

function percentage(correct: number, total: number) {
  if (total === 0) return 0;

  return Math.round((correct / total) * 100);
}

export default function StatsPage() {
  const router = useRouter();

  const [player, setPlayer] = useState<Player | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);

  const [conference, setConference] = useState<
    "East" | "West"
  >("East");

  const [selectedTeamId, setSelectedTeamId] =
    useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const savedPlayer = localStorage.getItem(
      "nba_pronos_player"
    );

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

    async function loadStats() {
      setLoading(true);
      setError("");

      const { data, error: statsError } =
        await supabase.rpc("get_player_stats", {
          p_user_id: currentPlayer.user_id,
        });

      if (statsError) {
        setError(statsError.message);
        setLoading(false);
        return;
      }

      setStats(data as PlayerStats);
      setLoading(false);
    }

    loadStats();
  }, [router]);

  const conferenceTeams = useMemo(() => {
    if (!stats) return [];

    return stats.teams.filter((team) => {
      const value = team.conference?.toLowerCase();

      if (conference === "East") {
        return value === "east" || value === "eastern";
      }

      return value === "west" || value === "western";
    });
  }, [stats, conference]);

  const selectedTeam =
    stats?.teams.find(
      (team) => team.team_id === selectedTeamId
    ) ?? null;

    const pointsPodium = useMemo(() => {
    if (!stats) return [];

    return [...stats.teams]
      .filter((team) => team.points > 0)
      .sort((a, b) => {
        if (b.points !== a.points) {
          return b.points - a.points;
        }

        return a.team.localeCompare(b.team);
      })
      .slice(0, 3);
  }, [stats]);

  function getPodiumPosition(teamId: number) {
    const index = pointsPodium.findIndex(
      (team) => team.team_id === teamId
    );

    return index === -1 ? null : index + 1;
  }

  useEffect(() => {
    if (
      conferenceTeams.length > 0 &&
      !conferenceTeams.some(
        (team) => team.team_id === selectedTeamId
      )
    ) {
      setSelectedTeamId(conferenceTeams[0].team_id);
    }
  }, [conferenceTeams, selectedTeamId]);

  return (
    <main className="min-h-screen bg-[#0B1F1D] text-[#F8F6EF]">
      <div className="mx-auto min-h-screen max-w-md">
        <header className="px-5 pb-5 pt-8">
          <p className="text-sm text-[#A9C2BD]">
            {player?.username || "..."}
          </p>

          <h1 className="mt-1 text-3xl font-black">
            MES STATS
          </h1>
        </header>

        <section className="space-y-4 px-5 pb-28">
          {loading && (
            <div className="rounded-3xl bg-[#143430] p-6 text-center text-[#A9C2BD]">
              Chargement de tes stats...
            </div>
          )}

          {error && (
            <div className="rounded-3xl bg-red-950 p-5 text-red-200">
              {error}
            </div>
          )}

          {!loading && !error && stats && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-[#143430] p-4 text-center">
                  <p className="text-2xl font-black">
                    {stats.total_points}
                  </p>
                  <p className="mt-1 text-xs text-[#A9C2BD]">
                    Points
                  </p>
                </div>

                <div className="rounded-2xl bg-[#143430] p-4 text-center">
                  <p className="text-2xl font-black">
                    {stats.success_percentage}%
                  </p>
                  <p className="mt-1 text-xs text-[#A9C2BD]">
                    Réussite
                  </p>
                </div>

                <div className="rounded-2xl bg-[#143430] p-4 text-center">
                  <p className="text-2xl font-black">
                    {stats.correct_predictions}/
                    {stats.total_predictions}
                  </p>
                  <p className="mt-1 text-xs text-[#A9C2BD]">
                    Bons
                  </p>
                </div>
              </div>

              <div className="rounded-3xl bg-[#265550] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-[#A9C2BD]">
                      PERFECT NIGHTS
                    </p>

                    <p className="mt-1 text-4xl font-black">
                      {stats.perfect_nights}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-[#A9C2BD]">
                      RECORD
                    </p>

                    <p className="mt-1 text-xl font-black">
                      {stats.biggest_perfect_night > 0
                        ? `${stats.biggest_perfect_night}/${stats.biggest_perfect_night} 🔥`
                        : "—"}
                    </p>

                    <p className="mt-1 text-xs text-[#E2ECE9]">
                      matchs dans une soirée
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-[#143430] p-4">
                  <p className="text-xs text-[#A9C2BD]">
                    PLUS GROS COUP
                  </p>

                  <p className="mt-2 text-xl font-black">
                    {stats.biggest_win?.team ?? "—"}
                  </p>

                  <p className="mt-1 text-sm text-[#A9C2BD]">
                    {stats.biggest_win
                      ? `${stats.biggest_win.odds} pts`
                      : "Aucun"}
                  </p>
                </div>

                <div className="rounded-2xl bg-[#143430] p-4">
                  <p className="text-xs text-[#A9C2BD]">
                    PLUS JOUÉE
                  </p>

                  <p className="mt-2 text-xl font-black">
                    {stats.most_picked_team?.team ?? "—"}
                  </p>

                  <p className="mt-1 text-sm text-[#A9C2BD]">
                    {stats.most_picked_team
                      ? `${stats.most_picked_team.predictions} pronos`
                      : "Aucun"}
                  </p>
                </div>
              </div>

              <div className="rounded-3xl bg-[#143430] p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black">
                    STATS PAR ÉQUIPE
                  </p>

                  <div className="flex rounded-xl bg-[#0B1F1D] p-1">
                    <button
                      type="button"
                      onClick={() => setConference("East")}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                        conference === "East"
                          ? "bg-[#F8F6EF] text-[#0B1F1D]"
                          : "text-[#A9C2BD]"
                      }`}
                    >
                      EST
                    </button>

                    <button
                      type="button"
                      onClick={() => setConference("West")}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                        conference === "West"
                          ? "bg-[#F8F6EF] text-[#0B1F1D]"
                          : "text-[#A9C2BD]"
                      }`}
                    >
                      OUEST
                    </button>
                  </div>
                </div>

                {conferenceTeams.length > 0 ? (
                  <div className="mt-5 grid grid-cols-5 gap-2">
                    {conferenceTeams.map((team) => {
                      const isSelected =
                        selectedTeamId === team.team_id;

                      const podiumPosition =
                        getPodiumPosition(team.team_id);

                      const podiumClass =
                        podiumPosition === 1
                          ? "bg-[#D4AF37]"
                          : podiumPosition === 2
                            ? "bg-[#A8B0B8]"
                            : podiumPosition === 3
                              ? "bg-[#A97142]"
                              : isSelected
                                ? "bg-[#3F7D76]"
                                : "bg-[#0B1F1D]";

                      return (
                        <button
                          key={team.team_id}
                          type="button"
                          onClick={() =>
                            setSelectedTeamId(team.team_id)
                          }
                          className={`relative flex aspect-square items-center justify-center rounded-2xl p-2 ${podiumClass} ${
                            isSelected
                              ? "ring-2 ring-[#F8F6EF]"
                              : ""
                          }`}
                        >
                          {team.logo_url ? (
                            <img
                              src={team.logo_url}
                              alt={team.name}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <span className="text-xs font-black">
                              {team.team}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-5 text-center text-sm text-[#A9C2BD]">
                    Pas encore de données pour cette conférence.
                  </p>
                )}

                {selectedTeam && (
                  <div className="mt-5 border-t border-[#265550] pt-5">
                    <div className="flex items-center gap-3">
                      {selectedTeam.logo_url && (
                        <img
                          src={selectedTeam.logo_url}
                          alt={selectedTeam.name}
                          className="h-12 w-12 object-contain"
                        />
                      )}

                      <div>
                        <p className="text-lg font-black">
                          {selectedTeam.name}
                        </p>

                        <p className="text-xs text-[#A9C2BD]">
                          {selectedTeam.predictions} matchs pronostiqués
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="rounded-xl bg-[#0B1F1D] p-3 text-center">
                        <p className="text-lg font-black">
                          {selectedTeam.correct}
                        </p>
                        <p className="text-[10px] text-[#A9C2BD]">
                          Bons
                        </p>
                      </div>

                      <div className="rounded-xl bg-[#0B1F1D] p-3 text-center">
                        <p className="text-lg font-black">
                          {selectedTeam.incorrect}
                        </p>
                        <p className="text-[10px] text-[#A9C2BD]">
                          Ratés
                        </p>
                      </div>

                      <div className="rounded-xl bg-[#0B1F1D] p-3 text-center">
                        <p className="text-lg font-black">
                          {selectedTeam.success_percentage}%
                        </p>
                        <p className="text-[10px] text-[#A9C2BD]">
                          Réussite
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between rounded-xl bg-[#0B1F1D] px-4 py-3">
                      <span className="text-sm text-[#A9C2BD]">
                        Moyenne
                      </span>

                      <span className="font-black">
                        {selectedTeam.average_points} pts / prono
                      </span>
                    </div>

                    <div className="mt-3 space-y-2">
                      <div className="flex justify-between rounded-xl bg-[#0B1F1D] px-4 py-3">
                        <span className="text-sm text-[#A9C2BD]">
                          Quand je joue {selectedTeam.team}
                        </span>

                        <span className="font-black">
                          {selectedTeam.picked_team_correct}/
                          {selectedTeam.picked_team_count}
                          {" · "}
                          {percentage(
                            selectedTeam.picked_team_correct,
                            selectedTeam.picked_team_count
                          )}
                          %
                        </span>
                      </div>

                      <div className="flex justify-between rounded-xl bg-[#0B1F1D] px-4 py-3">
                        <span className="text-sm text-[#A9C2BD]">
                          Contre {selectedTeam.team}
                        </span>

                        <span className="font-black">
                          {selectedTeam.picked_against_correct}/
                          {selectedTeam.picked_against_count}
                          {" · "}
                          {percentage(
                            selectedTeam.picked_against_correct,
                            selectedTeam.picked_against_count
                          )}
                          %
                        </span>
                      </div>

                      <div className="flex justify-between rounded-xl bg-[#0B1F1D] px-4 py-3">
                        <span className="text-sm text-[#A9C2BD]">
                          Quand {selectedTeam.team} gagne
                        </span>

                        <span className="font-black">
                          {selectedTeam.team_wins_correct}/
                          {selectedTeam.team_wins_seen}
                          {" · "}
                          {percentage(
                            selectedTeam.team_wins_correct,
                            selectedTeam.team_wins_seen
                          )}
                          %
                        </span>
                      </div>

                      <div className="flex justify-between rounded-xl bg-[#0B1F1D] px-4 py-3">
                        <span className="text-sm text-[#A9C2BD]">
                          Quand {selectedTeam.team} perd
                        </span>

                        <span className="font-black">
                          {selectedTeam.team_losses_correct}/
                          {selectedTeam.team_losses_seen}
                          {" · "}
                          {percentage(
                            selectedTeam.team_losses_correct,
                            selectedTeam.team_losses_seen
                          )}
                          %
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex justify-between px-1 text-sm">
                      <span className="text-[#A9C2BD]">
                        Points gagnés
                      </span>

                      <span className="font-black">
                        {selectedTeam.points} pts
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        <nav className="fixed bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 border-t border-[#265550] bg-[#0B1F1D]/95 px-4 py-3 backdrop-blur">
          <div className="grid grid-cols-4 text-center text-xs font-semibold">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="py-3 text-[#A9C2BD]"
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
              className="rounded-2xl bg-[#F8F6EF] py-3 text-[#0B1F1D]"
            >
              Stats
            </button>
          </div>
        </nav>
      </div>
    </main>
  );
}