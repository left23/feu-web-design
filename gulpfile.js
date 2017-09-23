'use strict';

// ===================================================
// Load Gulp plugins
// ===================================================


var importOnce    = require('node-sass-import-once'),
    notify        = require('gulp-notify'),
    twig          = require('gulp-twig'),
    fs            = require('fs'),
    glob          = require('glob'),
    path          = require('path'),
    data          = require('gulp-data'),
    plumber       = require('gulp-plumber'),
    rename        = require('gulp-rename'),
    concat        = require('gulp-concat'),
    uglify        = require('gulp-uglify'),
    gulp          = require('gulp'),
    $             = require('gulp-load-plugins')(),
    browserSync   = require('browser-sync').create(),
    del           = require('del'),
    sass          = require('gulp-sass'),
    postcss       = require('gulp-postcss'),
    foreach       = require('gulp-foreach'),
    autoprefixer  = require('autoprefixer'),
    cssmin        = require('gulp-cssmin'),
    mqpacker      = require('css-mqpacker');

var options = {};

options.theme = {
  root       : __dirname,
  components : __dirname + '/components/',
  data       : __dirname + '/data/',
  templates  : __dirname + '/templates/',
  images     : __dirname + '/images/',
  build      : __dirname + '/dist/',
  css        : __dirname + '/dist/assets/css/',
  js         : __dirname + '/dist/assets/js/',
  icons      : __dirname + '/dist/assets/images/'
};


// Define the node-sass configuration. The includePaths is critical!
options.sass = {
  importer: importOnce,
  includePaths: [
    options.theme.components
  ],
  outputStyle: 'expanded'
};

var sassFiles = [
  options.theme.components + '**/*.scss',
  // Do not open Sass partials as they will be included as needed.
  '!' + options.theme.components + '**/_*.scss'
];

var jsFiles = [
  options.theme.components + '**/*.js',
  // Do not open minified JS files as they should not be included.
  '!' + options.theme.components + '**/*.min.js'
];

var sassProcessors = [
  autoprefixer({browsers: ['> 1%', 'last 2 versions']}),
  mqpacker({sort: true})
];

// #################
//
// Compile Twig templates to HTML
//
// #################

function getJsonData (file, cb) {
  glob(options.theme.data + '*.json', {}, function(err, files) {
    var data = {};
    if (files.length) {
      files.forEach(function(fPath){
        var baseName = path.basename(fPath, '.json');
        data[baseName] = JSON.parse(fs.readFileSync(fPath));
      });
    }
    cb(undefined, data);
  });
}


gulp.task('twig', function(){
  return gulp.src(options.theme.templates + 'urls/**/*')
    .pipe(plumber({
      errorHandler: function (error) {
        console.log(error.message);
        this.emit('end');
      }}))
    .pipe(data(getJsonData))
    .pipe(foreach(function(stream,file){
      return stream
        .pipe(twig())
    }))
    .pipe(gulp.dest(options.theme.build))
    .pipe(browserSync.reload({stream:true}));
});

gulp.task('twig-watch', ['twig'], browserSync.reload);


// #################
//
// Compile the Sass
//
// #################
//
// This task will look for all scss files and run postcss and rucksack.
// For performance review we will display the file sizes
// Then the files will be stored in the assets folder
// At the end we check if we should inject new styles in the browser
// ===================================================

gulp.task('styles', ['clean:styles'], function () {
  return gulp.src(sassFiles)
    .pipe($.sass(options.sass).on('error', sass.logError))
    .pipe(plumber({
      errorHandler: function (error) {
        console.log(error.message);
        this.emit('end');
      }}))
    .pipe($.rucksack() )
    .pipe($.rename({dirname: ''}))
    .pipe($.size({showFiles: true}))
    .pipe(gulp.dest(options.theme.css))
    .pipe($.cssmin())
    .pipe($.concat('all.min.css'))
    .pipe($.postcss(sassProcessors) )
    .pipe(gulp.dest(options.theme.css))
    .pipe(browserSync.reload({stream:true}))
});



// #################
//
// Minify JS
//
// #################
//
// First clean the JS folder, then search all components for js files.
// Also search in the libraries folder for specific files.
// Then compress the files, give them an explicit .min filename and
// save them to the assets folder.
// ===================================================

gulp.task('js', ['clean:js'], function () {
  return gulp.src(jsFiles)
    .pipe(plumber({
      errorHandler: function (error) {
        console.log(error.message);
        this.emit('end');
      }}))
    .pipe($.concat('all.min.js'))
    .pipe($.uglify())
    .pipe(gulp.dest(options.theme.js));
});

gulp.task('js-watch',['js', 'js-process'],browserSync.reload);

gulp.task('js-process', function () {
  return gulp.src(options.theme.components + '**/*.min.js')
    .pipe(rename({dirname: ''}))
    .pipe(gulp.dest(options.theme.js))
});


// #################
//
// Sprite icons
//
// #################
//
// svgmin minifies our SVG files and strips out unnecessary
// code that you might inherit from your graphics editor.
// svgstore binds them together in one giant SVG container called
// icons.svg. Then cheerio gives us the ability to interact with
// the DOM components in this file in a jQuery-like way. cheerio
// in this case is removing any fill attributes from the SVG
// elements (you’ll want to use CSS to manipulate them)
// and adds a class of .hide to our parent SVG. It gets
// deposited into our inc directory with the rest of the HTML partials.
// ===================================================

var svgmin        = require('gulp-svgmin'),
    svgstore      = require('gulp-svgstore'),
    cheerio       = require('gulp-cheerio');

gulp.task('sprite-icons', function () {
  return gulp.src(options.theme.components + '**/*.svg')
    .pipe(svgmin())
    .pipe(svgstore({inlineSvg: true}))
    .pipe($.rename('icons.svg') )
    .pipe(cheerio({
      run: function ($, file) {
        $('svg').addClass('hidden');
      },
      parserOptions: { xmlMode: true }
    }))
    .pipe(gulp.dest(options.theme.icons))
});


// #################
//
// Image icons
//
// #################
//
// Besides the sprite we sometimes still need the individual svg files
// to load as a css background image. This task optimises and copies
// the icons to the assets folder.
// ===================================================

gulp.task('image-icons', function () {
  return gulp.src(options.theme.components + '**/*.svg')
    .pipe(svgmin())
    .pipe(rename({dirname: ''}))
    .pipe(gulp.dest(options.theme.icons + 'icons/'))
});


gulp.task('icons-watch', ['sprite-icons', 'image-icons'], browserSync.reload);


gulp.task('images', ['clean:images'], function () {
  return gulp.src(options.theme.images + '**/*')
    .pipe(gulp.dest(options.theme.build + 'assets/images/'));
});


gulp.task('font', function () {
  return gulp.src([options.theme.components + '**/*.woff2', options.theme.components + '**/*.woff'])
    .pipe(rename({dirname: ''}))
    .pipe(gulp.dest(options.theme.build + 'assets/font/'));
});




// ##############################
//
// Watch for changes and rebuild.
//
// ##############################

gulp.task('browser-sync', function () {

  browserSync.init({
    server: {
      baseDir: 'dist/'
    },
    open: false

  });

});

gulp.task('watch', ['build', 'browser-sync'],function(){
  gulp.watch(options.theme.components + '**/*.scss', ['styles']);
  gulp.watch(options.theme.components + '**/*.js', ['js-watch']);
  gulp.watch(options.theme.images + '**/*', ['images']);
  gulp.watch([options.theme.templates + '**/*', options.theme.data + '/*.json'],['twig-watch']);
});

// ######################
//
// Clean all directories.
//
// ######################

// Clean CSS files.
gulp.task('clean:styles', function () {
  return del([
    options.theme.build + '**/*.css',
    options.theme.build + '**/*.map'
  ], {force: true});
});

// Clean JS files.
gulp.task('clean:js', function () {
  return del([
    options.theme.build + '**/*.js'
  ], {force: true});
});

// Clean Template files.
gulp.task('clean:templates', function () {
  return del([
    options.theme.build + '**/*.html'
  ], {force: true});
});

// Clean images files.
gulp.task('clean:images', function () {
  return del([
    options.theme.build + 'assets/images/**/*'
  ], {force: true});
});


// ##################
//
// Build once
//
// ##################

// Before deploying create a fresh build
gulp.task('build', ['styles', 'js', 'js-process', 'twig', 'images']);
