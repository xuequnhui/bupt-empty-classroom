const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const sourceDir = path.join(projectRoot, 'frontend', 'dist')
const targetDir = path.join(projectRoot, 'public')

function removeDirectory(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return
  }

  fs.rmSync(directoryPath, { recursive: true, force: true })
}

function copyDirectory(sourcePath, targetPath) {
  fs.mkdirSync(targetPath, { recursive: true })

  const entries = fs.readdirSync(sourcePath, { withFileTypes: true })

  entries.forEach((entry) => {
    const sourceEntryPath = path.join(sourcePath, entry.name)
    const targetEntryPath = path.join(targetPath, entry.name)

    if (entry.isDirectory()) {
      copyDirectory(sourceEntryPath, targetEntryPath)
      return
    }

    fs.copyFileSync(sourceEntryPath, targetEntryPath)
  })
}

if (!fs.existsSync(sourceDir)) {
  throw new Error(`未找到前端构建产物目录: ${sourceDir}`)
}

removeDirectory(targetDir)
copyDirectory(sourceDir, targetDir)
