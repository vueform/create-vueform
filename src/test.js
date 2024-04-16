/**
 * @todo
 * - test different package managers
 * - think about npm < 6
 * - get notified if any framework files change
 */

import { spawn } from 'child_process'
import prompts from 'prompts'
import path from 'path'
import fs_, { promises as fs } from 'fs'
import fsExtra from 'fs-extra'
import { fileURLToPath } from 'url'
import { cyan } from 'kolorist'

const defaultProjectName = 'vueform-project'
const packageInfo = pkgFromUserAgent(process.env.npm_config_user_agent)
const packageManager = packageInfo ? packageInfo.name : 'npm'
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const frameworks = [
  // @todo: remove --overwrite=yes
  { title: 'Vite', value: 'vite', command: 'npm create vite@latest %PROJECT_NAME% -- --template %TEMPLATE% --overwrite=yes' },
  // @todo: remove --gitInit=false
  { title: 'Nuxt', value: 'nuxt', command: 'npx nuxi@latest init %PROJECT_NAME% --packageManager=%PACKAGE_MANAGER% --gitInit=false' },
  { title: 'Astro', value: 'astro', command: 'npm create astro@latest %PROJECT_NAME% -- --install=yes' },
]

const themes = [
  { title: 'Vueform', value: 'vueform' },
  { title: 'Tailwind', value: 'tailwind' },
  { title: 'Bootstrap', value: 'bootstrap' },
  { title: 'Material', value: 'material' },
  { title: 'Tailwind Material', value: 'tailwind-material' },
]

const tailwind = {
  vite: {
    install: ['npm install -D tailwindcss postcss autoprefixer'],
  },
  nuxt: {
    install: ['npm install -D @nuxtjs/tailwindcss'],
  },
  astro: {
    install: ['npx astro add tailwind'],
  }
}

async function main() {
  // @todo: remove
  if (await directoryExists(path.join(process.cwd(), defaultProjectName))) {
    await runCommand('rm', ['-r', defaultProjectName])
  } 

  try {
    const { projectName } = await prompts({
      type: 'text',
      name: 'projectName',
      initial: defaultProjectName,
      message: 'What is your project name?',
      validate: async (name) => {
        if (!/^[a-zA-Z0-9]+[a-zA-Z0-9-_]*$/.test(name)) {
          return 'Invalid project name. Use only alphanumeric, underscore, and hyphen characters and do not start with a hyphen or underscore.'
        }
        // @todo: uncomment
        // if (await directoryExists(name)) {
        //   return `The directory '${name}' already exists.`
        // }
        if (!name) {
          return 'Please provide a project name'
        }
        return true
      }
    })

    const response = await prompts([
      {
        type: 'select',
        name: 'builder',
        message: 'Which libraries do you want to install?',
        choices: [
          {
            title: 'Vueform',
            value: 'vueform',
          },
          {
            title: 'Vueform + Builder',
            value: 'builder',
          },
        ]
      },
      {
        type: 'select',
        name: 'framework',
        message: 'Choose a framework:',
        choices: (prev, { builder }) => frameworks.filter(f => builder !== 'builder' || f.value !== 'astro')
      },
      {
        type: prev => prev === 'vite' ? 'toggle' : null,
        name: 'ts',
        message: 'Do you plan to use TypeScript?',
        initial: 'yes',
        active: 'yes',
        inactive: 'no',
      },
      {
        type: 'select',
        name: 'theme',
        message: 'Select a theme for your project:',
        choices: themes
      }
    ])

    const { framework, ts, builder, theme } = response

    if (projectName && framework) {
      const fw = getFramework(framework)

      console.log(`Creating project '${projectName}' using ${fw.title}...`)

      const template = framework === 'vite' ? `vue${ts ? '-ts' : ''}` : ''

      const command = fw.command
        .replace('%PROJECT_NAME%', projectName)
        .replace('%TEMPLATE%', template)
        .replace('%PACKAGE_MANAGER%', packageManager)
        .split(' ')

      await runCommand(command[0], command.slice(1))
    } else {
      console.error('Project creation canceled.')
      return
    }

    if (!theme) {
      console.error('Project creation canceled.')
      return
    }

    const isTs = ['nuxt'].indexOf(framework) !== -1 || ts
    const isBuilder = builder === 'builder'
    const isTailwind = ['tailwind', 'tailwind-material'].indexOf(theme) !== -1
    const isBootstrap = ['bootstrap'].indexOf(theme) !== -1

    /**
     * Enter project folder
     */
    process.chdir(projectName)
    console.log(`Changed directory to ${projectName}`)

    /**
     * Install base dependencies
     */
    console.log('Running npm install...')
    await runCommand('npm', ['install'])

    /**
     * Install Tailwind
     */
    if (isTailwind) {
      console.log('Installing Tailwind...')
      await Promise.all(tailwind[framework].install.map(async (script) => {
        const command = script.split(' ')
        await runCommand(command[0], command.slice(1))
      }))
    }

    /**
     * Install Bootstrap
     */
    if (isBootstrap) {
      console.log('Installing Bootstrap...')
      await runCommand('npm', ['install', 'bootstrap'])
    }

    /**
     * Install Vueform package
     */
    const vueformPackage = isBuilder
      ? framework === 'nuxt' ? '@vueform/builder-nuxt' : '@vueform/vueform @vueform/builder'
      : framework === 'nuxt' ? '@vueform/nuxt' : '@vueform/vueform'

    console.log(`Installing Vueform${isBuilder?' + Vueform Builder':''}...`)
    await runCommand('npm', ['install', vueformPackage])

    /**
     * Copy Vueform files to project directory
     */
    console.log(`Copying additional files to ${projectName}...`)
    const sourcePath = path.join(__dirname, 'files', builder, framework, theme, isTs ? 'ts' : 'js')
    const targetPath = process.cwd()
    await copyFilesToProject(sourcePath, targetPath)

    console.log('')
    console.log(cyan(`cd ${projectName}`))
    console.log(cyan(`npm run dev`))

    await runCommand('npm', ['run', 'dev'])

  } catch (err) {
    console.error('An error occurred:', err)
    process.exit(1)
  }
}

function getFramework(key) {
  return frameworks.find(f => f.value === key)
}

function pkgFromUserAgent(userAgent) {
  if (!userAgent) return undefined
  const pkgSpec = userAgent.split(' ')[0]
  const pkgSpecArr = pkgSpec.split('/')
  return {
    name: pkgSpecArr[0],
    version: pkgSpecArr[1],
  }
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, { stdio: 'inherit' })

    process.on('close', code => {
      if (code !== 0) {
        reject(new Error(`${command} exited with code ${code}`))
      } else {
        resolve()
      }
    })

    process.on('error', err => {
      reject(new Error(`Failed to start process: ${err.message}`))
    })
  })
}

async function directoryExists(path) {
  try {
    const stats = await fs.stat(path)
    return stats.isDirectory()
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false
    }
    throw error
  }
}

async function copyFilesToProject(sourceDir, targetDir) {
  try {
    await fsExtra.copy(sourceDir, targetDir, { overwrite: true })
    console.log('Files copied successfully.')
  } catch (err) {
    console.error('Error copying files:', err)
  }
}

main()
