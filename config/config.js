module.exports = {
	concurrency: 10,
	input: './input/' + 'anki_export.json',
	fields: {
		word: 'Word',
		audio: 'Audio',
		definition: 'Definition',
		translation: 'Translation',
		example: 'Example',
		example___: 'Example___'
	},
	outputDir: './output',
	get mediaDir() { return this.outputDir + '/media'; },
	get outputFile() { return this.outputDir + '/output.txt'; }
};