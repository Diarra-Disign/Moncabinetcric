/**
 * Le squelette du tableau de bord.
 *
 * Sans lui, la page restait blanche pendant que le serveur lisait les
 * échéances, les dossiers, les pièces et l'index de recherche — puis tout
 * apparaissait d'un coup. Le brief demande d'éviter « les changements brusques
 * de mise en page pendant le chargement » : ce squelette occupe donc EXACTEMENT
 * la place des blocs qu'il annonce, pour que rien ne saute quand ils arrivent.
 */
function Bloc({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-3xl bg-muted ${className}`} />
}

export default function ChargementTableauDeBord() {
  return (
    <div className="space-y-8 pb-16" aria-busy="true" aria-label="Chargement du tableau de bord">
      <Bloc className="h-24" />
      <Bloc className="h-40" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Bloc key={i} className="h-36" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Bloc className="lg:col-span-2 h-72" />
        <Bloc className="h-72" />
      </div>
      <Bloc className="h-96" />
    </div>
  )
}
