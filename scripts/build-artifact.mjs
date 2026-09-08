// Transforme dist/index.html (document complet produit par Vite) en dist/artifact.html,
// un fragment publiable tel quel comme Artifact : le squelette <html>/<head>/<body>
// est ajouté au moment de la publication, on ne garde donc que le contenu.
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const html = await readFile(join(root, 'dist/index.html'), 'utf8')

const head = html.match(/<head>([\s\S]*?)<\/head>/i)?.[1] ?? ''
const body = html.match(/<body>([\s\S]*?)<\/body>/i)?.[1] ?? ''

// On retire du head ce que l'hôte fournit déjà (charset, viewport) et on garde
// le titre, les polices et les styles inlinés.
const keptHead = head
  .replace(/<meta[^>]*charset[^>]*>/gi, '')
  .replace(/<meta[^>]*name="viewport"[^>]*>/gi, '')
  .trim()

// Le <title> doit apparaître dans les 8 premiers Ko : on le sort en tête.
const title = keptHead.match(/<title>[\s\S]*?<\/title>/i)?.[0] ?? ''
const rest = keptHead.replace(/<title>[\s\S]*?<\/title>/i, '').trim()

const out = [title, rest, body.trim()].filter(Boolean).join('\n')
await writeFile(join(root, 'dist/artifact.html'), out + '\n')
console.log(`dist/artifact.html — ${(out.length / 1024).toFixed(0)} Ko`)
