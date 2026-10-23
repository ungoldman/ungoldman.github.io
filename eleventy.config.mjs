export default function (eleventyConfig) {
  const passthrough = [
    'assets',
    'index.css',
    'particles/particles.js',
    'particles/particles-card.png',
    'galaxies/galaxies.js',
    'galaxies/galaxies-card.png',
    'router.js',
    'router',
    'favicon.svg',
    'CNAME',
    'cat.jpg',
    'pizza.jpg',
    'resume.pdf',
    'resume',
    'tmp'
  ]
  for (const path of passthrough) eleventyConfig.addPassthroughCopy(path)

  eleventyConfig.ignores.add('resume/**')
  eleventyConfig.ignores.add('README.md')
  eleventyConfig.ignores.add('AGENTS.md')

  return {
    dir: {
      input: '.',
      includes: '_includes',
      output: '_site'
    }
  }
}
