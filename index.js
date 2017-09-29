const request = require('request-promise');
const jsonfile = require('jsonfile');
const cheerio = require('cheerio');
const fs = require('fs');
const translate = require('google-translate-api');
const del = require('del');
const streamToPromise = require('stream-to-promise');

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
	outputDir: './output',
	get mediaDir() { return this.outputDir + '/media' }
};

main();

function main() {
	setupDirStructure();
	let inputCollection = jsonfile.readFileSync(config.input);
	let cleanedInput = cleanInput(inputCollection);
	processInput(cleanedInput).then((cards) => {
		console.log(cards);
	});
}

function setupDirStructure() {
	// delete output directory
	del.sync(config.outputDir + '/');
	// recreate directory structure
	fs.mkdirSync(config.outputDir);
	fs.mkdirSync(config.mediaDir);
}

function cleanInput(input) {
	return input.filter((card) => {
		return card.Word != undefined;
	});
}

async function processInput(input) {
	let result = await Promise.all(
		input.map(async (card) => {
			let data = await getData(card);
			let modifiedCard = card;
			Object.assign(modifiedCard, data);
			return modifiedCard;
		})
	);
	return result;
}

async function getData(card) {
	let word = card[config.fields.word];
	let spanishDictPage = await request('http://www.spanishdict.com/translate/' + word);
	let $ = cheerio.load(spanishDictPage);

	// word not found
	if ($('.dictionary-entry').length == 0) {
		return {
			definition: "notfound"
		};
	}	

	// definition (English translation)
	const definitionSelector = 'body > div.content-container.container > div.main-container > div.translate > div:nth-child(1) > div.quickdef > div.lang > div';
	let definition = $(definitionSelector).text();

	// audio
	const audioSelector = 'span.media-links a';
	let audioURL = $(audioSelector).first().attr('href') + '.mp3';
	let audioFileName = word + '.mp3';
	let writeStream = fs.createWriteStream(`${config.mediaDir}/${audioFileName}`);
	request.get(audioURL).pipe(writeStream);
	await streamToPromise(writeStream);
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
		Definition: definition,
		Audio: audio,
		Translation: translation,
		Example: example,
		Example___: example___
	};
}

String.prototype.replaceAll = function (target, replacement) {
	return this.split(target).join(replacement);
};