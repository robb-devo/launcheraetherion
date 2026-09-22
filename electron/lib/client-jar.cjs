const path = require("node:path")

function clientJarRelative(versionId) {
  return `versions/${versionId}/${versionId}.jar`
}

function clientJarArtifact(root, versionId, versionJson) {
  const download = versionJson?.downloads?.client
  const url = String(download?.url || "").trim()
  const sha1 = String(download?.sha1 || "").trim().toLowerCase()
  if (!url || !sha1) {
    throw new Error(`Minecraft ${versionId} is missing the vanilla client jar in the version JSON.`)
  }
  return {
    path: path.join(root, "versions", versionId, `${versionId}.jar`),
    relativePath: clientJarRelative(versionId),
    url,
    sha1,
    size: Number(download.size) || 0,
    label: `${versionId}.jar`,
  }
}

module.exports = {
  clientJarRelative,
  clientJarArtifact,
}
