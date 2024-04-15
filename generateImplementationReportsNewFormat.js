"use strict";

const { QualWeb, generateEARLReport } = require("@qualweb/core");
const fs = require("fs");
const fetch = require("node-fetch");

(async () => {
  const qualweb = new QualWeb();

  // qualweb core option
  const launchOptions = {};

  // act tests options
  const testCasesJsonUrl =
    "https://www.w3.org/WAI/content-assets/wcag-act-rules/testcases.json";

  function removeRuleId(data) {
    return Object.values(data)[0];
  }

  function writeJSONFile(file, data) {
    return new Promise((resolve, reject) => {
      fs.writeFile(file, JSON.stringify(data, null, 2), (err) => {
        if (err) {
          console.log("Cannot write file ", file);
          reject(err);
        } else resolve();
      });
    });
  }

  async function loadTestCases() {
    const results = await fetch(testCasesJsonUrl);
    const data = await results.json();
    return data.testcases;
  }

  function getRuleIds(tests) {
    const ids = [];
    for (const test of tests) {
      if (ids.indexOf(test.ruleId) === -1) {
        ids.push(test.ruleId);
      }
    }
    return ids;
  }

  function getTestUrls(rule, tests) {
    const urls = [];
    const testsForRule = tests.filter((test) => test.ruleId === rule);
    for (const test of testsForRule) {
      urls.push(test.url);
    }
    return urls;
  }

  function buildEvaluationOptions(urls, ruleId) {
    const options = {
      urls: urls,
      execute: {
        act: true,
      },
      "act-rules": {
        rules: [ruleId],
      },
      maxParallelEvaluations: urls.length,
    };
    return options;
  }

  function buildFileName() {
    const today = new Date().toISOString().split("T")[0];
    const name = "qualweb-" + today + ".json";
    return name;
  }

  function buildEarlOptions(rule) {
    const options = {
      aggregated: true,
      aggregatedName: rule,
      modules: {
        act: true,
        html: false,
        css: false,
        "best-practices": false,
      },
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
    }
    return false;
  }

  function addRuleToReport(fullReport, partialReport) {
    const cleanReport = removeRuleId(partialReport);
    if (fullReport === null) {
      fullReport = cleanReport;
    } else {
      const partialGraph = cleanReport["@graph"];
      for (const partialTest of partialGraph) {
        fullReport["@graph"].push(partialTest);
      }
    }
    return fullReport;
  }

  // start
  console.log("Remember to update qualweb core to the latest version!");

  const testCases = await loadTestCases();
  if (!testCases) {
    console.log("No test cases");
    return;
  }

  await qualweb.start(launchOptions);

  const ruleIds = getRuleIds(testCases);
  const totalRules = ruleIds.length;
  let index = 0;
  let completeReport = null;
  for (const ruleId of ruleIds) {
    index++;
    console.log(
      "Running tests for rule",
      ruleId,
      "(",
      index,
      "/",
      totalRules,
      ")"
    );

    const testUrls = getTestUrls(ruleId, testCases);
    const evaluationOptions = buildEvaluationOptions(testUrls, ruleId);
    let report = await qualweb.evaluate(evaluationOptions);

    const earlOptions = buildEarlOptions(ruleId);
    const earlReport = await generateEARLReport(report, earlOptions);

    if (isImplemented(earlReport)) {
      completeReport = addRuleToReport(completeReport, earlReport);
    } else {
      console.log("Rule", ruleId, "is not implemented");
    }
  }
  const fileName = buildFileName();
  await writeJSONFile(fileName, completeReport);
  await qualweb.stop();
})();
