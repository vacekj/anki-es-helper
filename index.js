const request = require('request-promise');
const jsonfile = require('jsonfile');
const cheerio = require('cheerio');
const fs = require('fs');
const translate = require('google-translate-api');
const del = require('del');
const streamToPromise = require('stream-to-promise');
const pMap = require('p-map');

const config = {
	concurrency: 5,
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
	get mediaDir() { return this.outputDir + '/media'; },
	get outputFile() { return this.outputDir + '/output.txt'; }
};

main();

async function main() {
	setupDirStructure();
	let inputCollection = jsonfile.readFileSync(config.input);
	let cleanedInput = cleanInput(inputCollection);
	let output = await processInput(cleanedInput);
	writeOutput(output);
}

function setupDirStructure() {
	// delete output directory
	del.sync(config.outputDir + '/');
	// recreate directory structure
	fs.mkdirSync(config.outputDir);
	fs.mkdirSync(config.mediaDir);
}

function cleanInput(input) {
	let deUndefinedArray = input.filter((card) => {
		return card.Word != undefined;
	});
	let deDupedArray = removeDuplicates(deUndefinedArray, config.fields.word);
	return deDupedArray;
}

async function processInput(input) {
	const mapper = async (card) => {
		let data = await getData(card);
		let modifiedCard = card;
		Object.assign(modifiedCard, data);
		return modifiedCard;
	};

	let result = await pMap(input, mapper, { concurrency: config.concurrency });
	return result;
}

async function getData(card) {
	let word = card[config.fields.word];
	let spanishDictPage = await request('http://www.spanishdict.com/translate/' + word);
	let $ = cheerio.load(spanishDictPage);

	// TODO: detect network error, then retry 

	// word not found
	if ($('.dictionary-entry').length == 0) {
		return {
			Definition: "notfound"
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
	writeStream.end();
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

async function writeOutput(output) {
	let stream = fs.createWriteStream(config.outputFile);
	output.forEach(function (card) {
		// one line = one card
		let line = `${card.Word}\t${card.Definition}\t${card.Translation}\t${card.Example}\t${card.Example___}\t${card.Audio}\t\t\n`;
		stream.write(line);
	});
	stream.end();
}

String.prototype.replaceAll = function (target, replacement) {
	return this.split(target).join(replacement);
};

function removeDuplicates(myArr, prop) {
	return myArr.filter((obj, pos, arr) => {
		return arr.map(mapObj => mapObj[prop]).indexOf(obj[prop]) === pos;
	});
}