#!/usr/bin/env node
'use strict';
import * as ebnf from './index';
import * as path from 'path';
import * as fs from 'fs';
import * as util from 'util';
const grammarBNF        = ebnf.Grammars.BNF;
const grammarW3C        = ebnf.Grammars.W3C;
const grammarCustom     = ebnf.Grammars.Custom;

function dump(rules: ebnf.IRule[], isTSMode: boolean, exportSymbol: string, original: string, originalFile: string) : string {
  const prefix  = mktxt(
    `//---------------------------------------------------------------------------------
             // AUTO GENERATED CODE USING ebnf NPM MODULE ${new Date().toISOString()} (modified)
             //---------------------------------------------------------------------------------`, true);

  for (let item of rules) {
    if (typeof item.pinned === 'boolean') {
      delete item.pinned;
    }
  }

  const result = util.inspect(rules, {depth: 20, maxArrayLength: null});
  const base    = ``;
  const js = mktxt(isTSMode ?
    // TypeScript
    `import {IRule} from 'ebnf';
                 export const ${exportSymbol} : IRule[] = ` :
    // Plain JS
    `module.exports = {};
                 module.exports.${exportSymbol} = `
    , true) + result + ';';
  let srcSource = '// (omitted original source) ...\n';
  if(originalFile && original) {
    srcSource = mktxt(
      `// -------------------------------------------------
                 // source: ${originalFile}
                 // -------------------------------------------------`, true) +
      original.split(/\n\r?/).map(i => '// ' + i).join('\n') +
      "\n// -------------------------------------------------\n";
  }
  const postifx = `/* done */\n`;
  return `${prefix}\n${base}\n${js}\n${srcSource}\n${postifx}\n`;
}

function mktxt(text: string, allownl?: boolean) {
  let out = text.trim().split('\n').map(t => t.trim()).join(allownl ? "\n" : ' ');
  return allownl ? out + '\n' : out;
}

function mkLog(level: string, ignore?: boolean) {
  if (ignore) {
    // @ts-ignore
    return (...args: any[]) => {};
  } else {
    return console.log.bind(console, `[${level.padEnd(10)}] %s`);
  }
}

const ArgumentParser      = require('argparse').ArgumentParser;

const parser = new ArgumentParser({
  version: '1.0.0',
  addHelp: true,
  description: mktxt(`
        Generates pre-computed EBNF parser. It is based on the ebnf's npm module's own executable
        with the primary difference that it can also write a typescript compatible file.
    `)
});

parser.addArgument(
  '--grammar',
  {
    help: mktxt(`
            Which grammar to use to parse the EBNF input. Don't ask me... By default the 'custom' parser
            is used. I don't know the reason or, to be honest, the difference. :)
        `),
    choices: ['bnf', 'w3c-ebnf', 'custom']
  }
);

parser.addArgument(
  '--logs',
  {
    help: mktxt(`
            Report debug
        `),
    choices: ['debug', 'verbose', 'd', 'v']
  }
);

parser.addArgument(
  '--export',
  {
    help: mktxt(`
            The exported javascript variable. Must, obviously, be a valid identifier.
        `),
    defaultValue: 'rules',
  }
);

parser.addArgument(
  '--embed-source',
  {
    help: mktxt(`
            Save the EBNF input in the file.
        `),
    action: 'storeTrue'
  }
);

parser.addArgument(
  [ 'input' ],
  {
    help: mktxt(`
            EBNF parser input file.
        `)
  }
);

parser.addArgument(
  [ 'output' ],
  {
    help: mktxt(`
            The location of the output of Javascript or Typescript source code.
            The extension of the file determines whether it is typescript or plain
            javascript.
        `)
  }
);

const args = parser.parseArgs();

const userVerbose       = !!(args.logs && args.logs.startsWith('v'));
const userDebug         = !!(args.logs && args.logs.startsWith('d')) || userVerbose;
const logError          = mkLog('ERROR');
const logInfo           = mkLog('INFO');
const logDebug          = mkLog('DEBUG', userDebug);
const logVerbose        = mkLog('VERBOSE', userVerbose);

logVerbose("loading modules");

const inputFile     = path.resolve(process.cwd(), args.input);
const outputFile    = path.resolve(process.cwd(), args.output);
const Grammar       = (args.grammar === 'custom' || !args.grammar) ? grammarCustom :
                        (args.grammar === 'bnf') ? grammarBNF :
                          (args.grammar === 'w3c-ebnf') ? grammarW3C :
                            null;
const ExportSymbol  = args.export;
const incSource     = args.embed_source;
const ext           = path.extname(outputFile);
const outputType    = (ext === '.js' || ext === '.mjs') ? 'js' :
                        (ext === '.ts' || ext === '.tsx') ? 'ts' :
                          null;

if (!Grammar) {
  logError(`Unable to identify grammar: ${args.grammar}`);
  process.exit(-3);
}

if (!ExportSymbol) {
  logError(`Export symbol is not defined.`);
  process.exit(-3);
}

if (! /[\w\d_]+/.test(ExportSymbol)) {
  logError(`Export symbol, '${ExportSymbol}', is not a valid-ish identifier. (Restricted to letters, digits and underscore.)`);
  process.exit(-3);
}

if (!outputType) {
  logError(`File extension ${ext} is not a valid javascript/typescript file. ${outputType}`);
  process.exit(-3);
}

logInfo(`Configuring...`);
logInfo("");
logInfo (`Input:            ${inputFile}`);
logInfo (`Output:           ${outputFile}`);
logInfo (`Export:           ${args.export}`);
logInfo (`Parser:           ${args.grammar || 'default'}`);
logInfo (`Embed EBNF src:   ${incSource ? 'Yes' : 'No'}`);
logInfo("");

logInfo(`Reading '${inputFile}'...`);
let sourceBNF = null;
try {
  sourceBNF         = fs.readFileSync(inputFile).toString() + '\n';
} catch (e) {
  logError(`Unable to read EBNF rules from '${inputFile}'.`);
  process.exit(-3);
}

logDebug('Parsing rules...');
const rules         = Grammar.getRules(sourceBNF);

logDebug('Preparing script...');
const script        = dump(rules,
                            (outputType === 'ts'),
                            ExportSymbol,
                            (incSource    ? sourceBNF    : undefined),
                            (incSource    ? inputFile    : undefined));

logInfo(`Saving to '${outputFile}'...`);
try {
  fs.writeFileSync(outputFile, script);
} catch (e) {
  logError(`Unable to save EBNF rules to ${outputFile}.`);
  process.exit(-3);
}

logInfo(`Finished processing. Success.`);
