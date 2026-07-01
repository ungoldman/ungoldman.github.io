export default function (eleventyConfig) {
  // served as-is, untouched by templating
  const passthrough = [
    'assets',
    'index.css',
    'particles.js',
    'galaxies.js',
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

  // 404.html must stay at the root for GitHub Pages, so copy it verbatim.
  // other hand-authored pages (particles.html, galaxies.html) are processed as
  // templates -> pretty directory URLs (/particles/, /galaxies/).
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
