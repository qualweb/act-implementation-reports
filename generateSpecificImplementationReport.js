'use strict';

const { QualWeb, generateEarlReport } = require('@qualweb/core');
const fs = require('fs');
const request = require('request');

(async () => {

    const qualweb = new QualWeb();

    // qualweb core option
    const launchOptions = {
    };

    // act tests options
    const testCasesJsonUrl = "https://act-rules.github.io/testcases.json";
    const testCasesJsonOptions = { json: true };

    function removeRuleId(data) {
        return Object.values(data)[0];
    }

    function writeJSONFile(file, data) {
        const cleanData = removeRuleId(data);
        return new Promise((resolve, reject) => {
            fs.writeFile(file, JSON.stringify(cleanData, null, 2), (err) => {
                if (err) {
                    console.log("Cannot write file ", file);
                    reject(err);
                }
                else
                    resolve();
            })
        });
    }

    function loadTestCases() {
        return new Promise((resolve, reject) => {
            request(testCasesJsonUrl, testCasesJsonOptions, (err, res, body) => {
                if (err) {
                    console.log("Cannot read test cases from ", testCasesJsonUrl);
                    reject(err);
                }
                if (!err && res.statusCode == 200) {
                    resolve(body.testcases);
                }
            })
        });
    }

    function getTestUrls(rule, tests) {
        return ['https://www.ulisboa.pt/'];
        const urls = [];
        const testsForRule = tests.filter(test => test.ruleId === rule);
        for (const test of testsForRule) {
            urls.push(test.url);
        }
        return urls;
    }

    function buildEvaluationOptions(urls, ruleId) {
        //const rule = "['" + ruleId + "']";
        const options = {
            "urls": urls,
            "execute": {
                act: true
            },
            "act-rules": {
                "rules": [ruleId]
            },
            maxParallelEvaluations: urls.length
        };
        return options;
    }

    function buildFileName(rule) {
        const name = "qualweb-" + rule + ".json";
        return name;
    }

    function buildEarlOptions(rule) {
        const options = {
            "aggregated": true,
            "aggregatedName": rule,
            "modules": {
                "act": true,
                "html": false,
                "css": false,
                "best-practices": false
            }
        };
        return options;
    }

    function isImplemented(report) {
        const tests = Object.values(report)[0]["@graph"];
        let assertions = 0;
        for (const test of tests) {
            assertions += test.assertions.length;
        }
        if (assertions > 0) {
            return true;
        } else
            return false;
    }

    // start
    console.log("Remember to update qualweb core to the latest version!");

    const testCases = await loadTestCases();
    if (!testCases) {
        console.log("No test cases");
        return;
    }

    await qualweb.start(launchOptions);

    const ruleId = 'c6f8a9';
    console.log("Running tests for rule", ruleId);

    const testUrls = getTestUrls(ruleId, testCases);

    const evaluationOptions = buildEvaluationOptions(testUrls, ruleId);
    let report = await qualweb.evaluate(evaluationOptions);

    const fileName = buildFileName(ruleId);
    const earlOptions = buildEarlOptions(ruleId);
    const earlReports = await generateEarlReport(report, earlOptions);

    if (isImplemented(earlReports)) {
        await writeJSONFile(fileName, earlReports);
    } else {
        console.log("Rule", ruleId, "is not implemented");
    }

    await qualweb.stop();
})();