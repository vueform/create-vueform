import { defineBuildConfig } from 'unbuild'
import license from 'rollup-plugin-license'

export default defineBuildConfig({
  entries: ['src/index'],
  clean: true,
  rollup: {
    inlineDependencies: true,
    esbuild: {
      target: 'node18',
      minify: true,
    },
  },
  alias: {
    prompts: 'prompts/lib/index.js',
  },
  plugins: [
    license({
      banner: {
        content: `Vueform CLI v<%= pkg.version %> (https://github.com/vueform/create-vueform)\n` + 
                  `Copyright (c) <%= moment().format('YYYY') %> Adam Berecz <adam@vueform.com>\n` + 
                  `Licensed under the MIT License`,
        commentStyle: 'ignored',
      }
    })
  ]
})