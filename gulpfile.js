var gulp = require('gulp');

// gulp.task('js', ['jscs', 'jshint'], function() {
//   return gulp
//       .src('./src/**/*.js', {base: './src/'})
//       .pipe(concat('all.js'))
//       .pipe(uglify())
//       .pipe(gulp.dst('./build/'));
// })
//
// gulp.task('min2', function() {
//     return gulp
//         .src('./src/**/*.js')
//         .pipe(uglify())
//         .pipe(gulp.dst('./build/'));
// }
// gulp.task('lint-watcher', function() {
//     gulp.watch('./src/**/*.js', [
//         'jshint',
//         'jscs'
//     ]);
// });
// gulp.task('lint-watcher', function() {
//     gulp.watch('./src/**/*.less', function(event) {
//         console.log('watched event ' + event.type +
//                     ' for ' + event.path);
//     })
// });

gulp.task('hello-world', function() {
  console.log('Our first gulp task!');
});
