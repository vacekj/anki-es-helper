module.exports = {
	concurrency: 3, /* How many cards to process at a time */
	delay: 300, /* How many ms to wait after processing a card */
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