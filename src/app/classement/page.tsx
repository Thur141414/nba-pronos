"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Player = { user_id: string; username: string };
type RankingPlayer = { user_id: string; username: string; total_points: number; correct_predictions: number; finished_predictions: number; success_percentage: number; ranking_position: number };
type Extras = { user_id: string; week_points: number; month_points: number; week_correct: number; week_finished: number; month_correct: number; month_finished: number; previous_week_points: number; general_perfect_nights: number; week_perfect_nights: number; month_perfect_nights: number; general_movement: number; week_movement: number; month_movement: number };
type Period = "general" | "week" | "month";
type Scope = "all" | "conference" | "team";
type Team = { id: number; name: string; abbreviation: string; conference: string | null; logo_url: string | null };
type FilteredStat = { user_id: string; total_points: number; correct_predictions: number; finished_predictions: number };

export default function ClassementPage() {
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [ranking, setRanking] = useState<RankingPlayer[]>([]);
  const [extras, setExtras] = useState<Extras[]>([]);
  const [period, setPeriod] = useState<Period>("general");
  const [scope, setScope] = useState<Scope>("all");
  const [conference, setConference] = useState<"East" | "West">("East");
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState<number | null>(null);
  const [filtered, setFiltered] = useState<FilteredStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("nba_pronos_player");
    if (!saved) { router.replace("/login"); return; }
    try { setPlayer(JSON.parse(saved)); }
    catch { localStorage.removeItem("nba_pronos_player"); router.replace("/login"); return; }
    let active = true;
    async function load() {
      setLoading(true);
      const [r, e, t] = await Promise.all([
        supabase.rpc("get_players_ranking"),
        supabase.rpc("get_ranking_extras_v2"),
        supabase.from("teams").select("id,name,abbreviation,conference,logo_url").order("name"),
      ]);
      if (!active) return;
      if (r.error || e.error) setError(r.error?.message || e.error?.message || "Erreur de chargement.");
      else { setRanking(r.data || []); setExtras(e.data || []); }
      if (t.error) setFilterError(`Équipes : ${t.error.message}`);
      else { const all = (t.data || []) as Team[]; setTeams(all); setTeamId(all[0]?.id ?? null); }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [router]);

  useEffect(() => {
    if (scope === "all" || (scope === "team" && teamId == null)) return;
    let active = true;
    async function loadFiltered() {
      setFilterLoading(true); setFilterError("");
      const { data, error: rpcError } = await supabase.rpc("get_filtered_ranking_points_v1", {
        p_period: period, p_scope: scope,
        p_conference: scope === "conference" ? conference : null,
        p_team_id: scope === "team" ? teamId : null,
      });
      if (!active) return;
      if (rpcError) { setFilterError(rpcError.message); setFiltered([]); }
      else setFiltered((data || []) as FilteredStat[]);
      setFilterLoading(false);
    }
    void loadFiltered();
    return () => { active = false; };
  }, [period, scope, conference, teamId]);

  const extrasById = new Map(extras.map(x => [x.user_id, x]));
  const getExtra = (id: string) => extrasById.get(id);
  const pointsFor = (p: RankingPlayer) => period === "general" ? Number(p.total_points) : Number(getExtra(p.user_id)?.[period === "week" ? "week_points" : "month_points"] ?? 0);
  const correctFor = (p: RankingPlayer) => period === "general" ? Number(p.correct_predictions) : Number(getExtra(p.user_id)?.[period === "week" ? "week_correct" : "month_correct"] ?? 0);
  const finishedFor = (p: RankingPlayer) => period === "general" ? Number(p.finished_predictions) : Number(getExtra(p.user_id)?.[period === "week" ? "week_finished" : "month_finished"] ?? 0);
  const filteredById = new Map(filtered.map(x => [x.user_id, x]));
  const getFiltered = (id: string) => filteredById.get(id);
  const filteredPointsFor = (p: RankingPlayer) => Number(getFiltered(p.user_id)?.total_points ?? 0);
  const sorted = [...ranking].sort((a,b) => scope === "all"
    ? pointsFor(b) - pointsFor(a) || a.ranking_position - b.ranking_position
    : filteredPointsFor(b) - filteredPointsFor(a) || a.username.localeCompare(b.username));
  const previousWeekWinner = [...ranking].filter(p => Number(getExtra(p.user_id)?.previous_week_points ?? 0) > 0)
    .sort((a,b) => Number(getExtra(b.user_id)?.previous_week_points ?? 0) - Number(getExtra(a.user_id)?.previous_week_points ?? 0) || a.username.localeCompare(b.username))[0];
  const selectedTeam = teams.find(t => t.id === teamId);
  const scopeTitle = scope === "conference" ? `Conférence ${conference === "East" ? "Est" : "Ouest"}` : selectedTeam?.name || "Équipe";
  const busy = loading || (scope !== "all" && filterLoading);
  const activeError = error || (scope !== "all" ? filterError : "");

  return (
    <main className="min-h-screen bg-[#0B1F1D] text-[#F8F6EF]">
      <div className="mx-auto min-h-screen max-w-md bg-[#0B1F1D]">
        <header className="px-5 pb-5 pt-8"><p className="text-sm text-[#A9C2BD]">Classement des joueurs</p><h1 className="mt-1 text-3xl font-black">NBA PRONOS 🏆</h1></header>
        <section className="space-y-4 px-5 pb-28">
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-[#265550] p-1">
            {([ ["general","Général"], ["week","Semaine"], ["month","Mois"] ] as const).map(([value,label]) => (
              <button key={value} type="button" onClick={() => setPeriod(value)} className={`rounded-xl px-2 py-3 text-sm font-bold ${period === value ? "bg-[#3F7D76] text-[#F8F6EF]" : "text-[#A9C2BD]"}`}>{label}</button>
            ))}
          </div>
          <div className="rounded-2xl border border-[#3F7D76] bg-[#143430] p-4">
            <p className="mb-3 text-xs font-bold tracking-wider text-[#A9C2BD]">FILTRER LES MATCHS</p>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#0B1F1D] p-1">
              {([ ["all","Général"], ["conference","Conférence"], ["team","Équipe"] ] as const).map(([value,label]) => (
                <button key={value} type="button" onClick={() => setScope(value)} className={`rounded-lg px-1 py-2.5 text-xs font-bold ${scope === value ? "bg-[#3F7D76] text-[#F8F6EF]" : "text-[#A9C2BD]"}`}>{label}</button>
              ))}
            </div>
            {scope === "conference" && <div className="mt-3 grid grid-cols-2 gap-2">{([ ["East","EST"], ["West","OUEST"] ] as const).map(([value,label]) => <button key={value} type="button" onClick={() => setConference(value)} className={`rounded-xl py-3 text-sm font-bold ${conference === value ? "bg-[#3F7D76]" : "bg-[#0B1F1D] text-[#A9C2BD]"}`}>{label}</button>)}</div>}
            {scope === "team" && <div className="mt-3 flex items-center gap-3">
              {selectedTeam && <img src={selectedTeam.logo_url || `/logos/${selectedTeam.abbreviation}.png`} alt="" className="h-10 w-10 shrink-0 object-contain" />}
              <select aria-label="Choisir une équipe" value={teamId ?? ""} onChange={e => setTeamId(Number(e.target.value))} className="min-w-0 flex-1 rounded-xl bg-[#0B1F1D] px-3 py-3 text-sm font-bold text-[#F8F6EF]">
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>}
          </div>
          {busy && <div className="rounded-3xl bg-[#265550] p-6 text-center text-[#A9C2BD]">Chargement du classement...</div>}
          {activeError && <div className="rounded-3xl bg-red-950 p-5 text-red-200">Erreur : {activeError}</div>}
          {!busy && !activeError && <>
            <div className="rounded-2xl bg-[#265550] px-4 py-3 text-sm text-[#E2ECE9]">
              {scope === "all" ? (period === "general" ? "🏆 Classement de la saison" : period === "week" ? "📅 Cette semaine · lundi à dimanche" : "📅 Ce mois-ci") : `🏀 ${scopeTitle} · ${period === "general" ? "Saison" : period === "week" ? "Semaine" : "Mois"}`}
              <span className="block pt-1 text-xs text-[#A9C2BD]">{scope === "all" ? "Les périodes suivent la journée NBA (06 h, heure de Paris)." : "Conférence : points gagnés par les équipes de cette conférence. Équipe : points gagnés sur ses matchs, pour ou contre. Tous les joueurs sont inclus."}</span>
            </div>
            {scope === "all" && <div className="rounded-3xl border border-[#3F7D76] bg-[#265550] p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[#A9C2BD]">🏅 Joueur de la semaine passée</p>
              {previousWeekWinner ? <div className="mt-2 flex items-center justify-between gap-3"><p className="truncate text-lg font-black">{previousWeekWinner.username}</p><p className="shrink-0 font-black">{getExtra(previousWeekWinner.user_id)?.previous_week_points} pts</p></div> : <p className="mt-2 text-sm text-[#E2ECE9]">Pas encore de vainqueur pour la semaine passée.</p>}
            </div>}
            {sorted.length === 0 && <p className="py-8 text-center text-[#A9C2BD]">Aucun joueur pour le moment.</p>}
            {sorted.map((p,index) => {
              const isMe = p.user_id === player?.user_id;
              const extra = getExtra(p.user_id);
              const pts = scope === "all" ? pointsFor(p) : filteredPointsFor(p);
              const f = scope === "all" ? finishedFor(p) : Number(getFiltered(p.user_id)?.finished_predictions ?? 0);
              const c = scope === "all" ? correctFor(p) : Number(getFiltered(p.user_id)?.correct_predictions ?? 0);
              const pct = f > 0 ? (100*c/f).toFixed(1) : "0.0";
              const previous = sorted[index-1];
              const position = scope === "all"
                ? (period === "general" ? p.ranking_position : previous && pointsFor(previous) === pts ? sorted.findIndex(x => pointsFor(x) === pts) + 1 : index+1)
                : (previous && filteredPointsFor(previous) === pts ? sorted.findIndex(x => filteredPointsFor(x) === pts) + 1 : index+1);
              const movement = Number(extra?.[period === "general" ? "general_movement" : period === "week" ? "week_movement" : "month_movement"] ?? 0);
              const perfect = Number(extra?.[period === "general" ? "general_perfect_nights" : period === "week" ? "week_perfect_nights" : "month_perfect_nights"] ?? 0);
              return <div key={p.user_id} className={`rounded-3xl p-5 ${isMe ? "bg-[#3F7D76] ring-2 ring-[#A9C2BD]" : "bg-[#265550]"}`}>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0B1F1D] text-lg font-black">{position === 1 ? "🥇" : position === 2 ? "🥈" : position === 3 ? "🥉" : position}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-black">{p.username}{isMe && <span className="ml-2 text-xs font-semibold text-[#E2ECE9]">TOI</span>}</p>
                    <p className="mt-1 text-xs text-[#E2ECE9]">{c}/{f} bons pronos · {pct}%</p>
                    {scope === "all" && <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold">
                      <span>🌙 {perfect} Perfect Night{perfect > 1 ? "s" : ""}</span>
                      <span className={movement > 0 ? "text-[#F8F6EF]" : "text-[#E2ECE9]"}>{movement > 0 ? `▲ ${movement} place${movement > 1 ? "s" : ""}` : movement < 0 ? `▼ ${Math.abs(movement)} place${movement < -1 ? "s" : ""}` : "— Stable"}</span>
                    </div>}
                  </div>
                  <div className="shrink-0 text-right">{scope === "all" ? <><p className="text-2xl font-black">{pts}</p><p className="text-xs text-[#E2ECE9]">points</p></> : <><p className="text-2xl font-black">{pts}</p><p className="text-xs text-[#E2ECE9]">points</p></>}</div>
                </div>
              </div>;
            })}
            <p className="text-center text-xs text-[#A9C2BD]">{scope === "all" ? "🌙 Perfect Night : tous les matchs d’une journée NBA terminée correctement pronostiqués. ▲▼ Évolution entre les deux dernières journées NBA complètes." : "Les matchs d'une conférence sont comptés une seule fois. Égalité de points = même rang. Aucun point gagné = 0 pt."}</p>
          </>}
        </section>
        <nav className="fixed bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 border-t border-[#265550] bg-[#0B1F1D]/95 px-4 py-3 backdrop-blur"><div className="grid grid-cols-4 text-center text-xs font-semibold">
          <button type="button" onClick={() => router.push("/")} className="py-3 text-[#A9C2BD]">Accueil</button>
          <button type="button" onClick={() => router.push("/matchs")} className="py-3 text-[#A9C2BD]">Matchs</button>
          <button type="button" className="rounded-2xl bg-[#265550] px-2 py-3 text-[#F3F0E8]">Classement</button>
          <button type="button" onClick={() => router.push("/stats")} className="py-3 text-[#A9C2BD]">Stats</button>
        </div></nav>
      </div>
    </main>
  );
}
