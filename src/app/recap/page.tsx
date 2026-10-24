"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Pick = { username: string; team_id: number; points: number };
type RecapGame = {
  id: number;
  game_date: string;
  home_team_id: number;
  away_team_id: number;
  home_abbr: string;
  away_abbr: string;
  home_score: number;
  away_score: number;
  picks: Pick[];
  locked_home_odds?: number | null;
  locked_away_odds?: number | null;
};
type PlayerTotal = { name: string; points: number; correct: number; played: number };

function nbaDate(offset = 0) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const get = (key: string) => parts.find((p) => p.type === key)?.value ?? "";
  const date = new Date(`${get("year")}-${get("month")}-${get("day")}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function logo(abbr: string) { return `/logos/${abbr.toUpperCase()}.png`; }
function winner(game: RecapGame) {
  if (game.home_score === game.away_score) return null;
  return game.home_score > game.away_score ? game.home_team_id : game.away_team_id;
}
function pickTeam(game: RecapGame, pick: Pick) {
  return pick.team_id === game.away_team_id ? game.away_abbr : game.home_abbr;
}
function oddsLabel(value: number | null | undefined) {
  return value == null ? null : `${Number(value)} pts`;
}

export default function RecapPage() {
  const router = useRouter();
  const [date, setDate] = useState(() => nbaDate(-1));
  const [games, setGames] = useState<RecapGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("nba_pronos_player")) router.replace("/login");
  }, [router]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      const { data, error: rpcError } = await supabase.rpc("get_night_recap", { p_date: date });
      if (!active) return;
      if (rpcError) {
        setError(rpcError.message);
        setGames([]);
      } else {
        const recapGames = Array.isArray(data) ? (data as RecapGame[]) : [];
        if (recapGames.length === 0) {
          setGames([]);
        } else {
          // Les cotes sont verrouillées dans games ; get_night_recap ne les renvoie pas.
          const { data: oddsRows, error: oddsError } = await supabase
            .from("games")
            .select("id, locked_home_odds, locked_away_odds")
            .in("id", recapGames.map((game) => game.id));
          if (!active) return;
          if (oddsError) {
            // Le récap reste consultable même si les cotes sont indisponibles.
            console.warn("Cotes du récap indisponibles :", oddsError.message);
          }
          const oddsById = new Map(
            (oddsRows ?? []).map((row) => [Number(row.id), row])
          );
          setGames(recapGames.map((game) => {
            const odds = oddsById.get(Number(game.id));
            return {
              ...game,
              locked_home_odds: odds?.locked_home_odds ?? game.locked_home_odds ?? null,
              locked_away_odds: odds?.locked_away_odds ?? game.locked_away_odds ?? null,
            };
          }));
        }
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [date]);

  const totals = useMemo<PlayerTotal[]>(() => {
    const map = new Map<string, PlayerTotal>();
    games.forEach((game) => game.picks.forEach((pick) => {
      const current = map.get(pick.username) ?? { name: pick.username, points: 0, correct: 0, played: 0 };
      current.points += Number(pick.points) || 0;
      current.played++;
      if (pick.team_id === winner(game)) current.correct++;
      map.set(pick.username, current);
    }));
    return [...map.values()].sort((a, b) => b.points - a.points || b.correct - a.correct || a.name.localeCompare(b.name));
  }, [games]);

  const picksByGame = useMemo(() => {
    return games.map((game) => new Map(game.picks.map((pick) => [pick.username, pick])));
  }, [games]);

  async function exportImage() {
    if (!games.length || sharing) return;
    setSharing(true);
    setError("");
    try {
      const nameW = 210, gameW = 96, pointsW = 115, margin = 28;
      const headH = 112, rowH = 64, top = 154, bottom = 52;
      const width = margin * 2 + nameW + games.length * gameW + pointsW;
      const height = top + headH + Math.max(1, totals.length) * rowH + bottom;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Impossible de créer l'image.");
      ctx.fillStyle = "#0B1F1D";
      ctx.fillRect(0, 0, width, height);
      const text = (s: string, x: number, y: number, size = 15, color = "#F8F6EF", align: CanvasTextAlign = "left", bold = true) => {
        ctx.fillStyle = color;
        ctx.font = `${bold ? "800" : "500"} ${size}px Arial, sans-serif`;
        ctx.textAlign = align;
        ctx.fillText(s, x, y);
        ctx.textAlign = "left";
      };
      const fill = (x: number, y: number, w: number, h: number, color: string) => {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
      };
      const images = new Map<string, HTMLImageElement>();
      await Promise.all([...new Set(games.flatMap((g) => [g.away_abbr, g.home_abbr]))].map(async (abbr) => {
        const img = new Image();
        img.src = logo(abbr);
        try { await img.decode(); images.set(abbr, img); } catch { /* fallback texte */ }
      }));
      const drawLogo = (abbr: string, x: number, y: number, size: number, dim = false) => {
        const img = images.get(abbr);
        if (img) {
          ctx.save();
          if (dim) ctx.globalAlpha = 0.18;
          ctx.drawImage(img, x, y, size, size);
          ctx.restore();
        } else text(abbr, x + size / 2, y + size / 2 + 5, 13, dim ? "#56736E" : "#F8F6EF", "center");
      };
      text("PRONOS 2K26", margin, 35, 17, "#A9C2BD");
      text("RÉCAP DE LA NUIT", margin, 78, 33);
      text(new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }), margin, 110, 18, "#A9C2BD", "left", false);
      const x0 = margin, y0 = top;
      fill(x0, y0, nameW, headH, "#265550");
      text("JOUEURS", x0 + 14, y0 + 62, 18);
      games.forEach((game, i) => {
        const x = x0 + nameW + i * gameW;
        fill(x, y0, gameW - 1, headH, "#265550");
        drawLogo(game.away_abbr, x + 7, y0 + 10, 34);
        drawLogo(game.home_abbr, x + 55, y0 + 10, 34);
        text(game.away_abbr, x + 24, y0 + 59, 12, "#F8F6EF", "center");
        text(game.home_abbr, x + 72, y0 + 59, 12, "#F8F6EF", "center");
        text(`${game.away_score} – ${game.home_score}`, x + gameW / 2, y0 + 83, 15, "#F8F6EF", "center");
        const ao = oddsLabel(game.locked_away_odds), ho = oddsLabel(game.locked_home_odds);
        if (ao && ho) text(`${ao.replace(" pts", "")} / ${ho.replace(" pts", "")}`, x + gameW / 2, y0 + 101, 11, "#A9C2BD", "center");
      });
      const pointsX = x0 + nameW + games.length * gameW;
      fill(pointsX, y0, pointsW, headH, "#3F7D76");
      text("POINTS", pointsX + pointsW / 2, y0 + 62, 17, "#F8F6EF", "center");
      totals.forEach((p, row) => {
        const y = y0 + headH + row * rowH;
        const bg = row % 2 === 0 ? "#173B37" : "#214944";
        fill(x0, y, nameW, rowH - 1, bg);
        text(`${row + 1}.`, x0 + 12, y + 36, 15, "#A9C2BD");
        const shortName = p.name.length > 17 ? `${p.name.slice(0, 16)}…` : p.name;
        text(shortName, x0 + 43, y + 36, 16);
        games.forEach((game, i) => {
          const x = x0 + nameW + i * gameW;
          fill(x, y, gameW - 1, rowH - 1, bg);
          const pick = picksByGame[i].get(p.name);
          if (!pick) text("✕", x + gameW / 2, y + 40, 27, "#FB7185", "center");
          else drawLogo(pickTeam(game, pick), x + (gameW - 43) / 2, y + 10, 43, pick.team_id !== winner(game));
        });
        fill(pointsX, y, pointsW, rowH - 1, "#265550");
        text(`+${p.points}`, pointsX + pointsW / 2, y + 30, 19, "#F8F6EF", "center");
        text(`${p.correct}/${p.played}`, pointsX + pointsW / 2, y + 49, 12, "#A9C2BD", "center", false);
      });
      text("Logo clair = gagné  •  Logo sombre = perdu  •  ✕ = pas de prono", margin, height - 19, 14, "#A9C2BD", "left", false);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Impossible d'exporter l'image.");
      const file = new File([blob], `pronos-2k26-recap-${date}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        try { await navigator.share({ files: [file], title: `Récap PRONOS 2K26 · ${date}` }); }
        catch (e) { if ((e as Error).name !== "AbortError") throw e; }
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = file.name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de partage.");
    } finally { setSharing(false); }
  }

  return (
    <main className="min-h-screen bg-[#0B1F1D] text-[#F8F6EF]">
      <div className="mx-auto min-h-screen max-w-md px-5 pb-12">
        <header className="pb-5 pt-8">
          <button type="button" onClick={() => router.push("/")} className="mb-5 text-sm font-semibold text-[#A9C2BD]">← Accueil</button>
          <p className="text-xs font-bold tracking-widest text-[#A9C2BD]">PRONOS 2K26</p>
          <h1 className="mt-1 text-3xl font-black">Récap de la nuit 🏀</h1>
          <p className="mt-2 text-sm text-[#A9C2BD]">Tous les pronos en un seul tableau.</p>
        </header>

        <div className="mb-5 flex items-center justify-between rounded-2xl bg-[#265550] p-2">
          <button type="button" onClick={() => setDate((d) => shiftDate(d, -1))} className="px-4 py-3 text-2xl">‹</button>
          <p className="text-center text-sm font-bold capitalize">{new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</p>
          <button type="button" onClick={() => setDate((d) => shiftDate(d, 1))} className="px-4 py-3 text-2xl">›</button>
        </div>

        {loading && <p className="py-10 text-center text-[#A9C2BD]">Chargement du récap...</p>}
        {error && <p className="mb-4 rounded-2xl bg-red-950 p-4 text-sm text-red-200">{error}</p>}
        {!loading && !error && !games.length && <div className="rounded-3xl bg-[#265550] p-6 text-center text-[#E2ECE9]">Aucun match terminé pour cette journée.</div>}

        {!loading && games.length > 0 && (
          <>
            <div className="mb-3 flex items-center justify-between gap-2 text-xs text-[#A9C2BD]">
              <span>{totals.length} joueur{totals.length > 1 ? "s" : ""} · {games.length} match{games.length > 1 ? "s" : ""}</span>
              <span>Glisse vers la droite →</span>
            </div>
            <div className="overflow-hidden rounded-2xl border border-[#3F7D76]">
              <div className="overflow-x-auto overscroll-x-contain">
                <table className="w-max border-separate border-spacing-0 text-center text-xs">
                  <thead>
                    <tr>
                      <th scope="col" className="sticky left-0 z-30 w-[120px] min-w-[120px] border-b border-r border-[#3F7D76] bg-[#265550] px-2 py-3 text-left font-black shadow-[3px_0_8px_rgba(0,0,0,0.25)]">JOUEURS</th>
                      {games.map((game) => (
                        <th key={game.id} scope="col" className="w-[94px] min-w-[94px] border-b border-r border-[#3F7D76] bg-[#265550] px-1 py-2 align-top">
                          <div className="flex items-center justify-center gap-1">
                            <img src={logo(game.away_abbr)} alt={game.away_abbr} className="h-7 w-7 object-contain" />
                            <img src={logo(game.home_abbr)} alt={game.home_abbr} className="h-7 w-7 object-contain" />
                          </div>
                          <div className="mt-1 flex justify-center gap-2 text-[10px] font-bold text-[#E2ECE9]"><span>{game.away_abbr}</span><span>{game.home_abbr}</span></div>
                          <div className="mt-1 whitespace-nowrap font-black">{game.away_score} – {game.home_score}</div>
                          {game.locked_away_odds != null && game.locked_home_odds != null && (
                            <div className="mt-1 text-[10px] font-semibold text-[#A9C2BD]">{Number(game.locked_away_odds)} / {Number(game.locked_home_odds)} pts</div>
                          )}
                        </th>
                      ))}
                      <th scope="col" className="w-[88px] min-w-[88px] border-b border-[#3F7D76] bg-[#3F7D76] px-2 font-black">POINTS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {totals.map((person, row) => (
                      <tr key={person.name}>
                        <th scope="row" title={person.name} className={`sticky left-0 z-20 max-w-[120px] border-b border-r border-[#3F7D76] px-2 py-3 text-left font-bold shadow-[3px_0_8px_rgba(0,0,0,0.25)] ${row % 2 === 0 ? "bg-[#173B37]" : "bg-[#214944]"}`}>
                          <span className="mr-1 text-[#A9C2BD]">{row + 1}.</span>
                          <span className="break-words">{person.name}</span>
                        </th>
                        {games.map((game, i) => {
                          const pick = picksByGame[i].get(person.name);
                          const correct = pick?.team_id === winner(game);
                          return (
                            <td key={game.id} className={`h-[64px] border-b border-r border-[#3F7D76] p-1 ${row % 2 === 0 ? "bg-[#173B37]" : "bg-[#214944]"}`}>
                              {!pick ? (
                                <span title="Aucun prono" className="text-2xl font-black text-red-400">✕</span>
                              ) : (
                                <div className="flex justify-center" title={`${pickTeam(game, pick)} · ${correct ? "Gagné" : "Perdu"} · ${Number(pick.points) || 0} pts`}>
                                  <img src={logo(pickTeam(game, pick))} alt={pickTeam(game, pick)} className={`h-10 w-10 object-contain ${correct ? "drop-shadow-[0_0_7px_rgba(187,244,213,0.35)]" : "opacity-[0.18] grayscale"}`} />
                                </div>
                              )}
                            </td>
                          );
                        })}
                        <td className="border-b border-[#3F7D76] bg-[#265550] px-2 py-2">
                          <div className="text-base font-black">+{person.points}</div>
                          <div className="text-[10px] text-[#A9C2BD]">{person.correct}/{person.played}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-[#A9C2BD]">Logo clair : gagné · Logo sombre : perdu · <span className="text-red-400">✕</span> : pas de prono</p>
            <button type="button" onClick={() => void exportImage()} disabled={sharing} className="mt-5 w-full rounded-2xl bg-[#F8F6EF] px-4 py-4 font-black text-[#0B1F1D] disabled:opacity-50">
              {sharing ? "Préparation de l'image..." : "↗ Partager le tableau sur Messenger"}
            </button>
            <p className="mt-2 text-center text-xs text-[#A9C2BD]">Sur téléphone, choisis Messenger. Sur PC, l'image sera téléchargée.</p>
          </>
        )}
      </div>
    </main>
  );
}
