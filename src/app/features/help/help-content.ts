import { Role } from '../../core/models/user.model';

/** A run of text; `bold` marks the **button and field names** of the guide. Rendered by Angular templates, never as HTML. */
export interface HelpSegment {
  text: string;
  bold?: boolean;
}

export type HelpText = HelpSegment[];

export type HelpBlock =
  | { type: 'paragraph'; text: HelpText }
  | { type: 'steps'; items: HelpText[] }
  | { type: 'bullets'; items: HelpText[] }
  /** Shown with an "Attention :" label. */
  | { type: 'warning'; text: HelpText }
  /** Natural size, so the space is reserved before the lazy image loads. */
  | { type: 'image'; src: string; width: number; height: number; caption: string }
  /** Bullets that depend on the role; resolved into a plain `bullets` block by `sectionsForRole`. */
  | { type: 'role-bullets'; byRole: Partial<Record<Role, HelpText[]>> };

export interface HelpSection {
  id: string;
  title: string;
  roles: Role[];
  /** URL prefixes that open this section (`/invoices` covers `/invoices/:id`, `/invoices/` only the detail pages). */
  routes: string[];
  blocks: HelpBlock[];
}

/*
 * The in-app guide. Source of truth for the text: .superpowers/sdd/2026-10-31-aide/contenu-aide.md.
 * Order matters: the first section is the fallback, and on equal route prefixes the first one wins.
 * To change the guide, edit a section here; images live in public/images/aide/.
 */
export const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'demarrer',
    title: 'Pour commencer',
    roles: ['ADMIN', 'MANAGER', 'SELLER', 'CASHIER'],
    routes: ['/dashboard'],
    blocks: [
      { type: 'paragraph', text: [{ text: 'Le menu de gauche ne montre que les écrans de votre rôle. Le tableau de bord résume la journée de l\'agence.' }] },
      { type: 'bullets', items: [
        [{ text: 'Ventes du jour', bold: true }, { text: ', ' }, { text: 'Encaissé aujourd\'hui', bold: true }, { text: ', ' }, { text: 'Encours clients', bold: true }, { text: ', ' }, { text: 'Alertes stock', bold: true }, { text: ' : les quatre chiffres du jour.' }],
        [{ text: 'Ce qui attend', bold: true }, { text: ' : brouillons à terminer, livraisons et réceptions en attente.' }],
        [{ text: 'En haut à droite : votre nom, votre rôle et ' }, { text: 'Se déconnecter', bold: true }, { text: '.' }],
      ] },
      { type: 'warning', text: [{ text: 'recharger la page (F5) vous déconnecte.' }] },
      { type: 'image', src: '/images/aide/01-tableau-de-bord.jpg', width: 800, height: 700, caption: 'Le tableau de bord' },
    ],
  },
  {
    id: 'vente',
    title: 'Faire une vente',
    roles: ['ADMIN', 'MANAGER', 'SELLER'],
    routes: ['/invoices', '/new-sale'],
    blocks: [
      { type: 'steps', items: [
        [{ text: 'Factures → + Nouvelle vente', bold: true }, { text: '.' }],
        [{ text: 'Choisir le client, ou cocher ' }, { text: 'Autre (client de passage)', bold: true }, { text: '.' }],
        [{ text: 'Type de document', bold: true }, { text: ' : Facture (seule à réserver le stock), Devis ou Proforma (n\'engagent rien).' }],
        [{ text: 'Cocher ' }, { text: 'Vente à crédit', bold: true }, { text: ' si le client a un plafond de crédit.' }],
        [{ text: 'Pour chaque article : article, ' }, { text: 'conditionnement', bold: true }, { text: ', quantité, remise (%), puis ' }, { text: 'Ajouter la ligne', bold: true }, { text: '.' }],
        [{ text: 'Saisir le ' }, { text: 'Transport', bold: true }, { text: ' si besoin, puis ' }, { text: 'Créer le document', bold: true }, { text: ' ou ' }, { text: 'Créer, valider et encaisser', bold: true }, { text: '.' }],
      ] },
      { type: 'warning', text: [{ text: 'vérifiez toujours le conditionnement (sac, kg, pot…) avant la quantité.' }] },
      { type: 'image', src: '/images/aide/demo-d38-vente-ligne.jpg', width: 800, height: 579, caption: 'Une ligne : 5 sacs au tarif Chantier (5 200 F)' },
      { type: 'image', src: '/images/aide/demo-d39-vente-totaux.jpg', width: 800, height: 579, caption: 'Les totaux avec le transport, et les boutons' },
      { type: 'bullets', items: [
        [{ text: 'Valider', bold: true }, { text: ' fige le document ; une facture réserve alors le stock.' }],
        [{ text: 'Annuler une facture (gérant, patron) n\'est possible que si rien n\'est payé ni livré.' }],
      ] },
    ],
  },
  {
    id: 'encaisser',
    title: 'Encaisser un règlement',
    roles: ['ADMIN', 'MANAGER', 'SELLER', 'CASHIER'],
    routes: ['/payments', '/invoices'],
    blocks: [
      { type: 'steps', items: [
        [{ text: 'Bouton ' }, { text: 'Encaisser', bold: true }, { text: ' sur une facture validée qui a un reste à payer.' }],
        [{ text: 'Mode de paiement', bold: true }, { text: ' : Espèces, Mobile money, Virement, Chèque, Carte.' }],
        [{ text: 'Montant encaissé', bold: true }, { text: ' (paiement partiel accepté) et référence (obligatoire sauf espèces).' }],
        [{ text: 'Encaisser', bold: true }, { text: '.' }],
      ] },
      { type: 'bullets', items: [
        [{ text: 'Si aucune journée de caisse n\'est ouverte : une fenêtre propose de l\'ouvrir avec le fond de caisse (reste de la dernière clôture) ; corriger si besoin, puis ' }, { text: 'Ouvrir et encaisser', bold: true }, { text: '.' }],
        [{ text: 'Si la journée est ouverte depuis plus de 24 h : il faut ' }, { text: 'Confirmer', bold: true }, { text: ' chaque encaissement, et penser à clôturer.' }],
      ] },
      { type: 'image', src: '/images/aide/demo-d43-encaisser.jpg', width: 800, height: 579, caption: 'Le volet Encaisser : 32 680 F en espèces' },
    ],
  },
  {
    id: 'livrer',
    title: 'Livrer une facture',
    roles: ['ADMIN', 'MANAGER', 'SELLER'],
    routes: ['/deliveries', '/invoices/'],
    blocks: [
      { type: 'steps', items: [
        [{ text: 'Ouvrir la facture validée, section ' }, { text: 'Livraisons', bold: true }, { text: ', bouton ' }, { text: 'Livrer', bold: true }, { text: '.' }],
        [{ text: 'Vérifier les quantités ' }, { text: 'À livrer', bold: true }, { text: ' (mettre moins pour une livraison partielle).' }],
        [{ text: 'Livrer et sortir du stock', bold: true }, { text: ' : la marchandise sort immédiatement.' }],
      ] },
      { type: 'warning', text: [{ text: 'pas de confirmation. Une erreur se corrige en annulant le bon (gérant, patron).' }] },
      { type: 'image', src: '/images/aide/demo-d42-facture-validee.jpg', width: 800, height: 579, caption: 'Une facture validée : boutons Livrer et Encaisser' },
      { type: 'image', src: '/images/aide/demo-d45-livrer.jpg', width: 800, height: 579, caption: 'Le volet Nouveau bon de livraison' },
    ],
  },
  {
    id: 'clients',
    title: 'Clients et créances',
    roles: ['ADMIN', 'MANAGER', 'SELLER', 'CASHIER'],
    routes: ['/customers'],
    blocks: [
      { type: 'bullets', items: [
        [{ text: 'La fiche d\'un client montre son ' }, { text: 'encours', bold: true }, { text: ' et le crédit encore disponible.' }],
        [{ text: 'Créer un client (vendeur, gérant, patron) : ' }, { text: '+ Nouveau client', bold: true }, { text: ', Type, Nom, Grille tarifaire, ' }, { text: 'Plafond de crédit', bold: true }, { text: ' (0 = comptant), Délai de règlement, ' }, { text: 'Enregistrer', bold: true }, { text: '.' }],
      ] },
      { type: 'image', src: '/images/aide/demo-d35-client-form.jpg', width: 800, height: 579, caption: 'Un client entreprise avec grille et plafond de crédit' },
    ],
  },
  {
    id: 'caisse',
    title: 'Ouvrir et clôturer la journée de caisse',
    roles: ['ADMIN', 'MANAGER', 'CASHIER'],
    routes: ['/day-closing'],
    blocks: [
      { type: 'steps', items: [
        [{ text: 'Le matin : ' }, { text: 'Ouvrir la caisse', bold: true }, { text: ' et saisir le ' }, { text: 'Fond de caisse', bold: true }, { text: ' compté dans le tiroir.' }],
        [{ text: 'La carte ' }, { text: 'Caisse ouverte', bold: true }, { text: ' montre le fond et le ' }, { text: 'Théorique actuel', bold: true }, { text: ' (fond + espèces encaissées).' }],
        [{ text: 'Le soir : ' }, { text: 'Clôturer la journée', bold: true }, { text: ', saisir le ' }, { text: 'Montant compté en caisse', bold: true }, { text: '. L\'écart doit être zéro ; sinon l\'expliquer en commentaire.' }],
      ] },
      { type: 'bullets', items: [
        [{ text: 'Seules les espèces comptent dans le théorique.' }],
      ] },
      { type: 'image', src: '/images/aide/demo-d33-ouvrir-caisse.jpg', width: 800, height: 579, caption: 'Ouvrir la caisse avec le fond de caisse' },
      { type: 'image', src: '/images/aide/demo-d49-cloturer-ecart-estime.jpg', width: 800, height: 579, caption: 'Clôturer : l\'écart estimé suit le montant tapé' },
      { type: 'image', src: '/images/aide/demo-d50-cloture-faite.jpg', width: 800, height: 579, caption: 'La journée clôturée, écart 0' },
    ],
  },
  {
    id: 'stock',
    title: 'Consulter le stock et les mouvements',
    roles: ['ADMIN', 'MANAGER', 'SELLER', 'CASHIER'],
    routes: ['/stock', '/stock-movements'],
    blocks: [
      { type: 'bullets', items: [
        [{ text: 'Physique', bold: true }, { text: ' : dans le magasin ; ' }, { text: 'Réservé', bold: true }, { text: ' : facturé non livré ; ' }, { text: 'Disponible', bold: true }, { text: ' : ce qu\'on peut vendre.' }],
        [{ text: 'Sous le seuil', bold: true }, { text: ' : article à racheter.' }],
        [{ text: 'Mouvements', bold: true }, { text: ' : journal de toutes les entrées et sorties, filtrable par dates et article.' }],
      ] },
      { type: 'image', src: '/images/aide/demo-d26-stock-apres-inventaire.jpg', width: 800, height: 579, caption: 'L\'état du stock de l\'agence' },
      { type: 'image', src: '/images/aide/demo-d51-mouvements.jpg', width: 800, height: 579, caption: 'Les mouvements : réception, inventaire, transfert, vente' },
    ],
  },
  {
    id: 'inventaire',
    title: 'Saisir un inventaire',
    roles: ['ADMIN', 'MANAGER'],
    routes: ['/stock', '/stock-movements'],
    blocks: [
      { type: 'steps', items: [
        [{ text: 'État du stock → + Saisir un inventaire', bold: true }, { text: ', choisir l\'article.' }],
        [{ text: 'Saisir la ' }, { text: 'quantité comptée', bold: true }, { text: ' au total (en unité de stock). L\'écart s\'affiche.' }],
        [{ text: 'Si l\'écart est positif : choisir le ' }, { text: 'conditionnement', bold: true }, { text: ' et le ' }, { text: 'coût d\'achat', bold: true }, { text: ' de ce conditionnement.' }],
        [{ text: 'Motif', bold: true }, { text: ', puis ' }, { text: 'Enregistrer l\'inventaire', bold: true }, { text: '.' }],
      ] },
      { type: 'warning', text: [{ text: 'n\'utilisez jamais l\'inventaire pour entrer un achat ; il compte comme un gain dans la marge.' }] },
      { type: 'image', src: '/images/aide/demo-d25-inventaire.jpg', width: 800, height: 579, caption: 'Un inventaire : 10 kg perdus (sac percé)' },
      { type: 'bullets', items: [
        [{ text: 'Un mouvement erroné s\'annule depuis ' }, { text: 'Mouvements → Annuler ce mouvement', bold: true }, { text: '.' }],
      ] },
    ],
  },
  {
    id: 'transferts',
    title: 'Transférer entre agences',
    roles: ['ADMIN', 'MANAGER'],
    routes: ['/transfers'],
    blocks: [
      { type: 'steps', items: [
        [{ text: '+ Nouveau transfert', bold: true }, { text: ', choisir l\'agence destinataire, ' }, { text: 'Créer le transfert', bold: true }, { text: '.' }],
        [{ text: 'Ajouter les articles et quantités, puis ' }, { text: 'Envoyer', bold: true }, { text: ' : la marchandise sort du stock.' }],
        [{ text: 'L\'agence destinataire ouvre le transfert et clique ' }, { text: 'Réceptionner', bold: true }, { text: ', en réduisant ce qui manque.' }],
      ] },
      { type: 'image', src: '/images/aide/demo-d27-transfert-form.jpg', width: 800, height: 579, caption: 'Le formulaire Nouveau transfert' },
      { type: 'image', src: '/images/aide/demo-d29-envoyer-transfert.jpg', width: 800, height: 579, caption: 'Envoyer : la marchandise sort du stock' },
      { type: 'image', src: '/images/aide/demo-d52-receptionner-transfert.jpg', width: 800, height: 579, caption: 'Réceptionner : 245 kg reçus sur 250' },
    ],
  },
  {
    id: 'referentiel-consulter',
    title: 'Consulter articles et prix',
    roles: ['SELLER', 'CASHIER'],
    routes: ['/articles', '/families', '/packagings', '/units-of-measure', '/pricing'],
    blocks: [
      { type: 'paragraph', text: [{ text: 'Vous pouvez consulter les articles, conditionnements et prix pour renseigner un client, sans pouvoir les modifier.' }] },
      { type: 'image', src: '/images/aide/r03-vendeur-articles.jpg', width: 800, height: 579, caption: 'Les articles en consultation' },
    ],
  },
  {
    id: 'referentiel',
    title: 'Créer articles, conditionnements et prix',
    roles: ['ADMIN', 'MANAGER'],
    routes: ['/articles', '/families', '/packagings', '/units-of-measure', '/pricing'],
    blocks: [
      { type: 'paragraph', text: [{ text: 'Ordre : unités, familles, articles, conditionnements, prix.' }] },
      { type: 'steps', items: [
        [{ text: 'Unités de mesure → + Nouvelle unité', bold: true }, { text: ' : Code (SAC) et Libellé (Sac).' }],
        [{ text: 'Familles → + Nouvelle famille', bold: true }, { text: ' : Libellé, Ordre, Famille parente.' }],
        [{ text: 'Articles → + Nouvel article', bold: true }, { text: ' : Désignation, Famille, ' }, { text: 'Unité de stock', bold: true }, { text: ' (la plus petite unité de comptage), Seuil, TVA, Prix de vente détail.' }],
        [{ text: 'Conditionnements', bold: true }, { text: ' : choisir l\'article, ' }, { text: '+ Nouveau conditionnement', bold: true }, { text: ', Unité et ' }, { text: 'Contenance', bold: true }, { text: ' (50 pour un sac de 50 KG), cocher achat/vente par défaut.' }],
        [{ text: 'Tarifs et prix → Prix des articles', bold: true }, { text: ' : article, conditionnement, ' }, { text: '+ Nouveau prix', bold: true }, { text: ' (grille, prix HT, date de début).' }],
      ] },
      { type: 'warning', text: [{ text: 'un prix ne se modifie plus une fois en vigueur ; créez un nouveau prix daté.' }] },
      { type: 'image', src: '/images/aide/demo-d04-unite-form.jpg', width: 800, height: 579, caption: 'Le formulaire Nouvelle unité' },
      { type: 'image', src: '/images/aide/demo-d07-article-form.jpg', width: 800, height: 579, caption: 'Le formulaire Nouvel article' },
      { type: 'image', src: '/images/aide/demo-d10-conditionnement-form.jpg', width: 800, height: 579, caption: 'Un sac de 50 kg, par défaut à l\'achat et à la vente' },
      { type: 'image', src: '/images/aide/demo-d13-prix-form.jpg', width: 800, height: 579, caption: 'Le prix du sac sur une grille' },
    ],
  },
  {
    id: 'achats',
    title: 'Commander et réceptionner',
    roles: ['ADMIN', 'MANAGER'],
    routes: ['/purchase-orders', '/receptions', '/suppliers'],
    blocks: [
      { type: 'steps', items: [
        [{ text: 'Fournisseurs → + Nouveau fournisseur', bold: true }, { text: ' si besoin.' }],
        [{ text: 'Commandes fournisseurs → + Nouvelle commande', bold: true }, { text: ' : fournisseur, livraison prévue, ' }, { text: 'Créer la commande', bold: true }, { text: '.' }],
        [{ text: 'Ajouter les lignes : article, ' }, { text: 'conditionnement', bold: true }, { text: ', quantité, ' }, { text: 'prix d\'achat', bold: true }, { text: ', puis ' }, { text: 'Confirmer', bold: true }, { text: '.' }],
        [{ text: 'À l\'arrivée : ' }, { text: 'Réceptions', bold: true }, { text: ', ouvrir la commande, ' }, { text: 'Réceptionner', bold: true }, { text: ', quantités reçues, ' }, { text: 'numéro et fichier de la facture fournisseur', bold: true }, { text: ' (obligatoires), ' }, { text: 'Réceptionner', bold: true }, { text: '.' }],
      ] },
      { type: 'warning', text: [{ text: 'une réception déjà vendue ne peut plus être annulée ; corrigez par un inventaire.' }] },
      { type: 'image', src: '/images/aide/demo-d17-commande-form.jpg', width: 800, height: 579, caption: 'Le formulaire Nouvelle commande' },
      { type: 'image', src: '/images/aide/demo-d19-commande-brouillon.jpg', width: 800, height: 579, caption: 'Une commande en brouillon : 20 sacs, TVA 18 %' },
      { type: 'image', src: '/images/aide/demo-d22-reception-form.jpg', width: 800, height: 579, caption: 'Réceptionner avec le numéro et le fichier de la facture' },
    ],
  },
  {
    id: 'depenses',
    title: 'Saisir une charge',
    roles: ['ADMIN', 'MANAGER'],
    routes: ['/expenses'],
    blocks: [
      { type: 'steps', items: [
        [{ text: 'Analyse → Dépenses → + Nouvelle charge', bold: true }, { text: '.' }],
        [{ text: 'Date, ' }, { text: 'Catégorie', bold: true }, { text: ', Agence, Libellé, ' }, { text: 'Montant', bold: true }, { text: ', note, puis ' }, { text: 'Enregistrer', bold: true }, { text: '.' }],
      ] },
      { type: 'bullets', items: [
        [{ text: 'Le gérant saisit pour son agence et ne modifie que ses propres charges. Le patron peut saisir une charge ' }, { text: 'Commune', bold: true }, { text: ' et gérer les ' }, { text: 'Catégories', bold: true }, { text: '.' }],
      ] },
      { type: 'image', src: '/images/aide/demo-d31-charge-form.jpg', width: 800, height: 579, caption: 'Le formulaire Nouvelle charge' },
    ],
  },
  {
    id: 'reprise',
    title: 'Reprise des coûts',
    roles: ['ADMIN'],
    routes: ['/initial-costs'],
    blocks: [
      { type: 'steps', items: [
        [{ text: 'Démarrer le suivi des coûts', bold: true }, { text: ' (définitif).' }],
        [{ text: 'Pour chaque article : choisir le ' }, { text: 'conditionnement', bold: true }, { text: ' et taper le prix payé pour ce conditionnement. L\'écran confirme la conversion.' }],
        [{ text: 'Le filtre ' }, { text: 'Sans coût', bold: true }, { text: ' montre ce qui reste à remplir.' }],
      ] },
      { type: 'image', src: '/images/aide/13-reprise-couts.jpg', width: 800, height: 700, caption: 'La reprise des coûts' },
    ],
  },
  {
    id: 'rentabilite',
    title: 'Lire la rentabilité',
    roles: ['ADMIN'],
    routes: ['/reports'],
    blocks: [
      { type: 'steps', items: [
        [{ text: 'Choisir la période (' }, { text: 'Aujourd\'hui', bold: true }, { text: ', ' }, { text: 'Ce mois', bold: true }, { text: '…) et l\'agence.' }],
        [{ text: 'Lire le ' }, { text: 'BÉNÉFICE NET', bold: true }, { text: ' en bas ; déplier une famille pour voir chaque article.' }],
        [{ text: 'Exporter', bold: true }, { text: ' en PDF ou Excel.' }],
      ] },
      { type: 'bullets', items: [
        [{ text: 'Bandeau « articles sans coût » : terminer la Reprise des coûts.' }],
        [{ text: '« Marge calculée à partir du … » : la marge ne couvre qu\'une partie de la période, les dépenses toute la période.' }],
      ] },
      { type: 'image', src: '/images/aide/demo-d59-rentabilite-agence.jpg', width: 800, height: 579, caption: 'La rentabilité d\'une agence sur le mois' },
      { type: 'image', src: '/images/aide/demo-d60-rentabilite-famille-depliee.jpg', width: 800, height: 579, caption: 'Une famille dépliée : prix de vente, prix d\'achat, marge' },
      { type: 'image', src: '/images/aide/demo-d61-rentabilite-depenses-benefice.jpg', width: 800, height: 579, caption: 'Les dépenses et le bénéfice net' },
    ],
  },
  {
    id: 'administration',
    title: 'Agences et utilisateurs',
    roles: ['ADMIN'],
    routes: ['/agencies', '/users'],
    blocks: [
      { type: 'bullets', items: [
        [{ text: 'Utilisateurs → + Nouvel utilisateur', bold: true }, { text: ' : nom, identifiant, mot de passe provisoire, ' }, { text: 'Rôle', bold: true }, { text: ', ' }, { text: 'Agence', bold: true }, { text: ', ' }, { text: 'Remise maximale (%)', bold: true }, { text: '.' }],
        [{ text: 'Le rôle décide des écrans visibles. Désactivez un compte plutôt que de le supprimer.' }],
      ] },
      { type: 'image', src: '/images/aide/15-utilisateurs.jpg', width: 800, height: 700, caption: 'La liste des utilisateurs' },
    ],
  },
  {
    id: 'limites',
    title: 'Ce que votre rôle ne permet pas',
    roles: ['SELLER', 'CASHIER', 'MANAGER'],
    routes: [],
    blocks: [
      {
        type: 'role-bullets',
        byRole: {
          SELLER: [
            [{ text: 'Annuler une facture, un règlement ou une livraison : demandez au gérant.' }],
            [{ text: 'Accorder plus que votre remise maximale.' }],
            [{ text: 'Ouvrir ou clôturer la caisse.' }],
          ],
          CASHIER: [
            [{ text: 'Créer une vente ou livrer.' }],
            [{ text: 'Annuler un règlement : demandez au gérant.' }],
          ],
          MANAGER: [
            [{ text: 'Voir la rentabilité ou la reprise des coûts.' }],
            [{ text: 'Agir sur une autre agence (consultation du stock seulement).' }],
            [{ text: 'Créer des utilisateurs, des agences ou des catégories de charges.' }],
          ],
        },
      },
    ],
  },
];
