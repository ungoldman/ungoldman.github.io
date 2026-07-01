export default function (eleventyConfig) {
  const passthrough = [
    'assets',
    'index.css',
    'particles/particles.js',
    'particles/particles-card.png',
    'galaxies/galaxies.js',
    'galaxies/galaxies-card.png',
    'favicon.svg',
    'CNAME',
    'cat.jpg',
    'pizza.jpg',
    'resume.pdf',
    'resume',
    'tmp',
    '404.html'
  ]
  for (const path of passthrough) eleventyConfig.addPassthroughCopy(path)

  // 404.html stays at root for GitHub Pages
  eleventyConfig.ignores.add('404.html')
  eleventyConfig.ignores.add('resume/**')
  eleventyConfig.ignores.add('README.md')

  return {
    dir: {
      input: '.',
      includes: '_includes',
      output: '_site'
    }
  }
}
