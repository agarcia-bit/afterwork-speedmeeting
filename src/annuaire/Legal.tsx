import { frDate } from './api'

interface Props {
  title: string
  eventDate: string
  controller: string
  contactEmail: string | null
  retentionUntil: string
}

/**
 * Information des personnes (RGPD, art. 13). Toute modification de ce texte
 * doit s'accompagner d'un changement de CONSENT_VERSION dans config.ts.
 */
export default function Legal({ title, eventDate, controller, contactEmail, retentionUntil }: Props) {
  return (
    <details className="legal">
      <summary>Vos données et vos droits</summary>
      <dl>
        <dt>Qui collecte vos données ?</dt>
        <dd>{controller}, organisateur de l'{title}.</dd>

        <dt>Pourquoi ?</dt>
        <dd>
          Pour constituer l'annuaire des participants de la soirée du {frDate(eventDate)} et vous
          l'envoyer par email, afin de faciliter les échanges entre participants après l'événement.
        </dd>

        <dt>Sur quelle base ?</dt>
        <dd>
          Votre consentement (article 6.1.a du RGPD), que vous pouvez retirer à tout moment, aussi
          simplement que vous l'avez donné.
        </dd>

        <dt>Qui y a accès ?</dt>
        <dd>
          Les organisateurs, et les participants de la soirée qui ont eux-mêmes rempli ce
          formulaire et reçoivent l'annuaire. Seules les informations que vous avez accepté de
          partager y figurent. Votre adresse mail sert dans tous les cas à vous envoyer l'annuaire,
          mais n'y apparaît que si vous l'avez accepté.
        </dd>

        <dt>Combien de temps ?</dt>
        <dd>
          Jusqu'au {frDate(retentionUntil)}, soit un an après la soirée. Vos données sont alors
          supprimées automatiquement.
        </dd>

        <dt>Où sont-elles stockées ?</dt>
        <dd>Chez Supabase, sur des serveurs situés à Paris (Union européenne).</dd>

        <dt>Vos droits</dt>
        <dd>
          Vous pouvez consulter, corriger ou supprimer vos informations, et retirer votre
          consentement, à tout moment grâce au lien personnel remis après votre inscription
          {contactEmail ? (
            <>
              , ou en écrivant à <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
            </>
          ) : null}
          . Vous disposez aussi des droits de limitation, d'opposition et de portabilité, et pouvez
          adresser une réclamation à la CNIL (
          <a href="https://www.cnil.fr" target="_blank" rel="noreferrer">
            cnil.fr
          </a>
          ).
        </dd>

        <dt>Bon à savoir</dt>
        <dd>
          Si vous retirez votre consentement après l'envoi de l'annuaire, vous n'apparaîtrez plus
          dans les envois suivants, mais les exemplaires déjà reçus ne peuvent pas être rappelés.
        </dd>
      </dl>
    </details>
  )
}
