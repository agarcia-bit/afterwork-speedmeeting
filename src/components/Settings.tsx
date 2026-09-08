import type { TableMode } from '../solver'

interface Props {
  tableMode: TableMode
  tableCount: number
  perTable: number
  /** Format effectif de la salle, calculé par l'appli. */
  sizes: number[]
  rotationCount: number
  rotationMinutes: number
  presentCount: number
  lockedCount: number
  onChange: (patch: {
    tableMode?: TableMode
    tableCount?: number
    perTable?: number
    rotationCount?: number
    rotationMinutes?: number
  }) => void
  onGenerate: () => void
  onReset: () => void
  busy: boolean
}

function Stepper({
  value,
  min,
  max,
  onChange,
  label,
  suffix,
  derived = false,
}: {
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  label: string
  suffix?: string
  /** Valeur calculée à partir de l'autre réglage : la modifier reprend la main. */
  derived?: boolean
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)))
  return (
    <div className={`field${derived ? ' derived' : ''}`}>
      <label>
        {label}
        {suffix ? ` (${suffix})` : ''}
        {derived && <em>auto</em>}
      </label>
      <div className="stepper">
        <button type="button" onClick={() => set(value - 1)} aria-label={`${label} moins`}>
          −
        </button>
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => set(Number(e.target.value))}
          aria-label={label}
        />
        <button type="button" onClick={() => set(value + 1)} aria-label={`${label} plus`}>
          +
        </button>
      </div>
    </div>
  )
}

export default function Settings({
  tableMode,
  tableCount,
  perTable,
  sizes,
  rotationCount,
  rotationMinutes,
  presentCount,
  lockedCount,
  onChange,
  onGenerate,
  onReset,
  busy,
}: Props) {
  const biggest = sizes.length > 0 ? Math.max(...sizes) : 0
  // Chacun des deux réglages est saisissable : celui qu'on modifie pilote l'autre.
  // Le réglage piloté affiche la consigne saisie, l'autre le résultat calculé.
  const shownTables = tableMode === 'count' ? tableCount : sizes.length || tableCount
  const shownPerTable = tableMode === 'perTable' ? perTable : biggest || perTable

  // Au-delà de ce nombre de tours, tout le monde a rencontré tout le monde :
  // des re-rencontres deviennent mathématiquement inévitables.
  const maxCleanRotations = biggest > 1 ? Math.floor((presentCount - 1) / (biggest - 1)) : 0

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">Réglages</h2>
        <span className="card-hint">modifiables jusqu'au dernier moment</span>
      </div>

      <div className="fields">
        <Stepper
          label="Tables"
          value={shownTables}
          min={1}
          max={40}
          derived={tableMode === 'perTable'}
          onChange={(v) => onChange({ tableMode: 'count', tableCount: v })}
        />
        <Stepper
          label="Par table"
          value={shownPerTable}
          min={2}
          max={12}
          derived={tableMode === 'count'}
          onChange={(v) => onChange({ tableMode: 'perTable', perTable: v })}
        />
        <Stepper
          label="Rotations"
          value={rotationCount}
          min={1}
          max={12}
          onChange={(v) => onChange({ rotationCount: v })}
        />
        <Stepper
          label="Durée"
          suffix="min"
          value={rotationMinutes}
          min={1}
          max={60}
          onChange={(v) => onChange({ rotationMinutes: v })}
        />
      </div>

      <div className="preview">
        {presentCount === 0 ? (
          'Ajoute des participants pour voir la répartition.'
        ) : (
          <>
            <b>{presentCount}</b> présent{presentCount > 1 ? 's' : ''} → <b>{sizes.length}</b> table
            {sizes.length > 1 ? 's' : ''} de {sizes.join(', ')}.
            <br />
            Au-delà de <b>{maxCleanRotations}</b> rotation{maxCleanRotations > 1 ? 's' : ''}, des
            re-rencontres deviennent inévitables.
            {lockedCount > 0 && (
              <>
                <br />
                <b>{lockedCount}</b> rotation{lockedCount > 1 ? 's' : ''} verrouillée
                {lockedCount > 1 ? 's' : ''} — elle{lockedCount > 1 ? 's' : ''} ne bougera
                {lockedCount > 1 ? 'nt' : ''} pas.
              </>
            )}
          </>
        )}
      </div>

      <div className="generate-row">
        <button className="btn btn-primary" onClick={onGenerate} disabled={busy || presentCount < 2}>
          {busy ? 'Calcul…' : lockedCount > 0 ? 'Regénérer les tours restants' : 'Générer les rotations'}
        </button>
        <button className="btn btn-ghost" onClick={onReset} title="Effacer le tirage">
          Effacer
        </button>
      </div>
    </section>
  )
}
