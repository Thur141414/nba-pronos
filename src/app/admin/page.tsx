"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type PlayerStatus = {
  user_id: string;
  username: string;
  predictions_done: number;
  games_total: number;
  all_done: boolean;
};

type PlayerPrediction = {
  game_id: number;
  team_id: number;
};

type Team = {
  name: string;
  abbreviation: string;
};

type Game = {
  id: number;
  home_team_id: number;
  away_team_id: number;
  game_date: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  home: Team;
  away: Team;
};

export default function AdminPage() {
  const router = useRouter();

  const [players, setPlayers] = useState<PlayerStatus[]>([]);
  const [games, setGames] = useState<Game[]>([]);
    const [playerPredictions, setPlayerPredictions] = useState<
    PlayerPrediction[]
  >([]);
    const [editedPicks, setEditedPicks] = useState<
    Record<number, number>
  >({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [adminError, setAdminError] = useState("");
    const [checkingPin, setCheckingPin] = useState(false);

  const [selectedPlayerId, setSelectedPlayerId] = useState("");

  const [correctionPin, setCorrectionPin] = useState("");
  const [savingCorrection, setSavingCorrection] = useState(false);

  // Pour le moment on affiche la première journée.
  // On automatisera ensuite cette date comme sur l'accueil.
  const firstGameDate = "2026-10-20";

function getInitialDate() {
  const now = new Date();

  const franceNow = new Date(
    now.toLocaleString("en-US", {
      timeZone: "Europe/Paris",
    })
  );

  const seasonStart = new Date("2026-10-20T06:00:00");

  if (franceNow < seasonStart) {
    return firstGameDate;
  }

  // Avant 6h du matin = encore la journée NBA précédente
  if (franceNow.getHours() < 6) {
    franceNow.setDate(franceNow.getDate() - 1);
  }

  const year = franceNow.getFullYear();
  const month = String(franceNow.getMonth() + 1).padStart(2, "0");
  const day = String(franceNow.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

const [date, setDate] = useState(getInitialDate);

    async function unlockAdmin(pinToCheck = adminPin) {
    setCheckingPin(true);
    setAdminError("");

        const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 10000);

    let data;
    let error;

    try {
      const result = await supabase.functions.invoke(
        "admin-logic",
        {
          body: {
            pin: pinToCheck,
          },
          signal: controller.signal,
        }
      );

      data = result.data;
      error = result.error;
    } catch {
      setAdminError(
        "Connexion à Supabase impossible. Réessaie."
      );
      setCheckingPin(false);
      return;
    } finally {
      clearTimeout(timeout);
    }

  if (error) {
  setAdminError(`Erreur technique : ${error.message}`);
  setCheckingPin(false);
  return;
}

if (!data?.success) {
  setAdminError(data?.error || "PIN admin incorrect.");
  setCheckingPin(false);
  return;
}

  sessionStorage.setItem(
    "nba_pronos_admin",
    "unlocked"
  );

  setAdminUnlocked(true);
  setAdminPin("");
  await loadAdmin();
  setCheckingPin(false);
}

function changeDate(days: number) {
  const newDate = new Date(`${date}T12:00:00`);

  newDate.setDate(newDate.getDate() + days);

  const year = newDate.getFullYear();
  const month = String(newDate.getMonth() + 1).padStart(2, "0");
  const day = String(newDate.getDate()).padStart(2, "0");

  setDate(`${year}-${month}-${day}`);
}

  async function loadAdmin() {
    setLoading(true);
    setMessage("");

    const { data: playerData, error: playerError } =
      await supabase.rpc("get_admin_players_status", {
        p_date: date,
      });

    if (playerError) {
      setMessage(playerError.message);
      setLoading(false);
      return;
    }

    setPlayers(playerData || []);

    const start = new Date(`${date}T06:00:00+02:00`);

    const nextDay = new Date(`${date}T12:00:00`);

nextDay.setDate(nextDay.getDate() + 1);

const nextYear = nextDay.getFullYear();
const nextMonth = String(
  nextDay.getMonth() + 1
).padStart(2, "0");
const nextDate = String(
  nextDay.getDate()
).padStart(2, "0");

const end = new Date(
  `${nextYear}-${nextMonth}-${nextDate}T05:59:59+02:00`
);

    const { data: gameData, error: gameError } =
      await supabase
        .from("games")
                .select(`
          id,
          home_team_id,
          away_team_id,
          game_date,
          status,
          home_score,
          away_score,
          home:teams!games_home_team_id_fkey(
            name,
            abbreviation
          ),
          away:teams!games_away_team_id_fkey(
            name,
            abbreviation
          )
        `)
        .gte("game_date", start.toISOString())
        .lte("game_date", end.toISOString())
        .order("game_date");

    if (gameError) {
      setMessage(gameError.message);
      setLoading(false);
      return;
    }

    setGames((gameData || []) as unknown as Game[]);
    setLoading(false);
  }

    useEffect(() => {
    const unlocked =
      sessionStorage.getItem("nba_pronos_admin") ===
      "unlocked";

    if (unlocked) {
      setAdminUnlocked(true);
      loadAdmin();
      return;
    }

    const loginAdminPin =
      sessionStorage.getItem("nba_pronos_admin_pin");

        if (loginAdminPin) {
      sessionStorage.removeItem("nba_pronos_admin_pin");
      unlockAdmin(loginAdminPin);
      return;
    }

    setLoading(false);
  }, [date]);

  useEffect(() => {
    async function loadPlayerPredictions() {
            setPlayerPredictions([]);
      setEditedPicks({});

      if (!selectedPlayerId) return;

      const { data, error } = await supabase
        .from("predictions")
        .select("game_id, team_id")
        .eq("user_id", selectedPlayerId);

      if (error) {
        setMessage(
          "Impossible de charger les pronos : " + error.message
        );
        return;
      }

            setPlayerPredictions(data || []);

      const existingPicks: Record<number, number> = {};

      for (const prediction of data || []) {
        existingPicks[prediction.game_id] = prediction.team_id;
      }

      setEditedPicks(existingPicks);
    }

    loadPlayerPredictions();
  }, [selectedPlayerId]);

  function getChangedPicks() {
    return games
      .filter((game) => {
        const newTeamId = editedPicks[game.id];

        if (!newTeamId) return false;

        const existingPrediction = playerPredictions.find(
          (prediction) => prediction.game_id === game.id
        );

        return existingPrediction?.team_id !== newTeamId;
      })
      .map((game) => ({
        gameId: game.id,
        teamId: editedPicks[game.id],
      }));
  }

      async function saveAdminPrediction() {
    if (!selectedPlayerId || !correctionPin) {
      setMessage("Sélectionne un joueur et saisis le PIN Admin.");
      return;
    }

    const changes = getChangedPicks();

    if (changes.length === 0) {
      setMessage("Aucun pronostic à modifier.");
      return;
    }

    setSavingCorrection(true);
    setMessage("");

    try {
      for (const change of changes) {
        const { data, error } = await supabase.functions.invoke(
          "admin-logic",
          {
            body: {
              pin: correctionPin,
              action: "set_prediction",
              userId: selectedPlayerId,
              gameId: change.gameId,
              teamId: change.teamId,
            },
          }
        );

        if (error || !data?.success) {
          throw new Error(
            data?.error ||
              error?.message ||
              `Erreur pour le match ${change.gameId}`
          );
        }
      }

      setPlayerPredictions((previous) => {
        const updated = [...previous];

        for (const change of changes) {
          const index = updated.findIndex(
            (prediction) => prediction.game_id === change.gameId
          );

          if (index >= 0) {
            updated[index] = {
              game_id: change.gameId,
              team_id: change.teamId,
            };
          } else {
            updated.push({
              game_id: change.gameId,
              team_id: change.teamId,
            });
          }
        }

        return updated;
      });

      setCorrectionPin("");
      setMessage(
        `✅ ${changes.length} pronostic(s) enregistré(s) avec succès !`
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `❌ ${error.message} — certains pronos ont peut-être été enregistrés.`
          : "❌ Erreur lors de l'enregistrement."
      );
    } finally {
      setSavingCorrection(false);
    }
  }

  async function deletePlayer(
    userId: string,
    username: string
  ) {
    const confirmed = window.confirm(
      `Supprimer définitivement ${username} et tous ses pronostics ?`
    );

    if (!confirmed) return;

    const { error } = await supabase.rpc(
      "admin_delete_player",
      {
        p_user_id: userId,
      }
    );

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(`${username} a été supprimé.`);
    await loadAdmin();
  }

  async function enterResult(game: Game) {
    const awayScore = window.prompt(
      `Score ${game.away.abbreviation}`,
      game.away_score?.toString() || ""
    );

    if (awayScore === null) return;

    const homeScore = window.prompt(
      `Score ${game.home.abbreviation}`,
      game.home_score?.toString() || ""
    );

    if (homeScore === null) return;

    const away = Number(awayScore);
    const home = Number(homeScore);

    if (
      !Number.isInteger(away) ||
      !Number.isInteger(home) ||
      away < 0 ||
      home < 0
    ) {
      setMessage("Scores invalides.");
      return;
    }

    const { error } = await supabase.rpc(
      "admin_set_game_result",
      {
        p_game_id: game.id,
        p_home_score: home,
        p_away_score: away,
      }
    );

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(
      `Résultat enregistré : ${game.away.abbreviation} ${away} - ${home} ${game.home.abbreviation}`
    );

    await loadAdmin();
  }

  if (!adminUnlocked) {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-slate-900 px-6">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="mb-8 text-left text-sm text-slate-400"
        >
          ← Accueil
        </button>

        <div className="rounded-3xl bg-white p-6 text-slate-950">
          <p className="text-sm font-bold text-slate-500">
            NBA PRONOS
          </p>

          <h1 className="mt-2 text-3xl font-black">
            Administration ⚙️
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Entre le PIN administrateur.
          </p>

          <input
            type="password"
            inputMode="numeric"
            value={adminPin}
            onChange={(e) =>
              setAdminPin(
                e.target.value.replace(/\D/g, "")
              )
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" && adminPin.length > 0) {
                unlockAdmin();
              }
            }}
            placeholder="••••••"
            className="mt-6 w-full rounded-2xl bg-slate-100 px-4 py-4 text-center text-2xl tracking-[0.4em] outline-none"
          />

          {adminError && (
            <p className="mt-3 text-sm font-bold text-red-600">
              {adminError}
            </p>
          )}

          <button
            type="button"
            onClick={() => unlockAdmin()}
            disabled={
              checkingPin || adminPin.length === 0
            }
            className="mt-5 w-full rounded-2xl bg-slate-950 py-4 font-bold text-white disabled:opacity-40"
          >
            {checkingPin
              ? "Vérification..."
              : "Accéder à l'administration"}
          </button>
        </div>
      </div>
    </main>
  );
}

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto min-h-screen max-w-md bg-slate-900 px-5 pb-10">
        <header className="pb-6 pt-8">
          <button
            onClick={() => router.push("/")}
            className="text-sm text-slate-400"
          >
            ← Accueil
          </button>

          <h1 className="mt-4 text-3xl font-black">
            Administration ⚙️
          </h1>

          <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-800 p-2">
  <button
    type="button"
    onClick={() => changeDate(-1)}
    className="rounded-xl px-4 py-2 text-xl font-black"
  >
    ←
  </button>

  <div className="text-center">
    <p className="text-xs text-slate-400">
      Journée NBA
    </p>

    <p className="font-black">
      {new Date(`${date}T12:00:00`).toLocaleDateString(
        "fr-FR",
        {
          day: "numeric",
          month: "long",
          year: "numeric",
        }
      )}
    </p>
  </div>

  <button
    type="button"
    onClick={() => changeDate(1)}
    className="rounded-xl px-4 py-2 text-xl font-black"
  >
    →
  </button>
</div>
        </header>

        {message && (
          <div className="mb-5 rounded-2xl bg-slate-800 p-4 text-sm">
            {message}
          </div>
        )}

        {loading ? (
          <p className="text-slate-400">Chargement...</p>
        ) : (
          <>
            <section>
              <h2 className="mb-3 text-lg font-black">
                Pronos des joueurs
              </h2>

              <div className="space-y-3">
                {players.map((player) => {
                  const done = Number(
                    player.predictions_done
                  );

                  const total = Number(
                    player.games_total
                  );

                  const indicator =
                    total > 0 && done === total
                      ? "🟢"
                      : done > 0
                        ? "🟠"
                        : "🔴";

                  return (
                    <div
                      key={player.user_id}
                      className="flex items-center rounded-2xl bg-slate-800 p-4"
                    >
                      <div className="text-xl">
                        {indicator}
                      </div>

                      <div className="ml-3 flex-1">
                        <p className="font-bold">
                          {player.username}
                        </p>

                        <p className="text-xs text-slate-400">
                          {done}/{total} pronostics
                        </p>
                      </div>

                      <button
                        onClick={() =>
                          deletePlayer(
                            player.user_id,
                            player.username
                          )
                        }
                        className="rounded-xl bg-red-950 px-3 py-2 text-xs font-bold text-red-300"
                      >
                        Supprimer
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

                          <section className="mt-8">
                <h2 className="mb-3 text-lg font-black">
                  ✏️ Modifier un prono
                </h2>

                <div className="space-y-4 rounded-2xl bg-slate-800 p-4">
                  <div>
                    <label className="mb-2 block text-sm text-slate-300">
                      Joueur
                    </label>
                    <select
                      value={selectedPlayerId}
                      onChange={(e) =>
                        setSelectedPlayerId(e.target.value)
                      }
                      className="w-full rounded-xl bg-slate-700 p-3 text-white"
                    >
                      <option value="">Choisir un joueur</option>
                      {players.map((player) => (
                        <option
                          key={player.user_id}
                          value={player.user_id}
                        >
                          {player.username}
                        </option>
                      ))}
                    </select>
                  </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-slate-300">
                        Pronostics du joueur
                      </p>

                      <span className="rounded-lg bg-slate-600 px-3 py-1 text-xs font-bold">
                        {
                          games.filter((game) =>
                            playerPredictions.some(
                              (prediction) =>
                                prediction.game_id === game.id
                            )
                          ).length
                        }
                        /{games.length} faits
                      </span>
                    </div>

                    {games.map((game) => (
                      <div
                        key={game.id}
                        className="rounded-xl bg-slate-700 p-3"
                      >
                        <p className="mb-3 text-center text-sm font-bold">
                          {game.away.abbreviation} @{" "}
                          {game.home.abbreviation}
                        </p>

                        <div className="grid grid-cols-2 gap-2">
                          {[
                            {
                              id: game.away_team_id,
                              name: game.away.abbreviation,
                            },
                            {
                              id: game.home_team_id,
                              name: game.home.abbreviation,
                            },
                          ].map((team) => (
                            <button
                              key={team.id}
                              type="button"
                              onClick={() =>
                                setEditedPicks((previous) => ({
                                  ...previous,
                                  [game.id]: team.id,
                                }))
                              }
                              className={`rounded-lg px-3 py-3 font-bold ${
                                editedPicks[game.id] === team.id
                                  ? "bg-green-500 text-slate-950"
                                  : "bg-slate-600 text-white"
                              }`}
                            >
                              {team.name}
                            </button>
                          ))}
                        </div>

                        <p className="mt-2 text-center text-xs text-slate-300">
                          {editedPicks[game.id]
                            ? "✓ Équipe sélectionnée"
                            : "Aucun prono"}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className="mb-2 block text-sm text-slate-300">
                      PIN administrateur
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      value={correctionPin}
                      onChange={(e) =>
                        setCorrectionPin(e.target.value)
                      }
                      placeholder="Confirmer le PIN"
                      className="w-full rounded-xl bg-slate-700 p-3 text-white"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={saveAdminPrediction}
                    disabled={
                      savingCorrection ||
                      !selectedPlayerId ||
                      !correctionPin ||
                      getChangedPicks().length === 0
                    }
                    className="w-full rounded-xl bg-white py-3 font-black text-slate-950 disabled:opacity-40"
                  >
                    {savingCorrection
                      ? "Enregistrement..."
                      : "Enregistrer les modifications"}
                  </button>
                </div>
              </section>

            <section className="mt-8">
              <h2 className="mb-3 text-lg font-black">
                Résultats manuels
              </h2>

              <div className="space-y-3">
                {games.map((game) => (
                  <div
                    key={game.id}
                    className="rounded-2xl bg-slate-800 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-black">
                          {game.away.abbreviation}
                          {" @ "}
                          {game.home.abbreviation}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {game.status === "finished"
                            ? `${game.away_score} - ${game.home_score}`
                            : "Pas encore terminé"}
                        </p>
                      </div>

                      <button
                        onClick={() => enterResult(game)}
                        className="rounded-xl bg-white px-4 py-2 text-xs font-black text-slate-950"
                      >
                        {game.status === "finished"
                          ? "Corriger"
                          : "Résultat"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}