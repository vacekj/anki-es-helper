const request = require('request-promise');
const jsonfile = require('jsonfile');
const cheerio = require('cheerio');

const config = {
	input: 'anki_export.json',
	fields: {
		word: 'Word',
		audio: 'Audio',
		definition: 'Definition',
		translation: 'Translation'
	}
};

let inputCollection = jsonfile.readFileSync(config.input);
processInput(inputCollection).then((cards) => {
	
});

async function processInput(input) {
	let result = await Promise.all(
		input.map(async (card) => {
			let data = await getData(card[config.fields.word]);
			return data;
		})
	);
	return result;
}

async function getData(word) {
	let page = await request('http://www.spanishdict.com/translate/' + word);
	let $ = cheerio.load(page.body);
	//
}