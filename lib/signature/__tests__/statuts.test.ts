import { test, describe } from "node:test"
import assert from "node:assert/strict"
import {
  statutDeduit, sonTour, nomDocumentSigne, estClose,
  libelleRole, METHODES_AUTH_V1, STATUTS_DEMANDE,
  type DestinataireEtat,
} from "@/lib/signature/statuts"

/**
 * Ce que ces épreuves cherchent à prendre en défaut.
 *
 * UN REFUS QUI PASSE INAPERÇU. Si une demande dont un signataire a refusé
 * continuait d'être « partiellement signée », le CRM réclamerait les
 * signatures suivantes — et ferait signer des gens sur un document mort.
 *
 * UN TOUR MAL CALCULÉ. En mode séquentiel, laisser le second signer avant le
 * premier produit un contrat signé dans le désordre : contestable, et
 * impossible à corriger après coup.
 */

const d = (rank: number, status: string): DestinataireEtat => ({ rank, status })

describe("statutDeduit", () => {
  test("personne n'a rien fait : la demande reste envoyée", () => {
    assert.equal(statutDeduit([d(1, "pending"), d(2, "pending")], "sent"), "sent")
  })

  test("une consultation se voit", () => {
    assert.equal(statutDeduit([d(1, "viewed"), d(2, "pending")], "sent"), "viewed")
  })

  test("une seule signature sur deux : partiellement signée", () => {
    assert.equal(statutDeduit([d(1, "signed"), d(2, "pending")], "sent"), "partially_signed")
  })

  test("toutes les signatures : complétée", () => {
    assert.equal(statutDeduit([d(1, "signed"), d(2, "signed")], "partially_signed"), "completed")
  })

  test("UN SEUL REFUS arrête tout, même si un autre a déjà signé", () => {
    // Un contrat que l'une des parties refuse n'est pas « partiellement
    // signé » : il n'existe pas. Continuer à réclamer les signatures
    // suivantes ferait signer des gens sur un document mort.
    assert.equal(statutDeduit([d(1, "signed"), d(2, "declined")], "partially_signed"), "declined")
  })

  test("le refus l'emporte même sur une demande complète", () => {
    assert.equal(statutDeduit([d(1, "declined"), d(2, "signed")], "sent"), "declined")
  })

  test("une demande ANNULÉE ne se recalcule pas", () => {
    // Le cabinet a tranché ; la déduction ne doit pas rouvrir sa décision.
    assert.equal(statutDeduit([d(1, "signed"), d(2, "signed")], "cancelled"), "cancelled")
  })

  test("une demande EXPIRÉE non plus", () => {
    assert.equal(statutDeduit([d(1, "signed")], "expired"), "expired")
  })

  test("sans destinataire, rien n'est déduit", () => {
    // Une demande sans signataire est un défaut de préparation, pas un état
    // qu'on invente.
    assert.equal(statutDeduit([], "draft"), "draft")
  })

  test("un brouillon ne devient pas « envoyé » par déduction", () => {
    assert.equal(statutDeduit([d(1, "pending")], "draft"), "draft")
    assert.equal(statutDeduit([d(1, "pending")], "ready"), "ready")
  })
})

describe("sonTour", () => {
  const deux = [d(1, "pending"), d(2, "pending")]

  test("en séquentiel, le premier passe avant le second", () => {
    assert.equal(sonTour(deux, 1, "sequential"), true)
    assert.equal(sonTour(deux, 2, "sequential"), false)
  })

  test("le second attend que le premier ait signé", () => {
    const apres = [d(1, "signed"), d(2, "pending")]
    assert.equal(sonTour(apres, 2, "sequential"), true)
  })

  test("un REFUS du premier libère quand même le rang suivant", () => {
    // La règle de tour et la règle d'arrêt sont deux choses distinctes : c'est
    // `statutDeduit` qui arrête la demande, pas le calcul du tour. Les
    // confondre ferait dépendre l'arrêt d'un détail d'affichage.
    const refuse = [d(1, "declined"), d(2, "pending")]
    assert.equal(sonTour(refuse, 2, "sequential"), true)
  })

  test("en parallèle, tout le monde peut signer tout de suite", () => {
    assert.equal(sonTour(deux, 1, "parallel"), true)
    assert.equal(sonTour(deux, 2, "parallel"), true)
  })

  test("une consultation ne suffit pas à libérer le suivant", () => {
    const vu = [d(1, "viewed"), d(2, "pending")]
    assert.equal(sonTour(vu, 2, "sequential"), false)
  })
})

describe("nomDocumentSigne", () => {
  test("il nomme le document et son signataire", () => {
    assert.equal(
      nomDocumentSigne("Contrat de services", "Jean Tremblay"),
      "Contrat_de_services_SIGNE_Jean_Tremblay.pdf"
    )
  })

  test("les caractères qui coupent un chemin sont retirés", () => {
    // « ../ » dans un nom de fichier a déjà servi à viser le dossier d'un autre.
    const n = nomDocumentSigne("Contrat / 2026", "A:B*C")
    assert.ok(!n.includes("/"))
    assert.ok(!n.includes(":"))
    assert.ok(!n.includes("*"))
  })

  test("les accents sont CONSERVÉS", () => {
    // Le nom s'affiche, il n'entre pas dans un chemin de stockage : le
    // translittérer donnerait « Traore » à une cliente nommée Traoré.
    assert.match(nomDocumentSigne("Entente", "Fatou Traoré"), /Traoré/)
  })

  test("sans signataire, le nom reste utilisable", () => {
    assert.equal(nomDocumentSigne("Entente", ""), "Entente_SIGNE.pdf")
  })
})

describe("le vocabulaire", () => {
  test("les neuf statuts du cahier des charges sont là", () => {
    assert.equal(STATUTS_DEMANDE.length, 9)
    for (const s of ["draft", "ready", "sent", "viewed", "partially_signed",
                     "completed", "declined", "cancelled", "expired"]) {
      assert.ok(STATUTS_DEMANDE.includes(s as never), s)
    }
  })

  test("estClose distingue ce qui vit de ce qui est fini", () => {
    assert.equal(estClose("completed"), true)
    assert.equal(estClose("declined"), true)
    assert.equal(estClose("sent"), false)
    assert.equal(estClose("partially_signed"), false)
  })

  test("les rôles reprennent le vocabulaire des parties à une entente", () => {
    // Une seconde liste aurait produit « consultant » ici et « rcic » là.
    assert.equal(libelleRole("consultant"), "Consultant")
    assert.equal(libelleRole("co_applicant"), "Codemandeur")
    assert.equal(libelleRole("inconnu"), "inconnu")
  })

  test("V1 n'offre PAS les codes à usage unique", () => {
    // Ils sont portés par la base pour s'ajouter sans migration, mais les
    // offrir à l'écran avant de les avoir construits promettrait une sécurité
    // qui n'existe pas.
    assert.deepEqual(METHODES_AUTH_V1, ["link_only", "email_confirm"])
    assert.ok(!METHODES_AUTH_V1.includes("email_otp" as never))
  })
})
