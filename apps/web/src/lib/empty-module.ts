/**
 * Stands in for Node built ins that a browser bundle can never use.
 *
 * The Piper runtime ships Emscripten glue that branches on whether it is
 * running under Node and calls require("fs") in that branch. The branch is
 * dead in a browser, but the bundler still has to resolve the specifier, so
 * it is pointed here instead of failing the build.
 */
export default {};
