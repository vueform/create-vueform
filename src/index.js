import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import spawn from 'cross-spawn'
import minimist from 'minimist'
import prompts from 'prompts'
// import process from 'process'
import { exec } from 'child_process'
import {
  blue,
  cyan,
  green,
  lightBlue,
  lightGreen,
  lightRed,
  magenta,
  red,
  reset,
  yellow,
} from 'kolorist'

// Avoids autoconversion to number of the project name by defining that the args
// non associated with an option ( _ ) needs to be parsed as a string. See #4606
const argv = minimist(process.argv.slice(2), { string: ['_'] })
const cwd = process.cwd()

const FRAMEWORKS = [
  {
    title: 'Vite',
    value: 'vite',
    color: magenta,
  },
  {
    title: 'Nuxt',
    value: 'nuxt',
    color: green,
  },
  {
    title: 'Astro',
    value: 'astro',
  },
  {
    title: 'Laravel',
    value: 'laravel',
    color: red,
  },
]

const THEMES = [
  {
    title: 'Vueform',
    value: 'vueform',
  },
  {
    title: 'Tailwind',
    value: 'tailwind'
  },
  {
    title: 'Bootstrap',
    value: 'bootstrap'
  },
  {
    title: 'Material',
    value: 'material'
  },
  {
    title: 'Tailwind Material',
    value: 'tailwind-material'
  },
]

const PACKAGE_MANAGERS = [
  {
    value: 'npm',
  },
  {
    value: 'yarn',
  },
  {
    value: 'pnpm',
  },
  {
    value: 'bun',
  },
]

const FW_INSTALL_COMMANDS = [

]

const renameFiles = {
  _gitignore: '.gitignore',
}

const defaultTargetDir = 'vueform-project'

async function init() {
  const argTargetDir = argv.name || argv.n
  const argFramework = argv.framework || argv.f
  const argTheme = argv.theme || argv.t
  const argPackageManager = argv.packageManager || argv.pm
  let argTs = argv.ts !== undefined ? argv.ts : undefined
  let argBuilder = argv.builder !== undefined
    ? argv.builder
    : argv.b !== undefined
      ? argv.b
      : undefined

  argTs = argTs === 'true'
    ? true
    : argTs === 'false'
      ? false
      : argTs

  argBuilder = argBuilder === 'true'
    ? true
    : argBuilder === 'false'
      ? false
      : argBuilder

  let targetDir = argTargetDir || defaultTargetDir
  const getProjectName = () =>
    targetDir === '.' ? path.basename(path.resolve()) : targetDir

  let result

  let builderState = false

  const pkgInfo = pkgFromUserAgent(process.env.npm_config_user_agent)
  const pkgManager = pkgInfo ? pkgInfo.name : 'npm'
  const isYarn1 = pkgManager === 'yarn' && pkgInfo?.version.startsWith('1.')

  console.log(pkgManager)

  prompts.override({
    overwrite: argv.overwrite,
  })

  if (argFramework === 'laravel' && argTs) {
    console.log(red('✖') + ' Cannot install Laravel with TS')
    process.exit(0)
  }

  if (argBuilder) {
    if (argTheme && argTheme !== 'tailwind') {
      console.log(red('✖') + ' Vueform Builder can only be installed with Tailwind')
      process.exit(0)
    }
  }

  try {
    result = await prompts(
      [
        {
          type: argTargetDir ? null : 'text',
          name: 'projectName',
          message: reset('Project name:'),
          initial: defaultTargetDir,
          onState: (state) => {
            targetDir = formatTargetDir(state.value) || defaultTargetDir
          },
        },
        {
          type: () => !fs.existsSync(targetDir) || isEmpty(targetDir) ? null : 'select',
          name: 'overwrite',
          message: () =>
            (targetDir === '.'
              ? 'Current directory'
              : `Target directory "${targetDir}"`) +
            ` is not empty. Please choose how to proceed:`,
          initial: 0,
          choices: [
            {
              title: 'Remove existing files and continue',
              value: 'yes',
            },
            {
              title: 'Cancel operation',
              value: 'no',
            },
            {
              title: 'Ignore files and continue',
              value: 'ignore',
            },
          ],
        },
        {
          type: (_, { overwrite }) => {
            if (overwrite === 'no') {
              throw new Error(red('✖') + ' Operation cancelled')
            }
            return null
          },
          name: 'overwriteChecker',
        },
        {
          type: () => (isValidPackageName(getProjectName()) ? null : 'text'),
          name: 'packageName',
          message: reset('Package name:'),
          initial: () => toValidPackageName(getProjectName()),
          validate: (dir) =>
            isValidPackageName(dir) || 'Invalid package.json name',
        },
        {
          type: argPackageManager && PACKAGE_MANAGERS.map(f=>f.value).includes(argPackageManager) ? null : 'select',
          name: 'packageManager',
          message: 'Which package manage do you want to use?',
          choices: PACKAGE_MANAGERS,
        },
        {
          type: argBuilder !== undefined ? null : 'select',
          name: 'builder',
          message: 'What do you want to install?',
          onState: (value) => {
            builderState = value.value === 'builder'
          },
          choices: [
            {
              title: 'Vueform only',
              value: 'vueform',
            },
            {
              title: 'Vueform + Builder',
              value: 'builder',
            },
          ]
        },
        {
          type: (prev, { builder }) => {
            const fws = builder === 'builder' ? FRAMEWORKS.filter(f=>['astro'].indexOf(f.value) === -1) : FRAMEWORKS

            return argFramework && fws.map(f=>f.value).includes(argFramework) ? null : 'select'
          },
          name: 'framework',
          message:
            typeof argFramework === 'string' && !FRAMEWORKS.map(f=>f.value).includes(argFramework)
              ? reset(
                  `"${argTemplate}" isn't a valid framework. Please choose from below: `,
                )
              : reset('Select a framework:'),
          initial: 0,
          choices: (prev, { builder }) => {
            const fws = builder === 'builder' ? FRAMEWORKS.filter(f=>['astro'].indexOf(f.value) === -1) : FRAMEWORKS

            return fws.map((framework) => {
              return {
                title: framework.color ? framework.color(framework.title) : framework.title,
                value: framework.value,
              }
            })
          },
        },
        {
          type: (prev) => ['laravel'].indexOf(prev) !== -1 || ['laravel'].indexOf(argFramework) !== -1 || argTs !== undefined ? null : 'toggle',
          name: 'ts',
          message: 'Do you plan to write TypeScript?',
          active: 'yes',
          inactive: 'no'
        },
        {
          type: () => {
            return argTheme && THEMES.map(f=>f.value).includes(argTheme) ? null : 'select'
          },
          name: 'theme',
          message:
            typeof argTheme === 'string' && !THEMES.map(f=>f.value).includes(argTheme)
              ? reset(
                  `"${argTemplate}" isn't a valid theme. Please choose from below: `,
                )
              : reset('Select a theme:'),
          initial: 0,
          choices: THEMES.map((theme) => {
            return {
              title: theme.title,
              value: theme.value,
            }
          }),
        },
      ],
      {
        onCancel: () => {
          throw new Error(red('✖') + ' Operation cancelled')
        },
      },
    )
  } catch (cancelled) {
    console.log(cancelled.message)
    return
  }

  // // user choice associated with prompts
  const { packageName, overwrite } = result

  const framework = argFramework || result.framework
  const packageManager = argPackageManager || result.packageManager
  const theme = argTheme || result.theme || 'tailwind'
  const builder = argBuilder !== undefined ? argBuilder : result.builder
  const ts = argTs !== undefined ? argTs : result.ts

  const root = path.join(cwd, targetDir)

  if (overwrite === 'yes') {
    emptyDir(root)
  } else if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true })
  }

  process.chdir(root)

  const installBaseCommand = `${packageManager} xxx`

  try {
    await run(installBaseCommand)
  } catch (e) {
    console.log(red('✖') + ` Failed to install ${framework}`)
    process.exit(0)
  }

  if (builder === 'builder') {
    
  } else {
    // await run('')
  }

  // // determine template
  // let template = variant || framework?.name || argTemplate
  // let isReactSwc = false
  // if (template.includes('-swc')) {
  //   isReactSwc = true
  //   template = template.replace('-swc', '')
  // }

  // const pkgInfo = pkgFromUserAgent(process.env.npm_config_user_agent)
  // const pkgManager = pkgInfo ? pkgInfo.name : 'npm'
  // const isYarn1 = pkgManager === 'yarn' && pkgInfo?.version.startsWith('1.')

  // const { customCommand } =
  //   FRAMEWORKS.flatMap((f) => f.variants).find((v) => v.name === template) ?? {}

  // if (customCommand) {
  //   const fullCustomCommand = customCommand
  //     .replace(/^npm create /, () => {
  //       // `bun create` uses it's own set of templates,
  //       // the closest alternative is using `bun x` directly on the package
  //       if (pkgManager === 'bun') {
  //         return 'bun x create-'
  //       }
  //       return `${pkgManager} create `
  //     })
  //     // Only Yarn 1.x doesn't support `@version` in the `create` command
  //     .replace('@latest', () => (isYarn1 ? '' : '@latest'))
  //     .replace(/^npm exec/, () => {
  //       // Prefer `pnpm dlx`, `yarn dlx`, or `bun x`
  //       if (pkgManager === 'pnpm') {
  //         return 'pnpm dlx'
  //       }
  //       if (pkgManager === 'yarn' && !isYarn1) {
  //         return 'yarn dlx'
  //       }
  //       if (pkgManager === 'bun') {
  //         return 'bun x'
  //       }
  //       // Use `npm exec` in all other cases,
  //       // including Yarn 1.x and other custom npm clients.
  //       return 'npm exec'
  //     })

  //   const [command, ...args] = fullCustomCommand.split(' ')
  //   // we replace TARGET_DIR here because targetDir may include a space
  //   const replacedArgs = args.map((arg) => arg.replace('TARGET_DIR', targetDir))
  //   const { status } = spawn.sync(command, replacedArgs, {
  //     stdio: 'inherit',
  //   })
  //   process.exit(status ?? 0)
  // }

  // console.log(`\nScaffolding project in ${root}...`)

  // const templateDir = path.resolve(
  //   fileURLToPath(import.meta.url),
  //   '../..',
  //   `template-${template}`,
  // )

  // const write = (file, content) => {
  //   const targetPath = path.join(root, renameFiles[file] ?? file)
  //   if (content) {
  //     fs.writeFileSync(targetPath, content)
  //   } else {
  //     copy(path.join(templateDir, file), targetPath)
  //   }
  // }

  // const files = fs.readdirSync(templateDir)
  // for (const file of files.filter((f) => f !== 'package.json')) {
  //   write(file)
  // }

  // const pkg = JSON.parse(
  //   fs.readFileSync(path.join(templateDir, `package.json`), 'utf-8'),
  // )

  // pkg.name = packageName || getProjectName()

  // write('package.json', JSON.stringify(pkg, null, 2) + '\n')

  // if (isReactSwc) {
  //   setupReactSwc(root, template.endsWith('-ts'))
  // }

  // const cdProjectName = path.relative(cwd, root)
  // console.log(`\nDone. Now run:\n`)
  // if (root !== cwd) {
  //   console.log(
  //     `  cd ${
  //       cdProjectName.includes(' ') ? `"${cdProjectName}"` : cdProjectName
  //     }`,
  //   )
  // }
  // switch (pkgManager) {
  //   case 'yarn':
  //     console.log('  yarn')
  //     console.log('  yarn dev')
  //     break
  //   default:
  //     console.log(`  ${pkgManager} install`)
  //     console.log(`  ${pkgManager} run dev`)
  //     break
  // }
  // console.log()
}

function run(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) return reject(error)
      if (stderr) return reject(stderr)
      resolve(stdout)
    })
  })
}

function formatTargetDir(targetDir) {
  return targetDir?.trim().replace(/\/+$/g, '')
}

function copy(src, dest) {
  const stat = fs.statSync(src)
  if (stat.isDirectory()) {
    copyDir(src, dest)
  } else {
    fs.copyFileSync(src, dest)
  }
}

function isValidPackageName(projectName) {
  return /^(?:@[a-z\d\-*~][a-z\d\-*._~]*\/)?[a-z\d\-~][a-z\d\-._~]*$/.test(
    projectName,
  )
}

function toValidPackageName(projectName) {
  return projectName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/^[._]/, '')
    .replace(/[^a-z\d\-~]+/g, '-')
}

function copyDir(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true })
  for (const file of fs.readdirSync(srcDir)) {
    const srcFile = path.resolve(srcDir, file)
    const destFile = path.resolve(destDir, file)
    copy(srcFile, destFile)
  }
}

function isEmpty(path) {
  const files = fs.readdirSync(path)
  return files.length === 0 || (files.length === 1 && files[0] === '.git')
}

function emptyDir(dir) {
  if (!fs.existsSync(dir)) {
    return
  }
  for (const file of fs.readdirSync(dir)) {
    if (file === '.git') {
      continue
    }
    fs.rmSync(path.resolve(dir, file), { recursive: true, force: true })
  }
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

function setupReactSwc(root, isTs) {
  editFile(path.resolve(root, 'package.json'), (content) => {
    return content.replace(
      /"@vitejs\/plugin-react": ".+?"/,
      `"@vitejs/plugin-react-swc": "^3.5.0"`,
    )
  })
  editFile(
    path.resolve(root, `vite.config.${isTs ? 'ts' : 'js'}`),
    (content) => {
      return content.replace('@vitejs/plugin-react', '@vitejs/plugin-react-swc')
    },
  )
}

function editFile(file, callback) {
  const content = fs.readFileSync(file, 'utf-8')
  fs.writeFileSync(file, callback(content), 'utf-8')
}

init().catch((e) => {
  console.error(e)
})