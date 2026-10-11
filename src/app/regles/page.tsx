"use client";

import { useRouter } from "next/navigation";

export default function ReglesPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[#0B1F1D] text-[#F8F6EF]">
      <div className="mx-auto min-h-screen max-w-md px-5 pb-10">
        <header className="pb-6 pt-8">
          <button type="button" onClick={() => router.push("/")} className="mb-5 text-sm font-semibold text-[#A9C2BD]">
            ← Accueil
          </button>
          <h1 className="text-3xl font-black">RÈGLES</h1>
          <p className="mt-2 text-sm text-[#A9C2BD]">Tout ce qu&apos;il faut savoir pour jouer.</p>
        </header>

        <section className="space-y-4">
          <div className="rounded-3xl bg-[#265550] p-5">
            <p className="text-xs font-bold text-[#A9C2BD]">01 · LE PRINCIPE</p>
            <h2 className="mt-2 text-lg font-black">Pronostique le vainqueur</h2>
            <p className="mt-2 text-sm leading-6 text-[#E2ECE9]">Pour chaque match, choisis l&apos;équipe que tu penses voir gagner.</p>
          </div>

          <div className="rounded-3xl bg-[#265550] p-5">
            <p className="text-xs font-bold text-[#A9C2BD]">02 · CALCUL DES COTES</p>
            <h2 className="mt-2 text-lg font-black">Plus le prono est risqué, plus il rapporte</h2>
            <p className="mt-2 text-sm leading-6 text-[#E2ECE9]">Les 30 équipes sont classées selon leur pourcentage de victoires actuel. Ce classement sert à déterminer la cote de chaque équipe avant un match.</p>

            <div className="mt-4 space-y-3 rounded-2xl bg-[#0B1F1D] p-4">
              <div>
                <p className="font-black">1 · Base : 50 / 50</p>
                <p className="mt-1 text-sm leading-6 text-[#A9C2BD]">Si deux équipes occupent la même position, elles partent sur une base de 50 points chacune.</p>
              </div>
              <div>
                <p className="font-black">2 · Écart au classement</p>
                <p className="mt-1 text-sm leading-6 text-[#A9C2BD]">Chaque place d&apos;écart vaut +/-1 point. La meilleure équipe voit sa cote diminuer, tandis que celle de l&apos;équipe moins bien classée augmente.</p>
              </div>
              <div>
                <p className="font-black">3 · Domicile / extérieur</p>
                <p className="mt-1 text-sm leading-6 text-[#A9C2BD]">L&apos;équipe à domicile reçoit ensuite -5 points sur sa cote et l&apos;équipe à l&apos;extérieur +5 points.</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-[#3F7D76] p-4">
              <p className="text-sm font-black">Exemple</p>
              <p className="mt-2 text-sm leading-6 text-[#F8F6EF]">Une équipe classée 5e affronte une équipe classée 15e. Il y a 10 places d&apos;écart : les cotes de base sont donc 40 / 60.</p>
              <p className="mt-2 text-sm leading-6 text-[#F8F6EF]">Si la 5e joue à domicile, les cotes deviennent 35 / 65.</p>
              <p className="mt-2 text-sm font-bold">Favori : 35 pts · Outsider : 65 pts</p>
            </div>

            <div className="mt-4 rounded-2xl border border-[#3F7D76] p-4">
              <p className="text-sm font-black">Début de saison</p>
              <p className="mt-2 text-sm leading-6 text-[#A9C2BD]">Pendant les 7 premiers jours de la saison, le classement n&apos;est pas encore pris en compte. Tous les matchs partent donc d&apos;une base de 50 / 50.</p>
              <p className="mt-2 text-sm leading-6 text-[#E2ECE9]">L&apos;avantage domicile reste appliqué : 45 points pour l&apos;équipe à domicile et 55 points pour l&apos;équipe à l&apos;extérieur.</p>
            </div>
          </div>

          <div className="rounded-3xl bg-[#265550] p-5">
            <p className="text-xs font-bold text-[#A9C2BD]">03 · GEL DES COTES</p>
            <h2 className="mt-2 text-lg font-black">J-1 à 12h 🇫🇷</h2>
            <p className="mt-2 text-sm leading-6 text-[#E2ECE9]">Les cotes évoluent avec le classement puis sont définitivement figées le matin du match.</p>
            <p className="mt-3 text-sm leading-6 text-[#E2ECE9]">Même si tu as pronostiqué une semaine avant, c&apos;est cette cote définitive qui déterminera tes points.</p>
          </div>

          <div className="rounded-3xl bg-[#265550] p-5">
            <p className="text-xs font-bold text-[#A9C2BD]">04 · CLÔTURE DES PRONOS</p>
            <h2 className="mt-2 text-lg font-black">Jusqu&apos;au dernier moment</h2>
            <p className="mt-2 text-sm leading-6 text-[#E2ECE9]">Pour les matchs commençant après minuit en France, les pronostics ferment à minuit.</p>
            <p className="mt-3 text-sm leading-6 text-[#E2ECE9]">Pour les matchs commençant avant minuit en France, les pronostics ferment à l&apos;heure de début du match.</p>
          </div>

          <div className="rounded-3xl bg-[#265550] p-5">
            <p className="text-xs font-bold text-[#A9C2BD]">05 · LES POINTS</p>
            <h2 className="mt-2 text-lg font-black">Bon prono = la cote en points</h2>
            <p className="mt-2 text-sm leading-6 text-[#E2ECE9]">Si ton équipe gagne, tu remportes le nombre de points indiqué par sa cote définitive.</p>
            <p className="mt-3 text-sm leading-6 text-[#E2ECE9]">Si ton équipe perd, tu marques 0 point.</p>
          </div>

          <div className="rounded-3xl bg-[#265550] p-5">
            <p className="text-xs font-bold text-[#A9C2BD]">06 · PICKS DES AUTRES</p>
            <h2 className="mt-2 text-lg font-black">Pas de copiage 👀</h2>
            <p className="mt-2 text-sm leading-6 text-[#E2ECE9]">Les choix des autres joueurs restent cachés tant que les pronostics sont ouverts.</p>
            <p className="mt-3 text-sm leading-6 text-[#E2ECE9]">Après la clôture, tout le monde peut voir qui avait choisi chaque équipe.</p>
          </div>

          <div className="rounded-3xl bg-[#265550] p-5">
            <p className="text-xs font-bold text-[#A9C2BD]">07 · PERFECT NIGHT</p>
            <h2 className="mt-2 text-lg font-black">La soirée parfaite 🔥</h2>
            <p className="mt-2 text-sm leading-6 text-[#E2ECE9]">Une Perfect Night est obtenue lorsque tu pronostiques tous les matchs d&apos;une journée correctement.</p>
            <p className="mt-3 text-sm leading-6 text-[#E2ECE9]">Ton profil conserve aussi ton record du plus grand nombre de matchs réussis lors d&apos;une Perfect Night.</p>
          </div>

          <div className="rounded-3xl bg-[#265550] p-5">
            <p className="text-xs font-bold text-[#A9C2BD]">08 · CLASSEMENT</p>
            <h2 className="mt-2 text-lg font-black">Celui qui marque le plus gagne 🏆</h2>
            <p className="mt-2 text-sm leading-6 text-[#E2ECE9]">Le classement général est basé sur le total de points accumulés pendant la saison.</p>
            <p className="mt-3 text-sm leading-6 text-[#E2ECE9]">Tu peux aussi consulter les classements de la semaine et du mois pour voir qui domine sur une période plus courte.</p>
            <p className="mt-3 text-sm leading-6 text-[#E2ECE9]">Le joueur de la semaine met à l&apos;honneur celui qui a marqué le plus de points la semaine précédente. Les flèches indiquent les changements de position et les séries 🔥 récompensent les bons pronostics consécutifs.</p>
            <p className="mt-3 text-sm leading-6 text-[#A9C2BD]">Le pourcentage de bons pronostics est affiché à titre informatif, mais ne départage pas les joueurs au classement.</p>
          </div>

          <button type="button" onClick={() => router.push("/")} className="w-full rounded-2xl bg-[#3F7D76] px-4 py-4 font-black text-[#F8F6EF] transition-colors hover:bg-[#4A8B83]">
            Retour à l&apos;accueil
          </button>
        </section>
      </div>
    </main>
  );
}
