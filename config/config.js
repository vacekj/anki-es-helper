module.exports = {
	concurrency: 1, /* How many cards to process at a time */
	delay: 1000, /* How many ms to wait after processing a card */
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