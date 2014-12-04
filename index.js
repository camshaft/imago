/**
 * Module dependencies
 */

var envs = require('envs');
var Transloadit = require('transloadit');
var proxy = require('simple-http-proxy');

function noop() {}

/**
 * Initialize default params
 */

var params = [
  ['width', null, '1-5000', 'Width of the new image, in pixels'],
  ['height', null, '1-5000', 'Height of the new image, in pixels'],
  ['strip', false, 'boolean', 'Strips all metadata from the image. This is useful to keep thumbnails as small as possible.'],
  ['flatten', true, 'boolean', 'Flattens all layers onto the specified background to achieve better results from transparent formats to non-transparent formats, as explained in the ImageMagick documentation.\nNote To preserve animations, GIF files are not flattened when this is set to true. To flatten GIF animations, use the frame parameter.'],
  ['correct_gamma', false, 'boolean', 'Prevents gamma errors common in many image scaling algorithms.'],
  ['quality', 92, '1-100', 'Controls the image compression for JPG and PNG images.'],
  ['background', '#FFFFFF', 'string', 'Either the hexadecimal code or name of the color used to fill the background (only used for the pad resize strategy).'],
  ['resize_strategy', 'fit', 'fit|stretch|pad|crop|fillcrop', 'https://transloadit.com/docs/conversion-robots#resize-strategies'],
  ['zoom', true, 'boolean', 'If this is set to false, smaller images will not be stretched to the desired width and height. For details about the impact of zooming for your preferred resize strategy, see the list of available resize strategies.'],
  ['format', null, 'jpg|png|gif|tiff', 'The available formats are "jpg", "png", "gif", and "tiff".'],
  ['gravity', 'center', 'center|top|bottom|left|right', 'The direction from which the image is to be cropped. The available options are "center", "top", "bottom", "left", and "right". You can also combine options with a hyphen, such as "bottom-right".'],
  ['frame', null, 'integer', 'Use this parameter when dealing with animated GIF files to specify which frame of the GIF is used for the operation. Specify 1 to use the first frame, 2 to use the second, and so on.'],
  ['colorspace', null, 'string', 'Sets the image colorspace. For details about the available values, see the ImageMagick documentation. Please note that if you were using "RGB", we recommend using "sRGB" instead as of 2014-02-04. ImageMagick might try to find the most efficient colorspace based on the color of an image, and default to e.g. "Gray". To force colors, you might then have to use this parameter in combination with type "TrueColor"'],
  ['type', null, 'string', 'Sets the image color type. For details about the available values, see the ImageMagick documentation. If you\'re using colorspace, ImageMagick might try to find the most efficient based on the color of an image, and default to e.g. "Gray". To force colors, could e.g. set this parameter to "TrueColor"'],
  ['sepia', null, 'number', 'Sets the sepia tone in percent. Valid values range from 0 - 99.'],
  ['rotation', true, 'string|boolean|integer', 'Determines whether the image should be rotated. Set this to true to auto-rotate images that are rotated in a wrong way, or depend on EXIF rotation settings. You can also set this to an integer to specify the rotation in degrees. You can also specify "degrees" to rotate only when the image width exceeds the height (or "degrees" if the width must be less than the height). Specify false to disable auto-fixing of images that are rotated in a wrong way.'],
  ['compress', null, 'string', 'Specifies pixel compression for when the image is written. Valid values are None, "BZip", "Fax", "Group4", "JPEG", "JPEG2000", "Lossless", "LZW", "RLE", and "Zip". Compression is disabled by default.'],
  ['blur', null, 'string', 'Specifies gaussian blur, using a value with the form {radius}x{sigma}. The radius value specifies the size of area the operator should look at when spreading pixels, and should typically be either "0" or at least two times the sigma value. The sigma value is an approximation of how many pixels the image is "spread"; think of it as the size of the brush used to blur the image. This number is a floating point value, enabling small values like "0.5" to be used.'],

  ['crop_x1'],
  ['crop_y1'],
  ['crop_x2'],
  ['crop_y2'],

  ['text'],
  ['progressive', true, 'boolean', 'Interlaces the image if set to true, which makes the image load progressively in browsers. Instead of rendering the image from top to bottom, the browser will first show a low-res blurry version of the images which is then quickly replaced with the actual image as the data arrives. This greatly increases the user experience, but comes at a cost of a file size increase by around 10%.'],
  ['transparent', null, 'string', 'Make this color transparent within the image.'],
  ['clip', false, 'mixed', 'Apply the clipping path to other operations in the resize job, if one is present. If set to true, it will automatically take the first clipping path. If set to a string it finds a clipping path by that name.'],
  ['negate', false, 'boolean', 'Replace each pixel with its complementary color, effictively negating the image. Especially useful when testing clipping.'],
  ['density', null, 'string', 'While in-memory quality and file format depth specifies the color resolution, the density of an image is the spatial (space) resolution of the image. That is the density (in pixels per inch) of an image and defines how far apart (or how big) the individual pixels are. It defines the size of the image in real world terms when displayed on devices or printed.\n\nYou can set this value to a specific width or in the format widthxheight.\n\nIf your converted image has a low resolution, please try using the density parameter to resolve that.'],
  ['force_accept', false, 'boolean', 'Robots may accept only certain file types - all other possible input files are ignored. \nThis means the /video/encode robot for example will never touch an image while the /image/resize robot will never look at a video.\nWith the force_accept parameter you can force a robot to accept all files thrown at him, regardless if it would normally accept them.'],
  ['watermark_url', null, 'string', 'A url indicating a PNG image to be overlaid above this image. Please note that you can also supply the watermark via another assembly step.'],
  ['watermark_position', 'center', 'string', 'The position at which the watermark is placed. The available options are "center", "top", "bottom", "left", and "right". You can also combine options, such as "bottom-right".\n\nThis setting puts the watermark in the specified corner. To use a specific pixel offset for the watermark, you will need to add the padding to the image itself.'],
  ['watermark_size', null, 'string', 'The size of the watermark, as a percentage.\nFor example, a value of "50%" means that size of the watermark will be 50% of the size of image on which it is placed.'],
  ['watermark_resize_strategy', 'fit', 'string', 'Available values are "fit" and "stretch".']
];

/**
 * Initialize the imago middleware
 *
 * @param {Object} opts
 * @return {Function}
 */

module.exports = function(opts) {
  opts = opts || {};

  var client = createClient(opts);

  var bucket = opts.s3Bucket || envs('S3_BUCKET');
  var key = opts.s3Key || envs('AWS_ACCESS_KEY_ID');
  var secret = opts.s3Secret || envs('AWS_SECRET_ACCESS_KEY');
  var transformAssembly = opts.onassembly || noop;

  return function processImage(req, res, next) {
    if (req.url === '/') return api(req, res, next);

    var assembly = {
      params: {
        steps: {
          import: {
            robot: '/s3/import',
            key: key,
            secret: secret,
            bucket: bucket,
            path: req.url.split('?')[0].substr(1)
          },
          out: formatOut('import', req.query)
        }
      }
    };

    set(req.query, assembly.params, 'template_id');

    var transformed = (transformAssembly || noop)(assembly, req);

    var end = profile(req, 'transloadit.resize');
    client(transformed || assembly, function(err, result) {
      end({
        error: err && err.message,
        assembly: result && result.assembly_url
      });

      if (err) return next(err);
      var url = result.results.out[0].url;
      req.url = '';

      res.on('header', function() {
        if (res.statusCode !== 200) return;
        res.set('cache-control', 'max-age=31536000, public');
      });

      proxy(url)(req, res, next);
    });
  };
};

function api(req, res, next) {
  res.json({
    params: params.reduce(function(acc, args) {
      var key = args[0];
      acc[key] = {
        type: args[2],
        value: args[1],
        info: args[3]
      };
      return acc;
    }, {})
  });
}

/**
 * Create a transloadit client
 *
 * @param {Object} opts
 * @return {Function}
 */

function createClient(opts) {
  var client = new Transloadit({
    authKey    : opts.transloaditAuthKey || envs('TRANSLOADIT_AUTH_KEY'),
    authSecret : opts.transloaditAuthSecret || envs('TRANSLOADIT_SECRET_KEY')
  });

  function create(assembly, cb) {
    client.createAssembly(assembly, handle.bind(null, cb));
  }

  function poll(url, cb) {
    setTimeout(function() {
      client._remoteJson({
        url: url
      }, handle.bind(null, cb));
    }, 500);
  }

  function handle(cb, err, result) {
    if (err) return cb(err);
    if (result.error) return cb(new Error(result.message));
    if (result.ok !== 'ASSEMBLY_COMPLETED') return poll(result.assembly_url, cb);
    cb(err, result);
  }

  return create;
}

/**
 * Profile a transloadit request
 *
 * @param {Request} req
 * @param {String} str
 * @param {Object} opts
 * @return {Function}
 */

function profile(req, str, opts) {
  var metric = req.metric;
  if (!metric) return noop;
  var profile = metric.profile;
  if (!profile) return noop;
  return req.metric.profile(str, opts);
}

/**
 * Format the out params
 *
 * @param {String} use
 * @param {Object} query
 * @return {Object}
 */

function formatOut(use, query) {
  var assembly = {
    robot: '/image/resize',
    use: use
  };

  var s = set.bind(null, query, assembly);

  params.forEach(function(args) {
    s.apply(null, args);
  });

  return assembly;
}

/**
 * Set a value on the assembly
 *
 * @param {Object} query
 * @param {Object} assembly
 * @param {String} key
 * @param {Any} defaultValue
 * @param {Function?} transform
 */

function set(query, assembly, key, defaultValue) {
  var val = query[key];
  if (typeof val !== 'undefined') assembly[key] = val;
  else if (defaultValue !== null) assembly[key] = defaultValue;

  if (assembly[key] !== null) assembly[key] = deepParse(assembly[key]);
}

/**
 * Deep parse an object
 */

function deepParse(val) {
  if (typeof val !== 'object') return parse(val);
  if (Array.isArray(val)) return val.map(deepParse);
  return Object.keys(val).reduce(function(acc, key) {
    acc[key] = deepParse(val[key])
    return acc;
  }, {});
}

/**
 * Parse a query value
 *
 * @param {String} val
 * @return {String|Boolean|Number}
 */

function parse(val) {
  if (val === 'true') return true;
  if (val === 'false') return false;
  var num = parseInt(val);
  if (!isNaN(num)) return num;
  return val;
}
