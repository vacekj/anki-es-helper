module.exports = {
	concurrency: 3,
	input: './input/' + 'anki_export.json',
	fields: {
		word: 'Word',
		definition: 'Definition',
		translation: 'Translation',
		example: 'Example',
		example___: 'Example___'
	},
	outputDir: './output',
	get outputFile() { return this.outputDir + '/output.txt'; }
};