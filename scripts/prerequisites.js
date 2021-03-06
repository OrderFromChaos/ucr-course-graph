'use strict';

const _ = require('lodash');
const config = require('config');
const Promise = require('bluebird');
const cheerio = require('cheerio');

const fs = Promise.promisifyAll(require('fs'));
const fileHelper = require('./lib/fileHelper');
const rp = require('./lib/request');


const preReqRegex = /Course or Test: (.+)\s+Minimum Grade of (.{2})\s+(.+)/;
const subjectRegex = /(.+) (\d{1,4}.+)/;


async function getPrerequisites(crn, subjects) {
  try {
    const options = {
      method: 'POST',
      uri: config.get('catalog.urls.prereqs'),
      json: true,
      headers: {
        Referer: 'https://registrationssb.ucr.edu/StudentRegistrationSsb/ssb/classSearch/classSearch',
      },
      form: {
        term: config.get('catalog.term'),
        courseReferenceNumber: crn,
      },
    };

    const prereqHtml = await rp(options);
    // console.log(prereqHtml);

    if(prereqHtml.includes('No prerequisites')) return {};

    const $ = cheerio.load(prereqHtml);
    let reqData = $('pre').toArray();
    reqData = reqData.slice(1, reqData.length - 1)
      .map(i => $(i).text());

    return reqData.join(' ')
  } catch(e) {
    console.error('Failed to get prerequisites for CRN', crn, 'with error:', e);
  }
}

async function getAllPrerequisites(catalog, subjects) {
  return Promise.map(_.values(catalog), async (course) => {
    const reqs = await getPrerequisites(course.courseReferenceNumber, subjects);
    course.prereqs = reqs;
    return course;
  }, { concurrency: 1 });
}

async function main() {
  const subjects = await fileHelper.loadSubjects();
  const catalog = await fileHelper.loadCatalog();

  const prereqCatalog = JSON.stringify(await getAllPrerequisites(catalog, subjects), null, 2);
  await fs.writeFileAsync(fileHelper.getPrereqCatalogPath(), prereqCatalog);
}

if(require.main === module) { // Was run directly
  main();
} else { // Required as module
  module.exports = {
    getPrerequisites,
    getAllPrerequisites,
  };
}
