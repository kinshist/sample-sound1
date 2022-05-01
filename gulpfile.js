// const name = 'noguchi'
// const name = 'hoshide'

const config = {
  serverPrefix: '',
  startPath: '/',
  cssMinify: true,
  jsMinify: true,
}


const baseDir = './public/'

const srcDir = './src/'
const destDir = './public/'

const srcPath = {
  html: srcDir+'html/**/*.html',
  pug: [srcDir+'views/**/*.pug', '!'+srcDir+'views/**/_*.pug'],
  // scss: [srcDir+'styles/**/*.scss', '!'+srcDir+'styles/**/_*.scss'],
  // pug: [srcDir+'views/**/*.pug'],
  scss: [srcDir+'styles/**/*.scss'],
  js: srcDir+'scripts/**/*.js',
  img: [srcDir+'images/**/*.jpg', srcDir+'images/**/*.gif', srcDir+'images/**/*.png', srcDir+'images/**/*.svg'],
  webp: [srcDir+'images/**/*.jpg',srcDir+'images/**/*.png'],
}

const destPath = {
  html: destDir,
  css: destDir+'assets/css',
  js: destDir+'assets/js',
  img: destDir+'assets/images',
}

const watchPath = {
  html: srcDir+'**/*.html',
  pug: srcDir+'views/**/*',
  css: srcDir+'styles/**/*',
  js: srcDir+'scripts/**/*',
  img: srcDir+'images/**/*',
  webp: srcDir+'images/**/*.jpg',
  reload: [
    srcDir+'**/*.html',
    srcDir+'**/*.pug',
    srcDir+'**/_*.pug',
    srcDir+'**/*.scss',
    srcDir+'**/_*.scss',
    srcDir+'**/*.js',
    srcDir+'**/*.jpg',
    srcDir+'**/*.gif',
    srcDir+'**/*.png',
    srcDir+'**/*.svg',
  ]
}

// import
// --------------------------------------------------
const { src, dest, lastRun, parallel, watch } = require('gulp')

const plumber = require('gulp-plumber')
const notify = require('gulp-notify')
const replace = require('gulp-replace')
const header = require('gulp-header')
const gulpIf = require('gulp-if')
const rename = require('gulp-rename')

const pug = require('gulp-pug-3')
const browserify = require('browserify');

const sass = require('gulp-sass')
const sassGlob = require('gulp-sass-glob')
const autoPrefixer = require('gulp-autoprefixer')
const cleanCSS = require('gulp-clean-css')

const babel = require('gulp-babel')
const uglify = require('gulp-uglify')

const imagemin = require('gulp-imagemin')
const jpegRecompress = require('imagemin-jpeg-recompress')
const gifsicle = require('imagemin-gifsicle')
const pngquant = require('imagemin-pngquant')

const gulpWebp = require('gulp-webp')

const browserSync = require('browser-sync')
const fs = require('fs')

// task
// --------------------------------------------------

// copyHtml
const copyHtml = () => {
  return src(srcPath.html, { since: lastRun(scss) })
    .pipe(dest(destPath.html))
}

// html
const html = () => {
  return src(srcPath.pug, { since: lastRun(pug) })
    .pipe(plumber({ errorHandler: notify.onError('HTML Error!! <%= error.message %>') }))
    .pipe(pug({
      basedir: srcDir,
      pretty: true,
    }))
    .pipe(dest(destPath.html))
}

// scss
const scss = () => {
  return src(srcPath.scss)
    .pipe(plumber({ errorHandler: notify.onError('CSS Error!! <%= error.message %>') }))
    .pipe(sassGlob())
    .pipe(sass())
    .pipe(autoPrefixer({
      cascade: false,
      gird: true,
    }))
    .pipe(replace(/@charset "UTF-8";/g,''))
    .pipe(header('@charset "UTF-8";\n\n'))
    .pipe(gulpIf(config.cssMinify,cleanCSS()))
    .pipe(dest(destPath.css))
}

// js
const js = () => {
  return src(srcPath.js, { since: lastRun(js) })
    .pipe(plumber({ errorHandler: notify.onError('JavaScript Error!! <%= error.message %>') }))
    .pipe(babel({
      presets: ['@babel/preset-env'],
    }))
    .pipe(gulpIf(config.jsMinify,uglify({})))
    .pipe(dest(destPath.js))
}

const bundle = () => {return browserify(dest(destPath.js)).bundle();}

// img
const img = () => {
  return src(srcPath.img, { since: lastRun(img) })
    .pipe(
      imagemin([
        jpegRecompress({
          loops: 4,
          min: 70,
          max: 85,
          quality: 'medium',
        }),
        gifsicle({
          interlaced: false,
          optimizationLevel: 3,
          colors: 180,
        }),
        pngquant(),
        imagemin.svgo({
          plugins: [
            {
              removeViewBox: false,
            },
          ],
        }),
      ])
    )
    .pipe(dest(destPath.img))
}

const imgAll = () => {
  return src(srcPath.img)
    .pipe(
      imagemin([
        jpegRecompress({
          loops: 4,
          min: 70,
          max: 85,
          quality: 'medium',
        }),
        gifsicle({
          interlaced: false,
          optimizationLevel: 3,
          colors: 180,
        }),
        pngquant(),
        imagemin.svgo({
          plugins: [
            {
              removeViewBox: false,
            },
          ],
        }),
      ])
    )
    .pipe(dest(destPath.img))
}

// webp
const webp = () => {
  return src(srcPath.webp, { since: lastRun(webp) })
    .pipe(rename((path) => {
      path.basename += path.extname
    }))
    .pipe(gulpWebp())
    .pipe(dest(destPath.img))
}
const webpAll = () => {
  return src(srcPath.webp)
    .pipe(rename((path) => {
      path.basename += path.extname
    }))
    .pipe(gulpWebp())
    .pipe(dest(destPath.img))
}

// --------------------------------------------------

const bs = (done) => {
  browserSync.init({
    server: {
      baseDir: baseDir,
      directory: false,
    },
    ghostMode: false,
    open: 'external',
    browser: '/Applications/Google Chrome.app',
    notify: false,
    logPrefix: config.serverPrefix,
    startPath: config.startPath
  });
  done()
}

const reload = (done) => {
  browserSync.reload()
  done()
}

// --------------------------------------------------

exports.copyHtml = copyHtml
exports.html = html
exports.scss = scss
exports.js = js
exports.bundle = bundle
exports.img = img
exports.bs = bs
exports.webpAll = webpAll
exports.webp = webp
exports.imgAll = imgAll

exports.default = parallel([copyHtml, html, scss, js, img, bs], () => {
  watch(watchPath.html, copyHtml)
  watch(watchPath.pug, html)
  watch(watchPath.css, scss)
  watch(watchPath.js, js)
  watch(watchPath.img, img)
  watch(watchPath.reload, reload)
})
