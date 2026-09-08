// Enregistrement d'un fichier généré par la page.
// Dans un Artifact publié, le navigateur bloque les téléchargements lancés par
// la page : on passe alors par la capacité « downloads », qui demande son accord
// au lecteur. Partout ailleurs (appli locale), un lien de téléchargement suffit.

interface DownloadsApi {
  save(request: { filename: string; data: Blob }): Promise<{ status: string }>
}

interface ClaudeHost {
  use?: (name: string) => Promise<DownloadsApi | null>
}

export type SaveOutcome = 'saved' | 'declined' | 'unavailable'

let cached: DownloadsApi | null | undefined

async function hostDownloads(): Promise<DownloadsApi | null> {
  if (cached !== undefined) return cached
  const host = (window as unknown as { claude?: ClaudeHost }).claude
  cached = host?.use ? await host.use('downloads').catch(() => null) : null
  return cached
}

export async function saveFile(filename: string, blob: Blob): Promise<SaveOutcome> {
  const downloads = await hostDownloads()
  if (!downloads && (window as unknown as { claude?: ClaudeHost }).claude?.use) {
    // Page hébergée par claude.ai sans la capacité : un lien de téléchargement
    // y serait inerte, autant le dire plutôt que d'annoncer un faux succès.
    return 'unavailable'
  }
  if (downloads) {
    try {
      await downloads.save({ filename, data: blob })
      return 'saved'
    } catch (err) {
      const code = (err as { code?: string })?.code
      return code === 'declined' || code === 'rate_limited' ? 'declined' : 'unavailable'
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return 'saved'
}
