/*
 * files.ts
 * load templates and styles from disk
 *
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import * as racer from 'racer';
import * as resolve from 'resolve';

import { type AppForServer } from './AppForServer';
import * as parsing from './parsing';

export function loadViewsSync(app: AppForServer, sourceFilename: string, namespace: string) {
  let views = [];
  let files = [];
  const filename = resolve.sync(sourceFilename, {
    extensions: app.viewExtensions,
    packageFilter: deleteMain}
  );
  if (!filename) {
    throw new Error('View template file not found: ' + sourceFilename);
  }

  const file = fs.readFileSync(filename, 'utf8');

  const extension = path.extname(filename);
  const compiler = app.compilers[extension];
  if (!compiler) {
    throw new Error('Unable to find compiler for: ' + extension);
  }

  function onImport(attrs) {
    const dir = path.dirname(filename);
    const importFilename = resolve.sync(attrs.src, {
      basedir: dir,
      extensions: app.viewExtensions,
      packageFilter: deleteMain
    });
    const importNamespace = parsing.getImportNamespace(namespace, attrs, importFilename);
    const imported = loadViewsSync(app, importFilename, importNamespace);
    views = views.concat(imported.views);
    files = files.concat(imported.files);
  }

  const htmlFile = compiler(file, filename) as string;
  const parsedViews = parsing.parseViews(htmlFile, namespace, filename, onImport);
  return {
    views: views.concat(parsedViews),
    files: files.concat(filename)
  };
}

export interface StyleCompilerOptions extends Record<string, unknown> {
  compress?: boolean;
}

export function loadStylesSync(app: AppForServer, sourceFilename: string, options?: StyleCompilerOptions) {
  if (options == null) {
    options = { compress: racer.util.isProduction };
  }
  const resolved = resolve.sync(sourceFilename, {
    extensions: app.styleExtensions,
    packageFilter: deleteMain}
  );
  if (!resolved) {
    throw new Error('Style file not found: ' + sourceFilename);
  }
  const extension = path.extname(resolved);
  const compiler = app.compilers[extension];
  if (!compiler) {
    throw new Error('Unable to find compiler for: ' + extension);
  }
  const file = fs.readFileSync(resolved, 'utf8');
  return compiler(file, resolved, options);
}

// Resolve will use a main path from a package.json if found. Main is the
// entry point for javascript in a module, so this will mistakenly cause us to
// load the JS file instead of a view or style file in some cases. This package
// filter deletes the main property so that the normal file name lookup happens
function deleteMain() {
  return {};
}
