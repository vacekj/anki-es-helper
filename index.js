const request = require('request-promise');
const jsonfile = require('jsonfile');
const cheerio = require('cheerio');
const fs = require('fs');
const translate = require('google-translate-api');

const config = {
	input: 'anki_export.json',
	fields: {
		word: 'Word',
		audio: 'Audio',
		definition: 'Definition',
		translation: 'Translation',
		example: 'Example',
		example___: 'Example___'
	},
	mediaFolder: './media'
};

let inputCollection = jsonfile.readFileSync(config.input);
processInput(inputCollection).then((cards) => {
	console.log(cards);
});

function cleanInput(input) {
	return input.filter((card) => {
		return card.Word != undefined;
	});
}

async function processInput(input) {
	let result = await Promise.all(
		input.map(async (card) => {
			let data = await getData(card);
			// Merge the data with the original card
			return data;
		})
	);
	return result;
}

async function getData(card) {
	let word = card[config.fields.word];
	let spanishDictPage = await request('http://www.spanishdict.com/translate/' + word);
	let $ = cheerio.load(spanishDictPage);

	// definition (English translation)
	const definitionSelector = 'body > div.content-container.container > div.main-container > div.translate > div:nth-child(1) > div.quickdef > div.lang > div';
	let definition = $(definitionSelector).text();

	// audio
	const audioSelector = 'body > div.content-container.container > div.main-container > div.translate > div:nth-child(1) > div.quickdef > div.source > span > a.audio-start.js-audio-refresh';
	let audioURL = $(audioSelector).attr('href') + '.mp3';
	let audioFileName = word + '.mp3';
	let writeStream = fs.createWriteStream(`${config.mediaFolder}/${audioFileName}`);
	request.get(audioURL).pipe(writeStream);
	let audio = `[sound:${audioFileName}]`;

	// translation
	let translated = await translate(word, { from: 'es', to: 'cs' });
	let translation = translated.text;

	// format example
	let originalExample = card[config.fields.example];
	let example = originalExample.replaceAll('<b>', '').replaceAll('</b>', '');

	// generate example___
	let example___ = example.replaceAll(word, '   ');

	return {
		definition,
		audio,
		translation,
		example,
		example___
	};
}

String.prototype.replaceAll = function (target, replacement) {
	return this.split(target).join(replacement);
};