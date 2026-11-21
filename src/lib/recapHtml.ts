type Pick = {
  username: string;
  team_id: number;
  points: number;
};

type Game = {
  id: number;
  home_team_id: number;
  away_team_id: number;
  home_abbr: string;
  away_abbr: string;
  home_score: number;
  away_score: number;
  locked_home_odds?: number | null;
  locked_away_odds?: number | null;
  picks: Pick[];
};

type PlayerTotal = {
  name: string;
  points: number;
  correct: number;
  played: number;
};

type GeneralRank = {
  username: string;
  general_rank: number;
  rank_movement: number;
};

export function buildRecapHtml(
  date: string,
  games: Game[],
  totals: PlayerTotal[],
  generalRanking: GeneralRank[],
  logos: Record<string, string>
): string {
  const payload = JSON.stringify({
    date,
    games,
    totals,
    generalRanking,
    logos,
  }).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #0B1F1D; }
    canvas { display: block; }
  </style>
</head>
<body>
<canvas id="recap"></canvas>
<script>
(async () => {
  const { date, games, totals, generalRanking, logos } = ${payload};

  const nameW = 210;
  const gameW = 96;
  const pointsW = 115;
  const rankW = 132;
  const margin = 28;
  const headH = 112;
  const rowH = 64;
  const top = 154;
  const bottom = 52;

  const width = margin * 2 + nameW
    + games.length * gameW + pointsW + rankW;

  const height = top + headH
    + Math.max(1, totals.length) * rowH + bottom;

  const canvas = document.getElementById("recap");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");

  function rect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  function separator(x, y, h) {
  rect(x - 1, y, 2, h, "#0B1F1D");
}

  function text(value, x, y, size, color, bold = false, align = "left") {
    ctx.fillStyle = color;
    ctx.font = (bold ? "800" : "500") + " " + size + "px Arial, sans-serif";
    ctx.textAlign = align;
    ctx.fillText(String(value), x, y);
  }

  function rankColor(rank) {
    if (rank === 1) return "#F2C14E";
    if (rank === 2) return "#9DAEB8";
    if (rank === 3) return "#CD9565";
    return "#F8F6EF";
  }

  const images = {};

  await Promise.all(
    Object.entries(logos).map(async ([abbr, src]) => {
      const img = new Image();
      img.src = src;

      try {
        await img.decode();
        images[abbr.toUpperCase()] = img;
      } catch {
        // Le récap reste générable si un logo est absent.
      }
    })
  );

  function logo(abbr, x, y, size, alpha = 1) {
    const img = images[String(abbr).toUpperCase()];
    if (!img) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, x, y, size, size);
    ctx.restore();
  }

  const rankingByName = new Map(
    generalRanking.map(p => [p.username, p])
  );

  rect(0, 0, width, height, "#0B1F1D");

  text("PRONOS 2K26", margin, 35, 17, "#A9C2BD", true);
  text("RÉCAP DE LA NUIT", margin, 78, 33, "#F8F6EF", true);

  const formattedDate = new Date(date + "T12:00:00Z")
    .toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC"
    });

  text(formattedDate, margin, 110, 18, "#A9C2BD");

  let x = margin;

  rect(x, top, nameW, headH, "#265550");
  text("JOUEURS", x + 14, top + 62, 18, "#F8F6EF", true);
  x += nameW;

  for (const game of games) {
    rect(x, top, gameW, headH, "#265550");
      separator(x, top, headH);

    logo(game.away_abbr, x + 7, top + 10, 34);
    logo(game.home_abbr, x + 55, top + 10, 34);

    text(game.away_abbr, x + 24, top + 59, 12, "#F8F6EF", true, "center");
    text(game.home_abbr, x + 72, top + 59, 12, "#F8F6EF", true, "center");

    text(
      game.away_score + " - " + game.home_score,
      x + 48, top + 83, 15, "#F8F6EF", true, "center"
    );

    const odds =
      game.locked_away_odds != null && game.locked_home_odds != null
        ? game.locked_away_odds + " / " + game.locked_home_odds
        : "—";

    text(odds, x + 48, top + 101, 11, "#A9C2BD", false, "center");

    x += gameW;
  }

  rect(x, top, pointsW, headH, "#3F7D76");
  text("POINTS", x + pointsW / 2, top + 62, 17, "#F8F6EF", true, "center");
  x += pointsW;

  rect(x, top, rankW, headH, "#265550");
  text("GÉNÉRAL", x + rankW / 2, top + 49, 15, "#F8F6EF", true, "center");
  text("RANG / ÉVOL.", x + rankW / 2, top + 71, 12, "#A9C2BD", true, "center");

  totals.forEach((player, index) => {
    const y = top + headH + index * rowH;
    const perfect = games.length > 0
      && player.played === games.length
      && player.correct === games.length;

    const rowColor = perfect
      ? "#315B42"
      : index % 2 === 0 ? "#173B37" : "#214944";

    let cellX = margin;

    rect(cellX, y, nameW, rowH, rowColor);

    if (perfect) rect(cellX, y, 5, rowH, "#C8E6A0");

    text((index + 1) + ".", cellX + 12, y + 36, 15, "#A9C2BD", true);

    const shortName = player.name.length > 17
      ? player.name.slice(0, 16) + "…"
      : player.name;

    text(shortName, cellX + 43, y + 36, 16, "#F8F6EF", true);

    cellX += nameW;

    for (const game of games) {
      rect(cellX, y, gameW, rowH, rowColor);
        separator(cellX, y, rowH);

      const pick = (game.picks || []).find(
        p => p.username === player.name
      );

      if (!pick) {
        text("✕", cellX + gameW / 2, y + 40, 27, "#F87171", true, "center");
      } else {
        const winner = game.home_score > game.away_score
          ? game.home_team_id
          : game.away_score > game.home_score
            ? game.away_team_id
            : null;

        const abbr = pick.team_id === game.away_team_id
          ? game.away_abbr
          : game.home_abbr;

        logo(abbr, cellX + (gameW - 43) / 2, y + 10, 43,
          pick.team_id === winner ? 1 : 0.18);
      }

      cellX += gameW;
    }

    rect(cellX, y, pointsW, rowH, perfect ? "#386C4C" : "#265550");

    text("+" + player.points, cellX + pointsW / 2,
      y + 30, 19, "#F8F6EF", true, "center");

    text(player.correct + "/" + player.played,
      cellX + pointsW / 2, y + 49, 12, "#A9C2BD", false, "center");

    cellX += pointsW;

    rect(cellX, y, rankW, rowH, rowColor);

    const ranking = rankingByName.get(player.name);

    if (ranking) {
      const rank = Number(ranking.general_rank);
      const movement = Number(ranking.rank_movement);

      text(rank + (rank === 1 ? "er" : "e"),
        cellX + rankW / 2, y + 28, 19,
        rankColor(rank), true, "center");

      const movementText = movement > 0
        ? "↑ " + movement
        : movement < 0
          ? "↓ " + Math.abs(movement)
          : "=";

      const movementColor = movement > 0
        ? "#4ADE80"
        : movement < 0 ? "#F87171" : "#A9C2BD";

      text(movementText, cellX + rankW / 2,
        y + 49, 15, movementColor, true, "center");
    } else {
      text("—", cellX + rankW / 2, y + 37,
        18, "#A9C2BD", false, "center");
    }
  });

  text(
    "Logo clair = gagné  •  Logo sombre = perdu  •  ✕ = pas de prono",
    margin, height - 19, 14, "#A9C2BD"
  );

  window.recapReady = true;
})().catch(error => {
  window.recapError = String(error);
});
</script>
</body>
</html>`;
}