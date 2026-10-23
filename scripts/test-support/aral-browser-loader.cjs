module.exports = function(source) {
  const done = this.async();
  require("next/dist/build/swc").transform(source, {
    filename: this.resourcePath,
    jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2020", transform: { react: { runtime: "automatic" } } },
    module: { type: "es6" },
  }).then((result) => done(null, result.code), done);
};
