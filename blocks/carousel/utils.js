export function validateDateFormat(date) {
    if (!date) {
        return;
    }
    const dateFormatRegex = new RegExp('^(0?[1-9]|[1-2][0-9]|3[0-1])\/(0?[1-9]|1[0-2])\/([0-9]{4})$');
    if (!dateFormatRegex.test(date)) {
        throw new Error(`Invalid date format: ${date}`);
    }
}

export function validateTimeFormat(time) {
    if (!time) {
        return;
    }
    const timeFormatRegex = new RegExp('^(0?[1-9]|1[0-2]):[0-5][0-9]:[0-5][0-9]\\s(AM|PM)$');
    if (!timeFormatRegex.test(time)) {
        throw new Error(`Invalid time format: ${time}`);
    }
}

export function isGMT(timezone) {
    return timezone && timezone.toLowerCase() === 'gmt';
}

export function parseDateString (dateString, isGMT) {
    const dateParts = dateString.split('/');
    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const year = parseInt(dateParts[2], 10);
    if (isGMT) {
        return new Date(Date.UTC(year, month, day));
    }
    return new Date(year, month, day);
};

export function parseTimeString(timeString, isGMT) {
    const parts = timeString.split(':');
    let hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseInt(parts[2].split(' ')[0], 10);
    const isPM = (timeString.indexOf('PM') > -1);
    if (isPM && hours < 12) {
        hours += 12;
    }
    if (!isPM && hours === 12) {
        hours -= 12;
    }
    const dateObj = new Date();
    if (isGMT) {
        dateObj.setUTCHours(hours);
        dateObj.setUTCMinutes(minutes);
        dateObj.setUTCSeconds(seconds);
    } else {
        dateObj.setHours(hours);
        dateObj.setMinutes(minutes);
        dateObj.setSeconds(seconds);
    }
    return dateObj;
}

export function parseStartDateString(dateString, isGMT) {
    if (!dateString) {
        return new Date();
    }
    return parseDateString(dateString, isGMT);
}

export function parseEndDateString(dateString, isGMT) {
    if (!dateString) {
        const date = new Date();
        date.setFullYear(date.getFullYear() + 10);
        return date;
    }
    return parseDateString(dateString, isGMT);
}

export function parseStartTimeString(timeString, isGMT) {
    if (!timeString) {
        return new Date();
    }
    return parseTimeString(timeString, isGMT);
}

export function parseEndTimeString(timeString, isGMT) {
    if (!timeString) {
        const date = new Date();
        date.setFullYear(date.getFullYear() + 10);
        return date;
    }
    return parseTimeString(timeString, isGMT);
}

export function validateExtensionAndGetMediaType(link) {
    const supportedImageFormats = ['.png', '.jpg', '.jpeg', '.raw', '.tiff'];
    const supportedVideoFormats = ['.mp4', '.wmv', '.avi', '.mpg', '.m4v'];
    let mediaType;
    supportedImageFormats.forEach((format) => {
        if (link.includes(format)) {
            mediaType = 'image';
        }
    });
    supportedVideoFormats.forEach((format) => {
        if (link.includes(format)) {
            mediaType = 'video';
        }
    });
    if (mediaType) {
        return mediaType;
    }
    throw new Error(`Incompatible asset format: ${link}`);
}