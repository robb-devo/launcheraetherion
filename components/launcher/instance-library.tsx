"use client"

import { useEffect, useState } from "react"
import { FolderOpen, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ModpackInstance, ModrinthProject, ModrinthVersion } from "@/types/aetherion"

export function InstanceLibrary() {
  const [query, setQuery] = useState("")
  const [projects, setProjects] = useState<ModrinthProject[]>([])
  const [versions, setVersions] = useState<ModrinthVersion[]>([])
  const [activeProject, setActiveProject] = useState<ModrinthProject | null>(null)
  const [versionId, setVersionId] = useState("")
  const [installed, setInstalled] = useState<ModpackInstance[]>([])
  const [selectedId, setSelectedId] = useState("aetherion")
  const [mods, setMods] = useState<Array<{ filename: string; enabled: boolean }>>([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState("Search Modrinth, install a pack into its own instance, then choose it on the home screen.")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    refresh().catch(() => undefined)
    return window.aetherion?.instances?.onProgress((progress) => {
      setStatus(progress.message)
    })
  }, [])

  useEffect(() => {
    if (!selectedId || selectedId === "aetherion") {
      setMods([])
      return
    }
    window.aetherion?.instances
      ?.mods(selectedId)
      .then(setMods)
      .catch(() => setMods([]))
  }, [selectedId, installed])

  async function refresh() {
    const registry = await window.aetherion?.instances?.list()
    if (!registry) return
    setInstalled(registry.instances || [])
    setSelectedId(registry.selectedId || "aetherion")
  }

  async function search() {
    if (!window.aetherion?.modrinth) {
      setError("Pack search runs in the desktop launcher.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await window.aetherion.modrinth.search(query)
      setProjects(result.projects || [])
      setActiveProject(null)
      setVersions([])
      setStatus(result.projects?.length ? "Choose a pack, then a version." : "No packs matched that search.")
    } catch (err) {
      setError(readableError(err, "Modrinth search failed."))
    } finally {
      setBusy(false)
    }
  }

  async function openProject(project: ModrinthProject) {
    if (!window.aetherion?.modrinth) return
    setBusy(true)
    setError(null)
    setActiveProject(project)
    try {
      const result = await window.aetherion.modrinth.versions(project.projectId || project.slug)
      const next = result.versions || []
      setVersions(next)
      setVersionId(next[0]?.id || "")
      setStatus(next.length ? `${project.title} · pick a version to install.` : "That project has no installable versions.")
    } catch (err) {
      setError(readableError(err, "Could not load versions."))
    } finally {
      setBusy(false)
    }
  }

  async function install() {
    if (!activeProject || !versionId || !window.aetherion?.instances) return
    setBusy(true)
    setError(null)
    try {
      const instance = await window.aetherion.instances.install({
        projectId: activeProject.projectId,
        versionId,
        slug: activeProject.slug,
        name: activeProject.title,
      })
      await refresh()
      setSelectedId(instance.id)
      setStatus(`${instance.name} is installed on Minecraft ${instance.minecraftVersion}. Home → Play uses it when it is selected.`)
    } catch (err) {
      setError(readableError(err, "Install failed."))
    } finally {
      setBusy(false)
    }
  }

  async function removePack(id: string) {
    if (!window.confirm("Remove this pack and its instance folder?")) return
    setBusy(true)
    setError(null)
    try {
      const registry = await window.aetherion!.instances.remove(id)
      setInstalled(registry.instances || [])
      setSelectedId(registry.selectedId || "aetherion")
      setStatus("Pack removed. The Aetherion instance was left in place.")
    } catch (err) {
      setError(readableError(err, "Could not remove the pack."))
    } finally {
      setBusy(false)
    }
  }

  async function removeMod(filename: string) {
    if (selectedId === "aetherion") return
    setBusy(true)
    setError(null)
    try {
      setMods(await window.aetherion!.instances.removeMod(selectedId, filename))
    } catch (err) {
      setError(readableError(err, "Could not remove that mod."))
    } finally {
      setBusy(false)
    }
  }

  const selected = installed.find((pack) => pack.id === selectedId) || null

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Packs install into their own folder. They do not change the 1.21.1 Aetherion instance, and Play does not join the realm while one is selected.
        </p>
        <form
          className="flex max-w-xl gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void search()
          }}
        >
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Modrinth modpacks"
            aria-label="Search Modrinth modpacks"
            className="h-10 bg-input/40"
          />
          <Button type="submit" disabled={busy}>
            Search
          </Button>
        </form>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <p className="text-sm text-muted-foreground">{status}</p>
      </section>

      {projects.length > 0 ? (
        <section className="grid gap-3 md:grid-cols-2">
          {projects.map((project) => (
            <button
              key={project.projectId || project.slug}
              type="button"
              onClick={() => void openProject(project)}
              className="rounded-2xl border border-white/10 bg-white/3 px-4 py-3 text-left transition hover:border-primary/40"
            >
              <p className="font-medium text-foreground">{project.title}</p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{project.description}</p>
              <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-primary/80">
                {(project.loaders || []).join(" · ") || "modpack"} · {(project.minecraftVersions || []).slice(0, 3).join(", ")}
              </p>
            </button>
          ))}
        </section>
      ) : null}

      {activeProject && versions.length > 0 ? (
        <section className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-muted-foreground">
            {activeProject.title}
            <select
              aria-label="Pack version"
              value={versionId}
              onChange={(event) => setVersionId(event.target.value)}
              className="mt-2 block h-10 min-w-[240px] rounded-lg border border-white/10 bg-background px-3 text-sm text-foreground"
            >
              {versions.map((version) => (
                <option key={version.id} value={version.id}>
                  {version.versionNumber || version.name} · {(version.gameVersions || []).slice(0, 2).join(", ")} ·{" "}
                  {(version.loaders || []).join(", ")}
                </option>
              ))}
            </select>
          </label>
          <Button type="button" disabled={busy || !versionId} onClick={() => void install()}>
            Install
          </Button>
        </section>
      ) : null}

      <section>
        <p className="aetherion-kicker">Installed</p>
        {installed.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No extra packs yet. The Aetherion 1.21.1 instance stays on the home screen.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {installed.map((pack) => (
              <div key={pack.id} className="rounded-2xl border border-white/10 bg-background/40 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button type="button" className="text-left" onClick={() => setSelectedId(pack.id)}>
                    <p className="font-medium text-foreground">{pack.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Minecraft {pack.minecraftVersion} · {pack.loader.type}
                      {pack.loader.version ? ` ${pack.loader.version}` : ""}
                      {selectedId === pack.id ? " · selected" : ""}
                    </p>
                  </button>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => window.aetherion?.instances.open(pack.id)}>
                      <FolderOpen className="size-3.5" />
                      Folder
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => void removePack(pack.id)}>
                      <Trash2 className="size-3.5" />
                      Remove
                    </Button>
                  </div>
                </div>
                {pack.loader.type !== "fabric" && pack.loader.type !== "vanilla" ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Files are installed. Play currently starts Fabric packs and vanilla versions. This one uses {pack.loader.type}.
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      {selected ? (
        <section>
          <p className="aetherion-kicker">Mods in {selected.name}</p>
          {mods.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No jars in this pack&apos;s mods folder yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {mods.map((mod) => (
                <li key={mod.filename} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-3 py-2">
                  <span className="truncate text-sm text-foreground">
                    {mod.filename}
                    {mod.enabled ? "" : " · off"}
                  </span>
                  <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void removeMod(mod.filename)}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  )
}

function readableError(error: unknown, fallback: string) {
  const raw = error instanceof Error ? error.message : fallback
  return raw.replace(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/, "")
}
