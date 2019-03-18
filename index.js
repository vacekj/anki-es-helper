const request = require('request-promise');
const jsonfile = require('jsonfile');
const cheerio = require('cheerio');
const fs = require('fs');
const pMap = require('p-map');
const chalk = require('chalk');
const _cliProgress = require('cli-progress');

// Config file
const config = require('./config/config.js');

// create a new progress bar instance and use shades_classic theme
const bar1 = new _cliProgress.Bar({}, _cliProgress.Presets.shades_classic);

const writeStream = fs.createWriteStream(config.outputFile);

main();

async function main() {
	setupDirStructure();
	let inputCollection = jsonfile.readFileSync(config.input);
	let cleanedInput = cleanInput(inputCollection);
	bar1.start(cleanedInput.length, 0);
	let output = await processInput(cleanedInput);
	writeOutput(output);
	console.log(chalk.green('Success!'));
}

function setupDirStructure() {
}

function cleanInput(input) {
	let deUndefinedArray = input.filter((card) => {
		return card.Word != undefined;
	});
	let deDupedArray = removeDuplicates(deUndefinedArray, config.fields.word);
	return deDupedArray;
}

let cardsProcessed = 0;

async function processInput(input) {
	const mapper = async (card, index) => {
		try {
			let data = await getData(card);
			let modifiedCard = card;
			Object.assign(modifiedCard, data);

			await new Promise(resolve => setTimeout(resolve, config.delay));

			let line = `${modifiedCard.Word}\t${modifiedCard.Definition}\t${modifiedCard.Translation}\t${modifiedCard.Example}\t${modifiedCard.Example___}\t${modifiedCard.Audio}\t\t\n`;
			writeStream.write(line);

			console.clear();
			console.log(`Card processed: ${chalk.yellow(card[config.fields.word])} \n`);
			bar1.update(cardsProcessed++);
		} catch (error) {
			throw error;
		}
	};
	try {
		let result = await pMap(input, mapper, { concurrency: config.concurrency });
		return result;
	} catch (error) {
		throw error;
	}

}

async function getData(card) {
	var word = card[config.fields.word];
	try {
		var spanishDictPage = await request('http://www.spanishdict.com/translate/' + word);
	} catch (error) {
		throw error;
	}
	var $ = cheerio.load(spanishDictPage);

	// word not found
	if ($('.dictionary-entry').length == 0) {
		return {
			Definition: "notfound"
		};
	}

	// definition (English translation)
	const definitionSelector = '#quickdef1-es > a';
	let definition = $(definitionSelector).text();

	// translation
	try {
		var translation = await translate(definition);
	} catch (error) {
		throw error;
	}

	// format example
	let originalExample = card[config.fields.example];
	let example = originalExample.replaceAll('<b>', '').replaceAll('</b>', '').replaceAll('<br>', '');

	// generate example___
	let example___ = example.replaceAll(word, '___');

	return {
		Definition: definition,
		Translation: translation,
		Example: example,
		Example___: example___
	};
}

async function writeOutput(output) {
	writeStream.end();
}


/**
 * Translates word from english to czech
 *
 * @param {*} word
 */
async function translate(word) {
	try {
		let babLaPage = await request('https://en.bab.la/dictionary/english-czech/' + word.replaceAll(" ", "-"));
		let $ = cheerio.load(babLaPage);
		let quickResultEntries = $("div.quick-result-entry");
		let correctQuickResultEntry = quickResultEntries.filter((index, element) => {
			return $("a.babQuickResult", element).text() === word;
		});
		let quickResultOverview = $("ul.sense-group-results > li > a", correctQuickResultEntry[0]);
		let text = quickResultOverview.toArray().reduce((a, li) => a += " " + li.firstChild.data, "");
		return text.trim();
	} catch (error) {
		throw error;
	}
}

String.prototype.replaceAll = function (search, replacement) {
	var target = this;
	return target.replace(new RegExp(search, 'gi'), replacement);
};

function removeDuplicates(myArr, prop) {
	return myArr.filter((obj, pos, arr) => {
		return arr.map(mapObj => mapObj[prop]).indexOf(obj[prop]) === pos;
	});
}