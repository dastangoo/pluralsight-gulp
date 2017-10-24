var gulp = require('gulp');
var args = require('yargs').argv;
var browserSync = require('browser-sync');
var del = require('del');
var config = require('./gulp.config')();
var $ = require('gulp-load-plugins')({lazy: true});
var path = require('path');
var _ = require('lodash');
var port = process.env.PORT || config.defaultPort;

gulp.task('help', $.taskListing);
gulp.task('default', ['help']);
// gulp.task('help', function () {
// 	$.taskListing();
// });
gulp.task('vet', function() {
		log('Analyzing source with JSHint and JSCS');

		return gulp
			.src(config.alljs)
			.pipe($.if(args.verbose, $.print()))
			.pipe($.jscs())
			.pipe($.jshint())
			.pipe($.jshint.reporter('jshint-stylish', {verbose: true}))
			.pipe($.jshint.reporter('fail'));
});

gulp.task('styles', ['clean-styles'], function() {
  log('Compiling less --> CSS');

  return gulp
    .src(config.less)
		.pipe($.plumber())
    .pipe($.less())
    .pipe($.autoprefixer({browsers: ['last 2 versions', '> 5%']}))
    .pipe(gulp.dest(config.temp));
});
gulp.task('fonts', ['clean-fonts'], function () {
	log('Copying the fonts');
	return gulp
		.src(config.fonts)
		.pipe(gulp.dest(config.build + 'fonts'));
});
gulp.task('images', ['clean-images'], function () {
	log('Copying the compressing images');
	return gulp
		.src(config.images)
		.pipe($.imagemin({optimizationLevel: 4}))
		.pipe(gulp.dest(config.build + 'images'));

});

gulp.task('clean', function() {
	var delconfig = [].concat(config.build, config.temp);
	log('Cleaning: ' + $.util.colors.blue(delconfig));
	del(delconfig);
});
gulp.task('clean-code', function() {
	var files = [].concat(
		config.temp + '**/*.js',
		config.build + '**.*.html',
		config.build + 'js/**.*.js'
	);
	clean(files);
});

gulp.task('clean-fonts', function() {
	clean(config.build + 'fonts/**/*.*');
});
gulp.task('clean-images', function() {
	clean(config.build + 'images/**/*.*');
});
gulp.task('clean-styles', function() {
	clean(config.temp + '**/*.css');
});


 gulp.task('less-watcher', function() {
	gulp.watch([config.less], ['styles']);
});

gulp.task('templatecache', ['clean-code'], function () {
	log('Creating AngularJS $templatecache');

	return gulp
		.src(config.htmltemplates)
		.pipe($.minifyHtml({empty: true}))
		.pipe($.angularTemplatecache(
			config.templateCache.file,
			config.templateCache.options
		))
		.pipe(gulp.dest(config.temp));
});
gulp.task('wiredep', function() {
	log('Wire up the bower css js and our app into the html');
	var options = config.getWiredepDefaultOptions();
	var wiredep = require('wiredep').stream;
	return gulp
		.src(config.index)
		.pipe(wiredep(options))
		.pipe($.inject(gulp.src(config.js)))
		.pipe(gulp.dest(config.client));
});

gulp.task('inject', ['wiredep', 'styles', 'templatecache'], function() {
	log('Wire up the app css into html, and call wiredep');
	return gulp
		.src(config.index)
		.pipe($.inject(gulp.src(config.css)))
		.pipe(gulp.dest(config.client));
});

gulp.task('build', ['optimize', 'images', 'fonts'], function () {
	log('Building everything');

	var msg = {
		title: 'gulp build',
		subtitle: 'Deployed to the build folder',
		message: 'Running `gulp serve-build`'
	};

	del(config.temp);
	log(msg);
	notify(msg);

});
gulp.task('optimize', ['inject', 'test'], function () {
	log('Optimizing the javascrpt, css, html');

	var assets = $.useref({searchPath: './'});
	var templateCache = config.temp + config.templateCache.file;
	var cssFilter = $.filter('**/*.css');
	var jsLibFilter = $.filter('**/' + config.optimized.lib);
	var jsAppFilter = $.filter('**/' + config.optimized.app);

	return gulp
		.src(config.index)
		.pipe($.plumber())
		.pipe($.inject(gulp.src(templateCache, {read: false}), {
			starttag: '<!-- inject:template:js -->'
		}))
		.pipe(assets)
		.pipe(cssFilter)
		.pipe($.csso())
		.pipe(cssFilter.restore)
		.pipe(jsLibFilter)
		.pipe($.uglify())
		.pipe(jsLibFilter.restore)
		.pipe(jsAppFilter)
		.pipe($.ngAnnotate({remove: true}))
		.pipe($.uglify())
		.pipe(jsAppFilter.restore)
		.pipe($.rev())
		.pipe($.useref())
		.pipe($.revReplace())
		.pipe(gulp.dest(config.build))
		.pipe($.rev.manifest())
		.pipe(gulp.dest(config.build));
});

/**
* Bump the versions
* --type=pre will bump the prerelease version *.*.*-x
* --type=patch or no flag will bump the patch version *.*.x
* --type=minor will bump the minor version *.x.*
* --type=major will bump the major version x.*.*
* -version=1.2.3 will bump to a specific version and ignore other flags
**/
gulp.task('bump', function () {
	var msg = 'Bumping versions';
	var type = args.type;
	var version = args.version;
	var options = {};

	if (version) {
		options.version = version;
		msg += ' to ' + version;
	} else {
		options.type = type;
		msg = ' for a ' + type;
	}
	log(msg);
	return gulp
		.src(config.packages)
		.pipe($.print())
		.pipe($.bump(options))
		.pipe(gulp.dest(config.root));
});

gulp.task('serve-build', ['build'], function() {
	serve(false);
} );

gulp.task('serve-dev', ['inject'], function() {
	serve(true);
});

function serve(isDev) {

	var nodeOptions = {
		script: config.nodeServer,
		delayTime: 1,
		env: {
			'PORT': port,
			'NODE_ENV': isDev ? 'dev' : 'build'
		},
		watch: [config.server]
	};
	return $.nodemon(nodeOptions)
		.on('restart', function(ev) {
			log('*** nodemon restarted');
			log('files changed on restart:\n' + ev);
			setTimeout(function () {
				browserSync.notify('reloading now ...');
				browserSync.reload({stream: false});
			}, config.browerReloadDelay);
		})
		.on('start', function() {
			log('*** nodemon started');
			startBrowserSync(isDev);
		})
		.on('crash', function() {
			log('*** nodemon crashed: script crashed for some reason');
		})
		.on('exit', function() {
			log('*** nodemon exited cleanly');
		});
}

gulp.task('test', ['vet', 'templatecache'], function (done) {
	startTest(true /* singleRun */, done);
});

gulp.task('autotest', ['vet', 'templatecache'], function (done) {
	startTest(false /* singleRun */, done);
});
/////////////////
function changeEvent(event) {
	var srcPattern = new RegExp('/.*(?=/' + config.source + ')/');
	log('File ' + event.path.replace(srcPattern, '') + ' ' + event.type);
}

function notify(options) {
		var notifier = require('node-notifier');
		var notifyOptions = {
			sound: 'Bottle',
			contentImage: path.join(__dirname, 'gulp.png'),
			icon: path.join(__dirname, 'gulp.png')
		};
		_.assign(notifyOptions);
		notifier.notify(notifyOptions);
}

function startBrowserSync(isDev) {
	if (args.nosync || browserSync.active) {
		return;
	}
	log('Starting brower-sync on port ' + port);
	if (isDev) {
		gulp.watch([config.less], ['styles'])
			.on('change', function (event) { changeEvent(event); });
	} else {
		gulp.watch([config.less, config.js, config.html], ['optimize', browserSync.reload])
			.on('change', function (event) { changeEvent(event); });
	}

	var options = {
		proxy: 'localhost:' + port,
		port: 3000,
    files: isDev ? [
			config.client + '**/*.*',
			'!' + config.less,
			config.temp + '**/*.css'
		] : [],
    ghostMode: {
        clicks: true,
        location: false,
        forms: true,
        scroll: true
    },
    injectChanges: true,
    logFileChanges: true,
    logLevel: 'debug',
    logPrefix: 'gulp-patterns',
    notify: true,
    reloadDelay: 0 //1000
	};
	browserSync(options);
}

function startTest(singleRun, done) {
	var karma = require('karma').server;
	var excludeFiles = [];
	var serverSpecs = config.serverIntegrationSpecs;

	excludeFiles = serverSpecs;

	karma.start({
		configFile: __dirname + '/karma.config.js',
		exclude: excludeFiles,
		singleRun: !!singleRun
	}, karmaCompleted);

	function karmaCompleted(karmaResult) {
		log('Karma completed');
		if (karmaResult === 1) {
			done('karma: tests failed with code ' + karmaResult);
		} else {
			done();
		}
	}
}
function clean(path) {
	log('Cleaning: ' + $.util.colors.blue(path));
	del(path);
}
function log(msg) {
	if (typeof(msg) === 'object') {
		for (var item in msg) {
			if (msg.hasOwnProperty(item)) {
				$.util.log($.util.colors.blue(msg[item]));
			}
		}
	}	else {
		$.util.log($.util.colors.blue(msg));
	}
}
