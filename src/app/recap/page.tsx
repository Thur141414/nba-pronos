"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Pick = { username: string; team_id: number; points: number };
type RecapGame = {
  id: number; game_date: string;
  home_team_id: number; away_team_id: number;
  home_abbr: string; away_abbr: string;
  home_score: number; away_score: number; picks: Pick[];
};

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

export default function RecapPage() {
  const router = useRouter();
  const [date, setDate] = useState(() => nbaDate(-1));
  const [games, setGames] = useState<RecapGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("nba_pronos_player")) {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true); setError("");
      const { data, error: rpcError } = await supabase.rpc("get_night_recap", { p_date: date });
      if (!active) return;
      if (rpcError) { setError(rpcError.message); setGames([]); }
      else setGames(Array.isArray(data) ? (data as RecapGame[]) : []);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [date]);

  const totals = useMemo(() => {
    const map = new Map<string, { name: string; points: number; correct: number; played: number }>();
    games.forEach((game) => game.picks.forEach((pick) => {
      const current = map.get(pick.username) ?? { name: pick.username, points: 0, correct: 0, played: 0 };
      current.points += Number(pick.points) || 0;
      current.played++;
      if (pick.team_id === winner(game)) current.correct++;
      map.set(pick.username, current);
    }));
    return [...map.values()].sort((a, b) => b.points - a.points || b.correct - a.correct);
  }, [games]);

  async function exportImage() {
    if (!games.length || sharing) return;
    setSharing(true); setError("");
    try {
      const width = 900, pad = 45;
      const rowHeight = (game: RecapGame) => 140 + Math.ceil(game.picks.length / 2) * 42;
      const height = 180 + games.reduce((sum, g) => sum + rowHeight(g) + 18, 0) + 100 + totals.length * 45 + 75;
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Impossible de créer l'image.");
      ctx.fillStyle = "#0B1F1D"; ctx.fillRect(0, 0, width, height);
      const text = (value: string, x: number, y: number, size = 25, color = "#F8F6EF", bold = false) => {
        ctx.fillStyle = color; ctx.font = `${bold ? "800" : "500"} ${size}px Arial, sans-serif`;
        ctx.fillText(value, x, y);
      };
      const rect = (x: number, y: number, w: number, h: number, color: string) => {
        ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, 20); ctx.fill();
      };
      const images = new Map<string, HTMLImageElement>();
      await Promise.all([...new Set(games.flatMap((g) => [g.away_abbr, g.home_abbr]))].map(async (abbr) => {
        const img = new Image(); img.src = logo(abbr);
        try { await img.decode(); images.set(abbr, img); } catch { /* abbreviation fallback */ }
      }));
      const drawLogo = (abbr: string, x: number, y: number) => {
        const img = images.get(abbr);
        if (img) ctx.drawImage(img, x, y, 66, 66);
        else text(abbr, x, y + 42, 23, "#F8F6EF", true);
      };
      text("PRONOS 2K26", pad, 58, 23, "#A9C2BD", true);
      text("RÉCAP DE LA NUIT", pad, 112, 45, "#F8F6EF", true);
      text(new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }), pad, 151, 24, "#A9C2BD");
      let y = 180;
      games.forEach((game) => {
        const h = rowHeight(game);
        rect(pad, y, width - pad * 2, h, "#265550");
        drawLogo(game.away_abbr, pad + 25, y + 24);
        text(game.away_abbr, pad + 102, y + 67, 30, game.away_team_id === winner(game) ? "#F8F6EF" : "#B9CBC7", true);
        text(`${game.away_score}  –  ${game.home_score}`, pad + 305, y + 67, 36, "#F8F6EF", true);
        text(game.home_abbr, pad + 565, y + 67, 30, game.home_team_id === winner(game) ? "#F8F6EF" : "#B9CBC7", true);
        drawLogo(game.home_abbr, pad + 715, y + 24);
        ctx.fillStyle = "#3F7D76"; ctx.fillRect(pad + 22, y + 105, width - pad * 2 - 44, 2);
        game.picks.forEach((pick, index) => {
          const correct = pick.team_id === winner(game);
          const chosen = pick.team_id === game.away_team_id ? game.away_abbr : game.home_abbr;
          const x = pad + 25 + (index % 2) * 390;
          const py = y + 137 + Math.floor(index / 2) * 42;
          text(`${correct ? "✓" : "✕"} ${pick.username} · ${chosen}${correct ? ` (+${pick.points})` : ""}`, x, py, 21, correct ? "#B9F4D5" : "#FFC2C2", true);
        });
        y += h + 18;
      });
      rect(pad, y + 8, width - pad * 2, 75 + totals.length * 45, "#3F7D76");
      text("🏆 POINTS DE LA NUIT", pad + 24, y + 52, 29, "#F8F6EF", true);
      totals.forEach((p, i) => text(`${i + 1}. ${p.name}  ·  +${p.points} pts  (${p.correct}/${p.played})`, pad + 25, y + 98 + i * 45, 24, "#F8F6EF", true));
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Impossible d'exporter l'image.");
      const file = new File([blob], `pronos-2k26-recap-${date}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        try { await navigator.share({ files: [file], title: `Récap PRONOS 2K26 · ${date}` }); }
        catch (e) { if ((e as Error).name !== "AbortError") throw e; }
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a"); link.href = url; link.download = file.name; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Erreur de partage."); }
    finally { setSharing(false); }
  }

  return (
    <main className="min-h-screen bg-[#0B1F1D] text-[#F8F6EF]">
      <div className="mx-auto min-h-screen max-w-md px-5 pb-12">
        <header className="pb-5 pt-8">
          <button type="button" onClick={() => router.push("/")} className="mb-5 text-sm font-semibold text-[#A9C2BD]">← Accueil</button>
          <p className="text-xs font-bold tracking-widest text-[#A9C2BD]">PRONOS 2K26</p>
          <h1 className="mt-1 text-3xl font-black">Récap de la nuit 🏀</h1>
          <p className="mt-2 text-sm text-[#A9C2BD]">Scores, vainqueurs et pronos de tous les joueurs.</p>
        </header>
        <div className="mb-5 flex items-center justify-between rounded-2xl bg-[#265550] p-2">
          <button type="button" onClick={() => setDate((d) => shiftDate(d, -1))} className="px-4 py-3 text-2xl">‹</button>
          <p className="text-center text-sm font-bold capitalize">{new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</p>
          <button type="button" onClick={() => setDate((d) => shiftDate(d, 1))} className="px-4 py-3 text-2xl">›</button>
        </div>
        {loading && <p className="py-10 text-center text-[#A9C2BD]">Chargement du récap...</p>}
        {error && <p className="mb-4 rounded-2xl bg-red-950 p-4 text-sm text-red-200">{error}</p>}
        {!loading && !error && !games.length && <div className="rounded-3xl bg-[#265550] p-6 text-center text-[#E2ECE9]">Aucun match terminé pour cette journée.</div>}
        <div className="space-y-3">
          {games.map((game) => (
            <div key={game.id} className="rounded-3xl bg-[#265550] p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2"><img src={logo(game.away_abbr)} alt={game.away_abbr} className="h-10 w-10 object-contain"/><span className={`font-black ${winner(game) === game.away_team_id ? "text-[#F8F6EF]" : "text-[#A9C2BD]"}`}>{game.away_abbr}</span></div>
                <span className="text-lg font-black">{game.away_score} – {game.home_score}</span>
                <div className="flex items-center gap-2"><span className={`font-black ${winner(game) === game.home_team_id ? "text-[#F8F6EF]" : "text-[#A9C2BD]"}`}>{game.home_abbr}</span><img src={logo(game.home_abbr)} alt={game.home_abbr} className="h-10 w-10 object-contain"/></div>
              </div>
              <div className="mt-3 border-t border-[#3F7D76] pt-3">
                <p className="mb-2 text-xs font-bold text-[#A9C2BD]">PRONOS DES JOUEURS</p>
                {game.picks.length ? <div className="grid grid-cols-2 gap-2">{game.picks.map((pick, i) => {
                  const correct = pick.team_id === winner(game);
                  return <div key={`${pick.username}-${i}`} className={`rounded-xl p-2 text-xs font-bold ${correct ? "bg-[#3F7D76] text-[#F8F6EF]" : "bg-[#0B1F1D] text-[#A9C2BD]"}`}>
                    {correct ? "✓" : "✕"} {pick.username} · {pick.team_id === game.away_team_id ? game.away_abbr : game.home_abbr}{correct ? ` +${pick.points}` : ""}
                  </div>;
                })}</div> : <p className="text-xs text-[#A9C2BD]">Aucun prono enregistré.</p>}
              </div>
            </div>
          ))}
        </div>
        {!!games.length && <div className="mt-5 rounded-3xl bg-[#3F7D76] p-5">
          <h2 className="mb-3 text-lg font-black">🏆 Points de la nuit</h2>
          {totals.map((p, i) => <div key={p.name} className="flex justify-between gap-3 border-b border-[#265550] py-2 text-sm last:border-0"><span className="font-semibold">{i + 1}. {p.name} <span className="text-xs text-[#E2ECE9]">({p.correct}/{p.played})</span></span><span className="font-black">+{p.points} pts</span></div>)}
          <button type="button" onClick={() => void exportImage()} disabled={sharing} className="mt-5 w-full rounded-2xl bg-[#F8F6EF] px-4 py-4 font-black text-[#0B1F1D] disabled:opacity-50">{sharing ? "Préparation de l'image..." : "↗ Partager le récap sur Messenger"}</button>
          <p className="mt-2 text-center text-xs text-[#E2ECE9]">Choisis Messenger dans le partage du téléphone. Sur PC, l'image sera téléchargée.</p>
        </div>}
      </div>
    </main>
  );
}
