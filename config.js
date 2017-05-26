exports.DATABASE_URL = process.env.DATABASE_URL ||
                       global.DATABASE_URL ||
                      'mongodb://terry:terrypass@ds137749.mlab.com:37749/sds';
exports.TEST_DATABASE_URL = (
	process.env.TEST_DATABASE_URL ||
	'mongodb://localhost/test-SDS-server');
exports.PORT = process.env.PORT || 8080;
