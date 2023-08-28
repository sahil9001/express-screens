import {
  parseStartTimeString,
  parseEndTimeString,
  parseStartDateString,
  parseEndDateString,
  validateExtensionAndGetMediaType,
  validateTimeFormat,
  validateDateFormat,
  checkIfGMT,
} from './utils.js';

async function buildCarouselFromSheet(block) {
  const fetchData = async (url) => {
    let result = '';
    try {
      result = fetch(url)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`request to fetch ${url} failed with status code ${response.status}`);
          }
          return response.text();
        });
      return Promise.resolve(result);
    } catch (e) {
      throw new Error(`request to fetch ${url} failed with status code with error ${e}`);
    }
  };

  const extractSheetData = (url) => {
    const sheetDetails = [];
    const columns = document.querySelectorAll('.locations > div');
    if (!columns) {
      console.warn('No carousel data found while extracting sheet data.');
      return sheetDetails;
    }
    for (let i = 0; i < columns.length; i += 1) {
      try {
        const divs = columns[i].getElementsByTagName('div');
        const value = divs[0].textContent;
        const link = divs[1].getElementsByTagName('a')[0].href;
        const linkUrl = new URL(link);
        sheetDetails.push({
          name: value,
          link: url.origin + linkUrl.pathname,
        });
      } catch (err) {
        console.warn(`Exception while processing row ${i}`, err);
      }
    }
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

  const getAssets = async (url) => {
    const sheetDetails = extractSheetData(url) || [];
    console.log(JSON.stringify(sheetDetails));
    if (sheetDetails.length === 0) {
      console.warn('No sheet data available during HTML generation');
    }
    const assets = [];
    let errorFlag = false;
    for (let sheetIndex = 0; sheetIndex < sheetDetails.length; sheetIndex += 1) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const sheetDataResponse = JSON.parse(await fetchData(sheetDetails[sheetIndex].link));
        if (!sheetDataResponse) {
          console.warn(`Invalid sheet Link ${JSON.stringify(sheetDetails[sheetIndex])}.Skipping processing this one.`);
        } else {
          const sheetName = sheetDetails[sheetIndex].name;
          const sheetData = processSheetDataResponse(sheetDataResponse, sheetName);
          for (let row = 0; row < sheetData.length; row += 1) {
            try {
              const assetDetails = sheetData[row];
              const contentType = validateExtensionAndGetMediaType(assetDetails.Link);
              validateTimeFormat(assetDetails['Start Time']);
              validateTimeFormat(assetDetails['End Time']);
              validateDateFormat(assetDetails['Launch Start']);
              validateDateFormat(assetDetails['Launch End']);
              assets.push({
                link: assetDetails.Link,
                startTime: assetDetails['Start Time'],
                endTime: assetDetails['End Time'],
                launchStartDate: assetDetails['Launch Start'],
                launchEndDate: assetDetails['Launch End'],
                duration: assetDetails.Duration,
                type: contentType,
                isGMT: checkIfGMT(assetDetails.Timezone),
              });
            } catch (err) {
              console.warn(`Error while processing asset ${JSON.stringify(sheetData[row])}`, err);
            }
          }
        }
      } catch (err) {
        errorFlag = true;
        console.warn(`Error while processing sheet ${JSON.stringify(sheetDetails[sheetIndex])}`, err);
      }
    }
    if (assets.length === 0 && errorFlag) {
      // Don't create HTML with no assets when there was an error
      console.log('Skipping HTML generation due to assets length zero along with error occurrence');
      return assets;
    }
    return assets;
  };

  const createDivWithClass = (className) => {
    const div = document.createElement('div');
    div.className = className;
    return div;
  };

  const createContainerFromData = (assets) => {
    const carouselTrack = createDivWithClass('carousel-track');
    assets.forEach((asset) => {
      const carouselItem = createDivWithClass('carousel-item');
      carouselItem.setAttribute('start-time', asset.startTime);
      carouselItem.setAttribute('end-time', asset.endTime);
      carouselItem.setAttribute('launch-start-date', asset.launchStartDate);
      carouselItem.setAttribute('launch-end-date', asset.launchEndDate);
      carouselItem.setAttribute('duration', asset.duration);
      carouselItem.setAttribute('type', asset.type);
      if (asset.isGMT) {
        carouselItem.setAttribute('is-gmt', asset.isGMT);
      }
      if (asset.type === 'image') {
        const img = document.createElement('img');
        img.src = asset.link;
        carouselItem.appendChild(img);
      } else if (asset.type === 'video') {
        const video = document.createElement('video');
        video.src = asset.link;
        video.muted = true;
        video.playsInline = true;
        carouselItem.appendChild(video);
      }
      carouselTrack.appendChild(carouselItem);
    });
    return carouselTrack;
  };

  const assets = await getAssets(new URL(document.URL));
  const container = createContainerFromData(assets);
  block.innerHTML = '';
  block.appendChild(container);
}

export default async function decorate(block) {
  await buildCarouselFromSheet(block);
  const carouselTrack = block.querySelector('.carousel-track');
  const carouselItems = carouselTrack.querySelectorAll('.carousel-item');
  const totalItems = carouselItems.length;
  let currentIndex = -1;
  const DEFAULT_ITEM_DURATION = 10 * 1000;

  if (totalItems === 0) {
    return;
  }

  function isActive(itemIndex) {
    const item = carouselItems[itemIndex];
    const isGMT = item.getAttribute('is-gmt');
    const launchStartDate = parseStartDateString(item.getAttribute('launch-start-date'), isGMT);
    const launchEndDate = parseEndDateString(item.getAttribute('launch-end-date'), isGMT);
    const startTime = parseStartTimeString(item.getAttribute('start-time'), isGMT);
    const endTime = parseEndTimeString(item.getAttribute('end-time'), isGMT);
    const now = new Date();
    if (now >= launchStartDate && now <= launchEndDate
      && now >= startTime && now <= endTime) {
      return true;
    }
    return false;
  }

  function showSlide(itemIndex) {
    if (itemIndex < 0 || itemIndex >= totalItems) {
      return;
    }

    const itemWidth = carouselItems[0].offsetWidth;
    const translateX = -itemIndex * itemWidth;
    carouselTrack.style.transform = `translateX(${translateX}px)`;
    currentIndex = itemIndex;
  }

  function nextSlide() {
    const newIndex = (currentIndex + 1) % totalItems;
    if (!isActive(newIndex)) {
      nextSlide();
    }
    showSlide(newIndex);

    const item = carouselItems[newIndex];
    const assetType = item.getAttribute('type');

    switch (assetType) {
      case 'video': {
        const video = item.querySelector('video');
        video.onended = () => {
          nextSlide();
        };
        video.oncanplay = () => {
          video.play();
        };
        video.onerror = () => {
          nextSlide();
        };
        break;
      }
      default:
      {
        const itemDuration = item.getAttribute('duration') || DEFAULT_ITEM_DURATION;
        const img = document.createElement('img');
        img.onerror = () => {
          nextSlide();
        };
        setTimeout(nextSlide, itemDuration);
        break;
      }
    }
  }

  // Start the carousel
  nextSlide();
}
