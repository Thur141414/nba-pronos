
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";
import { buildRecapHtml } from "@/lib/recapHtml";
import { generateRecapImage } from "@/lib/generateRecapImage";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const secret = process.env.RECAP_CRON_SECRET;

  if (!secret) {
    return NextResponse.json(
      { success: false, error: "Configuration manquante" },
      { status: 500 }
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;

  const receivedBuffer = Buffer.from(authorization);
  const expectedBuffer = Buffer.from(expected);

  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    return NextResponse.json(
      { success: false, error: "Non autorisé" },
      { status: 401 }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return NextResponse.json(
      { success: false, error: "Configuration Supabase manquante" },
      { status: 500 }
    );
  }

  const supabase = createClient(url, key);

const now = new Date();

const parisParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
}).formatToParts(now);

const getPart = (type: string) =>
  parisParts.find((part) => part.type === type)?.value ?? "";

const parisHour = Number(getPart("hour"));

const parisToday =
  `${getPart("year")}-${getPart("month")}-${getPart("day")}`;

const parisDate = new Date(`${parisToday}T12:00:00Z`);

// Avant 6 h, la dernière journée NBA est celle d'avant-hier.
// À partir de 6 h, c'est celle d'hier.
parisDate.setUTCDate(
  parisDate.getUTCDate() - (parisHour < 6 ? 2 : 1)
);

const recapDate = parisDate.toISOString().slice(0, 10);

const { data: statusRows, error: statusError } = await supabase.rpc(
  "get_recap_generation_status",
  { p_date: recapDate }
);

if (statusError) {
  return NextResponse.json(
    { success: false, error: statusError.message },
    { status: 500 }
  );
}

const status = statusRows?.[0];

if (!status?.ready) {
  return NextResponse.json({
    success: true,
    ready: false,
    message: "Tous les matchs ne sont pas encore terminés.",
    total_games: status?.total_games ?? 0,
    finished_games: status?.finished_games ?? 0,
  });
}

const { data: recapGames, error: recapError } = await supabase.rpc(
  "get_night_recap",
  { p_date: recapDate }
);

if (recapError) {
  return NextResponse.json(
    { success: false, error: recapError.message },
    { status: 500 }
  );
}

const { data: generalRanking, error: rankingError } = await supabase.rpc(
  "get_recap_general_ranking",
  { p_date: recapDate }
);

const gameIds = (recapGames ?? []).map(
  (game: { id: number }) => game.id
);

const { data: gameOdds, error: oddsError } = await supabase
  .from("games")
  .select("id, locked_home_odds, locked_away_odds")
  .in("id", gameIds);

if (oddsError) {
  return NextResponse.json(
    { success: false, error: oddsError.message },
    { status: 500 }
  );
}

const oddsByGameId = new Map(
  (gameOdds ?? []).map((game) => [game.id, game])
);

const completeRecapGames = (recapGames ?? []).map(
  (game: { id: number }) => ({
    ...game,
    locked_home_odds:
      oddsByGameId.get(game.id)?.locked_home_odds ?? null,
    locked_away_odds:
      oddsByGameId.get(game.id)?.locked_away_odds ?? null,
  })
);

type RecapPick = {
  username: string;
  team_id: number;
  points: number;
};

type RecapGame = {
  id: number;
  home_team_id: number;
  away_team_id: number;
  home_score: number;
  away_score: number;
  picks: RecapPick[];
};

type GeneralRank = {
  username: string;
  general_rank: number;
  rank_movement: number;
};

const rankingByName = new Map(
  (generalRanking as GeneralRank[] ?? []).map((player) => [
    player.username,
    player,
  ])
);

const totalsByName = new Map<
  string,
  { name: string; points: number; correct: number; played: number }
>();

for (const game of completeRecapGames as RecapGame[]) {
  const winner =
    game.home_score > game.away_score
      ? game.home_team_id
      : game.away_score > game.home_score
        ? game.away_team_id
        : null;

  for (const pick of game.picks ?? []) {
    const total = totalsByName.get(pick.username) ?? {
      name: pick.username,
      points: 0,
      correct: 0,
      played: 0,
    };

    total.points += Number(pick.points) || 0;
    total.played += 1;

    if (winner !== null && pick.team_id === winner) {
      total.correct += 1;
    }

    totalsByName.set(pick.username, total);
  }
}

const nightlyTotals = [...totalsByName.values()].sort((a, b) => {
  if (b.points !== a.points) return b.points - a.points;

  const rankA = Number(
    rankingByName.get(a.name)?.general_rank ?? 999999
  );
  const rankB = Number(
    rankingByName.get(b.name)?.general_rank ?? 999999
  );

  if (rankA !== rankB) return rankA - rankB;

  return a.name.localeCompare(b.name, "fr");
});

if (rankingError) {
  return NextResponse.json(
    { success: false, error: rankingError.message },
    { status: 500 }
  );
}

  const { data, error } = await supabase.storage.getBucket("recaps");

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  const abbreviations = new Set<string>();

for (const game of completeRecapGames) {
  abbreviations.add(game.home_abbr.toUpperCase());
  abbreviations.add(game.away_abbr.toUpperCase());
}

const logos: Record<string, string> = {};

for (const abbr of abbreviations) {
  try {
    const file = await readFile(
      path.join(process.cwd(), "public", "logos", `${abbr}.png`)
    );

    logos[abbr] = `data:image/png;base64,${file.toString("base64")}`;
  } catch {
    console.warn(`Logo introuvable : ${abbr}`);
  }
}

const html = buildRecapHtml(
  recapDate,
  completeRecapGames,
  nightlyTotals,
  generalRanking ?? [],
  logos
);

const fileName = `${recapDate}.png`;

// Vérifier si le récap existe déjà.
const { data: existingFiles, error: listError } = await supabase.storage
  .from("recaps")
  .list("", {
    search: fileName,
  });

if (listError) {
  return NextResponse.json(
    { success: false, error: listError.message },
    { status: 500 }
  );
}

if (existingFiles?.some((file) => file.name === fileName)) {
  return NextResponse.json({
    success: true,
    already_exists: true,
    date: recapDate,
    message: "Le récap de cette nuit est déjà enregistré 🏀",
  });
}

// Générer l'image uniquement si elle n'existe pas.
const png = await generateRecapImage(html);

// Enregistrer dans le bucket privé.
const { error: uploadError } = await supabase.storage
  .from("recaps")
  .upload(fileName, png, {
    contentType: "image/png",
    upsert: false,
  });

if (uploadError) {
  return NextResponse.json(
    { success: false, error: uploadError.message },
    { status: 500 }
  );
}

return NextResponse.json({
  success: true,
  generated: true,
  date: recapDate,
  file: fileName,
  message: "Récap généré et enregistré dans Supabase 🏀",
});

}
