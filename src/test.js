/**
 * @todo
 * - test different package managers
 * - think about npm < 6
 * - get notified if any framework files change
 * - exit properly anytime
 */

import { spawn } from 'child_process'
import prompts from 'prompts'
import path from 'path'
import fs_, { promises as fs } from 'fs'
import fsExtra from 'fs-extra'
import { fileURLToPath } from 'url'
import { cyan } from 'kolorist'
import minimist from 'minimist'

// Avoids autoconversion to number of the project name by defining that the args
// non associated with an option ( _ ) needs to be parsed as a string. See #4606
const argv = minimist(process.argv.slice(2), { string: ['_'] })

const defaultProjectName = 'vueform-project'
const packageInfo = pkgFromUserAgent(process.env.npm_config_user_agent)
const packageManager = packageInfo ? packageInfo.name : 'npm'
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const frameworks = [
  // @todo: remove --overwrite=yes
  { title: 'Vite', value: 'vite', command: 'npm create vite@latest %PROJECT_NAME% -- --template %TEMPLATE% --overwrite=yes' },
  // @todo: remove --gitInit=false
  { title: 'Nuxt', value: 'nuxt', command: 'npx nuxi@latest init %PROJECT_NAME% --packageManager=%PACKAGE_MANAGER% --gitInit=false' },
  // @todo: remove --template=basics
  { title: 'Astro', value: 'astro', command: 'npm create astro@latest %PROJECT_NAME% -- --install=yes --template=basics' },
  { title: 'Laravel', value: 'laravel', command: 'php /usr/local/bin/composer.phar create-project laravel/laravel %PROJECT_NAME%' },
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
    install: ['npm install @astrojs/tailwind tailwindcss'],
  },
  laravel: {
    install: ['npm install -D tailwindcss postcss autoprefixer'],
  },
}

process.env.PATH += ':/usr/local/bin'

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
        type: prev => prev === 'builder' ? 'text' : null,
        name: 'publicKey',
        initial: argv.publicKey || 'obtain a FREE one at https://app.vueform.com',
        message: 'Your Public Key: ',
        validate: async (name) => {
          if (!/^[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}$/.test(name)) {
            return 'Invalid Public Key. Please go to https://app.vueform.com and generate one for FREE.'
          }
          if (!name) {
            return 'Please provide your Public Key. If you don\'t have one go to https://app.vueform.com and generate one for FREE.'
          }
          return true
        }
      },
      {
        type: 'select',
        name: 'framework',
        message: 'Choose a framework:',
        choices: frameworks,
      },
      {
        type: prev => prev !== 'vite' || prev === 'laravel' ? null : 'toggle',
        name: 'ts',
        message: 'Do you plan to use TypeScript?',
        initial: 'yes',
        active: 'yes',
        inactive: 'no',
      },
      {
        type: (prev, { builder }) => builder === 'builder' ? null : 'select',
        name: 'theme',
        message: 'Select a theme for your project:',
        choices: themes
      }
    ])

    const { framework, ts, builder, publicKey } = response

    const theme = builder === 'builder' ? 'tailwind' : response.theme

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
     * Variables
     */
    const isAstro = framework === 'astro'
    const isTs = await isTypescript(process.cwd(), framework, ts)
    const isBuilder = builder === 'builder'
    const isTailwind = ['tailwind', 'tailwind-material'].indexOf(theme) !== -1 || isBuilder
    const isBootstrap = ['bootstrap'].indexOf(theme) !== -1
    const isLaravel = framework === 'laravel'
    const sourcePath = path.join(__dirname, 'files', builder, framework, theme, isTs ? 'ts' : 'js')
    const targetPath = process.cwd()

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
     * Astro updates
     */
    if (isAstro) {
      // Install Vue in Astro
      console.log('Installing Vue...')
      await runCommand('npm', ['install', 'vue', '@astrojs/vue'])

      // Extend tsconfig.json
      await updateAstroTsConfig(process.cwd())
    }

    /**
     * Install Vue in Laravel
     */
    if (isLaravel) {
      console.log('Installing Vue...')
      await runCommand('npm', ['install', '@vitejs/plugin-vue'])
    }

    /**
     * Install Vueform package
     */
    const vueformPackage = isBuilder
      ? framework === 'nuxt' ? '@vueform/builder-nuxt' : '@vueform/vueform @vueform/builder'
      : framework === 'nuxt' ? '@vueform/nuxt' : '@vueform/vueform'

    console.log(`Installing Vueform${isBuilder?' + Vueform Builder':''}...`)
    await runCommand('npm', ['install', ...vueformPackage.split(' ')])

    /**
     * Copy Vueform files to project directory
     */
    console.log(`Copying additional files to ${projectName}...`)
    await copyFilesToProject(sourcePath, targetPath)

    /**
     * Inserting Public Key
     */
    if (isBuilder) {
      await addPublicKey(process.cwd(), publicKey)
    }

    /**
     * Show finish instructions
     */
    console.log('')
    console.log(cyan(`cd ${projectName}`))
    console.log(cyan(`npm run dev`))

    /**
     * Run dev server
     * @todo: remove
     */
    if (isLaravel) {
      await runCommand('npm', ['run', 'build'])
      await runCommand('php', ['artisan', 'serve'])
    } else {
      await runCommand('npm', ['run', 'dev'])
    }


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
    const process = spawn(command, args, { stdio: 'inherit', shell: true })

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

async function isTypescript(dir, framework, ts) {
  switch (framework) {
    case 'nuxt':
      return true
      break

    case 'astro':
      const tsConfigPath = path.join(dir, 'tsconfig.json')
      
      try {
        const tsConfig = await fsExtra.readJson(tsConfigPath)

        return tsConfig.extends !== 'astro/tsconfigs/base'
      } catch (err) {
        console.error('Error reading tsconfig.json:', err)
      }
      break

    case 'laravel':
      return false
      break

    default:
      return ts
  }
}

async function updateAstroTsConfig(dir) {
  const tsConfigPath = path.join(dir, 'tsconfig.json')

  try {
    const tsConfig = await fsExtra.readJson(tsConfigPath)

    tsConfig.compilerOptions = {
      'jsx': 'preserve'
    }

    await fsExtra.writeJson(tsConfigPath, tsConfig, { spaces: 2 })
    console.log('tsconfig.json has been updated')
  } catch (err) {
    console.error('Error updating tsconfig.json:', err)
  }
}

async function addPublicKey(dir, publicKey) {
  const jsFilePath = path.join(dir, 'vueform.config.js')
  const tsFilePath = path.join(dir, 'vueform.config.ts')

  let filePath
  try {
    if (await fsExtra.pathExists(jsFilePath)) {
        filePath = jsFilePath
    } else if (await fsExtra.pathExists(tsFilePath)) {
        filePath = tsFilePath
    } else {
        console.error('No vueform.config.js or vueform.config.ts file found.')
        return
    }
  } catch (err) {
    console.error('Error checking for config files:', err)
    return
  }

  try {
    let fileContent = await fsExtra.readFile(filePath, 'utf8')
    
    fileContent = fileContent.replace(/YOUR_PUBLIC_KEY/g, publicKey)
    
    await fsExtra.writeFile(filePath, fileContent, 'utf8')
    console.log(`Public Key has been inserted into ${path.basename(filePath)}`)
  } catch (err) {
    console.error(`Error inserting Public Key to ${path.basename(filePath)}:`, err)
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
