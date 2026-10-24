// Keep native import here: TypeScript's CommonJS target rewrites import() into require().
exports.create = async function ()
{
	const {MPEGDecoder} = await import('mpg123-decoder');
	const decoder = new MPEGDecoder(); await decoder.ready; return decoder;
};
