/* eslint-disable no-await-in-loop */
import { outputFile, ensureDir } from 'fs-extra';
import p from 'path';
import { load } from 'cheerio';
import FetchUtils from '@aem-screens/screens-offlineresources-generator/src/utils/fetchUtils.js';

const getFranklinMarkup = async (host, path) => {
  const resp = await FetchUtils.fetchDataWithMethod(host, path, 'GET');
  return resp.text();
};

const extractSheetData = async (host, path) => {
  // Get default franklin markup for path
  const franklinMarkup = await getFranklinMarkup(host, path);
  const $ = load(franklinMarkup);
  const sheetDetails = [];
  const columns = $('.locations > div');
  if (!columns.length) {
    console.warn('No carousel data found while extracting sheet data.');
    return sheetDetails;
  }

  columns.each((i, column) => {
    try {
      const divs = $(column).find('div');
      const value = divs.eq(0).text();
      const link = divs.eq(1).find('a').attr('href');
      sheetDetails.push({
        name: value,
        link,
      });
    } catch (err) {
      console.warn(`Exception while processing row ${i}`, err);
    }
  });

  return sheetDetails;
};

const processSheetDataResponse = (sheetDataResponse, sheetName) => {
  if (sheetDataResponse[':type'] === 'multi-sheet') {
    return sheetDataResponse[sheetName].data;
  } if (sheetDataResponse[':type'] === 'sheet') {
    return sheetDataResponse.data;
  }
  throw new Error(`Invalid sheet type: ${sheetDataResponse[':type']}`);
};

const getAssets = async (host, path) => {
  const sheetDetails = await extractSheetData(host, path) || [];
  if (sheetDetails.length === 0) {
    console.warn('No sheet data available during HTML generation');
  }
  const assets = [];
  for (let sheetIndex = 0; sheetIndex < sheetDetails.length; sheetIndex += 1) {
    try {
      assets.push(sheetDetails[sheetIndex].link);
      const resp = await FetchUtils.fetchDataWithMethod(host, sheetDetails[sheetIndex].link, 'GET');
      const sheetDataResponse = await resp.json();
      if (!sheetDataResponse) {
        console.warn(`Invalid sheet Link ${JSON.stringify(sheetDetails[sheetIndex])}. Skipping processing this one.`);
      } else {
        const sheetName = sheetDetails[sheetIndex].name;
        const sheetData = processSheetDataResponse(sheetDataResponse, sheetName);
        for (let row = 0; row < sheetData.length; row += 1) {
          try {
            const assetDetails = sheetData[row];
            assets.push(new URL(assetDetails.Link).pathname);
          } catch (err) {
            console.warn(`Error while processing asset ${JSON.stringify(sheetData[row])}`, err);
          }
        }
      }
    } catch (err) {
      console.warn(`Error while processing sheet ${JSON.stringify(sheetDetails[sheetIndex])}`, err);
    }
  }
  return assets;
};

export default class HtmlGenerator {
  static generateHTML = async (host, path) => {
    console.log(`running carousel from sheet generator for ${path}`);
    const additionalAssets = [];
    try {
      // Get assets from sheet
      const assets = await getAssets(host, path);
      additionalAssets.push(...assets);

      additionalAssets.push('/blocks/carousel/carousel.js');
      additionalAssets.push('/blocks/carousel/utils.js');
      additionalAssets.push('/blocks/carousel/carousel.css');

      // Get default franklin markup for path
      const franklinMarkup = await getFranklinMarkup(host, path);
      const $ = load(franklinMarkup);
      await ensureDir(p.dirname(path));
      await outputFile(`${path}.html`, $.html());
    } catch (error) {
      console.error(error);
    }
    return additionalAssets;
  };
}
