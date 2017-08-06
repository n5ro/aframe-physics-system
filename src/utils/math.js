module.exports.slerp = function ( a, b, t ) {
  if ( t <= 0 ) return a;
  if ( t >= 1 ) return b;

  var x = a[0], y = a[1], z = a[2], w = a[3];

  // http://www.euclideanspace.com/maths/algebra/realNormedAlgebra/quaternions/slerp/

  var cosHalfTheta = w * b[3] + x * b[0] + y * b[1] + z * b[2];

  if ( cosHalfTheta < 0 ) {

    a = a.slice();

    a[3] = - b[3];
    a[0] = - b[0];
    a[1] = - b[1];
    a[2] = - b[2];

    cosHalfTheta = - cosHalfTheta;

  } else {

    return b;

  }

  if ( cosHalfTheta >= 1.0 ) {

    a[3] = w;
    a[0] = x;
    a[1] = y;
    a[2] = z;

    return this;

  }

  var sinHalfTheta = Math.sqrt( 1.0 - cosHalfTheta * cosHalfTheta );

  if ( Math.abs( sinHalfTheta ) < 0.001 ) {

    a[3] = 0.5 * ( w + a[3] );
    a[0] = 0.5 * ( x + a[0] );
    a[1] = 0.5 * ( y + a[1] );
    a[2] = 0.5 * ( z + a[2] );

    return this;

  }

  var halfTheta = Math.atan2( sinHalfTheta, cosHalfTheta );
  var ratioA = Math.sin( ( 1 - t ) * halfTheta ) / sinHalfTheta;
  var ratioB = Math.sin( t * halfTheta ) / sinHalfTheta;

  a[3] = ( w * ratioA + a[3] * ratioB );
  a[0] = ( x * ratioA + a[0] * ratioB );
  a[1] = ( y * ratioA + a[1] * ratioB );
  a[2] = ( z * ratioA + a[2] * ratioB );

  return a;

};
