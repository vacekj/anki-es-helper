const request = require('request-promise');
const jsonfile = require('jsonfile');
const cheerio = require('cheerio');
const fs = require('fs');
const translate = require('google-translate-api');
const del = require('del');
const streamToPromise = require('stream-to-promise');
const pMap = require('p-map');
const chalk = require('chalk');

// Config file
const config = require('./config/config.js');

main();

async function main() {
	setupDirStructure();
	let inputCollection = jsonfile.readFileSync(config.input);
	let cleanedInput = cleanInput(inputCollection);
	let output = await processInput(cleanedInput);
	writeOutput(output);
	console.log(chalk.green('Success!'));
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
		console.log(`Card processed: ${chalk.blue(card[config.fields.word])}`);
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
	let audioFileName = word + '.mp3';
	let audioURL = $(audioSelector).first().attr('href') + '.mp3';
	const audioSelector = 'span.media-links a';
	let writeStream = fs.createWriteStream(`${config.mediaDir}/${audioFileName}`);
	request.get(audioURL).pipe(writeStream);
	await streamToPromise(writeStream);
	writeStream.end();
	let audio = `[sound:${audioFileName}]`;

	// translation
	let translated = await translate(word, { from: 'es', to: 'cs' });
	let translation = translated.text;

	// TODO: detect if example is present, if not, download it
	// format example
	let originalExample = card[config.fields.example];
	let example = originalExample.replaceAll('<b>', '').replaceAll('</b>', '').replaceAll('<br>', '');

	// generate example___
	let regexp = '<u>(.*?)<\/u>';
	let match = example.match(regexp);
	let wordMatch = match[1];
	let example___ = example.replaceAll(wordMatch, '___').replaceAll('<u>', '').replaceAll('</u>', '');

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

String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'gi'), replacement);
};

function removeDuplicates(myArr, prop) {
	return myArr.filter((obj, pos, arr) => {
		return arr.map(mapObj => mapObj[prop]).indexOf(obj[prop]) === pos;
	});
}