/**
 * @todo
 * - pass answers as args
 */

import prompts from 'prompts'
import path from 'path'
import minimist from 'minimist'
import fsExtra from 'fs-extra'
import fs_, { promises as fs } from 'fs'
import { spawn, execSync, exec } from 'child_process'
import { promisify } from 'util'
import { fileURLToPath } from 'url'
import {
  cyan,
  red,
  green,
} from 'kolorist'

const minNodeVersion = '18.0.0'
const minNpmVersion = '7.0.0'

const execAsync = promisify(exec)

const argv = minimist(process.argv.slice(2), { string: ['_'] })

const defaultProjectName = 'vueform-project'
const packageInfo = pkgFromUserAgent(process.env.npm_config_user_agent)
const packageManager = packageInfo ? packageInfo.name : 'npm'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const start = !!argv.start || !!argv.s
const force = !!argv.force || !!argv.f

const frameworks = [
  { title: 'Vite', value: 'vite', command: {
    npm: 'npm create vite@latest %PROJECT_NAME% -- --template %TEMPLATE%',
    yarn: 'yarn create vite %PROJECT_NAME% --template %TEMPLATE%',
    pnpm: 'pnpm create vite %PROJECT_NAME% --template %TEMPLATE%',
    bun: 'bun create vite %PROJECT_NAME% --template %TEMPLATE%',
  } },
  { title: 'Nuxt', value: 'nuxt', command: {
    npm: 'npx nuxi@latest init %PROJECT_NAME% --packageManager=%PACKAGE_MANAGER%',
    yarn: 'npx nuxi@latest init %PROJECT_NAME% --packageManager=%PACKAGE_MANAGER%',
    pnpm: 'pnpm dlx nuxi@latest init %PROJECT_NAME% --packageManager=%PACKAGE_MANAGER%',
    bun: 'bunx nuxi@latest init %PROJECT_NAME% --packageManager=%PACKAGE_MANAGER%',
  } },
  { title: 'Astro', value: 'astro', command: {
    npm: 'npm create astro@latest %PROJECT_NAME% -- --install=yes',
    yarn: 'yarn create astro %PROJECT_NAME% --install=yes',
    pnpm: 'pnpm create astro %PROJECT_NAME% --install=yes',
    bun: 'bun create astro %PROJECT_NAME% --install=yes',
  } },
  { title: 'Laravel', value: 'laravel', command: '%COMPOSER_PATH% create-project laravel/laravel %PROJECT_NAME%' },
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
    install: ['npm install -D tailwindcss@3 postcss autoprefixer'],
  },
  nuxt: {
    install: ['npm install -D @nuxtjs/tailwindcss@6'],
  },
  astro: {
    install: ['npm install @astrojs/tailwind tailwindcss'],
  },
  laravel: {
    install: ['npm install -D tailwindcss@3 postcss autoprefixer'],
  },
}

process.env.PATH += ':/usr/local/bin'

checkNodeAndNpmVersions()

async function main() {

  try {
    const { projectName } = await prompts({
      type: 'text',
      name: 'projectName',
      initial: defaultProjectName,
      message: 'Choose a project name:',
      validate: async (name) => {
        if (!/^[a-zA-Z0-9]+[a-zA-Z0-9-_]*$/.test(name)) {
          return 'Invalid project name. Use only alphanumeric, underscore, and hyphen characters and do not start with a hyphen or underscore.'
        }
        if (!force && await directoryExists(name)) {
          return `The directory '${name}' already exists.`
        }
        if (!name) {
          return 'Please provide a project name'
        }
        return true
      }
    }, 
    {
      onCancel: () => {
        throw new Error(red('✖') + ' Operation cancelled')
      },
    })

    if (force && await directoryExists(path.join(process.cwd(), projectName))) {
      await runCommand('rm', ['-r', defaultProjectName])
    }

    const response = await prompts([
      {
        type: !!argv.builder || !!argv.b ? null : 'select',
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
        type: prev => !!argv.builder || !!argv.b || prev === 'builder' ? 'text' : null,
        name: 'publicKey',
        initial: argv.publicKey || argv.pk || 'obtain a FREE one at https://app.vueform.com',
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
        type: (prev, { builder }) => !!argv.builder || !!argv.b || builder === 'builder' ? null : 'select',
        name: 'theme',
        message: 'Select a theme for your project:',
        choices: themes
      }
    ], 
    {
      onCancel: () => {
        throw new Error(red('✖') + ' Operation cancelled')
      },
    })

    const { framework, ts, publicKey } = response

    /**
     * Variables
     */
    const isBuilder = !!argv.builder || !!argv.b || response.builder === 'builder'
    const theme = isBuilder ? 'tailwind' : response.theme
    const isAstro = framework === 'astro'
    const isTailwind = ['tailwind', 'tailwind-material'].indexOf(theme) !== -1 || isBuilder
    const isBootstrap = ['bootstrap'].indexOf(theme) !== -1
    const isLaravel = framework === 'laravel'

    if (projectName && framework) {
      const fw = getFramework(framework)

      status(`\nCreating project '${projectName}' using ${fw.title}...`)

      const template = framework === 'vite' ? `vue${ts ? '-ts' : ''}` : ''

      let composerPath = ''

      if (framework === 'laravel') {
        composerPath = await getComposerPath()
      } 

      let command = typeof fw.command === 'string' ? fw.command : fw.command[packageManager]

      command = command
        .replace('%PROJECT_NAME%', projectName)
        .replace('%TEMPLATE%', template)
        .replace('%PACKAGE_MANAGER%', packageManager)
        .replace('%COMPOSER_PATH%', composerPath)
        .split(' ')

      await runCommand(command[0], command.slice(1), `create project with ${fw.title}`)
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

    /**
     * More variables
     */
    const isTs = await isTypescript(process.cwd(), framework, ts)
    const sourcePath = path.join(__dirname, '../', 'templates', isBuilder ? 'builder' : 'vueform', framework, theme, isTs ? 'ts' : 'js')
    const targetPath = process.cwd()

    /**
     * Install base dependencies
     */
    status('\nInstalling dependencies...')
    await runCommand('npm', ['install'], 'install dependencies')


    /**
     * Install Tailwind
     */
    if (isTailwind) {
      status('\nInstalling Tailwind...')
      await Promise.all(tailwind[framework].install.map(async (script) => {
        const command = script.split(' ')
        await runCommand(command[0], command.slice(1), 'install Tailwind CSS')
      }))
    }

    /**
     * Install Bootstrap
     */
    if (isBootstrap) {
      console.log('\nInstalling Bootstrap...')
      await runCommand('npm', ['install', 'bootstrap'], 'install Bootstrap')
    }

    /**
     * Astro updates
     */
    if (isAstro) {
      // Install Vue in Astro
      console.log('\nInstalling Vue...')
      await runCommand('npm', ['install', 'vue', '@astrojs/vue'], 'install Vue in Astro')

      // Extend tsconfig.json
      await updateAstroTsConfig(process.cwd())
    }

    /**
     * Install Vue in Laravel
     */
    if (isLaravel) {
      console.log('\nInstalling Vue...')
      await runCommand('npm', ['install', '@vitejs/plugin-vue'], 'install Vue in Laravel')
    }

    /**
     * Install Vueform package
     */
    const vueformPackage = isBuilder
      ? framework === 'nuxt' ? '@vueform/builder-nuxt' : '@vueform/vueform @vueform/builder'
      : framework === 'nuxt' ? '@vueform/nuxt' : '@vueform/vueform'

    status(`\nInstalling Vueform${isBuilder?' Builder':''}...`)
    await runCommand('npm', ['install', ...vueformPackage.split(' ')], `install ${vueformPackage}`)

    /**
     * Copy Vueform files to project directory
     */
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
    console.log(green(`\n✔ Installation finished`))
    console.log(cyan(`\ncd ${projectName}`))

    if (isLaravel) {
      console.log(cyan(`${packageManager} run build\n`))
      console.log(cyan(`php artisan serve\n`))
    } else {
      console.log(cyan(`${packageManager} run dev\n`))
    }

    /**
     * Run dev server
     */
    if (start) {
      if (isLaravel) {
        await runCommand('npm', ['run', 'build'])
        await runCommand('php', ['artisan', 'serve'])
      } else {
        await runCommand('npm', ['run', 'dev'])
      }
    }
  } catch (cancelled) {
    console.log(red(cancelled.message))
    return
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

function runCommand(command, args, name = '') {
  if (command === 'npm') {
    command = ['npm', 'yarn', 'pnpm', 'bun'].indexOf(packageManager) !== -1 ? packageManager : 'npm'

    if (args[0] === 'install' && args.length > 1) {
      if (['yarn', 'pnpm'].indexOf(packageManager) !== -1) {
        args = [...args]
        args[0] = 'add'
      }
    }
  }

  if (/^win/.test(process.platform)) {
    if (command === 'rm') {
      command = 'rmdir'
      args = [
        '/s',
        '/q',
        ...args.slice(1)
      ]
    }
  }

  return new Promise((resolve, reject) => {
    const childProcess = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
    })

    childProcess.on('close', code => {
      if (code !== 0) {
        reject(new Error(`${command} exited with code ${code}`))
      } else {
        resolve()
      }
    })

    childProcess.on('error', err => {
      reject(new Error(`Failed to ${name ? name : 'start process'}: ${err.message}`))
    })
  })
}

function status (msg) {
  return console.log(cyan(msg))
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
        throw new Error(`Error reading tsconfig.json: ${err.message}`)
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
  } catch (err) {
    throw new Error(`Error updating tsconfig.json: ${err.message}`)
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
        throw new Error(`No vueform.config.js or vueform.config.ts file found: ${err.message}`)
        return
    }
  } catch (err) {
    throw new Error(`Error checking for config files: ${err.message}`)
    return
  }

  try {
    let fileContent = await fsExtra.readFile(filePath, 'utf8')
    
    fileContent = fileContent.replace(/YOUR_PUBLIC_KEY/g, publicKey)
    
    await fsExtra.writeFile(filePath, fileContent, 'utf8')
  } catch (err) {
    throw new Error(`Error inserting Public Key to ${path.basename(filePath)}: ${err.message}`)
  }
}

async function copyFilesToProject(sourceDir, targetDir) {
  try {
    await fsExtra.copy(sourceDir, targetDir, { overwrite: true })
  } catch (err) {
    throw new Error(`Error copying files: ${err.message}`)
  }
}

async function getComposerPath() {
  const paths = [
    '/usr/local/bin/composer',
    '/usr/local/bin/composer.phar',
    '/usr/bin/composer',
    '/usr/bin/composer.phar',
    'C:\\ProgramData\\ComposerSetup\\bin\\composer',
    'C:\\ProgramData\\ComposerSetup\\bin\\composer.phar',
    'C:\\Program Files\\Composer\\composer.phar',
    'C:\\Program Files\\Composer\\composer'
  ]

  let path = 'composer'

  try {
    await execAsync('composer --version')
    return path
  } catch (error) {
    path = ''
  }

  paths.forEach((p) => {
    if (fsExtra.existsSync(p)) {
      path = p
    }
  })

  if (path.endsWith('.phar')) {
    path = `php ${path}`
  }

  if (!path) {
    console.error(red('\nComposer not found. Please ensure Composer is installed and added to your PATH.'))
    console.error(red('Visit https://getcomposer.org/download/ for installation instructions.\n'))
    throw new Error(red('✖') + ' Operation cancelled')
  }

  return path
}

function checkNodeAndNpmVersions() {
  // Get current Node.js version
  const currentNodeVersion = process.version.replace('v', '')

  // Get current npm version
  const currentNpmVersion = execSync('npm -v').toString().trim()

  // Check Node.js version
  if (compareVersions(currentNodeVersion, minNodeVersion) < 0) {
      console.error(`Error: Minimum Node.js version required is ${minNodeVersion}. Your current version is ${currentNodeVersion}. Please upgrade Node.js.`)
      process.exit(1)
  }

  // Check npm version
  if (compareVersions(currentNpmVersion, minNpmVersion) < 0) {
      console.error(`Error: Minimum npm version required is ${minNpmVersion}. Your current version is ${currentNpmVersion}. Please upgrade npm.`)
      process.exit(1)
  }
}

function compareVersions(version1, version2) {
  const parts1 = version1.split('.').map(Number)
  const parts2 = version2.split('.').map(Number)

  for (let i = 0; i < 3; i++) {
    if (parts1[i] !== parts2[i]) {
      return parts1[i] - parts2[i]
    }
  }

  return 0
}

main()
